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

export const reverseGeocode = asyncHandler(async (req: Request, res: Response) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return sendSuccess(res, {
      line1: "",
      line2: "",
      city: "",
      state: "",
      pincode: "",
      exact_location: "",
      lat: null,
      lng: null,
    });
  }

  let streetName = "";
  let areaName = "";
  let cityName = "";
  let stateName = "";
  let pincode = "";
  let displayName = "";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const osmRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      {
        headers: {
          "User-Agent": "VegaMart/1.0 (contact@vegamart.in)",
          "Accept-Language": "en",
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (osmRes.ok) {
      const data: any = await osmRes.json();
      const addr = data.address || {};
      streetName = addr.road || addr.street || addr.residential || addr.neighbourhood || "";
      areaName = addr.suburb || addr.neighbourhood || addr.village || addr.subdistrict || "";
      cityName = addr.city || addr.town || addr.village || addr.state_district || addr.county || "";
      stateName = addr.state || "";
      pincode = addr.postcode || "";
      displayName = data.display_name || "";
    }
  } catch (_err) {
    // If Nominatim times out, continue to fallback calculation
  }

  // If city is still blank, match closest known city by distance
  if (!cityName) {
    const knownCities = [
      { name: "Sakti", state: "Chhattisgarh", lat: 21.959, lng: 82.961 },
      { name: "Raigarh", state: "Chhattisgarh", lat: 21.897, lng: 83.395 },
      { name: "Bilaspur", state: "Chhattisgarh", lat: 22.079, lng: 82.140 },
      { name: "Raipur", state: "Chhattisgarh", lat: 21.251, lng: 81.629 },
      { name: "Bengaluru", state: "Karnataka", lat: 12.971, lng: 77.594 },
    ];
    let closest = knownCities[0]!;
    let minD = Infinity;
    for (const c of knownCities) {
      const d = Math.hypot(lat - c.lat, lng - c.lng);
      if (d < minD) {
        minD = d;
        closest = c;
      }
    }
    cityName = closest.name;
    if (!stateName) stateName = closest.state;
  }

  return sendSuccess(res, {
    line1: streetName,
    line2: areaName,
    city: cityName,
    state: stateName,
    pincode,
    exact_location: displayName || [streetName, areaName, cityName, stateName, pincode].filter(Boolean).join(", "),
    lat,
    lng,
    map_url: `https://www.google.com/maps?q=${lat},${lng}`,
  });
});
