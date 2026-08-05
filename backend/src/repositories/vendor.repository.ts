import { Prisma } from "@prisma/client";

import prisma from "../database/prisma";

const baseSelect = {
  id: true,
  user_id: true,
  business_name: true,
  slug: true,
  description: true,
  category: true,
  tags: true,
  logo_url: true,
  banner_url: true,
  address: true,
  landmark: true,
  city: true,
  state: true,
  country: true,
  pincode: true,
  latitude: true,
  longitude: true,
  delivery_radius_km: true,
  business_hours: true,
  min_order: true,
  delivery_fee: true,
  rating: true,
  review_count: true,
  is_open: true,
  is_verified: true,
  status: true,
  owner_name: true,
  phone: true,
  rejection_reason: true,
  available_from: true,
  available_to: true,
  roaming: true,
  created_at: true,
  updated_at: true,
} as const;

export type VendorRow = {
  id: string;
  user_id: string;
  business_name: string;
  slug: string;
  description: string | null;
  category: string | null;
  tags: string | null;
  logo_url: string | null;
  banner_url: string | null;
  address: string;
  landmark: string | null;
  city: string;
  state: string;
  country: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  delivery_radius_km: number;
  business_hours: string | null;
  min_order: import("@prisma/client").Prisma.Decimal;
  delivery_fee: import("@prisma/client").Prisma.Decimal;
  rating: number;
  review_count: number;
  is_open: boolean;
  is_verified: boolean;
  status: import("@prisma/client").VendorStatus;
  owner_name: string | null;
  phone: string | null;
  rejection_reason: string | null;
  available_from: string | null;
  available_to: string | null;
  roaming: boolean;
  created_at: Date;
  updated_at: Date;
};

export async function findByUserId(userId: string): Promise<VendorRow | null> {
  const row = await prisma.vendorProfile.findFirst({
    where: { user_id: userId, deleted_at: null },
    select: baseSelect,
  });
  return row as unknown as VendorRow | null;
}

export async function findById(id: string): Promise<VendorRow | null> {
  const row = await prisma.vendorProfile.findFirst({
    where: { id, deleted_at: null },
    select: baseSelect,
  });
  return row as unknown as VendorRow | null;
}

export async function findBySlug(slug: string): Promise<VendorRow | null> {
  const row = await prisma.vendorProfile.findFirst({
    where: { slug, deleted_at: null },
    select: baseSelect,
  });
  return row as unknown as VendorRow | null;
}

export async function listSlugs(exceptId?: string): Promise<Set<string>> {
  const rows = await prisma.vendorProfile.findMany({
    where: { deleted_at: null, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { slug: true },
  });
  return new Set(rows.map((r) => r.slug));
}

export async function createVendor(data: {
  user_id: string;
  business_name: string;
  slug: string;
  description?: string | null;
  category?: string | null;
  tags?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  address: string;
  landmark?: string | null;
  city: string;
  state: string;
  country?: string;
  pincode: string;
  latitude?: number | null;
  longitude?: number | null;
  delivery_radius_km?: number;
  business_hours?: string | null;
  min_order?: number;
  delivery_fee?: number;
  owner_name?: string | null;
  phone?: string | null;
  available_from?: string | null;
  available_to?: string | null;
  roaming?: boolean;
}): Promise<VendorRow> {
  const row = await prisma.vendorProfile.create({
    data: {
      user_id: data.user_id,
      business_name: data.business_name,
      slug: data.slug,
      description: data.description ?? null,
      category: data.category ?? null,
      tags: data.tags ?? null,
      logo_url: data.logo_url ?? null,
      banner_url: data.banner_url ?? null,
      address: data.address,
      landmark: data.landmark ?? null,
      city: data.city,
      state: data.state,
      country: data.country ?? "India",
      pincode: data.pincode,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      delivery_radius_km: data.delivery_radius_km ?? 5,
      business_hours: data.business_hours ?? null,
      min_order: data.min_order ?? 0,
      delivery_fee: data.delivery_fee ?? 0,
      owner_name: data.owner_name ?? null,
      phone: data.phone ?? null,
      available_from: data.available_from ?? null,
      available_to: data.available_to ?? null,
      roaming: data.roaming ?? false,
    },
    select: baseSelect,
  });
  return row as unknown as VendorRow;
}

export async function updateVendor(id: string, data: Prisma.VendorProfileUpdateInput): Promise<VendorRow> {
  const row = await prisma.vendorProfile.update({
    where: { id },
    data,
    select: baseSelect,
  });
  return row as unknown as VendorRow;
}

export interface VendorFilter {
  q?: string;
  city?: string;
  category?: string;
  isOpen?: boolean;
  status?: import("@prisma/client").VendorStatus;
  includeAll?: boolean;
}

function buildVendorWhere(filter: VendorFilter): Prisma.VendorProfileWhereInput {
  const where: Prisma.VendorProfileWhereInput = { deleted_at: null };
  if (!filter.includeAll) {
    where.status = filter.status ?? "APPROVED";
  } else if (filter.status) {
    where.status = filter.status;
  }

  if (filter.city) {
    where.city = { contains: filter.city, mode: "insensitive" };
  }
  if (filter.category) {
    where.category = { contains: filter.category, mode: "insensitive" };
  }
  if (filter.isOpen !== undefined) {
    where.is_open = filter.isOpen;
  }
  if (filter.q) {
    where.OR = [
      { business_name: { contains: filter.q, mode: "insensitive" } },
      { slug: { contains: filter.q, mode: "insensitive" } },
      { description: { contains: filter.q, mode: "insensitive" } },
      { city: { contains: filter.q, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listVendors(
  filter: VendorFilter,
  skip: number,
  take: number
): Promise<{ rows: VendorRow[]; total: number }> {
  const where = buildVendorWhere(filter);

  const [rows, total] = await Promise.all([
    prisma.vendorProfile.findMany({
      where,
      select: baseSelect,
      orderBy: [{ is_open: "desc" }, { rating: "desc" }, { created_at: "desc" }],
      skip,
      take,
    }),
    prisma.vendorProfile.count({ where }),
  ]);
  return { rows: rows as unknown as VendorRow[], total };
}

export interface AdminVendorRow extends VendorRow {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    kyc_records: Array<{
      id: string;
      type: string;
      documents: unknown;
      status: import("@prisma/client").KycStatus;
      verified_by: string | null;
      verified_at: Date | null;
      rejection_reason: string | null;
    }>;
  } | null;
}

export async function listVendorsAdmin(
  filter: VendorFilter,
  skip: number,
  take: number
): Promise<{ rows: AdminVendorRow[]; total: number }> {
  const where = buildVendorWhere(filter);

  const [rows, total] = await Promise.all([
    prisma.vendorProfile.findMany({
      where,
      select: {
        ...baseSelect,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            kyc_records: {
              where: { type: "vendor" },
              select: {
                id: true,
                type: true,
                documents: true,
                status: true,
                verified_by: true,
                verified_at: true,
                rejection_reason: true,
              },
            },
          },
        },
      },
      orderBy: [{ is_open: "desc" }, { rating: "desc" }, { created_at: "desc" }],
      skip,
      take,
    }),
    prisma.vendorProfile.count({ where }),
  ]);
  return { rows: rows as unknown as AdminVendorRow[], total };
}

export interface NearbyBoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export async function listWithinBoundingBox(
  bounds: NearbyBoundingBox,
  isOpenOnly: boolean
): Promise<VendorRow[]> {
  const where: Prisma.VendorProfileWhereInput = {
    deleted_at: null,
    status: "APPROVED",
    latitude: { not: null, gte: bounds.minLat, lte: bounds.maxLat },
    longitude: { not: null, gte: bounds.minLng, lte: bounds.maxLng },
  };
  if (isOpenOnly) {
    where.is_open = true;
  }
  const rows = await prisma.vendorProfile.findMany({
    where,
    select: baseSelect,
    orderBy: [{ rating: "desc" }, { review_count: "desc" }],
  });
  return rows as unknown as VendorRow[];
}

export async function countApproved(): Promise<number> {
  return prisma.vendorProfile.count({ where: { status: "APPROVED", deleted_at: null } });
}

export async function softDelete(id: string): Promise<void> {
  await prisma.vendorProfile.update({
    where: { id },
    data: { deleted_at: new Date() },
  });
}

export async function restore(id: string): Promise<VendorRow> {
  const row = await prisma.vendorProfile.update({
    where: { id },
    data: { deleted_at: null, status: "APPROVED" },
    select: baseSelect,
  });
  return row as unknown as VendorRow;
}

export interface AdminVendorStats {
  total_orders: number;
  active_orders: number;
  total_revenue: import("@prisma/client").Prisma.Decimal;
  total_earnings: import("@prisma/client").Prisma.Decimal;
  pending_earnings: import("@prisma/client").Prisma.Decimal;
  product_count: number;
  out_of_stock_count: number;
}

export async function getVendorStats(id: string): Promise<AdminVendorStats> {
  const [totalOrders, activeOrders, revenueAgg, earningsAgg, pendingEarnings, productCount, outOfStock] =
    await Promise.all([
      prisma.order.count({
        where: { vendor_id: id, status: { notIn: ["CANCELLED", "FAILED"] } },
      }),
      prisma.order.count({
        where: { vendor_id: id, status: { in: ["PENDING", "CONFIRMED", "PREPARING", "PACKED", "READY_FOR_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY"] } },
      }),
      prisma.order.aggregate({
        where: { vendor_id: id, status: { notIn: ["CANCELLED", "FAILED"] } },
        _sum: { total: true },
      }),
      prisma.vendorEarning.aggregate({
        where: { vendor_id: id },
        _sum: { amount: true },
      }),
      prisma.vendorEarning.aggregate({
        where: { vendor_id: id, status: "PENDING" },
        _sum: { amount: true },
      }),
      prisma.product.count({ where: { vendor_id: id, deleted_at: null } }),
      prisma.product.count({
        where: { vendor_id: id, deleted_at: null, inventory: { some: { quantity: { lte: 0 } } } },
      }),
    ]);

  return {
    total_orders: totalOrders,
    active_orders: activeOrders,
    total_revenue: revenueAgg._sum.total ?? new Prisma.Decimal(0),
    total_earnings: earningsAgg._sum.amount ?? new Prisma.Decimal(0),
    pending_earnings: pendingEarnings._sum.amount ?? new Prisma.Decimal(0),
    product_count: productCount,
    out_of_stock_count: outOfStock,
  };
}

export interface VendorDetail extends VendorRow {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    avatar_url: string | null;
    status: string;
    is_verified: boolean;
    created_at: Date;
  } | null;
}

export async function getVendorDetail(id: string): Promise<VendorDetail | null> {
  const row = await prisma.vendorProfile.findFirst({
    where: { id, deleted_at: null },
    select: {
      ...baseSelect,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          avatar_url: true,
          status: true,
          is_verified: true,
          created_at: true,
        },
      },
    },
  });
  if (!row) return null;
  const { user, ...vendor } = row;
  return { ...(vendor as unknown as VendorRow), user: user as VendorDetail["user"] };
}
