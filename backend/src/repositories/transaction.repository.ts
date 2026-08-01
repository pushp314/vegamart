import type { Prisma } from "@prisma/client";

import prisma from "../database/prisma";

export interface CreateTransactionInput {
  order_id: string;
  payment_id: string;
  user_id?: string | null;
  type: "CREDIT" | "DEBIT";
  amount: number;
  status: string;
  reference?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}

export async function create(input: CreateTransactionInput) {
  return prisma.transaction.create({
    data: {
      order_id: input.order_id,
      payment_id: input.payment_id,
      user_id: input.user_id ?? null,
      type: input.type as Prisma.TransactionCreateInput["type"],
      amount: input.amount,
      status: input.status,
      reference: input.reference ?? null,
      metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
    },
  });
}

export async function listByOrder(orderId: string) {
  return prisma.transaction.findMany({
    where: { order_id: orderId },
    orderBy: { created_at: "desc" },
  });
}
