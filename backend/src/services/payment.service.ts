import type { Request } from "express";

import { env } from "../config";
import { AUDIT_ACTIONS } from "../constants/auth";
import { auditService } from "./audit.service";
import { notificationService } from "./notification.service";
import { cacheService } from "../database/cache";
import * as paymentRepo from "../repositories/payment.repository";
import * as orderRepo from "../repositories/order.repository";
import * as inventoryRepo from "../repositories/inventory.repository";
import * as transactionRepo from "../repositories/transaction.repository";
import { findById as findOrderById } from "../repositories/order.repository";
import { razorpayGateway } from "../payments/razorpay.gateway";
import { subscriptionPaymentService } from "./subscription-payment.service";
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

function expectedAmountPaise(order: { total: { toNumber: () => number } }): number {
  return Math.round(order.total.toNumber() * 100);
}

/**
 * Verifies that a captured payment entity from Razorpay matches the persisted
 * order: it belongs to the expected razorpay order, has an acceptable status,
 * and the captured amount + currency equal the server-derived order total.
 * The expected amount is derived from the persisted order, never from the
 * frontend or from a client-supplied value.
 */
function assertCapturedPayment(
  entity: CapturedPaymentEntity,
  payment: { razorpay_order_id: string | null; currency: string },
  order: { total: { toNumber: () => number } }
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
  if (entity.amount !== expectedAmountPaise(order)) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "Captured amount does not match the order total.", {
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

    const order = await findOrderById(payment.order_id);
    if (!order) {
      throw new NotFoundError("Order not found.");
    }
    if (order.user_id !== userId) {
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

    let entity: CapturedPaymentEntity;
    try {
      entity = await razorpayGateway.fetchPayment(input.razorpay_payment_id);
    } catch {
      throw new ApiError(HttpStatus.BAD_GATEWAY, "Unable to verify payment with the payment gateway.", {
        code: "PAYMENT_VERIFICATION_FAILED",
      });
    }

    // The expected amount is derived from the persisted order; the frontend is
    // never trusted for the payable amount. Signature + amount + currency + order
    // mapping must all hold before the payment is marked paid.
    assertCapturedPayment(entity, payment, order);

    // Atomic claim: only the first request that transitions this payment to PAID
    // proceeds with the downstream side effects. Replayed/concurrent callbacks
    // find `claimed === 0` and return the already-paid state idempotently.
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
    await orderRepo.updateOrder(order.id, { payment_status: "PAID" });
    await orderRepo.updateOrderStatus(order.id, {
      status: "CONFIRMED",
      note: "Payment verified. Order confirmed.",
      actorType: "system",
    });

    await transactionRepo.create({
      order_id: order.id,
      payment_id: payment.id,
      user_id: userId,
      type: "DEBIT",
      amount: order.total.toNumber(),
      status: "success",
      reference: input.razorpay_payment_id,
      metadata: { razorpay_order_id: input.razorpay_order_id },
    });

    await inventoryRepo.reserveQuantityFromOrder(order.id, req);

    await notificationService.payment(userId, "Payment successful", `Your payment for ${order.order_number} was successful.`, {
      order_id: order.id,
      payment_id: payment.id,
    });

    await auditService.record(
      { userId, action: AUDIT_ACTIONS.PAYMENT_VERIFIED, entityType: "payment", entityId: payment.id, newValues: { razorpay_payment_id: input.razorpay_payment_id, order_id: order.id, amount: order.total.toNumber() } },
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

    await auditService.record(
      { actorType: "system", action: AUDIT_ACTIONS.PAYMENT_VERIFIED, entityType: "webhook", newValues: { event } },
      req
    );

    return { handled: event };
  },

  async handlePaymentCaptured(entity: CapturedPaymentEntity): Promise<void> {
    const razorpayOrderId = entity.order_id;
    if (!razorpayOrderId) return;

    const payment = await paymentRepo.findByRazorpayOrderId(razorpayOrderId);
    if (!payment) return;

    const order = await findOrderById(payment.order_id);
    if (!order) return;

    assertCapturedPayment(entity, payment, order);

    // Atomic claim: only one callback (webhook or client verify) applies the
    // paid transition; duplicates short-circuit before any side effect.
    const claimed = await paymentRepo.claimAsPaid(payment.id, {
      razorpay_payment_id: entity.id,
      gateway_response: entity as never,
      webhook_events: { captured: true },
    });
    if (claimed === 0) return;

    await orderRepo.updateOrder(order.id, { payment_status: "PAID" });
    await orderRepo.updateOrderStatus(order.id, {
      status: "CONFIRMED",
      note: "Payment confirmed via webhook.",
      actorType: "system",
    });

    await transactionRepo.create({
      order_id: order.id,
      payment_id: payment.id,
      user_id: order.user_id,
      type: "DEBIT",
      amount: order.total.toNumber(),
      status: "success",
      reference: entity.id ?? null,
      metadata: { razorpay_order_id: razorpayOrderId, source: "webhook" },
    });

    await inventoryRepo.reserveQuantityFromOrder(order.id, undefined);

    await notificationService.payment(order.user_id, "Payment successful", `Your payment for ${order.order_number} was successful.`, {
      order_id: order.id,
    });
  },

  async refund(userId: string, orderId: string, input: { amount?: number; reason?: string }, req: Request): Promise<unknown> {
    const order = await findOrderById(orderId);
    if (!order) {
      throw new NotFoundError("Order not found.");
    }

    const payment = await paymentRepo.findByOrderId(orderId);
    if (!payment) {
      throw new NotFoundError("Payment not found for this order.");
    }
    if (payment.status === "REFUNDED") {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Payment has already been refunded.", { code: "ALREADY_REFUNDED" });
    }
    if (payment.status !== "PAID") {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Only paid payments can be refunded.", { code: "NOT_PAID" });
    }

    const refundAmount = input.amount ?? payment.amount.toNumber();
    if (refundAmount <= 0 || refundAmount > payment.amount.toNumber()) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Invalid refund amount.", { code: "INVALID_REFUND_AMOUNT" });
    }

    const refund = await razorpayGateway.refundPayment(payment.razorpay_payment_id!, {
      amountPaise: Math.round(refundAmount * 100),
      notes: input.reason,
    });

    const fullyRefunded = refundAmount >= payment.amount.toNumber();
    const updatedPayment = await paymentRepo.updatePayment(payment.id, {
      refund_id: refund.id,
      refund_amount: refundAmount,
      refund_status: refund.status,
      status: fullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED",
    });

    await orderRepo.updateOrder(order.id, {
      payment_status: fullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED",
      refunded_at: fullyRefunded ? new Date() : null,
      refund_reason: input.reason ?? null,
    });
    if (fullyRefunded) {
      await orderRepo.updateOrderStatus(order.id, {
        status: "REFUNDED",
        note: input.reason ? `Refunded: ${input.reason}` : "Order refunded.",
        actorType: "admin",
      });
      await inventoryRepo.releaseQuantityForOrder(order.id);
    }

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
};
