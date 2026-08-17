import type { Request } from "express";
import type { Prisma } from "@prisma/client";
import prisma from "../database/prisma";

import { AUDIT_ACTIONS } from "../constants/auth";
import { DEFAULT_CURRENCY, OTP_TTL_MINUTES, TAX_RATE_PERCENT } from "../constants";
import { auditService } from "./audit.service";
import { cartService } from "./cart.service";
import { couponService } from "./coupon.service";
import { notificationService } from "./notification.service";
import * as cartRepo from "../repositories/cart.repository";
import * as couponRepo from "../repositories/coupon.repository";
import * as inventoryRepo from "../repositories/inventory.repository";
import * as orderRepo from "../repositories/order.repository";
import * as paymentRepo from "../repositories/payment.repository";
import { findById as findAddressById } from "../repositories/address.repository";
import { settingsService } from "./settings.service";
import { SETTING_KEYS } from "../constants/settings";
import { findById as findVendorById } from "../repositories/vendor.repository";
import { razorpayGateway } from "../payments/razorpay.gateway";
import { ApiError, NotFoundError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";
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

/** Case-insensitive check for self-pickup or booking delivery slot. */
function isSelfPickupSlot(deliverySlot?: string | null): boolean {
  if (!deliverySlot) return false;
  const normalized = deliverySlot.toLowerCase();
  return (
    normalized.includes("self") ||
    normalized.includes("pickup") ||
    normalized.includes("takeaway") ||
    normalized.includes("book")
  );
}

function isAdvanceRequiredSlot(deliverySlot?: string | null): boolean {
  if (!deliverySlot) return false;
  const normalized = deliverySlot.toLowerCase();
  return (
    normalized.includes("self") ||
    normalized.includes("pickup") ||
    normalized.includes("takeaway") ||
    normalized.includes("book")
  );
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
      const vendorDeliveryFee = computeOptionDeliveryFee(
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
        effectiveMinOrder = deliveryConfigs.booking.min_order;
      } else if (slotRaw.includes("self") || slotRaw.includes("pickup") || slotRaw.includes("takeaway")) {
        effectiveMinOrder = deliveryConfigs.self_pickup.min_order;
      } else if (slotRaw.includes("shop")) {
        effectiveMinOrder = deliveryConfigs.shop_delivery.min_order;
      } else {
        effectiveMinOrder = (deliveryConfigs.delivery_partner.min_order !== undefined && deliveryConfigs.delivery_partner.min_order > 0)
          ? deliveryConfigs.delivery_partner.min_order
          : (vendor.min_order && vendor.min_order.toNumber() > 0 ? vendor.min_order.toNumber() : globalMinOrderValue);
      }

      const advancePct = slotRaw.includes("book")
        ? deliveryConfigs.booking.advance_percentage
        : deliveryConfigs.self_pickup.advance_percentage;

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

    const tax = totalTax;
    const total = Math.round((itemsSubtotal + deliveryFee - discount + tax) * 100) / 100;

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

    const idempotencyKey = input.idempotency_key ?? undefined;
    const paymentMethod = input.payment_method ?? "RAZORPAY";
    const requestHash = idempotencyKey ? computeRequestHash(userId, input, summary) : null;

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
    const computations = summary.groups.map((group) => {
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
      const groupTotal = Math.round((groupSubtotal + group.delivery_fee - groupDiscount + groupTax) * 100) / 100;
      return { group, groupDiscount, groupTax, groupTotal, orderNumber: generateOrderNumber() };
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
    const gatewayOrders = await Promise.all(
      computations.map((c) => {
        let amountToCharge = c.groupTotal;
        if (isSelfPickupSlot(input.delivery_slot) && amountToCharge > 0) {
          // Require upfront online payment for Self Pickup based on vendor settings
          const advancePct = c.group.advance_payment_percentage ?? 10;
          amountToCharge = advancePct === 0 ? amountToCharge : Math.max(1, Math.round(amountToCharge * (advancePct / 100) * 100) / 100);
        }
        if (amountToCharge > 0 && amountToCharge < 1) {
          amountToCharge = 1; // Razorpay minimum is 1 INR
        }
        
        return paymentMethod === "RAZORPAY" && amountToCharge > 0
          ? razorpayGateway.createOrder({
              amountPaise: Math.round(amountToCharge * 100),
              currency: DEFAULT_CURRENCY,
              receipt: c.orderNumber,
              notes: { order_number: c.orderNumber, user_id: userId, delivery_slot: input.delivery_slot || "" },
            })
          : undefined
      })
    );

    const serializedOrders: Array<{ order: SerializedOrder; payment: SerializedPayment }> = [];

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

        for (let i = 0; i < computations.length; i++) {
          const { group, groupDiscount, groupTax, groupTotal, orderNumber } = computations[i]!;

          const order = await orderRepo.createOrder(
            {
              order_number: orderNumber,
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
              delivery_note: input.delivery_slot || (isAdvanceRequiredSlot(input.delivery_slot) ? "Self Pickup" : "Delivery partner"),
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

          let payment;
          if (paymentMethod === "RAZORPAY") {
            let amountCharged = groupTotal;
            if (isSelfPickupSlot(input.delivery_slot) && amountCharged > 0) {
              const advancePct = group.advance_payment_percentage ?? 10;
              amountCharged = advancePct === 0 ? amountCharged : Math.max(1, Math.round(amountCharged * (advancePct / 100) * 100) / 100);
            }
            if (amountCharged > 0 && amountCharged < 1) {
              amountCharged = 1;
            }
            if (amountCharged === 0) {
              payment = await paymentRepo.createForOrder(
                {
                  order_id: order.id,
                  amount: 0,
                  method: "COD",
                },
                tx
              );
            } else {
              payment = await paymentRepo.createForOrder(
                {
                  order_id: order.id,
                  amount: amountCharged,
                  method: "RAZORPAY",
                  razorpay_order_id: gatewayOrders[i]?.id,
                },
                tx
              );
            }
          } else {
            payment = await paymentRepo.createForOrder(
              {
                order_id: order.id,
                amount: groupTotal,
                method: "COD",
              },
              tx
            );
            await orderRepo.updateOrderStatus(
              order.id,
              { status: "CONFIRMED", note: "Order confirmed for Cash on Delivery.", actorType: "system" },
              tx
            );
          }

          serializedOrders.push(serializeOrder(updated, payment));
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
    }

    for (const entry of serializedOrders) {
      await notificationService.orderStatus(
        userId,
        entry.order.order_number,
        "Order placed",
        `Your order ${entry.order.order_number} has been placed successfully.`,
        { order_id: entry.order.id }
      );
    }

    await auditService.record(
      { userId, action: AUDIT_ACTIONS.ORDER_PLACED, entityType: "order", entityId: serializedOrders.map((o) => o.order.id).join(","), newValues: { count: serializedOrders.length, total: summary.total, payment_method: paymentMethod } },
      req
    );

    return { summary, orders: serializedOrders };
  },
};
