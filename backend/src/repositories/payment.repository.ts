import type { Prisma } from "@prisma/client";

import prisma from "../database/prisma";

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

export async function createForOrder(data: {
  order_id: string;
  amount: number;
  method: string;
  razorpay_order_id?: string | null;
  idempotency_key?: string | null;
}): Promise<PaymentRow> {
  const row = await prisma.payment.create({
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

export async function incrementAttempts(id: string): Promise<void> {
  await prisma.payment.update({
    where: { id },
    data: { attempts: { increment: 1 } },
  });
}
