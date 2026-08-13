import type { Prisma } from "@prisma/client";

import prisma from "../database/prisma";

type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * Atomically increments the daily order counter for a vendor.
 *
 * Runs inside the checkout transaction so the check-then-increment race of the
 * old middleware (`checkVendorDailyOrderLimit`) is closed: the counter row is
 * either inserted or updated conditionally, and only one concurrent checkout
 * can win the last remaining slot.
 *
 * Returns the new counter value, or `null` when the vendor's daily limit has
 * already been reached (`limit > 0` and the guard rejects the increment).
 */
export async function incrementForVendor(
  vendorId: string,
  date: Date,
  limit: number,
  db: DbClient = prisma
): Promise<number | null> {
  if (limit > 0) {
    const rows = await db.$queryRaw<Array<{ count: number }>>`
      INSERT INTO daily_order_counters (id, vendor_id, date, count, created_at, updated_at)
      VALUES (gen_random_uuid(), ${vendorId}::uuid, ${date}::date, 1, now(), now())
      ON CONFLICT (vendor_id, date) DO UPDATE
        SET count = daily_order_counters.count + 1, updated_at = now()
      WHERE daily_order_counters.count < ${limit}
      RETURNING count
    `;
    return rows[0]?.count ?? null;
  }

  const rows = await db.$queryRaw<Array<{ count: number }>>`
    INSERT INTO daily_order_counters (id, vendor_id, date, count, created_at, updated_at)
    VALUES (gen_random_uuid(), ${vendorId}::uuid, ${date}::date, 1, now(), now())
    ON CONFLICT (vendor_id, date) DO UPDATE
      SET count = daily_order_counters.count + 1, updated_at = now()
    RETURNING count
  `;
  return rows[0]?.count ?? 1;
}