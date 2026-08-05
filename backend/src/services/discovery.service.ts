import { ApiError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";
import prisma from "../database/prisma";
import { GUEST_USER_ID } from "../constants";

/**
 * Discovery service — favorites, follows, nearby search history and vendor
 * location history for the hyperlocal discovery experience.
 */

export interface DiscoveryVendorSummary {
  id: string;
  business_name: string;
  slug: string;
  category: string | null;
  logo_url: string | null;
  rating: number;
  review_count: number;
  is_verified: boolean;
  is_open: boolean;
  roaming: boolean;
  latitude: number | null;
  longitude: number | null;
  area: string | null;
  landmark: string | null;
  distance_km?: number;
}

const vendorSelect = {
  id: true,
  business_name: true,
  slug: true,
  category: true,
  logo_url: true,
  rating: true,
  review_count: true,
  is_verified: true,
  is_open: true,
  roaming: true,
  latitude: true,
  longitude: true,
  address: true,
} as const;

type VendorRow = {
  id: string;
  business_name: string;
  slug: string;
  category: string | null;
  logo_url: string | null;
  rating: number;
  review_count: number;
  is_verified: boolean;
  is_open: boolean;
  roaming: boolean;
  latitude: number | null;
  longitude: number | null;
  address: string;
};

function toSummary(v: VendorRow): DiscoveryVendorSummary {
  return {
    id: v.id,
    business_name: v.business_name,
    slug: v.slug,
    category: v.category,
    logo_url: v.logo_url,
    rating: v.rating,
    review_count: v.review_count,
    is_verified: v.is_verified,
    is_open: v.is_open,
    roaming: v.roaming,
    latitude: v.latitude,
    longitude: v.longitude,
    area: null,
    landmark: null,
  };
}

async function assertVendor(vendorId: string): Promise<VendorRow> {
  const vendor = await prisma.vendorProfile.findFirst({
    where: { id: vendorId, deleted_at: null },
    select: vendorSelect,
  });
  if (!vendor) {
    throw new ApiError(HttpStatus.NOT_FOUND, "Vendor not found.", { code: "NOT_FOUND" });
  }
  return vendor as unknown as VendorRow;
}

export const discoveryService = {
  // ── Favorites ────────────────────────────────────────────────────────────

  async favorite(userId: string, vendorId: string) {
    await assertVendor(vendorId);
    const existing = await prisma.customerFavorite.findUnique({
      where: { user_id_vendor_id: { user_id: userId, vendor_id: vendorId } },
    });
    if (existing) {
      await prisma.customerFavorite.delete({ where: { id: existing.id } });
    } else {
      await prisma.customerFavorite.create({ data: { user_id: userId, vendor_id: vendorId } });
    }
    const [favorited, count] = await Promise.all([
      prisma.customerFavorite.count({
        where: { user_id: userId, vendor_id: vendorId },
      }),
      prisma.customerFavorite.count({ where: { vendor_id: vendorId } }),
    ]);
    return { is_favorited: favorited > 0, favorites_count: count };
  },

  async listFavorites(userId: string): Promise<DiscoveryVendorSummary[]> {
    const rows = await prisma.customerFavorite.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: 100,
      select: {
        vendor: { select: vendorSelect },
        created_at: true,
      },
    });
    return rows.map((r) => toSummary(r.vendor as unknown as VendorRow));
  },

  // ── Follows ──────────────────────────────────────────────────────────────

  async follow(userId: string, vendorId: string) {
    await assertVendor(vendorId);
    const existing = await prisma.vendorFollower.findUnique({
      where: { user_id_vendor_id: { user_id: userId, vendor_id: vendorId } },
    });
    if (existing) {
      await prisma.vendorFollower.delete({ where: { id: existing.id } });
    } else {
      await prisma.vendorFollower.create({ data: { user_id: userId, vendor_id: vendorId } });
    }
    const [following, count] = await Promise.all([
      prisma.vendorFollower.count({
        where: { user_id: userId, vendor_id: vendorId },
      }),
      prisma.vendorFollower.count({ where: { vendor_id: vendorId } }),
    ]);
    return { is_following: following > 0, followers_count: count };
  },

  async listFollows(userId: string): Promise<DiscoveryVendorSummary[]> {
    const rows = await prisma.vendorFollower.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: 100,
      select: {
        vendor: { select: vendorSelect },
        created_at: true,
      },
    });
    return rows.map((r) => toSummary(r.vendor as unknown as VendorRow));
  },

  async getStatus(userId: string, vendorId: string) {
    await assertVendor(vendorId);
    const [isFavorited, isFollowing, favoritesCount, followersCount] = await Promise.all([
      prisma.customerFavorite.count({
        where: { user_id: userId, vendor_id: vendorId },
      }),
      prisma.vendorFollower.count({
        where: { user_id: userId, vendor_id: vendorId },
      }),
      prisma.customerFavorite.count({ where: { vendor_id: vendorId } }),
      prisma.vendorFollower.count({ where: { vendor_id: vendorId } }),
    ]);
    return {
      is_favorited: isFavorited > 0,
      is_following: isFollowing > 0,
      favorites_count: favoritesCount,
      followers_count: followersCount,
    };
  },

  // ── Nearby search history ────────────────────────────────────────────────

  async recordSearch(
    userId: string,
    input: {
      query: string;
      category?: string | null;
      latitude: number;
      longitude: number;
      radius_km?: number;
      filters?: Record<string, unknown> | null;
    },
  ) {
    if (!userId || userId === GUEST_USER_ID) return null;
    const existing = await prisma.nearbySearchHistory.findFirst({
      where: { user_id: userId, query: input.query, category: input.category ?? null },
      orderBy: { created_at: "desc" },
    });
    if (existing) {
      await prisma.nearbySearchHistory.update({
        where: { id: existing.id },
        data: {
          latitude: input.latitude,
          longitude: input.longitude,
          radius_km: input.radius_km ?? 5,
          filters: (input.filters as object) ?? undefined,
          created_at: new Date(),
        },
      });
    } else {
      await prisma.nearbySearchHistory.create({
        data: {
          user_id: userId,
          query: input.query,
          category: input.category ?? null,
          latitude: input.latitude,
          longitude: input.longitude,
          radius_km: input.radius_km ?? 5,
          filters: (input.filters as object) ?? undefined,
        },
      });
    }
    // keep the last 25 searches per user
    const stale = await prisma.nearbySearchHistory.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      skip: 25,
      select: { id: true },
    });
    if (stale.length) {
      await prisma.nearbySearchHistory.deleteMany({
        where: { id: { in: stale.map((s) => s.id) } },
      });
    }
    return true;
  },

  async listSearchHistory(userId: string) {
    return prisma.nearbySearchHistory.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: 25,
      select: {
        id: true,
        query: true,
        category: true,
        latitude: true,
        longitude: true,
        radius_km: true,
        filters: true,
        created_at: true,
      },
    });
  },

  async clearSearchHistory(userId: string) {
    await prisma.nearbySearchHistory.deleteMany({ where: { user_id: userId } });
  },

  // ── Vendor location history ──────────────────────────────────────────────

  async recordLocationHistory(vendorId: string, location: {
    area: string;
    landmark?: string | null;
    address: string;
    latitude: number;
    longitude: number;
    start_time?: string | null;
    end_time?: string | null;
    notes?: string | null;
    is_active?: boolean;
  }) {
    await prisma.vendorLocationHistory.create({
      data: {
        vendor_id: vendorId,
        area: location.area,
        landmark: location.landmark ?? null,
        address: location.address,
        latitude: location.latitude,
        longitude: location.longitude,
        start_time: location.start_time ?? null,
        end_time: location.end_time ?? null,
        notes: location.notes ?? null,
        is_active: location.is_active ?? true,
      },
    });
  },

  async getVendorHistory(vendorId: string, limit = 30) {
    const vendor = await assertVendor(vendorId);
    const rows = await prisma.vendorLocationHistory.findMany({
      where: { vendor_id: vendor.id },
      orderBy: { recorded_at: "desc" },
      take: Math.min(100, Math.max(1, limit)),
      select: {
        id: true,
        area: true,
        landmark: true,
        address: true,
        latitude: true,
        longitude: true,
        start_time: true,
        end_time: true,
        notes: true,
        is_active: true,
        recorded_at: true,
      },
    });
    return {
      vendor: {
        id: vendor.id,
        business_name: vendor.business_name,
        slug: vendor.slug,
        category: vendor.category,
        logo_url: vendor.logo_url,
      },
      history: rows,
    };
  },
};
