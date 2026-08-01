import { Prisma } from "@prisma/client";

import prisma from "../database/prisma";

const baseSelect = {
  id: true,
  user_id: true,
  vehicle_type: true,
  vehicle_number: true,
  license_number: true,
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
    total_earnings: import("@prisma/client").Prisma.Decimal;
    pending_earnings: import("@prisma/client").Prisma.Decimal;
  };
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
      select: baseSelect,
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

  const [deliveries, activeDeliveries, earnings, pendingEarnings] = await Promise.all([
    prisma.order.count({ where: { delivery_partner_id: id, status: "DELIVERED" } }),
    prisma.order.count({
      where: {
        delivery_partner_id: id,
        status: { in: ["PICKED_UP", "OUT_FOR_DELIVERY"] },
      },
    }),
    prisma.deliveryEarning.aggregate({ where: { delivery_partner_id: id }, _sum: { amount: true } }),
    prisma.deliveryEarning.aggregate({
      where: { delivery_partner_id: id, status: "PENDING" },
      _sum: { amount: true },
    }),
  ]);

  return {
    ...(row as unknown as DeliveryPartnerRow),
    user: row.user,
    stats: {
      total_deliveries: deliveries,
      active_deliveries: activeDeliveries,
      total_earnings: earnings._sum.amount ?? new Prisma.Decimal(0),
      pending_earnings: pendingEarnings._sum.amount ?? new Prisma.Decimal(0),
    },
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
