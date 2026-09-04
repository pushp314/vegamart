import type { Request } from "express";
import type { Prisma } from "@prisma/client";
import prisma from "../database/prisma";
import { env } from "../config";

import { AUDIT_ACTIONS } from "../constants/auth";
import { DEFAULT_CURRENCY, OTP_TTL_MINUTES, TAX_RATE_PERCENT } from "../constants";
import { auditService } from "./audit.service";
import { cartService } from "./cart.service";
import { couponService } from "./coupon.service";
import { notificationService } from "./notification.service";
import { realtime } from "../realtime/realtime";
import * as cartRepo from "../repositories/cart.repository";
import * as couponRepo from "../repositories/coupon.repository";
import * as inventoryRepo from "../repositories/inventory.repository";
import * as productRepo from "../repositories/product.repository";
import * as orderRepo from "../repositories/order.repository";
import * as paymentRepo from "../repositories/payment.repository";
import { findById as findAddressById } from "../repositories/address.repository";
import { settingsService } from "./settings.service";
import { SETTING_KEYS } from "../constants/settings";
import { findById as findVendorById } from "../repositories/vendor.repository";
import { razorpayGateway } from "../payments/razorpay.gateway";
import { ApiError, NotFoundError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";
import { haversineDistanceKm } from "../utils/geo";
import { generateDeliveryOtp, generateInvoiceNumber, generateOrderNumber } from "../utils/order";
import * as checkoutIdempotencyRepo from "../repositories/checkout-idempotency.repository";
import * as dailyOrderCounterRepo from "../repositories/daily-order-counter.repository";
import { membershipPlanService } from "./membership-plan.service";
import { analyticsService } from "./analytics.service";
import { cartFromItems } from "../utils/cart";
import type { CheckoutPreviewBody, CreateOrderFromCartBody, PlaceOrderBody } from "../validators/checkout.validators";

import { normalizeDeliveryConfigs, type VendorDeliveryConfigs } from "./vendor.service";

interface VendorGroup {
  vendor_id: string;
  items: cartRepo.CartRow["items"];
  subtotal: number;
}

function groupByVendor(cart: cartRepo.CartRow): VendorGroup[] {
  const groups = new Map<string, VendorGroup>();
  for (const item of cart.items) {
    const vendorId = item.product.vendor_id;
    const existing = groups.get(vendorId);
    if (existing) {
      existing.items.push(item);
      existing.subtotal += item.price_snapshot.toNumber() * item.quantity;
    } else {
      groups.set(vendorId, {
        vendor_id: vendorId,
        items: [item],
        subtotal: item.price_snapshot.toNumber() * item.quantity,
      });
    }
  }
  return [...groups.values()];
}

export function getDeliveryOptionConfig(
  slot: string | undefined | null,
  configs: VendorDeliveryConfigs
): { id: "booking" | "self_pickup" | "shop_delivery" | "delivery_partner"; name: string; config: import("./vendor.service").DeliveryOptionConfig } {
  const normalized = (slot || "").toLowerCase();
  if (normalized.includes("book")) {
    return { id: "booking", name: "Advance Booking", config: configs.booking };
  }
  if (normalized.includes("self") || normalized.includes("pickup") || normalized.includes("takeaway")) {
    return { id: "self_pickup", name: "Self Pickup", config: configs.self_pickup };
  }
  if (normalized.includes("shop") || normalized.includes("direct")) {
    return { id: "shop_delivery", name: "Shop Direct Delivery", config: configs.shop_delivery };
  }
  return { id: "delivery_partner", name: "VegaMart Home Delivery", config: configs.delivery_partner };
}

function computeDeliveryFee(
  vendorSubtotal: number, 
  globalFreeDeliveryThreshold: number, 
  globalDeliveryFee: number,
  vendorFreeDeliveryMinOrder: number | null,
  vendorDeliveryFee: number
): number {
  const freeThreshold = vendorFreeDeliveryMinOrder !== null ? vendorFreeDeliveryMinOrder : globalFreeDeliveryThreshold;
  const fee = vendorDeliveryFee > 0 ? vendorDeliveryFee : globalDeliveryFee;

  if (freeThreshold > 0 && vendorSubtotal >= freeThreshold) {
    return 0;
  }
  return fee;
}

function computeOptionDeliveryFee(
  slot: string | undefined,
  subtotal: number,
  deliveryConfigs: VendorDeliveryConfigs,
  globalFreeDeliveryThreshold: number,
  globalDeliveryFee: number,
  vendorFreeDeliveryMinOrder: number | null
): number {
  if (!slot) {
    const shopFee = deliveryConfigs.shop_delivery.delivery_fee > 0 ? deliveryConfigs.shop_delivery.delivery_fee : globalDeliveryFee;
    return computeDeliveryFee(subtotal, globalFreeDeliveryThreshold, globalDeliveryFee, vendorFreeDeliveryMinOrder, shopFee);
  }
  const raw = slot.toLowerCase();
  if (raw.includes("self") || raw.includes("pickup") || raw.includes("takeaway") || raw.includes("book")) {
    return 0;
  }
  if (raw.includes("shop")) {
    return deliveryConfigs.shop_delivery.delivery_fee;
  }
  // VegaMart Delivery Partner
  return computeDeliveryFee(subtotal, globalFreeDeliveryThreshold, globalDeliveryFee, vendorFreeDeliveryMinOrder, 0);
}

interface SerializedOrder {
  id: string;
  order_number: string;
  vendor_id: string;
  status: string;
  total: number;
  delivery_fee: number;
  payment_method: string;
  eta_minutes: number | null;
  created_at: Date | string;
}

interface SerializedPayment {
  id: string;
  method: string;
  amount: number;
  status: string;
  razorpay_order_id: string | null;
}

interface CheckoutResult {
  summary: CheckoutSummary;
  orders: Array<{ order: SerializedOrder; payment: SerializedPayment }>;
  master_order_id?: string;
}

function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/**
 * Canonical fingerprint of a checkout request. Any reuse of the same idempotency
 * key with different parameters (address, method, coupon or items) is a conflict.
 */
function computeRequestHash(userId: string, input: PlaceOrderBody, summary: CheckoutSummary): string {
  const items = summary.groups
    .flatMap((g) => g.items.map((i) => `${i.product_id}:${i.quantity}`))
    .sort()
    .join(",");
  return [
    userId,
    input.address_id,
    input.payment_method ?? "RAZORPAY",
    input.coupon_code ?? "",
    items,
  ].join("|");
}

function serializeOrder(
  order: orderRepo.OrderRow,
  payment: paymentRepo.PaymentRow
): { order: SerializedOrder; payment: SerializedPayment } {
  return {
    order: {
      id: order.id,
      order_number: order.order_number,
      vendor_id: order.vendor_id,
      status: order.status,
      total: Number(order.total),
      delivery_fee: Number(order.delivery_fee),
      payment_method: order.payment_method,
      eta_minutes: order.eta_minutes,
      created_at: order.created_at,
    },
    payment: {
      id: payment.id,
      method: payment.method,
      amount: Number(payment.amount),
      status: payment.status,
      razorpay_order_id: payment.razorpay_order_id,
    },
  };
}

export interface CheckoutSummaryItem {
  product_id: string;
  name: string;
  unit: string;
  selected_unit?: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  tax_rate?: number;
  image_url?: string | null;
}

export interface CheckoutGroup {
  vendor_id: string;
  vendor_name: string;
  items: CheckoutSummaryItem[];
  items_subtotal: number;
  delivery_fee: number;
  min_order: number;
  provides_delivery: boolean;
  is_open: boolean;
  advance_payment_percentage?: number;
  delivery_configs?: VendorDeliveryConfigs;
  admin_delivery_fee?: number;
  admin_min_order?: number;
  admin_free_delivery_threshold?: number;
}

export interface CheckoutSummary {
  groups: CheckoutGroup[];
  items_subtotal: number;
  delivery_fee: number;
  discount: number;
  tax: number;
  total: number;
  tax_rate: number;
  coupon: { id: string; code: string; type: string; discount: number } | null;
  /** Per-vendor eligible coupon discount; used only downstream when orders are created. */
  group_discounts: Record<string, number>;
  currency: string;
  /** True when multi-vendor cart is consolidated under a single VegaMart delivery charge. */
  is_consolidated_delivery?: boolean;
  platform_fee?: number;
  additional_charges?: Array<{ id: string; name: string; amount: number; type: string }>;
}

export const checkoutService = {
  async preview(userId: string, input: CheckoutPreviewBody, req: Request): Promise<CheckoutSummary> {
    const cart = input.items?.length
      ? await cartFromItems(userId, input.items)
      : await cartService.getMyCart(userId);
    const groups = groupByVendor(cart);
    const summary = await this.buildSummary(cart, groups, input, userId);
    await auditService.record(
      { userId, action: AUDIT_ACTIONS.CHECKOUT_PREVIEWED, entityType: "checkout", newValues: { total: summary.total, items: summary.groups.reduce((n, g) => n + g.items.length, 0) } },
      req
    );
    return summary;
  },

  async buildSummary(
    cart: cartRepo.CartRow,
    groups: VendorGroup[],
    input: CheckoutPreviewBody,
    userId: string
  ): Promise<CheckoutSummary> {
    if (cart.items.length === 0) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Your cart is empty.", { code: "EMPTY_CART" });
    }

    const settings = await settingsService.getAllSettings();
    const multiStoreEnabled = settings[SETTING_KEYS.MULTI_STORE_CHECKOUT_ENABLED] === true;
    if (!multiStoreEnabled && groups.length > 1) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Multi-store checkout is disabled. Only one store per order is allowed.",
        { code: "MULTI_STORE_NOT_ALLOWED" }
      );
    }

    // Detect multi-vendor + VegaMart delivery consolidation
    const vegamartDeliveryEnabled = settings[SETTING_KEYS.VEGAMART_DELIVERY_ENABLED] !== false;
    const isConsolidatedDelivery = groups.length > 1 && vegamartDeliveryEnabled;

    // When consolidated, only VegaMart Home Delivery (delivery_partner) is allowed
    if (isConsolidatedDelivery && input.delivery_slot) {
      const slotCheck = input.delivery_slot.toLowerCase();
      const isNonPartnerSlot =
        slotCheck.includes("self") || slotCheck.includes("pickup") || slotCheck.includes("takeaway") ||
        slotCheck.includes("shop") || slotCheck.includes("direct") ||
        slotCheck.includes("book");
      if (isNonPartnerSlot) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          "Your cart has items from multiple stores. Only VegaMart Home Delivery is available for multi-store orders. Please select VegaMart Home Delivery.",
          { code: "MULTI_STORE_DELIVERY_PARTNER_ONLY" }
        );
      }
    }

    const summaryGroups: CheckoutGroup[] = [];
    let itemsSubtotal = 0;
    let deliveryFee = 0;

    for (const group of groups) {
      const vendor = await findVendorById(group.vendor_id);
      if (!vendor) {
        throw new ApiError(HttpStatus.BAD_REQUEST, "One of the vendors is no longer available.", { code: "INVALID_VENDOR" });
      }
      if (!vendor.is_open) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          `${vendor.business_name} is currently offline. You can still save your cart and check out when they are back online.`,
          { code: "VENDOR_OFFLINE" }
        );
      }

      const settings = await settingsService.getAllSettings();
      const globalDeliveryFee = (settings[SETTING_KEYS.DELIVERY_FEE] as number) || 0;
      const globalFreeDeliveryThreshold = (settings[SETTING_KEYS.FREE_DELIVERY_THRESHOLD] as number) || 0;
      const globalMinOrderValue = (settings[SETTING_KEYS.MIN_ORDER_VALUE] as number) || 0;
      const taxRatePercent = (settings[SETTING_KEYS.TAX_RATE_PERCENT] as number) || TAX_RATE_PERCENT;

      const deliveryConfigs = normalizeDeliveryConfigs((vendor as any).delivery_configs, vendor);

      // When consolidated, validate that each vendor supports delivery_partner
      if (isConsolidatedDelivery && !deliveryConfigs.delivery_partner.enabled) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          `${vendor.business_name} does not support VegaMart Home Delivery. Multi-store orders require all stores to support VegaMart delivery. Please remove items from this store or order separately.`,
          { code: "VENDOR_NO_DELIVERY_PARTNER" }
        );
      }

      // When consolidated, per-vendor delivery fee is 0; the single fee is computed below
      const vendorDeliveryFee = isConsolidatedDelivery
        ? 0
        : computeOptionDeliveryFee(
            input.delivery_slot,
            group.subtotal,
            deliveryConfigs,
            globalFreeDeliveryThreshold,
            globalDeliveryFee,
            vendor.free_delivery_min_order ? vendor.free_delivery_min_order.toNumber() : null
          );

      let effectiveMinOrder = 0;
      const slotRaw = (input.delivery_slot || "").toLowerCase();
      if (slotRaw.includes("book")) {
        if (!deliveryConfigs.booking.enabled) {
          throw new ApiError(
            HttpStatus.BAD_REQUEST,
            `${vendor.business_name} does not offer Booking delivery at this time.`,
            { code: "DELIVERY_OPTION_DISABLED" }
          );
        }
        effectiveMinOrder = deliveryConfigs.booking.min_order;
      } else if (slotRaw.includes("self") || slotRaw.includes("pickup") || slotRaw.includes("takeaway")) {
        if (!deliveryConfigs.self_pickup.enabled) {
          throw new ApiError(
            HttpStatus.BAD_REQUEST,
            `${vendor.business_name} does not offer Self Pickup at this time.`,
            { code: "DELIVERY_OPTION_DISABLED" }
          );
        }
        effectiveMinOrder = deliveryConfigs.self_pickup.min_order;
      } else if (slotRaw.includes("shop")) {
        if (!deliveryConfigs.shop_delivery.enabled) {
          throw new ApiError(
            HttpStatus.BAD_REQUEST,
            `${vendor.business_name} does not offer Shop Direct Delivery at this time.`,
            { code: "DELIVERY_OPTION_DISABLED" }
          );
        }
        effectiveMinOrder = deliveryConfigs.shop_delivery.min_order;
      } else if (slotRaw.includes("partner") || slotRaw.includes("vegamart")) {
        if (deliveryConfigs.delivery_partner.enabled === false) {
          throw new ApiError(
            HttpStatus.BAD_REQUEST,
            `${vendor.business_name} does not offer VegaMart Delivery Partner delivery at this time.`,
            { code: "DELIVERY_OPTION_DISABLED" }
          );
        }
        effectiveMinOrder = (deliveryConfigs.delivery_partner.min_order !== undefined && deliveryConfigs.delivery_partner.min_order > 0)
          ? deliveryConfigs.delivery_partner.min_order
          : (vendor.min_order && vendor.min_order.toNumber() > 0 ? vendor.min_order.toNumber() : globalMinOrderValue);
      } else {
        effectiveMinOrder = (deliveryConfigs.delivery_partner.min_order !== undefined && deliveryConfigs.delivery_partner.min_order > 0)
          ? deliveryConfigs.delivery_partner.min_order
          : (vendor.min_order && vendor.min_order.toNumber() > 0 ? vendor.min_order.toNumber() : globalMinOrderValue);
      }

      let advancePct = 0;
      if (slotRaw.includes("book") || slotRaw.includes("advance")) {
        advancePct = deliveryConfigs.booking.advance_percentage;
      } else if (slotRaw.includes("self") || slotRaw.includes("pickup") || slotRaw.includes("takeaway")) {
        advancePct = deliveryConfigs.self_pickup.advance_percentage;
      }

      if (input.address_id) {
        const address = await findAddressById(input.address_id);
        const isPickup = slotRaw.includes("self") || slotRaw.includes("pickup") || slotRaw.includes("takeaway");
        if (address && !isPickup && address.latitude && address.longitude && vendor.latitude && vendor.longitude) {
          const distKm = haversineDistanceKm(
            Number(address.latitude),
            Number(address.longitude),
            Number(vendor.latitude),
            Number(vendor.longitude)
          );
          const maxRadius = Number(vendor.delivery_radius_km || 5);
          if (distKm > maxRadius) {
            throw new ApiError(
              HttpStatus.BAD_REQUEST,
              `Delivery address in ${address.city || address.full_address || "selected location"} is ${distKm.toFixed(1)} km away. ${vendor.business_name} only delivers within ${maxRadius} km. Please choose an address within Sakti District or select Self Pickup.`,
              {
                code: "OUT_OF_DELIVERY_RADIUS",
                details: {
                  distance_km: String(Math.round(distKm * 10) / 10),
                  max_radius_km: String(maxRadius),
                  vendor_name: vendor.business_name,
                  address_city: address.city || "",
                },
              }
            );
          }
        }
      }

      summaryGroups.push({
        vendor_id: group.vendor_id,
        vendor_name: vendor.business_name,
        items: group.items.map((item) => ({
          product_id: item.product_id,
          name: item.product.name,
          unit: item.selected_unit || item.product.unit,
          selected_unit: item.selected_unit,
          quantity: item.quantity,
          unit_price: item.price_snapshot.toNumber(),
          line_total: item.price_snapshot.toNumber() * item.quantity,
          tax_rate: (item.product as any).tax_rate ? Number((item.product as any).tax_rate) : (vendor as any).tax_rate ? Number((vendor as any).tax_rate) : taxRatePercent,
          image_url: item.product?.images?.[0]?.url ?? null,
        })),
        items_subtotal: Math.round(group.subtotal * 100) / 100,
        delivery_fee: Math.round(vendorDeliveryFee * 100) / 100,
        min_order: effectiveMinOrder,
        provides_delivery: vendor.provides_delivery,
        is_open: vendor.is_open,
        advance_payment_percentage: advancePct,
        delivery_configs: deliveryConfigs,
        admin_delivery_fee: globalDeliveryFee,
        admin_min_order: globalMinOrderValue,
        admin_free_delivery_threshold: globalFreeDeliveryThreshold,
      });
      itemsSubtotal += group.subtotal;
      deliveryFee += vendorDeliveryFee;
    }

    itemsSubtotal = Math.round(itemsSubtotal * 100) / 100;

    // Consolidated multi-vendor delivery: compute one platform-level delivery fee
    // based on total cart subtotal and global settings
    if (isConsolidatedDelivery) {
      const globalDeliveryFee = (settings[SETTING_KEYS.DELIVERY_FEE] as number) || 0;
      const globalFreeDeliveryThreshold = (settings[SETTING_KEYS.FREE_DELIVERY_THRESHOLD] as number) || 0;
      if (globalFreeDeliveryThreshold > 0 && itemsSubtotal >= globalFreeDeliveryThreshold) {
        deliveryFee = 0;
      } else {
        deliveryFee = globalDeliveryFee;
      }
    }

    deliveryFee = Math.round(deliveryFee * 100) / 100;

    let discount = 0;
    let groupDiscounts: Record<string, number> = {};
    let couponInfo: CheckoutSummary["coupon"] = null;

    if (input.coupon_code) {
      const result = await couponService.validateForCart(input.coupon_code, cart, userId);
      discount = Math.round(result.discount * 100) / 100;
      groupDiscounts = result.group_discounts ?? {};
      const freeDelivery = result.coupon.type === "FREE_DELIVERY";
      if (freeDelivery) {
        deliveryFee = 0;
      }
      couponInfo = { id: result.coupon.id, code: result.coupon.code, type: result.coupon.type, discount };
    }

    const taxRatePercent = (settings[SETTING_KEYS.TAX_RATE_PERCENT] as number) || TAX_RATE_PERCENT;

    let totalTax = 0;
    for (const group of summaryGroups) {
      const groupDiscount = groupDiscounts[group.vendor_id] ?? 0;
      const discountRatio = group.items_subtotal > 0 ? groupDiscount / group.items_subtotal : 0;
      let groupTaxRaw = 0;
      for (const item of group.items) {
        const itemDiscount = item.line_total * discountRatio;
        const itemTaxable = Math.max(0, item.line_total - itemDiscount);
        groupTaxRaw += (itemTaxable * (item.tax_rate ?? 0)) / 100;
      }
      totalTax += Math.round(groupTaxRaw * 100) / 100;
    }

    let isVegaMartDelivery = isConsolidatedDelivery;
    if (!isConsolidatedDelivery && input.delivery_slot) {
      const slotRaw = input.delivery_slot.toLowerCase();
      if (!slotRaw.includes("self") && !slotRaw.includes("pickup") && !slotRaw.includes("takeaway") &&
          !slotRaw.includes("shop") && !slotRaw.includes("direct") && !slotRaw.includes("book")) {
        isVegaMartDelivery = true;
      }
    }
    if (isVegaMartDelivery && deliveryFee > 0) {
      totalTax += Math.round(((deliveryFee * taxRatePercent) / 100) * 100) / 100;
    }

    const rawCharges = settings[SETTING_KEYS.PLATFORM_CHECKOUT_CHARGES] as string;
    let platformFeeTotal = 0;
    const additionalCharges: any[] = [];
    if (rawCharges) {
      try {
        const parsedCharges = JSON.parse(rawCharges);
        if (Array.isArray(parsedCharges)) {
          for (const charge of parsedCharges) {
            if (charge.is_active) {
               let amount = 0;
               if (charge.type === "percentage") {
                  amount = (itemsSubtotal * Number(charge.amount)) / 100;
               } else {
                  amount = Number(charge.amount);
               }
               amount = Math.round(amount * 100) / 100;
               if (amount > 0) {
                 platformFeeTotal += amount;
                 additionalCharges.push({
                   id: charge.id || String(Date.now()),
                   name: charge.name,
                   amount: amount,
                   type: charge.type
                 });
               }
            }
          }
        }
      } catch (e) {
        // ignore JSON parse errors
      }
    }

    const tax = Math.round(totalTax * 100) / 100;
    const total = Math.round((itemsSubtotal + deliveryFee - discount + tax + platformFeeTotal) * 100) / 100;

    return {
      groups: summaryGroups,
      items_subtotal: itemsSubtotal,
      delivery_fee: deliveryFee,
      discount,
      tax,
      total,
      tax_rate: taxRatePercent,
      coupon: couponInfo,
      group_discounts: groupDiscounts,
      currency: DEFAULT_CURRENCY,
      is_consolidated_delivery: isConsolidatedDelivery || undefined,
      platform_fee: platformFeeTotal,
      additional_charges: additionalCharges,
    };
  },

  async createOrderFromCart(userId: string, input: CreateOrderFromCartBody, req: Request) {
    const cart = await cartRepo.getOrCreate(userId);
    await cartRepo.clear(cart.id);
    for (const item of input.items) {
      await cartService.addItem(
        userId,
        { product_id: item.product_id, quantity: item.quantity, selected_unit: item.selected_unit },
        req
      );
    }
    return this.placeOrder(
      userId,
      {
        address_id: input.address_id,
        coupon_code: input.coupon_code,
        delivery_slot: input.delivery_slot,
        payment_method: input.payment_method,
        payment_type: input.payment_type,
        idempotency_key: input.idempotency_key,
      },
      req
    );
  },

  async placeOrder(userId: string, input: PlaceOrderBody, req: Request): Promise<CheckoutResult> {
    const cart = await cartService.getMyCart(userId);
    const groups = groupByVendor(cart);
    const summary = await this.buildSummary(cart, groups, input, userId);

    for (const group of summary.groups) {
      if (group.items_subtotal < group.min_order) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          `Minimum order for ${group.vendor_name} is ₹${group.min_order}. Please add more items.`,
          { code: "MIN_ORDER_NOT_MET" }
        );
      }
    }

    const address = await findAddressById(input.address_id);
    if (!address || address.user_id !== userId || address.deleted_at) {
      throw new NotFoundError("Address not found.");
    }

    const slotRaw = (input.delivery_slot || "").toLowerCase();
    const isPickup = slotRaw.includes("self") || slotRaw.includes("pickup") || slotRaw.includes("takeaway");

    // Enforce vendor delivery radius on all home deliveries
    if (!isPickup && address.latitude && address.longitude) {
      for (const group of summary.groups) {
        const vendor = await findVendorById(group.vendor_id);
        if (vendor && vendor.latitude && vendor.longitude) {
          const distKm = haversineDistanceKm(
            Number(address.latitude),
            Number(address.longitude),
            Number(vendor.latitude),
            Number(vendor.longitude)
          );
          const maxRadius = Number(vendor.delivery_radius_km || 5);
          if (distKm > maxRadius) {
            throw new ApiError(
              HttpStatus.BAD_REQUEST,
              `Selected delivery address in ${address.city || address.full_address || "selected area"} is ${distKm.toFixed(1)} km away. ${vendor.business_name} only delivers within ${maxRadius} km (Sakti District). Please choose a closer address or select Self Pickup.`,
              {
                code: "OUT_OF_DELIVERY_RADIUS",
                details: {
                  distance_km: String(Math.round(distKm * 10) / 10),
                  max_radius_km: String(maxRadius),
                  vendor_name: vendor.business_name,
                  address_city: address.city || "",
                },
              }
            );
          }
        }
      }
    }

    const idempotencyKey = input.idempotency_key ?? undefined;
    const paymentMethod = input.payment_method ?? "RAZORPAY";
    const paymentType = input.payment_type ?? "FULL";
    const requestHash = idempotencyKey ? computeRequestHash(userId, input, summary) : null;

    // Validate payment method and payment type against each vendor's delivery options config
    for (const group of summary.groups) {
      if (group.delivery_configs) {
        const deliveryInfo = getDeliveryOptionConfig(input.delivery_slot, group.delivery_configs);
        const optConfig = deliveryInfo.config;

        if (!optConfig.enabled) {
          throw new ApiError(
            HttpStatus.BAD_REQUEST,
            `${group.vendor_name} does not offer ${deliveryInfo.name} at this time.`,
            { code: "DELIVERY_OPTION_DISABLED" }
          );
        }

        // Validate Online vs COD
        if (paymentMethod === "COD" && !optConfig.cod_enabled) {
          throw new ApiError(
            HttpStatus.BAD_REQUEST,
            `Cash on Delivery/Pickup is disabled for ${deliveryInfo.name}. Please select an Online payment method.`,
            { code: "COD_NOT_ALLOWED" }
          );
        }
        if (paymentMethod === "RAZORPAY" && !optConfig.online_payment_enabled) {
          throw new ApiError(
            HttpStatus.BAD_REQUEST,
            `Online payment is disabled for ${deliveryInfo.name}. Please select Cash on Delivery.`,
            { code: "ONLINE_PAYMENT_NOT_ALLOWED" }
          );
        }
        if (!optConfig.online_payment_enabled && !optConfig.cod_enabled) {
          throw new ApiError(
            HttpStatus.BAD_REQUEST,
            `No payment methods are available for ${deliveryInfo.name}.`,
            { code: "PAYMENT_UNAVAILABLE" }
          );
        }

        // Validate Full vs Advance
        if (paymentType === "ADVANCE" && !optConfig.advance_payment_enabled) {
          throw new ApiError(
            HttpStatus.BAD_REQUEST,
            `Advance payment is not available for ${deliveryInfo.name}. Please select Full Payment.`,
            { code: "ADVANCE_PAYMENT_NOT_ALLOWED" }
          );
        }
        if (paymentType === "FULL" && !optConfig.full_payment_enabled && optConfig.advance_payment_enabled) {
          throw new ApiError(
            HttpStatus.BAD_REQUEST,
            `Full payment is disabled for ${deliveryInfo.name}. Only Advance Payment is accepted.`,
            { code: "FULL_PAYMENT_NOT_ALLOWED" }
          );
        }
      }
    }

    // Idempotent replay fast-path: reusing the same key must return the original
    // result (never a second order). A key used with different request params is
    // rejected outright.
    if (idempotencyKey) {
      const existing = await checkoutIdempotencyRepo.findByKey(idempotencyKey, userId);
      if (existing) {
        if (existing.request_hash && existing.request_hash !== requestHash) {
          throw new ApiError(HttpStatus.CONFLICT, "Idempotency key was already used for a different request.", {
            code: "IDEMPOTENCY_REUSE_CONFLICT",
          });
        }
        if (!existing.response) {
          throw new ApiError(HttpStatus.CONFLICT, "A checkout with this idempotency key is already in progress. Please retry.", {
            code: "IDEMPOTENCY_IN_PROGRESS",
          });
        }
        return existing.response as unknown as CheckoutResult;
      }
    }

    // Pre-compute the per-vendor totals once so the gateway, the persistence step
    // and the stored idempotent response all agree.
    const computations = summary.groups.map((group, idx) => {
      const groupSubtotal = group.items_subtotal;
      const groupDiscount = Math.round((summary.group_discounts?.[group.vendor_id] ?? 0) * 100) / 100;
      const discountRatio = groupSubtotal > 0 ? groupDiscount / groupSubtotal : 0;
      let groupTaxRaw = 0;
      for (const item of group.items) {
        const itemDiscount = item.line_total * discountRatio;
        const itemTaxable = Math.max(0, item.line_total - itemDiscount);
        groupTaxRaw += (itemTaxable * (item.tax_rate ?? 0)) / 100;
      }
      const groupTax = Math.round(groupTaxRaw * 100) / 100;
      // When consolidated delivery, assign the full delivery fee to first order only
      const effectiveDeliveryFee = summary.is_consolidated_delivery
        ? (idx === 0 ? summary.delivery_fee : 0)
        : group.delivery_fee;
      const groupTotal = Math.round((groupSubtotal + effectiveDeliveryFee - groupDiscount + groupTax) * 100) / 100;
      return { group: { ...group, delivery_fee: effectiveDeliveryFee }, groupDiscount, groupTax, groupTotal, orderNumber: generateOrderNumber() };
    });

    // Read each vendor's daily order limit before the transaction. A slightly
    // stale read is safe: the atomic counter enforces the limit strictly.
    const dailyLimits = await Promise.all(
      computations.map((c) =>
        membershipPlanService
            .getMyMembership(c.group.vendor_id)
            .then((membership) => membership?.plan?.daily_order_limit ?? 5)
            .catch(() => 5)
      )
    );

    // Gateway intents are created before the transaction
    let masterAmountToCharge = summary.total;
    if (summary.groups.length === 1 && summary.groups[0]?.delivery_configs) {
       const configs = summary.groups[0].delivery_configs;
       if (configs) {
         const deliveryInfo = getDeliveryOptionConfig(input.delivery_slot, configs);
         const optConfig = deliveryInfo.config;
         if (paymentMethod === "RAZORPAY" && paymentType === "ADVANCE" && optConfig.advance_payment_enabled) {
           const advancePct = optConfig.advance_percentage || 20;
           masterAmountToCharge = advancePct <= 0 || advancePct >= 100 ? summary.total : Math.max(1, Math.round(summary.total * (advancePct / 100) * 100) / 100);
         }
       }
    }
    if (masterAmountToCharge > 0 && masterAmountToCharge < 1) { masterAmountToCharge = 1; }

    const masterOrderNumber = generateOrderNumber();
    let gatewayOrder: any;
    if (paymentMethod === "RAZORPAY" && masterAmountToCharge > 0) {
        gatewayOrder = await razorpayGateway.createOrder({
            amountPaise: Math.round(masterAmountToCharge * 100),
            currency: DEFAULT_CURRENCY,
            receipt: masterOrderNumber,
            notes: { order_number: masterOrderNumber, user_id: userId, delivery_slot: input.delivery_slot || "", payment_type: paymentType }
        });
    }

    const serializedOrders: Array<{ order: SerializedOrder; payment: SerializedPayment }> = [];
    let outMasterOrderId = "";

    try {
      await prisma.$transaction(async (tx) => {
        // Reserve the key first: the unique `idempotency_key` serialises
        // concurrent duplicates — the loser fails this insert with P2002 and its
        // entire transaction is rolled back before anything is written.
        if (idempotencyKey) {
          await checkoutIdempotencyRepo.create(tx, {
            idempotency_key: idempotencyKey,
            user_id: userId,
            request_hash: requestHash as string,
          });
        }

        const masterOrder = await tx.masterOrder.create({
            data: {
                order_number: masterOrderNumber,
                user_id: userId,
                address_id: address.id,
                total_amount: summary.total,
                delivery_fee: summary.delivery_fee,
                tax: summary.tax,
                platform_fee: summary.platform_fee || 0,
                additional_charges: summary.additional_charges || [],
                status: "PENDING",
                payment_method: paymentMethod,
                payment_status: "PENDING",
            }
        });
        outMasterOrderId = masterOrder.id;

        const sharedOtp = generateDeliveryOtp();

        for (let i = 0; i < computations.length; i++) {
          const { group, groupDiscount, groupTax, groupTotal, orderNumber } = computations[i]!;

          const deliveryInfo = group.delivery_configs
            ? getDeliveryOptionConfig(input.delivery_slot, group.delivery_configs)
            : null;
          const optConfig = deliveryInfo?.config;
          const isAdvance = paymentType === "ADVANCE" && !!optConfig?.advance_payment_enabled;

          let amountCharged = groupTotal;
          if (isAdvance && optConfig) {
            const advancePct = optConfig.advance_percentage || 20;
            amountCharged = advancePct <= 0 || advancePct >= 100
              ? groupTotal
              : Math.max(1, Math.round(groupTotal * (advancePct / 100) * 100) / 100);
          }
          if (amountCharged > 0 && amountCharged < 1) {
            amountCharged = 1;
          }

          const deliverySlotLabel = input.delivery_slot || deliveryInfo?.name || "Standard Delivery";
          const advanceNote = isAdvance
            ? ` (${optConfig?.advance_percentage || 20}% Advance: ₹${amountCharged} paid online, Balance due on arrival: ₹${Math.max(0, groupTotal - amountCharged)})`
            : "";

          const order = await orderRepo.createOrder(
            {
              order_number: orderNumber,
              master_order_id: masterOrder.id,
              user_id: userId,
              vendor_id: group.vendor_id,
              address_id: address.id,
              coupon_id: summary.coupon?.id ?? null,
              coupon_discount: 0,
              items_subtotal: group.items_subtotal,
              delivery_fee: group.delivery_fee,
              tax: 0,
              total: 0,
              payment_method: paymentMethod,
              delivery_note: `${deliverySlotLabel}${advanceNote}`,
              items: group.items.map((item) => ({
                product_id: item.product_id,
                product_name: item.name,
                unit: item.unit,
                selected_unit: item.selected_unit,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.line_total,
                image_url: item.image_url ?? null,
              })),
            },
            tx
          );

          const updated = await orderRepo.updateOrder(
            order.id,
            {
              discount: groupDiscount,
              tax: groupTax,
              total: groupTotal,
              invoice_number: generateInvoiceNumber(orderNumber),
              otp_code: sharedOtp,
              otp_expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
            },
            tx
          );

          await orderRepo.updateOrderStatus(
            order.id,
            {
              status: "PENDING",
              note: "Order placed. Awaiting payment confirmation.",
              actorType: "customer",
              actorId: userId,
            },
            tx
          );

          // Atomic daily order counter: conditional insert-or-increment. Returns
          // null when the vendor has already hit their limit, aborting the tx.
          const counter = await dailyOrderCounterRepo.incrementForVendor(
            group.vendor_id,
            startOfToday(),
            dailyLimits[i] ?? 5,
            tx
          );
          if (counter === null) {
            throw new ApiError(
              HttpStatus.FORBIDDEN,
              "Vendor is currently busy and has reached their daily order limit.",
              { code: "DAILY_ORDER_LIMIT_REACHED" }
            );
          }

          serializedOrders.push(serializeOrder(updated, {} as any));
        }
        
        let payment;
        if (paymentMethod === "RAZORPAY") {
          payment = await paymentRepo.createForOrder({
             master_order_id: masterOrder.id,
             amount: masterAmountToCharge,
             method: "RAZORPAY",
             razorpay_order_id: gatewayOrder?.id,
          }, tx);
        } else {
          payment = await paymentRepo.createForOrder({
             master_order_id: masterOrder.id,
             amount: summary.total,
             method: "COD",
          }, tx);
        }

        for (let i = 0; i < serializedOrders.length; i++) {
            serializedOrders[i]!.payment = payment as any;
        }

        // Atomic inventory reservation: the conditional guard aborts the whole
        // checkout when any product is short, so over-committed reservations can
        // never leak into the database.
        const reservationItems = computations.flatMap((c) =>
          c.group.items.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            name: item.name,
          }))
        );
        await inventoryRepo.reserveAvailable(reservationItems, tx);

        // Coupon claim in the same transaction: an exhausted coupon rolls back the
        // whole checkout (orders, reservations, counters) atomically.
        if (summary.coupon) {
          const firstOrderId = serializedOrders[0]?.order.id;
          const claimed = firstOrderId
            ? await couponRepo.claimUsage(summary.coupon.id, firstOrderId, userId, summary.discount, tx)
            : false;
          if (!claimed) {
            throw new ApiError(HttpStatus.BAD_REQUEST, "Coupon usage limit has been reached. Please try again.", {
              code: "COUPON_EXHAUSTED",
            });
          }
        }

        // Persist the serialized result for idempotent replays.
        if (idempotencyKey) {
          await checkoutIdempotencyRepo.setResponse(tx, idempotencyKey, userId, {
            summary,
            orders: serializedOrders,
          } as unknown as Prisma.InputJsonValue);
        }
      });
    } catch (err) {
      // A concurrent duplicate won the idempotency insert. Read the winner: if it
      // already carries a response, replay it; otherwise the winner is still
      // committing, so tell the caller to retry.
      if ((err as { code?: string })?.code === "P2002" && idempotencyKey) {
        const winner = await checkoutIdempotencyRepo.findByKey(idempotencyKey, userId);
        if (!winner) {
          throw new ApiError(HttpStatus.CONFLICT, "A checkout with this idempotency key is already in progress. Please retry.", {
            code: "IDEMPOTENCY_IN_PROGRESS",
          });
        }
        if (winner.request_hash && winner.request_hash !== requestHash) {
          throw new ApiError(HttpStatus.CONFLICT, "Idempotency key was already used for a different request.", {
            code: "IDEMPOTENCY_REUSE_CONFLICT",
          });
        }
        if (!winner.response) {
          throw new ApiError(HttpStatus.CONFLICT, "A checkout with this idempotency key is already in progress. Please retry.", {
            code: "IDEMPOTENCY_IN_PROGRESS",
          });
        }
        return winner.response as unknown as CheckoutResult;
      }
      throw err;
    }

    await cartRepo.clear(cart.id);

    // Best-effort analytics, notifications and audit run after the commit and
    // can never fail or re-run a transaction.
    for (let i = 0; i < computations.length; i++) {
      const { group, groupTotal } = computations[i]!;
      const entry = serializedOrders[i];
      if (!entry) continue;
      await analyticsService.recordOrder(
        group.vendor_id,
        group.items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          total_price: item.line_total,
        })),
        groupTotal
      );
      await analyticsService.recordCustomer(group.vendor_id, userId, entry.order.id);

      // Publish stock updates to shop realtime
      for (const item of group.items) {
        productRepo.findById(item.product_id).then((product) => {
          if (product) {
            realtime.publishShopProductUpdate(group.vendor_id, item.product_id, {
              stock: product.stock,
              is_available: product.is_available,
            });
          }
        }).catch(() => {});
      }
    }

    // For COD, the order is confirmed immediately, so notify the customer and vendor now.
    // For RAZORPAY, the order is awaiting payment capture; notifications and alerts
    // fire upon payment verification in payment.service.ts.
    if (paymentMethod !== "RAZORPAY") {
      for (let i = 0; i < serializedOrders.length; i++) {
        const entry = serializedOrders[i]!;
        const group = computations[i]?.group;
        const groupTotal = computations[i]?.groupTotal ?? entry.order.total;

        await notificationService.orderStatus(
          userId,
          entry.order.order_number,
          "Order placed",
          `Your order ${entry.order.order_number} has been placed successfully via Cash on Delivery.`,
          { order_id: entry.order.id }
        );

        if (group) {
          const vendor = await findVendorById(group.vendor_id);
          if (vendor) {
            const customerName = (req.user as any)?.name || address?.label || "Customer";
            const customerPhone = address?.phone || (req.user as any)?.phone || undefined;
            const deliverySlot = input.delivery_slot || "Standard Delivery";

            await notificationService.vendor(
              vendor.user_id,
              "New Order Received! 🛒",
              `Order #${entry.order.order_number} has been placed (${group.items.length} item${group.items.length === 1 ? "" : "s"}, ₹${groupTotal}).`,
              {
                order_id: entry.order.id,
                order_number: entry.order.order_number,
                total: groupTotal,
                customer_name: customerName,
                delivery_slot: deliverySlot,
                payment_method: "COD",
              }
            );

            realtime.publishVendorOrder(group.vendor_id, {
              order_id: entry.order.id,
              order_number: entry.order.order_number,
              total: groupTotal,
              items_count: group.items.length,
              customer_name: customerName,
              customer_phone: customerPhone,
              delivery_slot: deliverySlot,
              payment_method: "COD",
              items: group.items.map((it) => ({
                name: it.name,
                quantity: it.quantity,
                price: it.unit_price,
              })),
              created_at: new Date().toISOString(),
            });
          }
        }
      }
    }

    await auditService.record(
      { userId, action: AUDIT_ACTIONS.ORDER_PLACED, entityType: "order", entityId: serializedOrders.map((o) => o.order.id).join(","), newValues: { count: serializedOrders.length, total: summary.total, payment_method: paymentMethod } },
      req
    );

    return { summary, orders: serializedOrders, master_order_id: outMasterOrderId };
  },

  async initiateOnlinePayment(
    userId: string,
    input: {
      address_id: string;
      coupon_code?: string;
      delivery_slot?: string;
      payment_type?: "FULL" | "ADVANCE";
      items: Array<{ product_id: string; quantity: number; selected_unit?: string }>;
    },
    req: Request
  ) {
    const cart = await cartRepo.getOrCreate(userId);
    await cartRepo.clear(cart.id);
    for (const item of input.items) {
      await cartService.addItem(
        userId,
        { product_id: item.product_id, quantity: item.quantity, selected_unit: item.selected_unit },
        req
      );
    }

    const currentCart = await cartService.getMyCart(userId);
    const groups = groupByVendor(currentCart);
    const summary = await this.buildSummary(currentCart, groups, input, userId);

    for (const group of summary.groups) {
      if (group.items_subtotal < group.min_order) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          `Minimum order for ${group.vendor_name} is ₹${group.min_order}. Please add more items.`,
          { code: "MIN_ORDER_NOT_MET" }
        );
      }
    }

    const address = await findAddressById(input.address_id);
    if (!address || address.user_id !== userId || address.deleted_at) {
      throw new NotFoundError("Address not found.");
    }

    const slotRaw = (input.delivery_slot || "").toLowerCase();
    const isPickup = slotRaw.includes("self") || slotRaw.includes("pickup") || slotRaw.includes("takeaway");

    if (!isPickup && address.latitude && address.longitude) {
      for (const group of summary.groups) {
        const vendor = await findVendorById(group.vendor_id);
        if (vendor && vendor.latitude && vendor.longitude) {
          const distKm = haversineDistanceKm(
            Number(address.latitude),
            Number(address.longitude),
            Number(vendor.latitude),
            Number(vendor.longitude)
          );
          const maxRadius = Number(vendor.delivery_radius_km || 5);
          if (distKm > maxRadius) {
            throw new ApiError(
              HttpStatus.BAD_REQUEST,
              `Selected delivery address in ${address.city || address.full_address || "selected area"} is ${distKm.toFixed(1)} km away. ${vendor.business_name} only delivers within ${maxRadius} km (Sakti District). Please choose a closer address or select Self Pickup.`,
              {
                code: "OUT_OF_DELIVERY_RADIUS",
                details: {
                  distance_km: String(Math.round(distKm * 10) / 10),
                  max_radius_km: String(maxRadius),
                  vendor_name: vendor.business_name,
                  address_city: address.city || "",
                },
              }
            );
          }
        }
      }
    }

    let totalToCharge = summary.total;
    const paymentType = input.payment_type ?? "FULL";

    if (summary.groups.length === 1 && summary.groups[0]?.delivery_configs) {
      const group = summary.groups[0];
      const configs = group.delivery_configs;
      if (configs) {
        const deliveryInfo = getDeliveryOptionConfig(input.delivery_slot, configs);
        const optConfig = deliveryInfo.config;
        if (paymentType === "ADVANCE" && optConfig.advance_payment_enabled) {
          const advancePct = optConfig.advance_percentage || 20;
          totalToCharge = advancePct <= 0 || advancePct >= 100
            ? summary.total
            : Math.max(1, Math.round(summary.total * (advancePct / 100) * 100) / 100);
        }
      }
    }

    if (totalToCharge > 0 && totalToCharge < 1) {
      totalToCharge = 1;
    }

    const receipt = `rcpt_${generateOrderNumber()}`;
    const gatewayOrder = await razorpayGateway.createOrder({
      amountPaise: Math.round(totalToCharge * 100),
      currency: DEFAULT_CURRENCY,
      receipt,
      notes: {
        user_id: userId,
        delivery_slot: input.delivery_slot || "",
        payment_type: paymentType,
      },
    });

    return {
      razorpay_order_id: gatewayOrder.id,
      amount: gatewayOrder.amount,
      amount_inr: totalToCharge,
      currency: gatewayOrder.currency || "INR",
      key_id: env.RAZORPAY_KEY_ID || "",
      checkout_payload: input,
      summary,
    };
  },

  async placeOrderWithVerifiedPayment(
    userId: string,
    input: {
      address_id: string;
      coupon_code?: string;
      delivery_slot?: string;
      payment_type?: "FULL" | "ADVANCE";
      items: Array<{ product_id: string; quantity: number; selected_unit?: string }>;
    },
    verifiedPayment: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    },
    req: Request
  ): Promise<CheckoutResult> {
    const cart = await cartRepo.getOrCreate(userId);
    await cartRepo.clear(cart.id);
    for (const item of input.items) {
      await cartService.addItem(
        userId,
        { product_id: item.product_id, quantity: item.quantity, selected_unit: item.selected_unit },
        req
      );
    }

    const currentCart = await cartService.getMyCart(userId);
    const groups = groupByVendor(currentCart);
    const summary = await this.buildSummary(currentCart, groups, input, userId);

    const address = await findAddressById(input.address_id);
    if (!address || address.user_id !== userId || address.deleted_at) {
      throw new NotFoundError("Address not found.");
    }

    const paymentType = input.payment_type ?? "FULL";
    const groupDiscounts = summary.group_discounts;
    const computations = summary.groups.map((group, idx) => {
      const groupDiscount = groupDiscounts[group.vendor_id] ?? 0;
      const discountRatio = group.items_subtotal > 0 ? groupDiscount / group.items_subtotal : 0;
      const groupSubtotal = group.items_subtotal;
      let groupTaxRaw = 0;
      for (const item of group.items) {
        const itemDiscount = item.line_total * discountRatio;
        const itemTaxable = Math.max(0, item.line_total - itemDiscount);
        groupTaxRaw += (itemTaxable * (item.tax_rate ?? 0)) / 100;
      }
      const groupTax = Math.round(groupTaxRaw * 100) / 100;
      // When consolidated delivery, assign the full delivery fee to first order only
      const effectiveDeliveryFee = summary.is_consolidated_delivery
        ? (idx === 0 ? summary.delivery_fee : 0)
        : group.delivery_fee;
      const groupTotal = Math.round((groupSubtotal + effectiveDeliveryFee - groupDiscount + groupTax) * 100) / 100;
      return { group: { ...group, delivery_fee: effectiveDeliveryFee }, groupDiscount, groupTax, groupTotal, orderNumber: generateOrderNumber() };
    });

    const serializedOrders: Array<{ order: SerializedOrder; payment: SerializedPayment }> = [];
    let outMasterOrderId = "";

    await prisma.$transaction(async (tx) => {
      const masterOrderNumber = generateOrderNumber();
      const masterOrder = await tx.masterOrder.create({
          data: {
              order_number: masterOrderNumber,
              user_id: userId,
              address_id: address.id,
              total_amount: summary.total,
              delivery_fee: summary.delivery_fee,
              tax: summary.tax,
              platform_fee: summary.platform_fee || 0,
              additional_charges: summary.additional_charges || [],
              status: "ACCEPTED",
              payment_method: "RAZORPAY",
              payment_status: "PAID",
          }
      });
      outMasterOrderId = masterOrder.id;

      for (let i = 0; i < computations.length; i++) {
        const { group, groupDiscount, groupTax, groupTotal, orderNumber } = computations[i]!;


        const order = await orderRepo.createOrder(
          {
            order_number: orderNumber,
            master_order_id: masterOrder.id,
            user_id: userId,
            vendor_id: group.vendor_id,
            address_id: address.id,
            coupon_id: summary.coupon?.id ?? null,
            coupon_discount: groupDiscount,
            items_subtotal: group.items_subtotal,
            delivery_fee: group.delivery_fee,
            tax: groupTax,
            total: groupTotal,
            payment_method: "RAZORPAY",
            delivery_note: input.delivery_slot ?? null,
            items: group.items.map((item) => ({
              product_id: item.product_id,
              product_name: item.name,
              unit: item.unit,
              selected_unit: item.selected_unit,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_price: item.line_total,
              image_url: item.image_url ?? null,
            })),
          },
          tx
        );

        const updated = await orderRepo.updateOrder(
          order.id,
          {
            discount: groupDiscount,
            tax: groupTax,
            total: groupTotal,
            invoice_number: generateInvoiceNumber(orderNumber),
            otp_code: generateDeliveryOtp(),
            otp_expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
          },
          tx
        );

        await dailyOrderCounterRepo.incrementForVendor(
          group.vendor_id,
          startOfToday(),
          50,
          tx
        );

        serializedOrders.push(serializeOrder(updated, {} as any));
      }

      let masterAmountToCharge = summary.total;
      if (summary.groups.length === 1 && summary.groups[0]?.delivery_configs) {
         const configs = summary.groups[0].delivery_configs;
         if (configs) {
           const deliveryInfo = getDeliveryOptionConfig(input.delivery_slot, configs);
           const optConfig = deliveryInfo.config;
           if (paymentType === "ADVANCE" && optConfig.advance_payment_enabled) {
             const advancePct = optConfig.advance_percentage || 20;
             masterAmountToCharge = advancePct <= 0 || advancePct >= 100 ? summary.total : Math.max(1, Math.round(summary.total * (advancePct / 100) * 100) / 100);
           }
         }
      }
      if (masterAmountToCharge > 0 && masterAmountToCharge < 1) { masterAmountToCharge = 1; }

      const paymentRecord = await paymentRepo.createForOrder({
         master_order_id: masterOrder.id,
         amount: masterAmountToCharge,
         method: "RAZORPAY",
         razorpay_order_id: verifiedPayment.razorpay_order_id,
      }, tx);

      await paymentRepo.claimAsPaid(paymentRecord.id, { razorpay_payment_id: verifiedPayment.razorpay_payment_id, razorpay_signature: verifiedPayment.razorpay_signature });

      for (let i = 0; i < serializedOrders.length; i++) {
          serializedOrders[i]!.payment = { ...paymentRecord, status: "PAID" } as any;
      }

      const reservationItems = computations.flatMap((c) =>
        c.group.items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          name: item.name,
        }))
      );
      await inventoryRepo.reserveAvailable(reservationItems, tx);

      if (summary.coupon) {
        const firstOrderId = serializedOrders[0]?.order.id;
        if (firstOrderId) {
          await couponRepo.claimUsage(summary.coupon.id, firstOrderId, userId, summary.discount, tx);
        }
      }
    });

    await cartRepo.clear(cart.id);

    for (let i = 0; i < computations.length; i++) {
      const { group, groupTotal } = computations[i]!;
      const entry = serializedOrders[i];
      if (!entry) continue;

      // Publish stock updates to shop realtime
      for (const item of group.items) {
        productRepo.findById(item.product_id).then((product) => {
          if (product) {
            realtime.publishShopProductUpdate(group.vendor_id, item.product_id, {
              stock: product.stock,
              is_available: product.is_available,
            });
          }
        }).catch(() => {});
      }

      await notificationService.orderStatus(
        userId,
        entry.order.order_number,
        "Order Confirmed & Paid",
        `Your order ${entry.order.order_number} has been placed and paid successfully (₹${groupTotal}).`,
        { order_id: entry.order.id }
      );

      const vendor = await findVendorById(group.vendor_id);
      if (vendor) {
        const customerName = (req.user as any)?.name || address?.label || "Customer";
        const customerPhone = address?.phone || (req.user as any)?.phone || undefined;
        const deliverySlot = input.delivery_slot || "Standard Delivery";

        await notificationService.vendor(
          vendor.user_id,
          "New Paid Order Received! 🛒",
          `Order #${entry.order.order_number} has been paid online (${group.items.length} items, ₹${groupTotal}).`,
          {
            order_id: entry.order.id,
            order_number: entry.order.order_number,
            total: groupTotal,
            customer_name: customerName,
            delivery_slot: deliverySlot,
            payment_method: "RAZORPAY",
          }
        );

        realtime.publishVendorOrder(group.vendor_id, {
          order_id: entry.order.id,
          order_number: entry.order.order_number,
          total: groupTotal,
          items_count: group.items.length,
          customer_name: customerName,
          customer_phone: customerPhone,
          delivery_slot: deliverySlot,
          payment_method: "RAZORPAY",
          items: group.items.map((it) => ({
            name: it.name,
            quantity: it.quantity,
            price: it.unit_price,
          })),
          created_at: new Date().toISOString(),
        });
      }
    }

    await auditService.record(
      {
        userId,
        action: AUDIT_ACTIONS.ORDER_PLACED,
        entityType: "order",
        entityId: serializedOrders.map((o) => o.order.id).join(","),
        newValues: { count: serializedOrders.length, total: summary.total, payment_method: "RAZORPAY" },
      },
      req
    );

    return { summary, orders: serializedOrders, master_order_id: outMasterOrderId };
  },
};
