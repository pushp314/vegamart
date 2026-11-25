import type { Request, Response } from "express";
import prisma from "../database/prisma";
import { sendSuccess } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";
import {
  formatCanonicalCityName,
  getKnownCityCenter,
  normalizeCityName,
  reverseGeocodeCoords,
} from "../utils/geocoding";
import { calculateStoreAvailability } from "../utils/store-schedule";
import { routingService } from "../modules/tracking/route.provider";

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
      auto_schedule_enabled: true,
      store_schedule: true,
      manual_override_status: true,
      manual_override_until: true,
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
    const canonicalCity = formatCanonicalCityName(v.city);
    const key = normalizeCityName(canonicalCity);
    if (!canonicalCity || !key || key === "city") continue;
    const existing = cityMap.get(key);
    const hasCoords =
      v.latitude !== null &&
      v.longitude !== null &&
      Number(v.latitude) > 5 &&
      Number(v.longitude) > 60;
    const radius = Number(v.delivery_radius_km || 10);
    const isVendorOpen = calculateStoreAvailability(v).isOpen;
    let stateVal = (v.state || "").trim() || "India";
    if (key === "sakti" || key === "bhilai" || key === "durg") {
      stateVal = "Chhattisgarh";
    }

    if (existing) {
      existing.vendor_count += 1;
      if (isVendorOpen) existing.open_vendor_count += 1;
      if (radius > existing.maxRadius) existing.maxRadius = radius;
      if (hasCoords) {
        existing.latSum += Number(v.latitude);
        existing.lngSum += Number(v.longitude);
        existing.coordCount += 1;
      }
    } else {
      cityMap.set(key, {
        city: canonicalCity,
        state: stateVal,
        vendor_count: 1,
        open_vendor_count: isVendorOpen ? 1 : 0,
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
    .map((c) => {
      const known = getKnownCityCenter(c.city);
      return {
        city: c.city,
        state: normalizeCityName(c.city) === "sakti" ? "Chhattisgarh" : c.state,
        vendor_count: c.vendor_count,
        open_vendor_count: c.open_vendor_count,
        latitude:
          c.coordCount > 0
            ? Math.round((c.latSum / c.coordCount) * 10000) / 10000
            : (known?.lat ?? null),
        longitude:
          c.coordCount > 0
            ? Math.round((c.lngSum / c.coordCount) * 10000) / 10000
            : (known?.lng ?? null),
        delivery_radius_km: c.maxRadius,
      };
    });

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

  const result = await reverseGeocodeCoords(lat, lng);
  return sendSuccess(res, result);
});

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
