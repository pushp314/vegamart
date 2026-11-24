/**
 * Real Road Routing & Turn-by-Turn Navigation Engine for Vegamart
 * Powers live GPS road tracking, smooth marker movement, and in-app navigation
 * using OpenStreetMap / OSRM road geometry.
 */

import { api } from "@/lib/api";

export interface ManeuverStep {
  instruction: string;
  type: string;
  modifier?: string;
  distanceMeters: number;
  durationSeconds: number;
  streetName: string;
  location: [number, number]; // [lat, lng]
}

export interface RoadRoute {
  coordinates: [number, number][]; // [lat, lng]
  distanceKm: number;
  durationMinutes: number;
  steps: ManeuverStep[];
}

// In-memory route cache to prevent redundant network calls during minor GPS jitter
const routeCache = new Map<string, { route: RoadRoute; timestamp: number }>();
const CACHE_TTL_MS = 30000; // 30 seconds cache

function getCacheKey(waypoints: Array<{ lat: number; lng: number }>): string {
  // Round to ~10 meters resolution to group nearby GPS pings
  return waypoints
    .map((w) => `${w.lat.toFixed(4)},${w.lng.toFixed(4)}`)
    .join(";");
}

function computeBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

function formatManeuverInstruction(
  type: string,
  modifier: string | undefined,
  streetName: string
): string {
  const road = streetName && streetName.trim().length > 0 ? `on ${streetName}` : "ahead";

  if (type === "arrive") return "You have arrived at your destination";
  if (type === "depart") return `Head towards route ${road}`;
  if (type === "roundabout") return `Enter roundabout and take exit ${road}`;

  switch (modifier) {
    case "left":
      return `Turn left ${road}`;
    case "right":
      return `Turn right ${road}`;
    case "sharp left":
      return `Make a sharp left ${road}`;
    case "sharp right":
      return `Make a sharp right ${road}`;
    case "slight left":
      return `Keep slightly left ${road}`;
    case "slight right":
      return `Keep slightly right ${road}`;
    case "straight":
      return `Continue straight ${road}`;
    case "uturn":
      return `Make a U-turn ${road}`;
    default:
      return `Continue ${road}`;
  }
}

function decodeGooglePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}

/**
 * Fetch true road route along real street network.
 * Priority:
 * 1. Google Directions API (if VITE_GOOGLE_MAPS_API_KEY configured)
 * 2. Backend /locations/directions proxy (uses Google or high-accuracy server routing)
 * 3. OpenStreetMap multi-profile (bike, motorcycle, car) with abnormal detour rejection
 */
export async function fetchRoadRoute(
  waypoints: Array<{ lat: number; lng: number }>
): Promise<RoadRoute | null> {
  const valid = waypoints.filter(
    (w) =>
      typeof w.lat === "number" &&
      typeof w.lng === "number" &&
      !isNaN(w.lat) &&
      !isNaN(w.lng) &&
      w.lat > 5 &&
      w.lng > 60 // Valid coordinates in India bounds
  );

  if (valid.length < 2) return null;

  const cacheKey = getCacheKey(valid);
  const cached = routeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.route;
  }

  const first = valid[0]!;
  const last = valid[valid.length - 1]!;

  // Straight line distance
  const dLat = ((last.lat - first.lat) * Math.PI) / 180;
  const dLon = ((last.lng - first.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((first.lat * Math.PI) / 180) *
      Math.cos((last.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const straightDistKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // 1. Direct Google Directions if VITE_GOOGLE_MAPS_API_KEY is configured
  const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (googleApiKey && typeof googleApiKey === "string" && googleApiKey.trim().length > 10) {
    try {
      const intermediates = valid.slice(1, -1);
      const waypointsParam =
        intermediates.length > 0
          ? `&waypoints=${intermediates.map((w) => `${w.lat},${w.lng}`).join("|")}`
          : "";
      const googleUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${first.lat},${first.lng}&destination=${last.lat},${last.lng}${waypointsParam}&mode=driving&key=${googleApiKey.trim()}`;

      const res = await fetch(googleUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.status === "OK" && data.routes?.[0]?.overview_polyline?.points) {
          const coordinates = decodeGooglePolyline(data.routes[0].overview_polyline.points);
          let distMeters = 0;
          let durSeconds = 0;
          const steps: ManeuverStep[] = [];

          if (Array.isArray(data.routes[0].legs)) {
            for (const leg of data.routes[0].legs) {
              distMeters += leg.distance?.value || 0;
              durSeconds += leg.duration?.value || 0;
              if (Array.isArray(leg.steps)) {
                for (const s of leg.steps) {
                  steps.push({
                    instruction: (s.html_instructions || "").replace(/<[^>]*>?/gm, ""),
                    type: s.maneuver || "turn",
                    distanceMeters: s.distance?.value || 0,
                    durationSeconds: s.duration?.value || 0,
                    streetName: "",
                    location: [s.end_location?.lat || 0, s.end_location?.lng || 0],
                  });
                }
              }
            }
          }

          const result: RoadRoute = {
            coordinates,
            distanceKm: Math.round((distMeters / 1000) * 10) / 10,
            durationMinutes: Math.max(1, Math.round(durSeconds / 60)),
            steps,
          };
          routeCache.set(cacheKey, { route: result, timestamp: Date.now() });
          return result;
        }
      }
    } catch {
      // Fallback to next engine
    }
  }

  // 2. Try Backend Directions Proxy
  try {
    const intermediates = valid.slice(1, -1);
    const waypointsQuery =
      intermediates.length > 0
        ? `&waypoints=${intermediates.map((w) => `${w.lat},${w.lng}`).join(";")}`
        : "";
    const proxyRes = await api.get<any>(
      `/locations/directions?origin=${first.lat},${first.lng}&destination=${last.lat},${last.lng}${waypointsQuery}`
    );
    const pData = proxyRes?.data?.data || proxyRes?.data;
    if (pData?.coordinates && Array.isArray(pData.coordinates) && pData.coordinates.length >= 2) {
      const result: RoadRoute = {
        coordinates: pData.coordinates,
        distanceKm: pData.distanceKm || Math.round(straightDistKm * 10) / 10,
        durationMinutes: pData.durationMinutes || Math.max(1, Math.round((straightDistKm / 25) * 60)),
        steps: [],
      };
      routeCache.set(cacheKey, { route: result, timestamp: Date.now() });
      return result;
    }
  } catch {
    // Continue to OSRM
  }

  // 3. OpenStreetMap multi-profile routing with detour check
  const coordsQuery = valid.map((w) => `${w.lng},${w.lat}`).join(";");
  const endpoints = [
    `https://routing.openstreetmap.de/routed-bike/route/v1/bicycle/${coordsQuery}?overview=full&geometries=geojson&steps=true`,
    `https://routing.openstreetmap.de/routed-car/route/v1/driving/${coordsQuery}?overview=full&geometries=geojson&steps=true&continue_straight=false`,
    `https://router.project-osrm.org/route/v1/driving/${coordsQuery}?overview=full&geometries=geojson&steps=true&continue_straight=false`,
  ];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) continue;
      const data = await res.json();
      const route = data.routes?.[0];

      if (!route?.geometry?.coordinates || !Array.isArray(route.geometry.coordinates)) {
        continue;
      }

      const distanceKm = Math.round((route.distance / 1000) * 10) / 10;

      // Reject phantom detours on short distances (where OSM lacks a local village lane and loops 3km on a highway)
      if (straightDistKm > 0 && straightDistKm < 1.5 && distanceKm > 2.8 * straightDistKm) {
        continue;
      }

      // Convert GeoJSON [lon, lat] to Leaflet [lat, lon]
      const coordinates: [number, number][] = route.geometry.coordinates.map(
        (c: [number, number]) => [c[1], c[0]]
      );

      if (coordinates.length < 2) continue;

      const durationMinutes = Math.max(1, Math.round(route.duration / 60));

      const steps: ManeuverStep[] = [];
      if (Array.isArray(route.legs)) {
        for (const leg of route.legs) {
          if (Array.isArray(leg.steps)) {
            for (const s of leg.steps) {
              const m = s.maneuver || {};
              const loc: [number, number] = m.location
                ? [m.location[1], m.location[0]]
                : coordinates[0] || [0, 0];
              const street = s.name || "";
              const instruction = formatManeuverInstruction(m.type, m.modifier, street);

              steps.push({
                instruction,
                type: m.type || "turn",
                modifier: m.modifier,
                distanceMeters: Math.round(s.distance || 0),
                durationSeconds: Math.round(s.duration || 0),
                streetName: street,
                location: loc,
              });
            }
          }
        }
      }

      const result: RoadRoute = {
        coordinates,
        distanceKm,
        durationMinutes,
        steps,
      };

      routeCache.set(cacheKey, { route: result, timestamp: Date.now() });
      return result;
    } catch {
      // Continue to next mirror endpoint
    }
  }

  return null;
}

/**
 * Snaps a live GPS point to the nearest line segment on the road polyline.
 * Computes exact heading/bearing of that road segment so bike icon faces forward.
 */
export function snapPointToPolyline(
  point: { lat: number; lng: number },
  polyline: Array<[number, number]>
): { lat: number; lng: number; heading: number; distanceMeters: number } {
  if (polyline.length < 2) {
    return {
      lat: point.lat,
      lng: point.lng,
      heading: 0,
      distanceMeters: 0,
    };
  }

  let minDistance = Infinity;
  let bestPoint = { lat: point.lat, lng: point.lng };
  let bestHeading = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    if (!a || !b) continue;

    const projected = projectPointOnSegment(point, { lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] });
    const dist = distanceInMeters(point.lat, point.lng, projected.lat, projected.lng);

    if (dist < minDistance) {
      minDistance = dist;
      bestPoint = projected;
      bestHeading = (computeBearing(a[0], a[1], b[0], b[1]) + 360) % 360;
    }
  }

  // If rider is within 80m of the road, snap to road center; otherwise track actual GPS
  const useSnapped = minDistance <= 80;

  return {
    lat: useSnapped ? bestPoint.lat : point.lat,
    lng: useSnapped ? bestPoint.lng : point.lng,
    heading: bestHeading,
    distanceMeters: minDistance,
  };
}

function projectPointOnSegment(
  p: { lat: number; lng: number },
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): { lat: number; lng: number } {
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) return a;

  let t = ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  return {
    lat: a.lat + t * dy,
    lng: a.lng + t * dx,
  };
}

export function distanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function calculateTotalDistanceKm(waypoints: Array<{ lat: number; lng: number }>): number {
  let totalMeters = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    if (a && b) {
      totalMeters += distanceInMeters(a.lat, a.lng, b.lat, b.lng);
    }
  }
  return Math.round((totalMeters / 1000) * 10) / 10;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.max(1, Math.round(minutes))} min`;
  }
  const hrs = Math.floor(minutes / 60);
  const rem = Math.round(minutes % 60);
  return `${hrs} hr ${rem} min`;
}
