import type { Prisma, PrismaClient } from "@prisma/client";

import prisma from "../database/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

const baseSelect = {
  id: true,
  code: true,
  type: true,
  value: true,
  max_discount: true,
  min_order_value: true,
  usage_limit: true,
  per_user_limit: true,
  used_count: true,
  valid_from: true,
  valid_until: true,
  is_active: true,
  applies_to_vendor_ids: true,
  applies_to_product_ids: true,
  applies_to_category_ids: true,
  created_by_vendor_id: true,
  created_at: true,
  updated_at: true,
} as const;

export type CouponRow = {
  id: string;
  code: string;
  type: "PERCENTAGE" | "FIXED" | "FREE_DELIVERY";
  value: import("@prisma/client").Prisma.Decimal;
  max_discount: import("@prisma/client").Prisma.Decimal | null;
  min_order_value: import("@prisma/client").Prisma.Decimal | null;
  usage_limit: number;
  per_user_limit: number;
  used_count: number;
  valid_from: Date;
  valid_until: Date;
  is_active: boolean;
  applies_to_vendor_ids: string | null;
  applies_to_product_ids: string | null;
  applies_to_category_ids: string | null;
  created_by_vendor_id: string | null;
  created_at: Date;
  updated_at: Date;
};

function mapRow(row: unknown): CouponRow {
  return row as CouponRow;
}

export async function findByCode(code: string): Promise<CouponRow | null> {
  const row = await prisma.coupon.findFirst({
    where: { code, deleted_at: null },
    select: baseSelect,
  });
  return row ? mapRow(row) : null;
}

export async function findById(id: string): Promise<CouponRow | null> {
  const row = await prisma.coupon.findFirst({
    where: { id, deleted_at: null },
    select: baseSelect,
  });
  return row ? mapRow(row) : null;
}

export interface CouponListFilter {
  isActive?: boolean;
  q?: string;
  type?: string;
}

export async function listCoupons(
  filter: CouponListFilter,
  skip: number,
  take: number
): Promise<{ rows: CouponRow[]; total: number }> {
  const where: Prisma.CouponWhereInput = { deleted_at: null };
  if (filter.isActive !== undefined) where.is_active = filter.isActive;
  if (filter.type) where.type = filter.type as Prisma.CouponWhereInput["type"];
  if (filter.q) where.code = { contains: filter.q, mode: "insensitive" };

  const [rows, total] = await Promise.all([
    prisma.coupon.findMany({
      where,
      select: baseSelect,
      orderBy: { created_at: "desc" },
      skip,
      take,
    }),
    prisma.coupon.count({ where }),
  ]);
  return { rows: rows.map(mapRow), total };
}

export async function listByVendor(
  vendorId: string,
  filter: CouponListFilter,
  skip: number,
  take: number
): Promise<{ rows: CouponRow[]; total: number }> {
  const where: Prisma.CouponWhereInput = {
    deleted_at: null,
    created_by_vendor_id: vendorId,
  };
  if (filter.isActive !== undefined) where.is_active = filter.isActive;
  if (filter.type) where.type = filter.type as Prisma.CouponWhereInput["type"];
  if (filter.q) where.code = { contains: filter.q, mode: "insensitive" };

  const [rows, total] = await Promise.all([
    prisma.coupon.findMany({
      where,
      select: baseSelect,
      orderBy: { created_at: "desc" },
      skip,
      take,
    }),
    prisma.coupon.count({ where }),
  ]);
  return { rows: rows.map(mapRow), total };
}

export async function listActiveBetween(from: Date, until: Date): Promise<CouponRow[]> {
  const rows = await prisma.coupon.findMany({
    where: { deleted_at: null, is_active: true, valid_from: { lte: until }, valid_until: { gte: from } },
    select: baseSelect,
    orderBy: { valid_until: "asc" },
  });
  return rows.map(mapRow);
}

/**
 * Lists coupons a customer can actually use right now: active, inside their
 * validity window, and not exhausted (`usage_limit = 0` means unlimited).
 *
 * `used_count < usage_limit` is a column-to-column comparison Prisma cannot
 * express in its typed `where`, so it runs as a bounded raw query. The atomic
 * `claimUsage` lock remains the authoritative guard against over-consumption;
 * this is a best-effort, up-to-date listing for the checkout coupon picker.
 */
export async function listAvailableForCustomer(now: Date): Promise<CouponRow[]> {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT id, code, type, value, max_discount, min_order_value, usage_limit, per_user_limit,
           used_count, valid_from, valid_until, is_active, applies_to_vendor_ids,
           applies_to_product_ids, applies_to_category_ids, created_by_vendor_id,
           created_at, updated_at
    FROM coupons
    WHERE deleted_at IS NULL
      AND is_active = true
      AND valid_from <= ${now}
      AND valid_until >= ${now}
      AND (usage_limit = 0 OR used_count < usage_limit)
    ORDER BY valid_until ASC
    LIMIT 20
  `;
  return rows.map(mapRow);
}

export async function countUsages(couponId: string): Promise<number> {
  return prisma.couponUsage.count({ where: { coupon_id: couponId } });
}

export async function countUserUsages(couponId: string, userId: string): Promise<number> {
  return prisma.couponUsage.count({ where: { coupon_id: couponId, user_id: userId } });
}

export async function createCoupon(data: {
  code: string;
  type: string;
  value: number;
  max_discount?: number | null;
  min_order_value?: number | null;
  usage_limit?: number;
  per_user_limit?: number;
  valid_from: Date;
  valid_until: Date;
  is_active?: boolean;
  applies_to_vendor_ids?: string[] | null;
  applies_to_product_ids?: string[] | null;
  applies_to_category_ids?: string[] | null;
  created_by_vendor_id?: string | null;
}): Promise<CouponRow> {
  const row = await prisma.coupon.create({
    data: {
      code: data.code,
      type: data.type as CouponRow["type"],
      value: data.value,
      max_discount: data.max_discount ?? null,
      min_order_value: data.min_order_value ?? null,
      usage_limit: data.usage_limit ?? 0,
      per_user_limit: data.per_user_limit ?? 1,
      valid_from: data.valid_from,
      valid_until: data.valid_until,
      is_active: data.is_active ?? true,
      applies_to_vendor_ids: data.applies_to_vendor_ids?.length ? data.applies_to_vendor_ids.join(",") : null,
      applies_to_product_ids: data.applies_to_product_ids?.length ? data.applies_to_product_ids.join(",") : null,
      applies_to_category_ids: data.applies_to_category_ids?.length ? data.applies_to_category_ids.join(",") : null,
      created_by_vendor_id: data.created_by_vendor_id ?? null,
    },
    select: baseSelect,
  });
  return mapRow(row);
}

export async function updateCoupon(id: string, data: Prisma.CouponUpdateInput): Promise<CouponRow> {
  const row = await prisma.coupon.update({
    where: { id },
    data,
    select: baseSelect,
  });
  return mapRow(row);
}

export async function softDelete(id: string): Promise<void> {
  await prisma.coupon.update({
    where: { id },
    data: { deleted_at: new Date(), is_active: false },
  });
}

async function runClaim(
  db: DbClient,
  couponId: string,
  orderId: string,
  userId: string,
  discount: number
): Promise<boolean> {
  const [locked] = await db.$queryRaw<
    Array<{ id: string; used_count: number; usage_limit: number; per_user_limit: number }>
  >`
    SELECT id, used_count, usage_limit, per_user_limit
    FROM coupons
    WHERE id = ${couponId}::uuid AND deleted_at IS NULL
    FOR UPDATE
  `;
  if (!locked) {
    return false;
  }
  if (locked.usage_limit > 0 && locked.used_count >= locked.usage_limit) {
    return false;
  }
  if (locked.per_user_limit > 0) {
    const usedByUser = await db.couponUsage.count({
      where: { coupon_id: couponId, user_id: userId },
    });
    if (usedByUser >= locked.per_user_limit) {
      return false;
    }
  }
  await db.coupon.update({
    where: { id: couponId },
    data: { used_count: { increment: 1 } },
  });
  await db.couponUsage.create({
    data: { coupon_id: couponId, order_id: orderId, user_id: userId, discount },
  });
  return true;
}

/**
 * Atomically claims one usage of a coupon for a checkout.
 *
 * The coupon row is locked (`SELECT ... FOR UPDATE`) so concurrent claims on the
 * same coupon serialise: the global `usage_limit` and the per-user limit are
 * re-validated inside the lock right before the usage is recorded, which closes
 * the check-then-increment race that previously let concurrent checkouts exceed
 * the limits. The usage is recorded (used_count +1 and one CouponUsage row) only
 * after the caller has successfully created the order, so a failed checkout never
 * consumes coupon usage.
 *
 * When `db` is a transaction client the claim runs on that transaction so it
 * participates in the caller's all-or-nothing checkout. On a standalone call it
 * wraps its own transaction.
 *
 * Returns `false` when the coupon or one of its limits is already exhausted, so
 * callers can abort without recording partial usage.
 */
export async function claimUsage(
  couponId: string,
  orderId: string,
  userId: string,
  discount: number,
  db: DbClient = prisma
): Promise<boolean> {
  if (db === prisma) {
    return prisma.$transaction((tx) => runClaim(tx, couponId, orderId, userId, discount));
  }
  return runClaim(db, couponId, orderId, userId, discount);
}
