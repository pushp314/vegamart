import type { Prisma } from "@prisma/client";

import prisma from "../database/prisma";

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

export async function recordUsage(couponId: string, orderId: string, userId: string, discount: number): Promise<void> {
  await prisma.$transaction([
    prisma.couponUsage.create({
      data: { coupon_id: couponId, order_id: orderId, user_id: userId, discount },
    }),
    prisma.coupon.update({
      where: { id: couponId },
      data: { used_count: { increment: 1 } },
    }),
  ]);
}
