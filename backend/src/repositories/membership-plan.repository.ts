import type { Prisma } from "@prisma/client";

import prisma from "../database/prisma";

const baseSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  price: true,
  billing_period: true,
  features: true,
  product_limit: true,
  daily_order_limit: true,
  commission_rate: true,
  includes_sponsorship: true,
  is_active: true,
  sort_order: true,
  created_at: true,
  updated_at: true,
} as const;

export type MembershipPlanRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: import("@prisma/client").Prisma.Decimal;
  billing_period: string;
  features: import("@prisma/client").Prisma.JsonValue;
  product_limit: number;
  daily_order_limit: number;
  commission_rate: import("@prisma/client").Prisma.Decimal;
  includes_sponsorship: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
};

export async function findById(id: string): Promise<MembershipPlanRow | null> {
  const row = await prisma.vendorMembershipPlan.findUnique({
    where: { id },
    select: baseSelect,
  });
  return row as unknown as MembershipPlanRow | null;
}

export async function findBySlug(slug: string): Promise<MembershipPlanRow | null> {
  const row = await prisma.vendorMembershipPlan.findUnique({
    where: { slug },
    select: baseSelect,
  });
  return row as unknown as MembershipPlanRow | null;
}

export async function listAll(
  includeInactive = false
): Promise<MembershipPlanRow[]> {
  const where: Prisma.VendorMembershipPlanWhereInput = {};
  if (!includeInactive) {
    where.is_active = true;
  }
  const rows = await prisma.vendorMembershipPlan.findMany({
    where,
    select: baseSelect,
    orderBy: [{ sort_order: "asc" }, { price: "asc" }],
  });
  return rows as unknown as MembershipPlanRow[];
}

export async function create(data: {
  name: string;
  slug: string;
  description?: string | null;
  price: import("@prisma/client").Prisma.Decimal | number;
  billing_period: string;
  features: import("@prisma/client").Prisma.InputJsonValue;
  product_limit: number;
  daily_order_limit?: number;
  commission_rate: import("@prisma/client").Prisma.Decimal | number;
  includes_sponsorship: boolean;
  is_active: boolean;
  sort_order: number;
}): Promise<MembershipPlanRow> {
  const row = await prisma.vendorMembershipPlan.create({
    data,
    select: baseSelect,
  });
  return row as unknown as MembershipPlanRow;
}

export async function update(
  id: string,
  data: Prisma.VendorMembershipPlanUpdateInput
): Promise<MembershipPlanRow> {
  const row = await prisma.vendorMembershipPlan.update({
    where: { id },
    data,
    select: baseSelect,
  });
  return row as unknown as MembershipPlanRow;
}

export async function remove(id: string): Promise<void> {
  await prisma.vendorMembershipPlan.delete({
    where: { id },
  });
}

export async function countVendorsOnPlan(planId: string): Promise<number> {
  return prisma.vendorProfile.count({
    where: { membership_plan_id: planId, deleted_at: null },
  });
}
