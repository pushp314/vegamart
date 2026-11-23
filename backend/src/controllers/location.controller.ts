import type { Request, Response } from "express";
import prisma from "../database/prisma";
import { sendSuccess } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";

export interface ServiceableCity {
  city: string;
  state: string;
  vendor_count: number;
  open_vendor_count: number;
  latitude: number | null;
  longitude: number | null;
  delivery_radius_km: number;
}

export const getServiceableCities = asyncHandler(async (_req: Request, res: Response) => {
  const vendors = await prisma.vendorProfile.findMany({
    where: {
      status: "APPROVED",
      deleted_at: null,
    },
    select: {
      id: true,
      city: true,
      state: true,
      latitude: true,
      longitude: true,
      delivery_radius_km: true,
      is_open: true,
    },
  });

  const cityMap = new Map<
    string,
    {
      city: string;
      state: string;
      vendor_count: number;
      open_vendor_count: number;
      latSum: number;
      lngSum: number;
      coordCount: number;
      maxRadius: number;
    }
  >();

  for (const v of vendors) {
    const rawCity = (v.city || "").trim();
    if (!rawCity || rawCity.toLowerCase() === "city") continue;
    const key = rawCity.toLowerCase();
    const existing = cityMap.get(key);
    const hasCoords = v.latitude !== null && v.longitude !== null;
    const radius = Number(v.delivery_radius_km || 5);

    if (existing) {
      existing.vendor_count += 1;
      if (v.is_open) existing.open_vendor_count += 1;
      if (radius > existing.maxRadius) existing.maxRadius = radius;
      if (hasCoords) {
        existing.latSum += Number(v.latitude);
        existing.lngSum += Number(v.longitude);
        existing.coordCount += 1;
      }
    } else {
      cityMap.set(key, {
        city: rawCity,
        state: (v.state || "").trim() || "India",
        vendor_count: 1,
        open_vendor_count: v.is_open ? 1 : 0,
        latSum: hasCoords ? Number(v.latitude) : 0,
        lngSum: hasCoords ? Number(v.longitude) : 0,
        coordCount: hasCoords ? 1 : 0,
        maxRadius: radius,
      });
    }
  }

  let result: ServiceableCity[] = Array.from(cityMap.values()).map((c) => ({
    city: c.city,
    state: c.state,
    vendor_count: c.vendor_count,
    open_vendor_count: c.open_vendor_count,
    latitude: c.coordCount > 0 ? Math.round((c.latSum / c.coordCount) * 10000) / 10000 : null,
    longitude: c.coordCount > 0 ? Math.round((c.lngSum / c.coordCount) * 10000) / 10000 : null,
    delivery_radius_km: c.maxRadius,
  }));

  // Ensure known target expansion cities (Sakti, Raigarh, Bilaspur, Raipur, Bengaluru, Mumbai) are included
  // if not already present from database vendors
  const fallbackDefaults: ServiceableCity[] = [
    { city: "Sakti", state: "Chhattisgarh", vendor_count: 0, open_vendor_count: 0, latitude: 21.959, longitude: 82.961, delivery_radius_km: 10 },
    { city: "Raigarh", state: "Chhattisgarh", vendor_count: 0, open_vendor_count: 0, latitude: 21.897, longitude: 83.395, delivery_radius_km: 10 },
    { city: "Bilaspur", state: "Chhattisgarh", vendor_count: 0, open_vendor_count: 0, latitude: 22.079, longitude: 82.140, delivery_radius_km: 10 },
    { city: "Raipur", state: "Chhattisgarh", vendor_count: 0, open_vendor_count: 0, latitude: 21.251, longitude: 81.629, delivery_radius_km: 15 },
    { city: "Bengaluru", state: "Karnataka", vendor_count: 0, open_vendor_count: 0, latitude: 12.971, longitude: 77.594, delivery_radius_km: 10 },
  ];

  const existingCityNames = new Set(result.map((r) => r.city.toLowerCase()));
  for (const def of fallbackDefaults) {
    if (!existingCityNames.has(def.city.toLowerCase())) {
      result.push(def);
      existingCityNames.add(def.city.toLowerCase());
    }
  }

  // Sort by vendor count desc, then city name
  result.sort((a, b) => b.vendor_count - a.vendor_count || a.city.localeCompare(b.city));

  return sendSuccess(res, result);
});
