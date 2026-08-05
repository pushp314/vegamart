import { Prisma } from "@prisma/client";

import prisma from "../database/prisma";
import { haversineDistanceKm, boundingBox } from "../utils/geo";

const baseSelect = {
  id: true,
  vendor_id: true,
  broadcast_date: true,
  area: true,
  landmark: true,
  address: true,
  latitude: true,
  longitude: true,
  start_time: true,
  end_time: true,
  notes: true,
  is_active: true,
  created_at: true,
  updated_at: true,
} as const;

export type VendorDailyLocationRow = {
  id: string;
  vendor_id: string;
  broadcast_date: Date;
  area: string;
  landmark: string | null;
  address: string;
  latitude: number;
  longitude: number;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

export type NearbyDailyLocationResult = VendorDailyLocationRow & {
  distance_km: number;
  business_name: string;
  slug: string;
  category: string | null;
  logo_url: string | null;
  rating: number;
  review_count: number;
  is_open: boolean;
  is_verified: boolean;
  roaming: boolean;
};

export async function findByVendorAndDate(
  vendorId: string,
  date: Date,
): Promise<VendorDailyLocationRow | null> {
  const row = await prisma.vendorDailyLocation.findUnique({
    where: {
      vendor_id_broadcast_date: {
        vendor_id: vendorId,
        broadcast_date: date,
      },
    },
    select: baseSelect,
  });
  return (row as unknown as VendorDailyLocationRow) ?? null;
}

export async function upsert(
  vendorId: string,
  date: Date,
  data: {
    area: string;
    landmark?: string | null;
    address: string;
    latitude: number;
    longitude: number;
    start_time?: string | null;
    end_time?: string | null;
    notes?: string | null;
    is_active?: boolean;
  },
): Promise<VendorDailyLocationRow> {
  const row = await prisma.vendorDailyLocation.upsert({
    where: {
      vendor_id_broadcast_date: {
        vendor_id: vendorId,
        broadcast_date: date,
      },
    },
    create: {
      vendor_id: vendorId,
      broadcast_date: date,
      area: data.area,
      landmark: data.landmark ?? null,
      address: data.address,
      latitude: data.latitude,
      longitude: data.longitude,
      start_time: data.start_time ?? null,
      end_time: data.end_time ?? null,
      notes: data.notes ?? null,
      is_active: data.is_active ?? true,
    },
    update: {
      area: data.area,
      landmark: data.landmark ?? null,
      address: data.address,
      latitude: data.latitude,
      longitude: data.longitude,
      start_time: data.start_time ?? null,
      end_time: data.end_time ?? null,
      notes: data.notes ?? null,
      is_active: data.is_active ?? true,
    },
    select: baseSelect,
  });
  return row as unknown as VendorDailyLocationRow;
}

export async function deleteByVendorAndDate(
  vendorId: string,
  date: Date,
): Promise<boolean> {
  const result = await prisma.vendorDailyLocation.deleteMany({
    where: {
      vendor_id: vendorId,
      broadcast_date: date,
    },
  });
  return result.count > 0;
}

export async function findNearby(
  lat: number,
  lng: number,
  radiusKm: number,
  date: Date,
  opts: { category?: string; is_open?: boolean; page?: number; per_page?: number } = {},
): Promise<{ items: NearbyDailyLocationResult[]; total: number }> {
  const bounds = boundingBox(lat, lng, radiusKm);
  const page = opts.page ?? 1;
  const per_page = opts.per_page ?? 20;
  const skip = (page - 1) * per_page;

  const where: Prisma.VendorDailyLocationWhereInput = {
    broadcast_date: date,
    is_active: true,
    latitude: { gte: bounds.minLat, lte: bounds.maxLat },
    longitude: { gte: bounds.minLng, lte: bounds.maxLng },
    vendor: {
      status: "APPROVED",
      roaming: true,
      deleted_at: null,
      ...(opts.category ? { category: opts.category } : {}),
      ...(opts.is_open !== undefined ? { is_open: opts.is_open } : {}),
    },
  };

  const [rows, total] = await Promise.all([
    prisma.vendorDailyLocation.findMany({
      where,
      select: {
        ...baseSelect,
        vendor: {
          select: {
            business_name: true,
            slug: true,
            category: true,
            logo_url: true,
            rating: true,
            review_count: true,
            is_open: true,
            is_verified: true,
            roaming: true,
          },
        },
      },
      skip,
      take: per_page,
    }),
    prisma.vendorDailyLocation.count({ where }),
  ]);

  const items: NearbyDailyLocationResult[] = rows
    .map((row) => {
      const distance = haversineDistanceKm(lat, lng, row.latitude, row.longitude);
      if (distance > radiusKm) return null;
      const { vendor, ...location } = row;
      return {
        ...location,
        distance_km: Math.round(distance * 100) / 100,
        business_name: vendor.business_name,
        slug: vendor.slug,
        category: vendor.category,
        logo_url: vendor.logo_url,
        rating: vendor.rating,
        review_count: vendor.review_count,
        is_open: vendor.is_open,
        is_verified: vendor.is_verified,
        roaming: vendor.roaming,
      } as NearbyDailyLocationResult;
    })
    .filter((item): item is NearbyDailyLocationResult => item !== null);

  items.sort((a, b) => a.distance_km - b.distance_km);

  return { items, total };
}

export async function countActiveForDate(date: Date): Promise<number> {
  return prisma.vendorDailyLocation.count({
    where: {
      broadcast_date: date,
      is_active: true,
    },
  });
}
