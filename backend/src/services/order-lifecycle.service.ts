import type { Request } from "express";
import type { OrderStatus, PaymentStatus } from "@prisma/client";

import prisma from "../database/prisma";
import * as orderRepo from "../repositories/order.repository";
import * as inventoryRepo from "../repositories/inventory.repository";
import { paymentService } from "./payment.service";
import { reverseOrderEarnings } from "./earning.service";
import { ApiError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";

/**
 * Authoritative order state machine.
 *
 * Every order status change in the system must pass through
 * `assertOrderTransition` (directly, or via the lifecycle helpers below) so
 * arbitrary/backwards transitions are rejected. A transition to the current
 * status is always permitted (idempotent no-op) and every target set includes
 * the source state for that reason.
 *
 * Terminal states (CANCELLED, REFUNDED, RETURNED, FAILED) only allow staying in
 * place: money movement and inventory release are never claimed after an order
 * reaches them, and a cancelled order can never be revived for delivery.
 */
export const ALLOWED_ORDER_TRANSITIONS: Record<string, ReadonlySet<string>> = {
  PENDING: new Set(["PENDING", "CONFIRMED", "CANCELLED", "FAILED"]),
  CONFIRMED: new Set(["CONFIRMED", "PREPARING", "PACKED", "READY_FOR_PICKUP", "PICKED_UP", "CANCELLED", "FAILED"]),
  PREPARING: new Set(["PREPARING", "PACKED", "READY_FOR_PICKUP", "PICKED_UP", "CANCELLED"]),
  PACKED: new Set(["PACKED", "READY_FOR_PICKUP", "PICKED_UP", "CANCELLED"]),
  READY_FOR_PICKUP: new Set(["READY_FOR_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"]),
  PICKED_UP: new Set(["PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED"]),
  OUT_FOR_DELIVERY: new Set(["OUT_FOR_DELIVERY", "DELIVERED"]),
  DELIVERED: new Set(["DELIVERED", "REFUNDED", "RETURNED"]),
  CANCELLED: new Set(["CANCELLED"]),
  REFUNDED: new Set(["REFUNDED"]),
  RETURNED: new Set(["RETURNED"]),
  FAILED: new Set(["FAILED"]),
};

/** Statuses from which an order may be cancelled (source states of CANCELLED). */
export const CANCELLABLE_ORDER_STATUSES: readonly string[] = Object.entries(
  ALLOWED_ORDER_TRANSITIONS
)
  .filter(([, targets]) => targets.has("CANCELLED"))
  .map(([status]) => status);

export function assertOrderTransition(current: string, next: string): void {
  if (current === next) return;
  const allowed = ALLOWED_ORDER_TRANSITIONS[current];
  if (!allowed || !allowed.has(next)) {
    throw new ApiError(
      HttpStatus.BAD_REQUEST,
      `Cannot transition order from ${current} to ${next}.`,
      { code: "INVALID_STATUS" }
    );
  }
}

export interface OrderLifecycleParams {
  order: orderRepo.OrderDetail;
  reason?: string | null;
  actorType: string;
  actorId?: string | null;
  req: Request;
}

interface RefundOutcome {
  payment?: { status?: string };
}

function needsGatewayRefund(paymentStatus: string): boolean {
  return paymentStatus === "PAID" || paymentStatus === "PARTIALLY_REFUNDED";
}

function refundPaymentStatus(outcome: unknown): string | undefined {
  return (outcome as RefundOutcome | null)?.payment?.status;
}

/**
 * Runs the gateway refund for a lifecycle, treating an already-completed refund
 * as a success. A retry (or an admin refund issued through the payment endpoint
 * before the lifecycle ran) must not re-run the money movement, but the order
 * still needs its terminal claim.
 */
async function runRefund(params: OrderLifecycleParams, reason: string | null): Promise<RefundOutcome | null> {
  if (!needsGatewayRefund(params.order.payment_status)) {
    return null;
  }
  try {
    return (await paymentService.refund(
      params.actorId ?? params.order.user_id,
      params.order.id,
      { reason: reason ?? undefined },
      params.req
    )) as RefundOutcome;
  } catch (err) {
    if ((err as { code?: string })?.code === "ALREADY_REFUNDED") {
      return { payment: { status: "REFUNDED" } };
    }
    throw err;
  }
}

/**
 * Cancels an order with a financially recoverable refund-first saga.
 *
 * 1. Already-cancelled orders short-circuit (idempotent, no side effects).
 * 2. A paid order is refunded BEFORE the order is claimed cancelled, so a failed
 *    refund leaves the order in its prior state with the payment still PAID and
 *    inventory still reserved - the cancellation can simply be retried.
 * 3. The CANCELLED claim is an atomic conditional updateMany (only matches
 *    cancelable source statuses), and the order event + inventory release run in
 *    the SAME transaction, so inventory is released exactly once - never by a
 *    replayed or concurrent cancellation.
 * 4. Once CANCELLED the state machine forbids any forward transition, so
 *    reserved stock can never be consumed or delivered after cancellation.
 */
export async function cancelOrderLifecycle(params: OrderLifecycleParams): Promise<orderRepo.OrderRow> {
  const { order } = params;

  if (order.status === "CANCELLED") {
    return order as unknown as orderRepo.OrderRow;
  }
  assertOrderTransition(order.status, "CANCELLED");

  const refundOutcome = await runRefund(params, params.reason ?? null);
  const paymentStatus = refundPaymentStatus(refundOutcome) as PaymentStatus | undefined;

  const claimed = await prisma.$transaction(async (tx) => {
    const res = await tx.order.updateMany({
      where: { id: order.id, status: { in: [...CANCELLABLE_ORDER_STATUSES] as OrderStatus[] } },
      data: {
        status: "CANCELLED",
        cancelled_at: new Date(),
        cancel_reason: params.reason ?? null,
        ...(paymentStatus ? { payment_status: paymentStatus } : {}),
      },
    });
    if (res.count === 0) return false;

    await tx.orderEvent.create({
      data: {
        status: "CANCELLED",
        note: params.reason ? `Cancelled: ${params.reason}` : "Order cancelled.",
        actor_type: params.actorType,
        actor_id: params.actorId ?? null,
        order: { connect: { id: order.id } },
      },
    });

    await inventoryRepo.releaseQuantityForOrder(order.id, tx);
    return true;
  });

  if (!claimed) {
    const fresh = await orderRepo.findById(order.id);
    if (fresh?.status === "CANCELLED") {
      return fresh as unknown as orderRepo.OrderRow;
    }
    throw new ApiError(
      HttpStatus.CONFLICT,
      "Order can no longer be cancelled in its current state.",
      { code: "NOT_CANCELLABLE" }
    );
  }

  const updated = await orderRepo.findById(order.id);
  return (updated ?? order) as unknown as orderRepo.OrderRow;
}

/**
 * Refunds a delivered order and then claims REFUNDED.
 *
 * The refund is always processed before the REFUNDED status is claimed, so the
 * order is never marked REFUNDED while money is still owed. The REFUNDED claim
 * is an atomic conditional updateMany (DELIVERED only) with no inventory side
 * effects - a delivered order has already had its stock consumed. Replays and
 * concurrent calls are idempotent.
 */
export async function refundOrderLifecycle(params: OrderLifecycleParams): Promise<orderRepo.OrderRow> {
  const { order } = params;

  if (order.status === "REFUNDED") {
    return order as unknown as orderRepo.OrderRow;
  }
  assertOrderTransition(order.status, "REFUNDED");

  const refundOutcome = await runRefund(params, params.reason ?? null);
  const paymentStatus = refundPaymentStatus(refundOutcome) as PaymentStatus | undefined;

  const claimed = await prisma.$transaction(async (tx) => {
    const res = await tx.order.updateMany({
      where: { id: order.id, status: "DELIVERED" },
      data: {
        status: "REFUNDED",
        refunded_at: new Date(),
        refund_reason: params.reason ?? null,
        ...(paymentStatus ? { payment_status: paymentStatus } : {}),
      },
    });
    if (res.count === 0) return false;

    await tx.orderEvent.create({
      data: {
        status: "REFUNDED",
        note: params.reason ? `Refunded: ${params.reason}` : "Order refunded.",
        actor_type: params.actorType,
        actor_id: params.actorId ?? null,
        order: { connect: { id: order.id } },
      },
    });

    const fullOrder = await tx.order.findUnique({
      where: { id: order.id },
      select: { vendor_id: true, delivery_partner_id: true, total: true },
    });
    if (fullOrder) {
      await reverseOrderEarnings(
        {
          id: order.id,
          vendor_id: fullOrder.vendor_id,
          delivery_partner_id: fullOrder.delivery_partner_id,
          total: fullOrder.total.toNumber(),
        },
        1.0, // full refund fraction
        "order-refund", // fallback reference id
        tx
      );
    }

    return true;
  });

  if (!claimed) {
    const fresh = await orderRepo.findById(order.id);
    if (fresh?.status === "REFUNDED") {
      return fresh as unknown as orderRepo.OrderRow;
    }
    throw new ApiError(
      HttpStatus.CONFLICT,
      "Order can no longer be refunded in its current state.",
      { code: "INVALID_STATUS" }
    );
  }

  const updated = await orderRepo.findById(order.id);
  return (updated ?? order) as unknown as orderRepo.OrderRow;
}
