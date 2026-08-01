import type { Request } from "express";

import { AUDIT_ACTIONS } from "../constants/auth";
import { DEFAULT_CURRENCY, TAX_RATE_PERCENT } from "../constants";
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
import { findById as findVendorById } from "../repositories/vendor.repository";
import { razorpayGateway } from "../payments/razorpay.gateway";
import { ApiError, NotFoundError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";
import { generateDeliveryOtp, generateInvoiceNumber, generateOrderNumber } from "../utils/order";
import type { CheckoutPreviewBody, PlaceOrderBody } from "../validators/checkout.validators";

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

function computeDeliveryFee(vendorSubtotal: number, minOrder: number, deliveryFee: number): number {
  if (minOrder > 0 && vendorSubtotal >= minOrder) {
    return 0;
  }
  return deliveryFee;
}

export interface CheckoutSummaryItem {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface CheckoutGroup {
  vendor_id: string;
  vendor_name: string;
  items: CheckoutSummaryItem[];
  items_subtotal: number;
  delivery_fee: number;
  min_order: number;
}

export interface CheckoutSummary {
  groups: CheckoutGroup[];
  items_subtotal: number;
  delivery_fee: number;
  discount: number;
  tax: number;
  total: number;
  coupon: { id: string; code: string; type: string; discount: number } | null;
  currency: string;
}

export const checkoutService = {
  async preview(userId: string, input: CheckoutPreviewBody, req: Request): Promise<CheckoutSummary> {
    const cart = await cartService.getMyCart(userId);
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

    const summaryGroups: CheckoutGroup[] = [];
    let itemsSubtotal = 0;
    let deliveryFee = 0;

    for (const group of groups) {
      const vendor = await findVendorById(group.vendor_id);
      if (!vendor) {
        throw new ApiError(HttpStatus.BAD_REQUEST, "One of the vendors is no longer available.", { code: "INVALID_VENDOR" });
      }
      const vendorDeliveryFee = computeDeliveryFee(group.subtotal, vendor.min_order.toNumber(), vendor.delivery_fee.toNumber());
      summaryGroups.push({
        vendor_id: group.vendor_id,
        vendor_name: vendor.business_name,
        items: group.items.map((item) => ({
          product_id: item.product_id,
          name: item.product.name,
          quantity: item.quantity,
          unit_price: item.price_snapshot.toNumber(),
          line_total: item.price_snapshot.toNumber() * item.quantity,
        })),
        items_subtotal: Math.round(group.subtotal * 100) / 100,
        delivery_fee: Math.round(vendorDeliveryFee * 100) / 100,
        min_order: vendor.min_order.toNumber(),
      });
      itemsSubtotal += group.subtotal;
      deliveryFee += vendorDeliveryFee;
    }

    itemsSubtotal = Math.round(itemsSubtotal * 100) / 100;
    deliveryFee = Math.round(deliveryFee * 100) / 100;

    let discount = 0;
    let couponInfo: CheckoutSummary["coupon"] = null;

    if (input.coupon_code) {
      const { coupon, discount: couponDiscount } = await couponService.validateForCart(input.coupon_code, cart, userId);
      discount = Math.round(couponDiscount * 100) / 100;
      const freeDelivery = coupon.type === "FREE_DELIVERY";
      if (freeDelivery) {
        deliveryFee = 0;
      }
      couponInfo = { id: coupon.id, code: coupon.code, type: coupon.type, discount };
    }

    const taxable = Math.max(0, itemsSubtotal - discount);
    const tax = Math.round((taxable * TAX_RATE_PERCENT) / 100 * 100) / 100;
    const total = Math.round((itemsSubtotal + deliveryFee - discount + tax) * 100) / 100;

    return {
      groups: summaryGroups,
      items_subtotal: itemsSubtotal,
      delivery_fee: deliveryFee,
      discount,
      tax,
      total,
      coupon: couponInfo,
      currency: DEFAULT_CURRENCY,
    };
  },

  async placeOrder(userId: string, input: PlaceOrderBody, req: Request) {
    const cart = await cartService.getMyCart(userId);
    const groups = groupByVendor(cart);
    const summary = await this.buildSummary(cart, groups, input, userId);

    const address = await findAddressById(input.address_id);
    if (!address || address.user_id !== userId) {
      throw new NotFoundError("Address not found.");
    }
    if (address.deleted_at) {
      throw new NotFoundError("Address not found.");
    }

    await this.validateStock(groups);

    const idempotencyKey = input.idempotency_key ?? undefined;
    const orders = [];
    const paymentMethod = input.payment_method ?? "RAZORPAY";

    for (const group of summary.groups) {
      const orderNumber = generateOrderNumber();
      const order = await orderRepo.createOrder({
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
        items: group.items.map((item) => ({
          product_id: item.product_id,
          product_name: item.name,
          unit: "",
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.line_total,
        })),
      });

      // Allocate shared summary values: subtotal/discount/tax are apportioned per group.
      const groupSubtotal = group.items_subtotal;
      const groupDiscount = summary.discount > 0
        ? Math.round((summary.discount * groupSubtotal / summary.items_subtotal) * 100) / 100
        : 0;
      const groupTaxable = Math.max(0, groupSubtotal - groupDiscount);
      const groupTax = Math.round((groupTaxable * TAX_RATE_PERCENT) / 100 * 100) / 100;
      const groupTotal = Math.round((groupSubtotal + group.delivery_fee - groupDiscount + groupTax) * 100) / 100;

      const invoiceNumber = generateInvoiceNumber(orderNumber);
      const updated = await orderRepo.updateOrder(order.id, {
        discount: groupDiscount,
        tax: groupTax,
        total: groupTotal,
        invoice_number: invoiceNumber,
        idempotency_key: idempotencyKey ?? null,
        otp_code: paymentMethod === "COD" ? generateDeliveryOtp() : null,
      });

      await orderRepo.updateOrderStatus(order.id, {
        status: "PENDING",
        note: "Order placed. Awaiting payment confirmation.",
        actorType: "customer",
        actorId: userId,
      });

      let payment;
      if (paymentMethod === "RAZORPAY") {
        const razorpayOrder = await razorpayGateway.createOrder({
          amountPaise: Math.round(groupTotal * 100),
          currency: DEFAULT_CURRENCY,
          receipt: orderNumber,
          notes: { order_number: orderNumber, user_id: userId },
        });
        payment = await paymentRepo.createForOrder({
          order_id: order.id,
          amount: groupTotal,
          method: "RAZORPAY",
          razorpay_order_id: razorpayOrder.id,
        });
      } else {
        payment = await paymentRepo.createForOrder({
          order_id: order.id,
          amount: groupTotal,
          method: "COD",
        });
        await orderRepo.updateOrderStatus(order.id, {
          status: "CONFIRMED",
          note: "Order confirmed for Cash on Delivery.",
          actorType: "system",
        });
      }

      orders.push({ order: updated, payment });
    }

    await cartRepo.clear(cart.id);

    if (summary.coupon) {
      const perOrderDiscount = Math.round((summary.discount / summary.groups.length) * 100) / 100;
      for (const order of orders) {
        await couponRepo.recordUsage(summary.coupon.id, order.order.id, userId, perOrderDiscount);
      }
    }

    for (const order of orders) {
      await notificationService.orderStatus(
        userId,
        order.order.order_number,
        "Order placed",
        `Your order ${order.order.order_number} has been placed successfully.`,
        { order_id: order.order.id }
      );
    }

    await auditService.record(
      { userId, action: AUDIT_ACTIONS.ORDER_PLACED, entityType: "order", entityId: orders.map((o) => o.order.id).join(","), newValues: { count: orders.length, total: summary.total, payment_method: paymentMethod } },
      req
    );

    return { summary, orders };
  },

  async validateStock(groups: VendorGroup[]): Promise<void> {
    for (const group of groups) {
      for (const item of group.items) {
        const inventory = await inventoryRepo.findByProductId(item.product_id);
        const available = inventory ? inventory.quantity - inventory.reserved : null;
        if (available !== null && available < item.quantity) {
          throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, `Insufficient stock for "${item.product.name}".`, {
            code: "INSUFFICIENT_STOCK",
          });
        }
      }
    }
  },

  async reserveInventory(orders: Array<{ order: orderRepo.OrderRow; payment: paymentRepo.PaymentRow }>): Promise<void> {
    for (const { order } of orders) {
      const detail = await orderRepo.findById(order.id);
      if (!detail) continue;
      for (const item of detail.items) {
        await inventoryRepo.reserveQuantity(item.product_id, item.quantity);
      }
    }
  },
};
