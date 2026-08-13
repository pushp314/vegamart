import type { Prisma, PrismaClient } from "@prisma/client";

import prisma from "../database/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

const baseSelect = {
  id: true,
  order_id: true,
  razorpay_order_id: true,
  razorpay_payment_id: true,
  razorpay_signature: true,
  method: true,
  amount: true,
  status: true,
  currency: true,
  attempts: true,
  failure_reason: true,
  refund_id: true,
  refund_amount: true,
  refund_status: true,
  gateway_response: true,
  webhook_events: true,
  idempotency_key: true,
  created_at: true,
  updated_at: true,
} as const;

export type PaymentRow = {
  id: string;
  order_id: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  method: string;
  amount: import("@prisma/client").Prisma.Decimal;
  status: string;
  currency: string;
  attempts: number;
  failure_reason: string | null;
  refund_id: string | null;
  refund_amount: import("@prisma/client").Prisma.Decimal | null;
  refund_status: string | null;
  gateway_response: Prisma.JsonValue | null;
  webhook_events: Prisma.JsonValue | null;
  idempotency_key: string | null;
  created_at: Date;
  updated_at: Date;
};

export async function createForOrder(
  data: {
    order_id: string;
    amount: number;
    method: string;
    razorpay_order_id?: string | null;
    idempotency_key?: string | null;
  },
  db: DbClient = prisma
): Promise<PaymentRow> {
  const row = await db.payment.create({
    data: {
      order_id: data.order_id,
      amount: data.amount,
      method: data.method as Prisma.PaymentCreateInput["method"],
      razorpay_order_id: data.razorpay_order_id ?? null,
      idempotency_key: data.idempotency_key ?? null,
    },
    select: baseSelect,
  });
  return row as unknown as PaymentRow;
}

export async function findByOrderId(orderId: string): Promise<PaymentRow | null> {
  const row = await prisma.payment.findUnique({
    where: { order_id: orderId },
    select: baseSelect,
  });
  return row ? (row as unknown as PaymentRow) : null;
}

export async function findById(id: string): Promise<PaymentRow | null> {
  const row = await prisma.payment.findUnique({
    where: { id },
    select: baseSelect,
  });
  return row ? (row as unknown as PaymentRow) : null;
}

export async function findByRazorpayOrderId(razorpayOrderId: string): Promise<PaymentRow | null> {
  const row = await prisma.payment.findFirst({
    where: { razorpay_order_id: razorpayOrderId },
    select: baseSelect,
  });
  return row ? (row as unknown as PaymentRow) : null;
}

export async function updatePayment(id: string, data: Prisma.PaymentUpdateInput): Promise<PaymentRow> {
  const row = await prisma.payment.update({
    where: { id },
    data,
    select: baseSelect,
  });
  return row as unknown as PaymentRow;
}

/**
 * Atomically transitions a payment from any un-settled state to PAID.
 *
 * Returns the number of rows updated (1 when this call won the claim, 0 when the
 * payment is already PAID). Concurrent or replayed verification callbacks can
 * therefore never double-apply the paid transition or duplicate downstream side
 * effects (order events, transactions, inventory reservation).
 *
 * REFUNDED / PARTIALLY_REFUNDED payments are intentionally excluded: a late
 * payment.captured callback for an order that was cancelled and refunded in the
 * meantime must never revive the payment back to PAID.
 */
export async function claimAsPaid(
  id: string,
  data: {
    razorpay_payment_id?: string;
    razorpay_signature?: string;
    gateway_response?: Prisma.InputJsonValue;
    webhook_events?: Prisma.InputJsonValue;
  }
): Promise<number> {
  const result = await prisma.payment.updateMany({
    where: { id, status: { in: ["PENDING", "INITIATED", "FAILED"] } },
    data: {
      status: "PAID",
      ...(data.razorpay_payment_id !== undefined ? { razorpay_payment_id: data.razorpay_payment_id } : {}),
      ...(data.razorpay_signature !== undefined ? { razorpay_signature: data.razorpay_signature } : {}),
      ...(data.gateway_response !== undefined ? { gateway_response: data.gateway_response } : {}),
      ...(data.webhook_events !== undefined ? { webhook_events: data.webhook_events } : {}),
    },
  });
  return result.count;
}

/**
 * Atomically claims a refund on a payment.
 *
 * Only a payment that is still refundable (PAID / PARTIALLY_REFUNDED) and not
 * already being refunded (refund_status === "INITIATED") can be claimed, so
 * concurrent or replayed refund calls can never double-refund. Returns 1 when
 * this call won the claim, 0 otherwise.
 */
export async function claimRefund(id: string): Promise<number> {
  const result = await prisma.payment.updateMany({
    where: {
      id,
      status: { in: ["PAID", "PARTIALLY_REFUNDED"] },
      OR: [{ refund_status: null }, { refund_status: { not: "INITIATED" } }],
    },
    data: { refund_status: "INITIATED" },
  });
  return result.count;
}

/** Releases a refund claim after a failed gateway attempt so the refund can be retried. */
export async function clearRefundClaim(id: string): Promise<void> {
  await prisma.payment.updateMany({
    where: { id, refund_status: "INITIATED" },
    data: { refund_status: null },
  });
}

export async function incrementAttempts(id: string): Promise<void> {
  await prisma.payment.update({
    where: { id },
    data: { attempts: { increment: 1 } },
  });
}
