import { Prisma } from "@prisma/client";

import prisma from "../database/prisma";

const baseSelect = {
  id: true,
  user_id: true,
  vehicle_type: true,
  vehicle_number: true,
  license_number: true,
  base_delivery_fee: true,
  fee_per_km: true,
  status: true,
  is_verified: true,
  is_available: true,
  availability_status: true,
  current_lat: true,
  current_lng: true,
  rating: true,
  review_count: true,
  rejection_reason: true,
  created_at: true,
  updated_at: true,
} as const;

export type DeliveryPartnerRow = {
  id: string;
  user_id: string;
  vehicle_type: string;
  vehicle_number: string;
  license_number: string;
  base_delivery_fee: import("@prisma/client").Prisma.Decimal;
  fee_per_km: import("@prisma/client").Prisma.Decimal;
  status: import("@prisma/client").DeliveryStatus;
  is_verified: boolean;
  is_available: boolean;
  availability_status: import("@prisma/client").AvailabilityStatus;
  current_lat: number | null;
  current_lng: number | null;
  rating: number;
  review_count: number;
  rejection_reason: string | null;
  created_at: Date;
  updated_at: Date;
};

export interface DeliveryPartnerDetail extends DeliveryPartnerRow {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    avatar_url: string | null;
    status: string;
    is_verified: boolean;
    created_at: Date;
  };
  stats: {
    total_deliveries: number;
    active_deliveries: number;
    assigned_deliveries: number;
    pending_deliveries: number;
    total_earnings: import("@prisma/client").Prisma.Decimal;
    pending_earnings: import("@prisma/client").Prisma.Decimal;
  };
  by_vendor: {
    vendor_id: string;
    vendor_name: string;
    assigned: number;
    delivered: number;
  }[];
  recent_orders: {
    id: string;
    order_number: string;
    status: import("@prisma/client").OrderStatus;
    total: import("@prisma/client").Prisma.Decimal;
    delivery_fee: import("@prisma/client").Prisma.Decimal;
    vendor_name: string;
    customer_name: string;
    delivered_at: Date | null;
    updated_at: Date;
  }[];
}

export async function findById(id: string): Promise<DeliveryPartnerRow | null> {
  const row = await prisma.deliveryProfile.findFirst({
    where: { id, deleted_at: null },
    select: baseSelect,
  });
  return row as unknown as DeliveryPartnerRow | null;
}

export async function findByUserId(userId: string): Promise<DeliveryPartnerRow | null> {
  const row = await prisma.deliveryProfile.findFirst({
    where: { user_id: userId, deleted_at: null },
    select: baseSelect,
  });
  return row as unknown as DeliveryPartnerRow | null;
}

export interface DeliveryFilter {
  q?: string;
  status?: import("@prisma/client").DeliveryStatus;
  isAvailable?: boolean;
  vehicleType?: string;
}

export async function listDeliveryPartners(
  filter: DeliveryFilter,
  skip: number,
  take: number
): Promise<{ rows: DeliveryPartnerRow[]; total: number }> {
  const where: Prisma.DeliveryProfileWhereInput = { deleted_at: null };
  if (filter.status) where.status = filter.status;
  if (filter.isAvailable !== undefined) where.is_available = filter.isAvailable;
  if (filter.vehicleType) {
    where.vehicle_type = { contains: filter.vehicleType, mode: "insensitive" };
  }
  if (filter.q) {
    where.user = {
      is: {
        OR: [
          { name: { contains: filter.q, mode: "insensitive" } },
          { email: { contains: filter.q, mode: "insensitive" } },
          { phone: { contains: filter.q, mode: "insensitive" } },
        ],
      },
    };
  }

  const [rows, total] = await Promise.all([
    prisma.deliveryProfile.findMany({
      where,
      select: {
        ...baseSelect,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
      skip,
      take,
    }),
    prisma.deliveryProfile.count({ where }),
  ]);
  return { rows: rows as unknown as DeliveryPartnerRow[], total };
}

export async function getDetail(id: string): Promise<DeliveryPartnerDetail | null> {
  const row = await prisma.deliveryProfile.findFirst({
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

  const assignedWhere: Prisma.OrderWhereInput = { delivery_partner_id: id, deleted_at: null };
  const completedWhere: Prisma.OrderWhereInput = {
    delivery_partner_id: id,
    status: "DELIVERED",
    deleted_at: null,
  };
  const inProgressWhere: Prisma.OrderWhereInput = {
    delivery_partner_id: id,
    status: { in: ["PICKED_UP", "OUT_FOR_DELIVERY"] },
    deleted_at: null,
  };

  const [
    assignedCount,
    completedCount,
    inProgressCount,
    earnings,
    pendingEarnings,
    assignedByVendor,
    completedByVendor,
    recentOrders,
  ] = await Promise.all([
    prisma.order.count({ where: assignedWhere }),
    prisma.order.count({ where: completedWhere }),
    prisma.order.count({ where: inProgressWhere }),
    prisma.deliveryEarning.aggregate({
      where: { delivery_partner_id: id },
      _sum: { amount: true },
    }),
    prisma.deliveryEarning.aggregate({
      where: { delivery_partner_id: id, status: "PENDING" },
      _sum: { amount: true },
    }),
    prisma.order.groupBy({
      by: ["vendor_id"],
      where: assignedWhere,
      _count: { _all: true },
    }),
    prisma.order.groupBy({
      by: ["vendor_id"],
      where: completedWhere,
      _count: { _all: true },
    }),
    prisma.order.findMany({
      where: assignedWhere,
      orderBy: { updated_at: "desc" },
      take: 10,
      select: {
        id: true,
        order_number: true,
        status: true,
        total: true,
        delivery_fee: true,
        delivered_at: true,
        updated_at: true,
        vendor: { select: { id: true, business_name: true } },
        customer: { select: { name: true } },
      },
    }),
  ]);

  const vendorIds = [
    ...new Set(
      [
        ...assignedByVendor.map((g) => g.vendor_id),
        ...completedByVendor.map((g) => g.vendor_id),
      ].filter((v): v is string => Boolean(v)),
    ),
  ];
  const vendors = vendorIds.length
    ? await prisma.vendorProfile.findMany({
        where: { id: { in: vendorIds } },
        select: { id: true, business_name: true },
      })
    : [];
  const vendorNameMap = new Map(vendors.map((v) => [v.id, v.business_name]));
  const completedMap = new Map(completedByVendor.map((g) => [g.vendor_id, g._count._all]));

  const byVendor = assignedByVendor.map((g) => ({
    vendor_id: g.vendor_id,
    vendor_name: vendorNameMap.get(g.vendor_id) ?? "Vendor",
    assigned: g._count._all,
    delivered: completedMap.get(g.vendor_id) ?? 0,
  }));

  return {
    ...(row as unknown as DeliveryPartnerRow),
    user: row.user,
    stats: {
      total_deliveries: completedCount,
      active_deliveries: inProgressCount,
      assigned_deliveries: assignedCount,
      pending_deliveries: Math.max(0, assignedCount - completedCount),
      total_earnings: earnings._sum.amount ?? new Prisma.Decimal(0),
      pending_earnings: pendingEarnings._sum.amount ?? new Prisma.Decimal(0),
    },
    by_vendor: byVendor,
    recent_orders: recentOrders.map((o) => ({
      id: o.id,
      order_number: o.order_number,
      status: o.status,
      total: o.total,
      delivery_fee: o.delivery_fee,
      vendor_name: o.vendor?.business_name ?? "Vendor",
      customer_name: o.customer?.name ?? "Customer",
      delivered_at: o.delivered_at,
      updated_at: o.updated_at,
    })),
  };
}

export async function updateDelivery(id: string, data: Prisma.DeliveryProfileUpdateInput): Promise<DeliveryPartnerRow> {
  const row = await prisma.deliveryProfile.update({
    where: { id },
    data,
    select: baseSelect,
  });
  return row as unknown as DeliveryPartnerRow;
}

export async function countByStatus(status: import("@prisma/client").DeliveryStatus): Promise<number> {
  return prisma.deliveryProfile.count({ where: { status, deleted_at: null } });
}
