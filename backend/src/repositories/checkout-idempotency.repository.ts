import type { Prisma } from "@prisma/client";

import prisma from "../database/prisma";

type DbClient = Prisma.TransactionClient | typeof prisma;

const baseSelect = {
  id: true,
  idempotency_key: true,
  user_id: true,
  request_hash: true,
  response: true,
  created_at: true,
  updated_at: true,
} as const;

export type CheckoutIdempotencyRow = {
  id: string;
  idempotency_key: string;
  user_id: string;
  request_hash: string | null;
  response: Prisma.JsonValue | null;
  created_at: Date;
  updated_at: Date;
};

export async function findByKey(
  idempotencyKey: string,
  userId: string
): Promise<CheckoutIdempotencyRow | null> {
  const row = await prisma.checkoutIdempotency.findFirst({
    where: { idempotency_key: idempotencyKey, user_id: userId },
    select: baseSelect,
  });
  return row as unknown as CheckoutIdempotencyRow | null;
}

/**
 * Inserts the idempotency marker first inside the checkout transaction. The
 * unique `idempotency_key` serialises concurrent duplicate submissions: the
 * loser fails with a unique-violation (P2002) and its whole transaction is
 * rolled back before any order, reservation, counter or coupon write.
 */
export async function create(
  db: DbClient,
  data: { idempotency_key: string; user_id: string; request_hash: string }
): Promise<CheckoutIdempotencyRow> {
  const row = await db.checkoutIdempotency.create({
    data: {
      idempotency_key: data.idempotency_key,
      user_id: data.user_id,
      request_hash: data.request_hash,
    },
    select: baseSelect,
  });
  return row as unknown as CheckoutIdempotencyRow;
}

export async function setResponse(
  db: DbClient,
  idempotencyKey: string,
  userId: string,
  response: Prisma.InputJsonValue
): Promise<void> {
  await db.checkoutIdempotency.updateMany({
    where: { idempotency_key: idempotencyKey, user_id: userId },
    data: { response, updated_at: new Date() },
  });
}