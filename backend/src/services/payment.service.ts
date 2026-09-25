import type { Request } from "express";

import { env } from "../config";
import { AUDIT_ACTIONS } from "../constants/auth";
import { auditService } from "./audit.service";
import { notificationService } from "./notification.service";
import { realtime } from "../realtime/realtime";
import { cacheService } from "../database/cache";
import prisma from "../database/prisma";
import * as paymentRepo from "../repositories/payment.repository";
import * as orderRepo from "../repositories/order.repository";
import * as transactionRepo from "../repositories/transaction.repository";
import * as settingsRepo from "../repositories/settings.repository";
import { SETTING_KEYS } from "../constants/settings";
import { findById as findOrderById, findMasterOrderById, updateMasterOrderStatus } from "../repositories/order.repository";
import { MasterOrderStatus } from "@prisma/client";
import { razorpayGateway } from "../payments/razorpay.gateway";
import { subscriptionPaymentService } from "./subscription-payment.service";
import { reverseOrderEarnings } from "./earning.service";
import { payoutService } from "./payout.service";
import { checkoutService } from "./checkout.service";
import log from "../config/logger";
import type { InitiateCheckoutPaymentBody } from "../validators/payment.validators";
import { ApiError, NotFoundError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";

// Razorpay statuses for which the payment amount can be trusted as captured.
// `authorized` is accepted for merchants that use manual capture; both must still
// pass the amount/currency/order checks below.
const ACCEPTABLE_PAYMENT_STATUSES = new Set(["captured", "authorized"]);

interface CapturedPaymentEntity {
  id?: string;
  order_id?: string;
  status?: string;
  amount?: number;
  currency?: string;
}

function expectedAmountPaise(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Verifies that a captured payment entity from Razorpay matches the persisted
 * order: it belongs to the expected razorpay order, has an acceptable status,
 * and the captured amount + currency equal the expected payment amount.
 * The expected amount is derived from the persisted payment, never from the
 * frontend or from a client-supplied value.
 */
function assertCapturedPayment(
  entity: CapturedPaymentEntity,
  payment: { razorpay_order_id: string | null; currency: string; amount: { toNumber: () => number } }
): void {
  if (!entity.id || !entity.order_id || !entity.status || typeof entity.amount !== "number") {
    throw new ApiError(HttpStatus.BAD_REQUEST, "Payment verification failed: incomplete gateway data.", {
      code: "PAYMENT_VERIFICATION_FAILED",
    });
  }
  if (payment.razorpay_order_id && entity.order_id !== payment.razorpay_order_id) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "Payment does not belong to this order.", {
      code: "PAYMENT_ORDER_MISMATCH",
    });
  }
  if (!ACCEPTABLE_PAYMENT_STATUSES.has(entity.status)) {
    throw new ApiError(HttpStatus.BAD_REQUEST, `Payment status is not acceptable (${entity.status}).`, {
      code: "PAYMENT_STATUS_NOT_ACCEPTABLE",
    });
  }
  if (entity.amount !== expectedAmountPaise(payment.amount.toNumber())) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "Captured amount does not match the expected payment amount.", {
      code: "PAYMENT_AMOUNT_MISMATCH",
    });
  }
  if (entity.currency && entity.currency !== (payment.currency || "INR")) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "Payment currency does not match the expected currency.", {
      code: "PAYMENT_CURRENCY_MISMATCH",
    });
  }
}

export const paymentService = {
  async verifyPayment(userId: string, input: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }, req: Request) {
    const payment = await paymentRepo.findByRazorpayOrderId(input.razorpay_order_id);
    if (!payment) {
      throw new NotFoundError("Payment not found.");
    }

    let order: any = null;
    let isMaster = false;
    if (payment.master_order_id) {
        order = await prisma.masterOrder.findUnique({ where: { id: payment.master_order_id }, include: { orders: { include: { vendor: true, items: true, customer: true } } } });
        isMaster = true;
    } else if (payment.order_id) {
        order = await prisma.order.findUnique({ where: { id: payment.order_id }, include: { vendor: true, items: true, customer: true } });
    }
    
    if (!order) {
      throw new NotFoundError("Order not found.");
    }
    const isOwner = order.user_id === userId;
    const isAssignedDelivery = req.user?.role === "delivery" && (
      !order.delivery_partner_id ||
      order.delivery_partner_id === req.user?.delivery_id ||
      order.delivery_partner_id === req.user?.id ||
      req.user?.role === "delivery"
    );
    if (!isOwner && !isAssignedDelivery) {
      throw new ApiError(HttpStatus.FORBIDDEN, "You do not own this order.", { code: "FORBIDDEN" });
    }

    if (payment.status === "PAID") {
      return { payment, order };
    }

    const valid = razorpayGateway.verifySignature({
      orderId: input.razorpay_order_id,
      paymentId: input.razorpay_payment_id,
      signature: input.razorpay_signature,
    });
    if (!valid) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Invalid payment signature.", { code: "INVALID_SIGNATURE" });
    }

    let entity: any;
    try {
      entity = await razorpayGateway.fetchPayment(input.razorpay_payment_id);
    } catch {
      throw new ApiError(HttpStatus.BAD_GATEWAY, "Unable to verify payment with the payment gateway.", {
        code: "PAYMENT_VERIFICATION_FAILED",
      });
    }

    assertCapturedPayment(entity, payment);

    const claimed = await paymentRepo.claimAsPaid(payment.id, {
      razorpay_payment_id: input.razorpay_payment_id,
      razorpay_signature: input.razorpay_signature,
      gateway_response: entity as never,
    });
    if (claimed === 0) {
      const paidPayment = await paymentRepo.findByRazorpayOrderId(input.razorpay_order_id);
      return { payment: paidPayment ?? payment, order };
    }

    const updatedPayment = await paymentRepo.findByRazorpayOrderId(input.razorpay_order_id) ?? payment;
    const amountPaid = payment.amount.toNumber();

    if (isMaster) {
        await prisma.masterOrder.update({
            where: { id: order.id },
            data: { payment_status: "PAID", payment_method: "RAZORPAY", status: order.status === "PENDING" ? "ACCEPTED" : undefined }
        });
        
        for (const subOrder of order.orders) {
            await prisma.order.update({ where: { id: subOrder.id }, data: { payment_status: "PAID", payment_method: "RAZORPAY" } });
            if (subOrder.status === "PENDING" || subOrder.status === "CONFIRMED") {
                await prisma.order.update({ where: { id: subOrder.id }, data: { status: "CONFIRMED" } });
            }
            // notification logic for suborder
            if (subOrder.vendor?.user_id) {
               await realtime.publishVendorOrder(subOrder.vendor_id, {
                 order_id: subOrder.id,
                 order_number: subOrder.order_number,
                 total: Number(subOrder.total),
                 items_count: subOrder.items?.length ?? 0,
                 customer_name: subOrder.customer?.name ?? undefined,
                 customer_phone: subOrder.customer?.phone ?? undefined,
                 payment_method: "RAZORPAY",
                 items: subOrder.items?.map((it: any) => ({
                   name: it.product_name,
                   quantity: it.quantity,
                   price: Number(it.total_price),
                 })) || [],
                 created_at: new Date().toISOString(),
               });
            }
        }
    } else {
        await prisma.order.update({ where: { id: order.id }, data: { payment_status: "PAID", payment_method: "RAZORPAY" } });
        if (order.status === "PENDING" || order.status === "CONFIRMED") {
            await prisma.order.update({ where: { id: order.id }, data: { status: "CONFIRMED" } });
        }
    }

    await transactionRepo.create({
      order_id: isMaster ? order.orders[0].id : order.id,
      payment_id: payment.id,
      user_id: userId,
      type: "DEBIT",
      amount: amountPaid,
      status: "success",
      reference: input.razorpay_payment_id,
      metadata: { razorpay_order_id: input.razorpay_order_id },
    });

    await auditService.record(
      { userId, action: AUDIT_ACTIONS.PAYMENT_VERIFIED, entityType: "payment", entityId: payment.id, newValues: { razorpay_payment_id: input.razorpay_payment_id, order_id: order.id, amount: amountPaid } },
      req
    );

    return { payment: updatedPayment, order };
  },

  async handleWebhook(body: string, signature: string | undefined, req: Request): Promise<{ handled: string }> {
    if (!signature) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, "Missing webhook signature.", { code: "INVALID_SIGNATURE" });
    }
    const valid = razorpayGateway.verifyWebhookSignature({ body, signature });
    if (!valid) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, "Invalid webhook signature.", { code: "INVALID_SIGNATURE" });
    }

    const payload = JSON.parse(body) as {
      event?: string;
      event_id?: string;
      payload?: {
        payment?: { entity?: Record<string, unknown> };
        order?: { entity?: Record<string, unknown> };
        subscription?: { entity?: Record<string, unknown> };
      };
    };

    const event = payload.event ?? "";
    const paymentEntity = payload.payload?.payment?.entity;
    const subscriptionEntity = payload.payload?.subscription?.entity;

    const SUBSCRIPTION_EVENTS = new Set([
      "subscription.charged",
      "subscription.activated",
      "subscription.completed",
      "subscription.cancelled",
      "subscription.paused",
      "subscription.resumed",
    ]);

    if (SUBSCRIPTION_EVENTS.has(event)) {
      const handled = await subscriptionPaymentService.handleSubscriptionWebhook(event, subscriptionEntity ?? {}, paymentEntity);
      await auditService.record(
        { actorType: "system", action: AUDIT_ACTIONS.PAYMENT_VERIFIED, entityType: "webhook", newValues: { event, subscription: handled } },
        req
      );
      return { handled: event };
    }

    if (event === "payment.failed" && paymentEntity?.subscription_id) {
      await subscriptionPaymentService.markPaymentFailed(
        paymentEntity.subscription_id as string,
        (paymentEntity.error_description as string) ?? null
      );
      await auditService.record(
        { actorType: "system", action: AUDIT_ACTIONS.PAYMENT_VERIFIED, entityType: "webhook", newValues: { event } },
        req
      );
      return { handled: event };
    }

    if (event === "payment.captured" && paymentEntity) {
      const dedupeKey = `${event}:${(paymentEntity.id as string) ?? payload.event_id ?? "unknown"}`;
      const alreadyHandled = await cacheService.get<boolean>("webhook", dedupeKey);
      if (alreadyHandled === true) {
        return { handled: `${event}:replayed` };
      }
      await this.handlePaymentCaptured(paymentEntity as never);
      await cacheService.set("webhook", dedupeKey, true, env.CACHE_TTL_SECONDS_DEFAULT * 60);
    }

    if (event === "payment_link.paid") {
      const plinkEntity = (payload.payload as any)?.payment_link?.entity;
      const rzpOrderId = plinkEntity?.order_id || (paymentEntity as any)?.order_id;
      const notesOrderId = plinkEntity?.notes?.order_id || (paymentEntity as any)?.notes?.order_id;
      const isMaster = plinkEntity?.notes?.is_master === "true" || (paymentEntity as any)?.notes?.is_master === "true";

      let payment = rzpOrderId ? await paymentRepo.findByRazorpayOrderId(rzpOrderId) : null;
      if (!payment && notesOrderId) {
        payment = isMaster ? await paymentRepo.findByMasterOrderId(notesOrderId) : await paymentRepo.findByOrderId(notesOrderId);
      }
      if (payment && payment.status !== "PAID") {
        await this.finalizePaymentAsPaid({
          payment,
          razorpayPaymentId: paymentEntity?.id || plinkEntity?.id || `plink_pay_${Date.now()}`,
          gatewayResponse: { payment_link: plinkEntity, payment: paymentEntity },
          source: "webhook:payment_link.paid",
        });
      }
    }

    if (event === "qr_code.credited") {
      const qrEntity = (payload.payload as any)?.qr_code?.entity;
      const qrPaymentEntity = (payload.payload as any)?.payment?.entity;
      const notesOrderId = qrEntity?.notes?.order_id || qrPaymentEntity?.notes?.order_id;
      const isMaster = qrEntity?.notes?.is_master === "true" || qrPaymentEntity?.notes?.is_master === "true";

      let payment = notesOrderId ? (isMaster ? await paymentRepo.findByMasterOrderId(notesOrderId) : await paymentRepo.findByOrderId(notesOrderId)) : null;
      if (payment && payment.status !== "PAID") {
        await this.finalizePaymentAsPaid({
          payment,
          razorpayPaymentId: qrPaymentEntity?.id || qrEntity?.id || `qr_pay_${Date.now()}`,
          gatewayResponse: { qr_code: qrEntity, payment: qrPaymentEntity },
          source: "webhook:qr_code.credited",
        });
      }
    }

    await auditService.record(
      { actorType: "system", action: AUDIT_ACTIONS.PAYMENT_VERIFIED, entityType: "webhook", newValues: { event } },
      req
    );

    return { handled: event };
  },

  async finalizePaymentAsPaid(params: {
    payment: any;
    razorpayPaymentId: string;
    gatewayResponse?: any;
    source?: string;
  }): Promise<void> {
    const { payment, razorpayPaymentId, gatewayResponse, source } = params;
    if (!payment || payment.status === "PAID") return;

    let order: any = null;
    let isMaster = false;
    if (payment.master_order_id) {
      order = await prisma.masterOrder.findUnique({
        where: { id: payment.master_order_id },
        include: { orders: { include: { vendor: true, items: true, customer: true } }, customer: true },
      });
      isMaster = true;
    } else if (payment.order_id) {
      order = await prisma.order.findUnique({
        where: { id: payment.order_id },
        include: { vendor: true, items: true, customer: true },
      });
    }

    if (!order) return;

    const claimed = await paymentRepo.claimAsPaid(payment.id, {
      razorpay_payment_id: razorpayPaymentId,
      gateway_response: gatewayResponse as never,
      webhook_events: { captured: true, source: source || "gateway" },
    });
    if (claimed === 0) return;

    const amountPaid = payment.amount.toNumber();

    if (isMaster) {
      await prisma.masterOrder.update({
        where: { id: order.id },
        data: {
          payment_status: "PAID",
          payment_method: "RAZORPAY",
          status: order.status === "PENDING" ? "ACCEPTED" : undefined,
        },
      });

      for (const subOrder of order.orders) {
        await prisma.order.update({
          where: { id: subOrder.id },
          data: { payment_status: "PAID", payment_method: "RAZORPAY" },
        });
        if (subOrder.status === "PENDING" || subOrder.status === "CONFIRMED") {
          await orderRepo.updateOrderStatus(subOrder.id, {
            status: "CONFIRMED",
            note: "Payment confirmed via Razorpay.",
            actorType: "system",
          });
        }
        if (subOrder.vendor?.user_id) {
          await realtime.publishVendorOrder(subOrder.vendor_id, {
            order_id: subOrder.id,
            order_number: subOrder.order_number,
            total: Number(subOrder.total),
            items_count: subOrder.items?.length ?? 0,
            customer_name: subOrder.customer?.name ?? undefined,
            customer_phone: subOrder.customer?.phone ?? undefined,
            payment_method: "RAZORPAY",
            items: subOrder.items?.map((it: any) => ({
              name: it.product_name,
              quantity: it.quantity,
              price: Number(it.total_price),
            })) || [],
            created_at: new Date().toISOString(),
          });
          await payoutService.settleVendorOrderEarnings(subOrder.id, razorpayPaymentId).catch(() => {});
        }
      }
    } else {
      await orderRepo.updateOrder(order.id, {
        payment_status: "PAID",
        payment_method: "RAZORPAY",
      });
      if (order.status === "PENDING" || order.status === "CONFIRMED") {
        await orderRepo.updateOrderStatus(order.id, {
          status: "CONFIRMED",
          note: "Payment confirmed via Razorpay.",
          actorType: "system",
        });
      }
      if (order.vendor?.user_id) {
        await realtime.publishVendorOrder(order.vendor_id, {
          order_id: order.id,
          order_number: order.order_number,
          total: amountPaid,
          items_count: order.items?.length ?? 0,
          customer_name: order.customer?.name ?? undefined,
          customer_phone: order.customer?.phone ?? undefined,
          payment_method: "RAZORPAY",
          items: order.items?.map((it: any) => ({
            name: it.product_name,
            quantity: it.quantity,
            price: Number(it.total_price),
          })),
          created_at: new Date().toISOString(),
        });
        await payoutService.settleVendorOrderEarnings(order.id, razorpayPaymentId).catch(() => {});
      }
    }

    await transactionRepo.create({
      order_id: isMaster ? order.orders[0].id : order.id,
      payment_id: payment.id,
      user_id: order.user_id,
      type: "DEBIT",
      amount: amountPaid,
      status: "success",
      reference: razorpayPaymentId,
      metadata: { source: source || "razorpay" },
    });

    await notificationService.orderStatus(
      order.user_id,
      order.order_number,
      "Order confirmed",
      `Your payment of ₹${amountPaid.toFixed(2)} for order ${order.order_number} has been verified and confirmed.`,
      { order_id: order.id }
    ).catch(() => {});

    await notificationService.payment(
      order.user_id,
      "Payment successful",
      `Your payment of ₹${amountPaid.toFixed(2)} for ${order.order_number} was successful.`,
      { order_id: order.id }
    ).catch(() => {});
  },

  async handlePaymentCaptured(entity: CapturedPaymentEntity): Promise<void> {
    const razorpayOrderId = entity.order_id;
    if (!razorpayOrderId) return;

    const payment = await paymentRepo.findByRazorpayOrderId(razorpayOrderId);
    if (!payment) return;

    assertCapturedPayment(entity, payment);

    await this.finalizePaymentAsPaid({
      payment,
      razorpayPaymentId: entity.id || `pay_${Date.now()}`,
      gatewayResponse: entity,
      source: "webhook:payment.captured",
    });
  },

  async refund(userId: string, orderId: string, input: { amount?: number; reason?: string }, req: Request): Promise<unknown> {
    const order = await findOrderById(orderId);
    if (!order) {
      throw new NotFoundError("Order not found.");
    }

    const payment = await paymentRepo.findByOrderId(orderId, (order as any).master_order_id);
    if (!payment) {
      throw new NotFoundError("Payment not found for this order.");
    }
    if (payment.status === "REFUNDED") {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Payment has already been refunded.", { code: "ALREADY_REFUNDED" });
    }
    if (payment.status !== "PAID" && payment.status !== "PARTIALLY_REFUNDED") {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Only paid payments can be refunded.", { code: "NOT_PAID" });
    }

    const paidAmount = payment.amount.toNumber();
    const refundedSoFar = payment.refund_amount?.toNumber() ?? 0;
    const remaining = Math.max(0, paidAmount - refundedSoFar);
    const refundAmount = input.amount ?? remaining;
    if (refundAmount <= 0 || refundAmount > remaining) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Invalid refund amount.", { code: "INVALID_REFUND_AMOUNT" });
    }

    // Atomic claim: only the first caller that marks the payment as refund-in-
    // progress proceeds to the gateway. Concurrent or replayed refunds lose the
    // claim and short-circuit here.
    const claimed = await paymentRepo.claimRefund(payment.id);
    if (claimed === 0) {
      const current = await paymentRepo.findByOrderId(orderId);
      if (current?.status === "REFUNDED") {
        return {
          refund_id: current.refund_id ?? null,
          amount: remaining,
          status: "REFUNDED",
          payment: current,
        };
      }
      throw new ApiError(HttpStatus.CONFLICT, "A refund for this payment is already being processed.", {
        code: "REFUND_IN_PROGRESS",
      });
    }

    let refund;
    try {
      refund = await razorpayGateway.refundPayment(payment.razorpay_payment_id!, {
        amountPaise: Math.round(refundAmount * 100),
        notes: input.reason,
      });
    } catch (err) {
      // The gateway call failed - release the claim so the refund can be retried
      // and leave the payment (and order) fully recoverable.
      await paymentRepo.clearRefundClaim(payment.id);
      throw err;
    }

    const cumulativeRefunded = Math.round((refundedSoFar + refundAmount) * 100) / 100;
    const fullyRefunded = cumulativeRefunded >= paidAmount;
    const updatedPayment = await paymentRepo.updatePayment(payment.id, {
      refund_id: refund.id,
      refund_amount: cumulativeRefunded,
      refund_status: refund.status,
      status: fullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED",
    });

    await transactionRepo.create({
      order_id: order.id,
      payment_id: payment.id,
      user_id: order.user_id,
      type: "CREDIT",
      amount: refundAmount,
      status: "success",
      reference: refund.id,
      metadata: { reason: input.reason ?? null },
    });

    // Reverse the vendor's and delivery partner's earnings proportionally to the
    // CUMULATIVE refunded share of the paid amount (refundedSoFar + this refund).
    // reverseOrderEarnings writes only the delta beyond what is already reversed,
    // so passing the cumulative fraction here keeps cascading partial refunds
    // converging to the total reversal. Passing the incremental fraction instead
    // would stop reversing after the first partial refund. The reversal is anchored
    // on the gateway refund id so a replayed refund event can never double-create an
    // adjustment. Orders cancelled before delivery never earned anything, so this is
    // a safe no-op for them.
    await reverseOrderEarnings(
      {
        id: order.id,
        vendor_id: order.vendor_id,
        delivery_partner_id: order.delivery_partner_id,
        total: order.total.toNumber(),
      },
      cumulativeRefunded / paidAmount,
      refund.id
    );

    await notificationService.payment(order.user_id, "Refund processed", `A refund of ₹${refundAmount.toFixed(2)} has been processed for ${order.order_number}.`, {
      order_id: order.id,
      refund_id: refund.id,
    });

    await auditService.record(
      { userId, action: AUDIT_ACTIONS.PAYMENT_REFUNDED, entityType: "payment", entityId: payment.id, newValues: { refund_id: refund.id, amount: refundAmount } },
      req
    );

    return { refund_id: refund.id, amount: refundAmount, status: refund.status, payment: updatedPayment };
  },

  async resolveOrderContext(orderId: string) {
    let order: any = await findOrderById(orderId);
    let isMasterOrder = false;
    if (order && order.master_order_id) {
      const masterOrder = await findMasterOrderById(order.master_order_id);
      if (masterOrder) {
        order = masterOrder;
        isMasterOrder = true;
      }
    } else if (!order) {
      const masterOrder = await findMasterOrderById(orderId);
      if (!masterOrder) {
        throw new NotFoundError("Order not found.");
      }
      order = masterOrder;
      isMasterOrder = true;
    }
    return {
      order,
      isMasterOrder,
      userIdOwner: order.user_id,
      paymentStatus: order.payment_status,
      orderStatus: order.status,
      orderNumber: order.order_number,
      orderTotal: isMasterOrder ? order.total_amount : order.total,
    };
  },

  async retryPayment(userId: string, orderId: string, _req: Request) {
    const { order, isMasterOrder, userIdOwner, paymentStatus, orderStatus, orderNumber, orderTotal } = await this.resolveOrderContext(orderId);
    const isOwner = userIdOwner === userId;
    const isAssignedDelivery = _req.user?.role === "delivery" && (
      !order.delivery_partner_id ||
      order.delivery_partner_id === _req.user?.delivery_id ||
      order.delivery_partner_id === _req.user?.id ||
      _req.user?.role === "delivery"
    );
    if (!isOwner && !isAssignedDelivery) {
      throw new ApiError(HttpStatus.FORBIDDEN, "You do not own this order.", { code: "FORBIDDEN" });
    }
    if (paymentStatus === "PAID") {
      throw new ApiError(HttpStatus.BAD_REQUEST, "This order is already paid.", { code: "ALREADY_PAID" });
    }
    if (orderStatus === "CANCELLED") {
      // Re-activate order to PENDING so customer can pay
      if (isMasterOrder) {
        await updateMasterOrderStatus(order.id, "PENDING" as MasterOrderStatus);
      } else {
        await orderRepo.updateOrderStatus(order.id, {
          status: "PENDING",
          note: "Customer retrying payment",
          actorType: "customer",
        });
      }
    }

    const existingPayment = isMasterOrder 
      ? await paymentRepo.findByMasterOrderId(order.id)
      : await paymentRepo.findByOrderId(order.id);
      
    const amountToCharge = Number(existingPayment?.amount && Number(existingPayment.amount) > 0 ? existingPayment.amount : orderTotal);
    const amountPaise = Math.max(100, Math.round(amountToCharge * 100)); // minimum 1 INR for Razorpay

    const gatewayOrder = await razorpayGateway.createOrder({
      amountPaise,
      currency: "INR",
      receipt: orderNumber,
      notes: {
        order_number: orderNumber,
        user_id: userId,
        retry: "true",
      },
    });

    if (existingPayment) {
      await paymentRepo.updatePayment(existingPayment.id, {
        razorpay_order_id: gatewayOrder.id,
        amount: amountToCharge as any,
        method: "RAZORPAY" as never,
        status: "PENDING",
      });
    } else {
      await paymentRepo.createForOrder({
        order_id: isMasterOrder ? undefined : order.id,
        master_order_id: isMasterOrder ? order.id : undefined,
        amount: amountToCharge,
        method: "RAZORPAY",
        razorpay_order_id: gatewayOrder.id,
      });
    }

    return {
      order_id: order.id,
      order_number: order.order_number,
      amount: amountToCharge,
      currency: "INR",
      razorpay_order_id: gatewayOrder.id,
      key: env.RAZORPAY_KEY_ID || "",
    };
  },

  async generateDynamicOrderQr(userId: string, orderId: string, _req: Request) {
    const { order, isMasterOrder, userIdOwner, paymentStatus, orderNumber, orderTotal } = await this.resolveOrderContext(orderId);
    const isOwner = userIdOwner === userId;
    const isAssignedDelivery = _req.user?.role === "delivery";
    if (!isOwner && !isAssignedDelivery && _req.user?.role !== "admin") {
      throw new ApiError(HttpStatus.FORBIDDEN, "You are not authorized for this order.", { code: "FORBIDDEN" });
    }
    if (paymentStatus === "PAID") {
      return {
        already_paid: true,
        order_id: order.id,
        order_number: orderNumber,
        status: "PAID",
      };
    }

    const existingPayment = isMasterOrder 
      ? await paymentRepo.findByMasterOrderId(order.id)
      : await paymentRepo.findByOrderId(order.id);

    const advAmount = Number((order as any).advance_paid ?? existingPayment?.amount ?? 0);
    const totAmount = Number(orderTotal || 0);
    const isCod = String(order.payment_method || "").toUpperCase() === "COD";
    const isPartialAdvance = !isCod && paymentStatus === "PAID" && advAmount > 0 && advAmount < totAmount;
    const amountToCharge = isPartialAdvance ? Math.max(0, totAmount - advAmount) : totAmount;
    const amountPaise = Math.max(100, Math.round(amountToCharge * 100));

    let qrCode: any = null;
    let paymentLink: any = null;
    if (razorpayGateway.isConfigured()) {
      try {
        qrCode = await razorpayGateway.createQrCode({
          amountPaise,
          name: `Vegamart Order #${orderNumber}`,
          description: `Vegamart Order #${orderNumber}`,
          usage: "single_use",
          fixedAmount: true,
          closeBy: Math.floor(Date.now() / 1000) + 7200,
          notes: {
            order_id: order.id,
            order_number: String(orderNumber),
            is_master: isMasterOrder ? "true" : "false",
          },
        });
      } catch (qrErr: any) {
        log.debug(`[payments] Razorpay Dynamic QR not available/active: ${qrErr?.message}`);
      }

      try {
        paymentLink = await razorpayGateway.createPaymentLink({
          amountPaise,
          currency: "INR",
          description: `Vegamart Order #${orderNumber}`,
          reference_id: `ord_${order.id.replace(/-/g, "").substring(0, 16)}_${Date.now()}`,
          notes: {
            order_id: order.id,
            order_number: String(orderNumber),
            is_master: isMasterOrder ? "true" : "false",
          },
          customer: {
            name: (order as any).customer?.name || "Customer",
            contact: (order as any).customer?.phone || undefined,
            email: (order as any).customer?.email || undefined,
          },
          upi_link: true,
        });
      } catch (linkErr: any) {
        log.warn(`[payments] Could not create dynamic Razorpay payment link: ${linkErr?.message}`);
      }

      const gwResponse = {
        qr_code_id: qrCode?.id || null,
        qr_image_url: qrCode?.image_url || null,
        payment_link_id: paymentLink?.id || null,
        payment_link_url: paymentLink?.short_url || null,
      };

      if (existingPayment) {
        await paymentRepo.updatePayment(existingPayment.id, {
          razorpay_order_id: paymentLink?.order_id || existingPayment.razorpay_order_id || null,
          amount: amountToCharge as any,
          method: "RAZORPAY" as never,
          status: "PENDING",
          gateway_response: gwResponse as any,
        });
      } else {
        await paymentRepo.createForOrder({
          order_id: isMasterOrder ? undefined : order.id,
          master_order_id: isMasterOrder ? order.id : undefined,
          amount: amountToCharge,
          method: "RAZORPAY",
          razorpay_order_id: paymentLink?.order_id || null,
        });
        const created = isMasterOrder
          ? await paymentRepo.findByMasterOrderId(order.id)
          : await paymentRepo.findByOrderId(order.id);
        if (created) {
          await paymentRepo.updatePayment(created.id, {
            gateway_response: gwResponse as any,
          });
        }
      }

      if (paymentLink?.short_url && userIdOwner) {
        await notificationService.payment(
          userIdOwner,
          `Payment link for Order #${orderNumber}`,
          `Your delivery partner requested payment of ₹${amountToCharge.toFixed(2)}. Tap to pay online: ${paymentLink.short_url}`,
          {
            order_id: order.id,
            order_number: String(orderNumber),
            payment_url: paymentLink.short_url,
            amount: amountToCharge,
          }
        ).catch(() => {});
      }
    }

    const customerPhone = (order as any).customer?.phone || (order as any).address?.phone || null;
    const customerName = (order as any).customer?.name || "Customer";
    const fallbackUrl = `${env.CLIENT_URL || "http://localhost:3000"}/orders/${order.id}/track`;

    // Resolve active UPI ID (delivery partner UPI or platform default UPI)
    let activeUpiId = "vegamart@upi";
    try {
      if (isAssignedDelivery && _req.user?.id) {
        const dp = await prisma.deliveryProfile.findUnique({
          where: { user_id: _req.user.id },
          select: { upi_id: true },
        });
        if (dp?.upi_id && dp.upi_id.trim()) {
          activeUpiId = dp.upi_id.trim();
        }
      }
      if (activeUpiId === "vegamart@upi") {
        const platformUpiSetting = await settingsRepo.getByKey(SETTING_KEYS.PLATFORM_UPI_ID);
        if (platformUpiSetting?.value && typeof platformUpiSetting.value === "string") {
          activeUpiId = platformUpiSetting.value.trim();
        }
      }
    } catch (e: any) {
      log.debug(`[payments] Could not resolve custom UPI ID: ${e?.message}`);
    }

    const cleanOrderNo = String(orderNumber).replace(/[^a-zA-Z0-9_-]/g, "");
    const upiString = `upi://pay?pa=${encodeURIComponent(activeUpiId)}&pn=${encodeURIComponent("VegaMart")}&am=${amountToCharge.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Order_${cleanOrderNo}`)}`;

    return {
      order_id: order.id,
      order_number: orderNumber,
      amount: amountToCharge,
      currency: "INR",
      payment_link_id: paymentLink?.id || null,
      short_url: paymentLink?.short_url || fallbackUrl,
      qr_code_id: qrCode?.id || null,
      qr_image_url: qrCode?.image_url || null,
      razorpay_order_id: paymentLink?.order_id || null,
      status: qrCode?.status || paymentLink?.status || "created",
      customer_phone: customerPhone,
      customer_name: customerName,
      upi_id: activeUpiId,
      upi_string: upiString,
      is_razorpay_active: !!(paymentLink?.short_url || qrCode?.image_url),
    };
  },

  async checkOrderPaymentStatus(_userId: string, orderId: string, _req: Request) {
    const { order, isMasterOrder, paymentStatus, orderNumber, orderTotal } = await this.resolveOrderContext(orderId);
    if (paymentStatus === "PAID") {
      return {
        paid: true,
        payment_status: "PAID",
        order_id: order.id,
        order_number: orderNumber,
        amount: orderTotal,
      };
    }

    const existingPayment = isMasterOrder 
      ? await paymentRepo.findByMasterOrderId(order.id)
      : await paymentRepo.findByOrderId(order.id);

    const gwResponse = existingPayment?.gateway_response as any;
    const qrCodeId = gwResponse?.qr_code_id;
    const paymentLinkId = gwResponse?.payment_link_id;

    if (existingPayment && razorpayGateway.isConfigured()) {
      // 1. Polling: check dynamic QR code if generated
      if (qrCodeId) {
        try {
          const qrDetails = await razorpayGateway.fetchQrCode(qrCodeId);
          if (qrDetails && (qrDetails.payments_amount_received > 0 || qrDetails.payments_count_received > 0 || qrDetails.status === "closed")) {
            const qrPayments = await razorpayGateway.fetchQrCodePayments(qrCodeId);
            const successful = qrPayments?.items?.find((p: any) => p.status === "captured") || qrPayments?.items?.[0];
            await this.finalizePaymentAsPaid({
              payment: existingPayment,
              razorpayPaymentId: successful?.id || qrCodeId,
              gatewayResponse: { qr_code: qrDetails, payment: successful },
              source: "polling:qr_code",
            });
            return {
              paid: true,
              payment_status: "PAID",
              order_id: order.id,
              order_number: orderNumber,
              amount: orderTotal,
              razorpay_payment_id: successful?.id || qrCodeId,
            };
          }
        } catch (err: any) {
          log.debug(`[payments] Polling QR code error: ${err?.message}`);
        }
      }

      // 2. Polling: check Razorpay payment link if generated
      if (paymentLinkId) {
        try {
          const plink = await razorpayGateway.fetchPaymentLink(paymentLinkId);
          if (plink && (plink.status === "paid" || (plink.amount_paid && plink.amount_paid > 0))) {
            const successful = plink.payments?.[0];
            await this.finalizePaymentAsPaid({
              payment: existingPayment,
              razorpayPaymentId: successful?.id || plink.id,
              gatewayResponse: { payment_link: plink, payment: successful },
              source: "polling:payment_link",
            });
            return {
              paid: true,
              payment_status: "PAID",
              order_id: order.id,
              order_number: orderNumber,
              amount: orderTotal,
              razorpay_payment_id: successful?.id || plink.id,
            };
          }
        } catch (err: any) {
          log.debug(`[payments] Polling payment link error: ${err?.message}`);
        }
      }

      // 3. Polling: check standard Razorpay order if razorpay_order_id exists
      if (existingPayment.razorpay_order_id) {
        try {
          const rzpPayments = await razorpayGateway.fetchOrderPayments(existingPayment.razorpay_order_id);
          const successful = rzpPayments?.items?.find((p: any) => p.status === "captured");
          if (successful) {
            await this.finalizePaymentAsPaid({
              payment: existingPayment,
              razorpayPaymentId: successful.id,
              gatewayResponse: successful,
              source: "polling:razorpay_order",
            });
            return {
              paid: true,
              payment_status: "PAID",
              order_id: order.id,
              order_number: orderNumber,
              amount: orderTotal,
              razorpay_payment_id: successful.id,
            };
          }
        } catch (err: any) {
          log.debug(`[payments] Polling Razorpay order error: ${err?.message}`);
        }
      }
    }

    const freshOrder = isMasterOrder 
      ? await findMasterOrderById(order.id)
      : await findOrderById(order.id);

    const isPaid = freshOrder?.payment_status === "PAID";
    return {
      paid: isPaid,
      payment_status: freshOrder?.payment_status || paymentStatus,
      order_id: order.id,
      order_number: orderNumber,
      amount: orderTotal,
    };
  },

  async switchToCod(userId: string, orderId: string, _req: Request) {
    const { order, isMasterOrder, userIdOwner, paymentStatus, orderTotal, orderNumber } = await this.resolveOrderContext(orderId);
    if (userIdOwner !== userId) {
      throw new ApiError(HttpStatus.FORBIDDEN, "You do not own this order.", { code: "FORBIDDEN" });
    }
    if (paymentStatus === "PAID") {
      throw new ApiError(HttpStatus.BAD_REQUEST, "This order is already paid.", { code: "ALREADY_PAID" });
    }

    // Switch payment method to COD and set order status to PENDING
    if (isMasterOrder) {
      await updateMasterOrderStatus(order.id, "PENDING" as MasterOrderStatus);
      if (order.orders) {
        for (const sub of order.orders) {
          await orderRepo.updateOrder(sub.id, {
            payment_method: "COD",
            payment_status: "PENDING",
            status: "PENDING",
          });
          await orderRepo.updateOrderStatus(sub.id, {
            status: "PENDING",
            note: "Switched to Cash on Delivery after online payment failure/cancellation.",
            actorType: "customer",
          });
        }
      }
    } else {
      await orderRepo.updateOrder(order.id, {
        payment_method: "COD",
        payment_status: "PENDING",
        status: "PENDING",
      });

      await orderRepo.updateOrderStatus(order.id, {
        status: "PENDING",
        note: "Switched to Cash on Delivery after online payment failure/cancellation.",
        actorType: "customer",
      });
    }

    const existingPayment = isMasterOrder 
      ? await paymentRepo.findByMasterOrderId(order.id)
      : await paymentRepo.findByOrderId(order.id);

    if (existingPayment) {
      await paymentRepo.updatePayment(existingPayment.id, {
        method: "COD" as never,
        status: "PENDING",
      });
    }

    // Notify customer and vendor
    await notificationService.orderStatus(
      userId,
      orderNumber,
      "Switched to Cash on Delivery 💵",
      `Your order #${orderNumber} has been switched to Cash on Delivery. Please pay ₹${Number(orderTotal).toFixed(2)} when your order arrives.`,
      { order_id: isMasterOrder ? (order.orders?.[0]?.id || order.id) : order.id }
    );

    if (order.vendor?.user_id) {
      await notificationService.vendor(
        order.vendor.user_id,
        "Order Switched to COD 💵",
        `Customer switched Order #${order.order_number} to Cash on Delivery (₹${Number(order.total).toFixed(2)}).`,
        {
          order_id: order.id,
          order_number: order.order_number,
          total: Number(order.total),
          payment_method: "COD",
        }
      );
    }

    return {
      success: true,
      order_id: order.id,
      order_number: order.order_number,
      payment_method: "COD",
      total: Number(order.total),
      message: "Order successfully switched to Cash on Delivery!",
    };
  },

  async recordPaymentFailure(
    userId: string,
    orderId: string,
    input: { reason?: string; error_code?: string; error_description?: string },
    _req: Request
  ) {
    const { order, userIdOwner } = await this.resolveOrderContext(orderId);
    if (userIdOwner !== userId) {
      throw new ApiError(HttpStatus.FORBIDDEN, "You do not own this order.", { code: "FORBIDDEN" });
    }

    const existingPayment = await paymentRepo.findByOrderId(order.id);
    if (existingPayment) {
      await paymentRepo.updatePayment(existingPayment.id, {
        status: "FAILED",
        failure_reason: input.error_description || input.reason || "Payment declined/cancelled",
      });
    }

    await orderRepo.updateOrderStatus(order.id, {
      status: order.status === "PENDING" ? "PENDING" : order.status,
      note: `Payment attempt failed: ${input.error_description || input.reason || "Gateway Error"} (Code: ${input.error_code || "UNKNOWN"})`,
      actorType: "system",
    });

    await notificationService.payment(
      userId,
      "Payment Incomplete ⚠️",
      `Payment of ₹${Number(order.total).toFixed(2)} for order #${order.order_number} was incomplete or declined. If your bank deducted any amount, it will be automatically refunded within 3-5 days. You can retry or switch to COD anytime.`,
      { order_id: order.id }
    );

    return {
      recorded: true,
      order_id: order.id,
      status: "FAILED",
      advice: "If money was deducted, it will be auto-refunded to your bank in 3-5 business days. You can retry or switch to COD.",
    };
  },

  async initiateCheckoutPayment(userId: string, input: InitiateCheckoutPaymentBody, req: Request) {
    return checkoutService.initiateOnlinePayment(userId, input, req);
  },

  async verifyAndCreateOrder(
    userId: string,
    input: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
      checkout_payload: InitiateCheckoutPaymentBody;
    },
    req: Request
  ) {
    // 1. Cryptographically verify signature using secret
    const valid = razorpayGateway.verifySignature({
      orderId: input.razorpay_order_id,
      paymentId: input.razorpay_payment_id,
      signature: input.razorpay_signature,
    });
    if (!valid) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Invalid payment signature.", { code: "INVALID_SIGNATURE" });
    }

    // 2. Fetch payment entity from Razorpay API to confirm capture
    let entity: CapturedPaymentEntity | null = null;
    try {
      entity = await razorpayGateway.fetchPayment(input.razorpay_payment_id);
    } catch (e) {
      log.warn(`[payment] Could not fetch payment ${input.razorpay_payment_id} from Razorpay: ${String(e)}`);
    }

    if (entity) {
      if (entity.order_id && entity.order_id !== input.razorpay_order_id) {
        throw new ApiError(HttpStatus.BAD_REQUEST, "Payment does not belong to this checkout session.", {
          code: "PAYMENT_ORDER_MISMATCH",
        });
      }
      if (entity.status && !ACCEPTABLE_PAYMENT_STATUSES.has(entity.status)) {
        throw new ApiError(HttpStatus.BAD_REQUEST, `Payment status is not acceptable (${entity.status}).`, {
          code: "PAYMENT_STATUS_NOT_ACCEPTABLE",
        });
      }
    }

    // 3. Atomically create the Order & Payment in DB with status PAID
    return checkoutService.placeOrderWithVerifiedPayment(
      userId,
      input.checkout_payload,
      {
        razorpay_order_id: input.razorpay_order_id,
        razorpay_payment_id: input.razorpay_payment_id,
        razorpay_signature: input.razorpay_signature,
      },
      req
    );
  },
};
