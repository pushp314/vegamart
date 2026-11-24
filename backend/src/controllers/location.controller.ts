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
    let stateVal = (v.state || "").trim() || "India";
    if (key === "sakti") {
      stateVal = "Chhattisgarh";
    }

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
        state: stateVal,
        vendor_count: 1,
        open_vendor_count: v.is_open ? 1 : 0,
        latSum: hasCoords ? Number(v.latitude) : 0,
        lngSum: hasCoords ? Number(v.longitude) : 0,
        coordCount: hasCoords ? 1 : 0,
        maxRadius: radius,
      });
    }
  }

  // Only return cities that have actual approved vendors
  let result: ServiceableCity[] = Array.from(cityMap.values())
    .filter((c) => c.vendor_count > 0)
    .map((c) => ({
      city: c.city,
      state: c.city.toLowerCase() === "sakti" ? "Chhattisgarh" : c.state,
      vendor_count: c.vendor_count,
      open_vendor_count: c.open_vendor_count,
      latitude: c.coordCount > 0 ? Math.round((c.latSum / c.coordCount) * 10000) / 10000 : null,
      longitude: c.coordCount > 0 ? Math.round((c.lngSum / c.coordCount) * 10000) / 10000 : null,
      delivery_radius_km: c.maxRadius,
    }));

  // If no vendors exist anywhere in DB yet, fallback solely to primary launch city Sakti
  if (result.length === 0) {
    result.push({
      city: "Sakti",
      state: "Chhattisgarh",
      vendor_count: 0,
      open_vendor_count: 0,
      latitude: 21.959,
      longitude: 82.961,
      delivery_radius_km: 10,
    });
  }

  // Auto-correct any database records for Sakti where state was accidentally saved as Karnataka
  prisma.vendorProfile
    .updateMany({
      where: {
        city: { equals: "sakti", mode: "insensitive" },
        state: { not: "Chhattisgarh" },
      },
      data: { state: "Chhattisgarh" },
    })
    .catch(() => {});

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

import { routingService } from "../modules/tracking/route.provider";

export const getDirections = asyncHandler(async (req: Request, res: Response) => {
  const originStr = req.query.origin as string;
  const destStr = req.query.destination as string;
  const waypointsStr = req.query.waypoints as string;

  if (!originStr || !destStr) {
    return sendSuccess(res, { coordinates: [], distanceKm: 0, durationMinutes: 0 });
  }

  const origParts = originStr.split(",").map(Number);
  const destParts = destStr.split(",").map(Number);

  const origLat = origParts[0];
  const origLng = origParts[1];
  const destLat = destParts[0];
  const destLng = destParts[1];

  if (
    origLat === undefined ||
    origLng === undefined ||
    destLat === undefined ||
    destLng === undefined ||
    Number.isNaN(origLat) ||
    Number.isNaN(origLng) ||
    Number.isNaN(destLat) ||
    Number.isNaN(destLng)
  ) {
    return sendSuccess(res, { coordinates: [], distanceKm: 0, durationMinutes: 0 });
  }

  const waypoints: Array<{ lat: number; lng: number }> = [{ lat: origLat, lng: origLng }];

  if (waypointsStr) {
    const rawPts = waypointsStr.split(";");
    for (const p of rawPts) {
      const parts = p.split(",").map(Number);
      const wLat = parts[0];
      const wLng = parts[1];
      if (wLat !== undefined && wLng !== undefined && !Number.isNaN(wLat) && !Number.isNaN(wLng)) {
        waypoints.push({ lat: wLat, lng: wLng });
      }
    }
  }

  waypoints.push({ lat: destLat, lng: destLng });

  const result = await routingService.calculateRoute(waypoints);

  return sendSuccess(res, {
    coordinates: result.points,
    distanceKm: Math.round((result.distanceMeters / 1000) * 10) / 10,
    durationMinutes: Math.max(1, Math.round(result.durationSeconds / 60)),
    provider: result.provider,
  });
});
