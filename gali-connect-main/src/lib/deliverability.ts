/**
 * Deliverability & Multi-City Service Area Evaluation Engine
 *
 * Checks whether a given product or store is deliverable to the customer's
 * active delivery location / selected city based on:
 * 1. Store Open / Active status & Stock.
 * 2. Multi-City separation (Vendor city must match customer city).
 * 3. Delivery radius (Geographic distance between customer & vendor must be <= delivery_radius_km).
 */

export interface CustomerLocationCoords {
  city?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
}

export interface DeliverabilityStatus {
  isDeliverable: boolean;
  reason?: "DIFFERENT_CITY" | "OUT_OF_RADIUS" | "STORE_CLOSED" | "OUT_OF_STOCK" | null;
  message?: string;
  distanceKm?: number;
  maxRadiusKm?: number;
}

const CITY_ALIASES: Record<string, string> = {
  "bhilai nagar": "bhilai",
  "bhilai-durg": "bhilai",
  bangalore: "bengaluru",
};

export function normalizeCityName(raw?: string | null): string {
  if (!raw) return "";
  const s = String(raw)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\b(municipal corporation|district|tahsil|tehsil|city)\b/g, "")
    .trim();
  if (!s) return "";
  return CITY_ALIASES[s] ?? s;
}

export function citiesMatch(cityA?: string | null, cityB?: string | null): boolean {
  const normA = normalizeCityName(cityA);
  const normB = normalizeCityName(cityB);
  if (!normA || !normB) return true;
  return normA === normB || normA.includes(normB) || normB.includes(normA);
}

export function computeDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function checkVendorDeliverability(
  vendor: any,
  customerLocation?: CustomerLocationCoords | null
): DeliverabilityStatus {
  if (!vendor) return { isDeliverable: true };

  if (vendor.is_open === false || vendor.store_availability?.isOpen === false) {
    const nextTime = vendor.store_availability?.nextOpenTime;
    return {
      isDeliverable: false,
      reason: "STORE_CLOSED",
      message: nextTime ? `Store Closed (Opens at ${nextTime})` : "Store Closed",
    };
  }

  if (!customerLocation) return { isDeliverable: true };

  const custCity = (customerLocation.city || "").trim();
  const vendorCity = (vendor.city || vendor.profile?.city || "").trim();

  if (normalizeCityName(custCity) && normalizeCityName(vendorCity)) {
    if (!citiesMatch(custCity, vendorCity)) {
      return {
        isDeliverable: false,
        reason: "DIFFERENT_CITY",
        message: `Only available in ${vendorCity}`,
      };
    }
  }

  const cLat = Number(customerLocation.latitude);
  const cLng = Number(customerLocation.longitude);
  const vLat = Number(vendor.latitude || vendor.lat || vendor.profile?.latitude);
  const vLng = Number(vendor.longitude || vendor.lng || vendor.profile?.longitude);

  if (cLat > 5 && cLng > 60 && vLat > 5 && vLng > 60) {
    const distKm = computeDistanceKm(cLat, cLng, vLat, vLng);
    const maxRadius = Number(vendor.delivery_radius_km || vendor.profile?.delivery_radius_km || 10);

    if (distKm > maxRadius) {
      return {
        isDeliverable: false,
        reason: "OUT_OF_RADIUS",
        message: `Outside delivery radius (${distKm} km away, max ${maxRadius} km)`,
        distanceKm: distKm,
        maxRadiusKm: maxRadius,
      };
    }
  }

  return { isDeliverable: true };
}

export function checkProductDeliverability(
  product: any,
  customerLocation?: CustomerLocationCoords | null
): DeliverabilityStatus {
  if (!product) return { isDeliverable: true };

  // 1. Stock & Product Availability
  const isZeroStock = typeof product.stock === "number" && product.stock <= 0;
  const isOutOfStock =
    product.is_available === false ||
    product.is_active === false ||
    isZeroStock;

  if (isOutOfStock) {
    return {
      isDeliverable: false,
      reason: "OUT_OF_STOCK",
      message: "Out of Stock",
    };
  }

  const vendor = product.vendor;
  if (!vendor) return { isDeliverable: true };

  return checkVendorDeliverability(vendor, customerLocation);
}
