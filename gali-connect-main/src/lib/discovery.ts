/**
 * VegaMart discovery layer — nearby vendors, roaming carts, favorites,
 * follows, search history and categories. Reuses the shared `api` client.
 */
import { api } from "@/lib/api";
import type { ApiResponse } from "@/lib/api";
import { calculateDistance } from "@/lib/utils/distance";

export type VendorKind = "roaming" | "shop";

export interface DiscoveryVendor {
  id: string;
  business_name: string;
  slug: string;
  category: string | null;
  logo_url: string | null;
  banner_url?: string | null;
  tags?: string[] | string | null;
  rating: number;
  review_count: number;
  is_verified: boolean;
  is_open: boolean;
  roaming: boolean;
  vendor_type: VendorKind;
  latitude: number | null;
  longitude: number | null;
  distance_km?: number;
  area?: string | null;
  landmark?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  available_to?: string | null;
  available_from?: string | null;
  business_hours?: string | null;
  followers_count?: number;
  favorites_count?: number;
  is_favorited?: boolean;
  is_following?: boolean;
  updated_at?: string | null;
}

export interface DiscoveryFilters {
  radiusKm: number;
  categories: string[]; // empty = all
  minRating: number; // 0 = any
  openNow: boolean;
  verifiedOnly: boolean;
  kinds: VendorKind[]; // empty = both
  hasOffers: boolean;
}

export const DEFAULT_FILTERS: DiscoveryFilters = {
  radiusKm: 5,
  categories: [],
  minRating: 0,
  openNow: false,
  verifiedOnly: false,
  kinds: [],
  hasOffers: false,
};

// ── Categories ────────────────────────────────────────────────────────────────

export interface CategoryPill {
  id: string;
  label: string;
  emoji: string;
  /** tailwind-friendly hex used for markers / accents */
  color: string;
}

export const DISCOVERY_CATEGORIES: CategoryPill[] = [
  { id: "all", label: "All", emoji: "🛒", color: "#10b981" },
  { id: "vegetables", label: "Vegetables", emoji: "🥦", color: "#059669" },
  { id: "fruits", label: "Fruits", emoji: "🍎", color: "#f43f5e" },
  { id: "milk", label: "Milk", emoji: "🥛", color: "#38bdf8" },
  { id: "dairy", label: "Dairy", emoji: "🧀", color: "#818cf8" },
  { id: "bakery", label: "Bakery", emoji: "🥐", color: "#f59e0b" },
  { id: "tea", label: "Tea & Chai", emoji: "☕", color: "#a16207" },
  { id: "food", label: "Food", emoji: "🍛", color: "#ef4444" },
  { id: "flowers", label: "Flowers", emoji: "💐", color: "#ec4899" },
  { id: "street", label: "Street Food", emoji: "🍢", color: "#fb923c" },
  { id: "groceries", label: "Groceries", emoji: "🛍️", color: "#14b8a6" },
  { id: "meat", label: "Meat & Fish", emoji: "🍗", color: "#b91c1c" },
  { id: "eggs", label: "Eggs", emoji: "🥚", color: "#eab308" },
];

export function colorForCategory(category: string | null | undefined): string {
  if (!category) return "#10b981";
  const c = category.toLowerCase();
  const found = DISCOVERY_CATEGORIES.find(
    (p) => c.includes(p.id) || p.label.toLowerCase().includes(c),
  );
  return found?.color ?? "#10b981";
}

// ── Normalization ─────────────────────────────────────────────────────────────

interface RawNearbyItem {
  vendor?: Record<string, unknown>;
  distance_km?: number;
  latitude?: number | null;
  longitude?: number | null;
  [key: string]: unknown;
}

/** A `/vendors/nearby/daily` row — a live roaming cart location. */
interface RawDailyLocation extends RawNearbyItem {
  area?: string | null;
  landmark?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  updated_at?: string | null;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function normalizeNearbyVendor(item: RawNearbyItem): DiscoveryVendor | null {
  const vendor = (item.vendor ?? item) as Record<string, unknown>;
  const lat = num(item.latitude ?? vendor.latitude);
  const lng = num(item.longitude ?? vendor.longitude);
  const id = (vendor.id as string) ?? (item.id as string);
  if (!id || lat == null || lng == null) return null;

  const roaming = Boolean(vendor.roaming);
  const rawTags = vendor.tags;
  let tags: string[] = [];
  if (Array.isArray(rawTags)) tags = rawTags as string[];
  else if (typeof rawTags === "string" && rawTags.trim()) {
    try {
      const parsed = JSON.parse(rawTags);
      if (Array.isArray(parsed)) tags = parsed;
    } catch {
      tags = rawTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }
  }

  return {
    id,
    business_name: (vendor.business_name as string) ?? (vendor.name as string) ?? "Unknown vendor",
    slug: (vendor.slug as string) ?? id,
    category: (vendor.category as string) ?? null,
    logo_url: (vendor.logo_url as string) ?? null,
    banner_url: (vendor.banner_url as string) ?? null,
    tags,
    rating: num(vendor.rating) ?? 0,
    review_count: num(vendor.review_count) ?? 0,
    is_verified: Boolean(vendor.is_verified),
    is_open: Boolean(vendor.is_open),
    roaming,
    vendor_type: roaming ? "roaming" : "shop",
    latitude: lat,
    longitude: lng,
    distance_km: num(item.distance_km) ?? undefined,
    area: (item.area as string) ?? null,
    landmark: (item.landmark as string) ?? null,
    address: (vendor.address as string) ?? null,
    city: (vendor.city as string) ?? null,
    phone: (vendor.phone as string) ?? null,
    available_to: (vendor.available_to as string) ?? null,
    available_from: (vendor.available_from as string) ?? null,
    business_hours: (vendor.business_hours as string) ?? null,
    followers_count: num(item.followers_count) ?? undefined,
    favorites_count: num(item.favorites_count) ?? undefined,
    is_favorited: Boolean(item.is_favorited),
    is_following: Boolean(item.is_following),
    updated_at: (item.updated_at as string) ?? null,
  };
}

// ── API helpers ───────────────────────────────────────────────────────────────

export interface NearbyResult {
  vendors: DiscoveryVendor[];
  total: number;
}

export async function fetchNearbyVendors(opts: {
  lat: number;
  lng: number;
  radiusKm: number;
  category?: string;
  isOpen?: boolean;
}): Promise<NearbyResult> {
  const params = new URLSearchParams({
    lat: String(opts.lat),
    lng: String(opts.lng),
    radius: String(opts.radiusKm),
    per_page: "100",
  });
  if (opts.category && opts.category !== "all") params.set("category", opts.category);
  if (opts.isOpen) params.set("is_open", "true");

  const res = await api.get<any[]>(`/vendors/nearby?${params.toString()}`);
  const rows = Array.isArray(res.data) ? res.data : ((res.data as any)?.data ?? []);
  const vendors = rows.map(normalizeNearbyVendor).filter(Boolean) as DiscoveryVendor[];
  return { vendors, total: res.pagination?.total ?? vendors.length };
}

export interface DailyResult {
  locations: DiscoveryVendor[];
  total: number;
}

export async function fetchNearbyDailyLocations(opts: {
  lat: number;
  lng: number;
  radiusKm: number;
  category?: string;
  isOpen?: boolean;
}): Promise<DailyResult> {
  const params = new URLSearchParams({
    lat: String(opts.lat),
    lng: String(opts.lng),
    radius: String(opts.radiusKm),
    per_page: "100",
  });
  if (opts.category && opts.category !== "all") params.set("category", opts.category);
  if (opts.isOpen) params.set("is_open", "true");

  const res = await api.get<RawDailyLocation[]>(`/vendors/nearby/daily?${params.toString()}`);
  const rows: RawDailyLocation[] = Array.isArray(res.data)
    ? res.data
    : (((res.data as any)?.data ?? []) as RawDailyLocation[]);
  const locations = rows
    .map((item) => {
      const v = normalizeNearbyVendor({
        ...item,
        vendor: { ...item, latitude: item.latitude, longitude: item.longitude },
      });
      if (!v) return null;
      v.roaming = true;
      v.vendor_type = "roaming";
      v.area = item.area ?? null;
      v.landmark = item.landmark ?? null;
      v.business_hours = item.start_time
        ? `${item.start_time} – ${item.end_time ?? "close"}`
        : null;
      v.available_to = item.end_time ?? null;
      v.available_from = item.start_time ?? null;
      v.updated_at = item.updated_at ?? null;
      return v;
    })
    .filter(Boolean) as DiscoveryVendor[];
  return { locations, total: res.pagination?.total ?? locations.length };
}

interface RawCategory {
  id: string;
  name: string;
}

export async function fetchCategories(): Promise<{ id: string; name: string }[]> {
  const res = await api.get<RawCategory[]>("/categories");
  const rows: RawCategory[] = Array.isArray(res.data)
    ? res.data
    : (((res.data as any)?.data ?? []) as RawCategory[]);
  return rows.map((c) => ({ id: c.id, name: c.name }));
}

// ── Engagement (favorites / follows) ─────────────────────────────────────────

export interface EngagementState {
  is_favorited: boolean;
  is_following: boolean;
  favorites_count: number;
  followers_count: number;
}

export function toggleFavoriteVendor(vendorId: string): Promise<ApiResponse> {
  return api.post(`/discovery/favorites/${vendorId}`);
}

export function toggleFollowVendor(vendorId: string): Promise<ApiResponse> {
  return api.post(`/discovery/follows/${vendorId}`);
}

export async function fetchMyFavorites(): Promise<DiscoveryVendor[]> {
  const res = await api.get<RawNearbyItem[]>("/discovery/favorites");
  const rows: RawNearbyItem[] = Array.isArray(res.data)
    ? res.data
    : (((res.data as any)?.data ?? []) as RawNearbyItem[]);
  return rows
    .map((r) => normalizeNearbyVendor({ vendor: r, latitude: r.latitude, longitude: r.longitude }))
    .filter(Boolean) as DiscoveryVendor[];
}

export async function fetchMyFollows(): Promise<DiscoveryVendor[]> {
  const res = await api.get<RawNearbyItem[]>("/discovery/follows");
  const rows: RawNearbyItem[] = Array.isArray(res.data)
    ? res.data
    : (((res.data as any)?.data ?? []) as RawNearbyItem[]);
  return rows
    .map((r) => normalizeNearbyVendor({ vendor: r, latitude: r.latitude, longitude: r.longitude }))
    .filter(Boolean) as DiscoveryVendor[];
}

// ── Search history ───────────────────────────────────────────────────────────

export interface NearbySearchHistoryEntry {
  id: string;
  query: string;
  category: string | null;
  latitude: number;
  longitude: number;
  radius_km: number;
  filters?: unknown;
  created_at: string;
}

export async function fetchSearchHistory(): Promise<NearbySearchHistoryEntry[]> {
  const res = await api.get<NearbySearchHistoryEntry[]>("/discovery/search-history");
  return Array.isArray(res.data) ? res.data : ((res.data as any)?.data ?? []);
}

export function clearSearchHistory(): Promise<ApiResponse> {
  return api.delete("/discovery/search-history");
}

// ── Vendor location history ──────────────────────────────────────────────────

export interface VendorLocationHistoryEntry {
  id: string;
  area: string;
  landmark: string | null;
  address: string;
  latitude: number;
  longitude: number;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  is_active: boolean;
  recorded_at: string;
}

export async function fetchVendorHistory(
  vendorId: string,
  limit = 30,
): Promise<{ vendor: Record<string, unknown>; history: VendorLocationHistoryEntry[] } | null> {
  const res = await api.get<any>(`/vendors/${vendorId}/history?limit=${limit}`);
  return res.success ? (res.data as any) : null;
}

// ── Geo / time helpers ───────────────────────────────────────────────────────

export function walkTimeMinutes(distanceKm: number | undefined): number | null {
  if (distanceKm == null) return null;
  return Math.max(2, Math.round((distanceKm / 4.8) * 60)); // ~4.8 km/h walking
}

export function distanceFrom(userLat: number, userLng: number, v: DiscoveryVendor): number | null {
  if (v.latitude == null || v.longitude == null) return null;
  return calculateDistance(userLat, userLng, v.latitude, v.longitude);
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMin = Math.round((Date.now() - then) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  return `${Math.round(diffHr / 24)} d ago`;
}
