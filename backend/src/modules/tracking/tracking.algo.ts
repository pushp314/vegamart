import type { GPSPingPayload } from "./tracking.types";

const EARTH_RADIUS_METERS = 6371000;

export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const theta = Math.atan2(y, x);
  return ((theta * 180) / Math.PI + 360) % 360;
}

/**
 * Normalizes coordinates to [lat, lng].
 * GeoJSON directions often return [lng, lat]. In India, lat is ~8-37 and lng is ~68-97.
 * If coordinate 0 is > 60 and coordinate 1 is < 40, coordinate 0 is longitude!
 */
export function normalizeCoordinates(coord: [number, number]): [number, number] {
  if (!coord || coord.length < 2) return [0, 0];
  const [c0, c1] = coord;
  // If first coordinate is outside valid latitude [-90, 90], it's definitely [lng, lat]
  if (Math.abs(c0) > 90 && Math.abs(c1) <= 90) {
    return [c1, c0];
  }
  // Standard India bounds: lat 8..38, lng 68..98
  if (c0 > 60 && c0 < 100 && c1 >= 5 && c1 <= 40) {
    return [c1, c0];
  }
  return [c0, c1];
}

export function normalizePolyline(points: [number, number][]): [number, number][] {
  if (!Array.isArray(points)) return [];
  return points.map(normalizeCoordinates);
}

export interface GpsValidationResult {
  valid: boolean;
  reason?: string;
  isStationary?: boolean;
  deltaMeters?: number;
  impliedSpeedKmh?: number;
}

export function validateGpsPing(
  ping: GPSPingPayload,
  prevPing?: { lat: number; lng: number; ts: number; seq?: number },
  currentTs = Date.now()
): GpsValidationResult {
  // Reject basic lat/lng out of range
  if (
    typeof ping.lat !== "number" ||
    isNaN(ping.lat) ||
    typeof ping.lng !== "number" ||
    isNaN(ping.lng) ||
    ping.lat < -90 ||
    ping.lat > 90 ||
    ping.lng < -180 ||
    ping.lng > 180
  ) {
    return { valid: false, reason: "INVALID_COORDINATES" };
  }

  // Reject inaccurate GPS pings (greater than 50 meters)
  if (ping.accuracy !== undefined && ping.accuracy !== null && ping.accuracy > 50) {
    return { valid: false, reason: "ACCURACY_TOO_LOW" };
  }

  if (prevPing) {
    // Check out-of-order sequence if both have sequence
    if (
      ping.sequence != null &&
      prevPing.seq != null &&
      ping.sequence < prevPing.seq
    ) {
      return { valid: false, reason: "OUT_OF_ORDER_SEQUENCE" };
    }

    const deltaMeters = haversineDistanceMeters(
      prevPing.lat,
      prevPing.lng,
      ping.lat,
      ping.lng
    );
    const timeDeltaSec = Math.max(0.1, (currentTs - prevPing.ts) / 1000);
    const impliedSpeedKmh = (deltaMeters / timeDeltaSec) * 3.6;

    // Reject impossible speed jumps (e.g. GPS teleporting > 90 km/h in urban delivery)
    if (impliedSpeedKmh > 90 && deltaMeters > 50) {
      return {
        valid: false,
        reason: "TELEPORT_SPEED_EXCEEDED",
        deltaMeters,
        impliedSpeedKmh,
      };
    }

    // Stationary update (< 1m moved)
    if (deltaMeters < 1) {
      return {
        valid: true,
        isStationary: true,
        deltaMeters,
        impliedSpeedKmh,
      };
    }

    return {
      valid: true,
      isStationary: false,
      deltaMeters,
      impliedSpeedKmh,
    };
  }

  return { valid: true, isStationary: false };
}

export function smoothSpeedEma(
  rawSpeedKmh: number | null | undefined,
  prevSpeedKmh: number | null | undefined,
  isStationary = false,
  alpha = 0.3
): number {
  if (isStationary) {
    return 0;
  }
  // Clamp raw speed to reasonable urban bike range (10-40 km/h, fallback default 18 km/h)
  let speed = typeof rawSpeedKmh === "number" && !isNaN(rawSpeedKmh) && rawSpeedKmh > 0
    ? rawSpeedKmh
    : (prevSpeedKmh ?? 18);

  speed = Math.min(60, Math.max(10, speed));

  if (typeof prevSpeedKmh === "number" && prevSpeedKmh > 0) {
    return Math.round((alpha * speed + (1 - alpha) * prevSpeedKmh) * 10) / 10;
  }
  return Math.round(speed * 10) / 10;
}

export interface SnapResult {
  snappedLat: number;
  snappedLng: number;
  segmentIndex: number;
  distanceToRoadMeters: number;
  heading: number | null;
}

/**
 * Snaps (lat, lng) perpendicularly onto the closest segment of a road polyline.
 * If rider is within maxDistanceMeters (default 60m), snaps to road.
 */
export function snapToPolyline(
  point: { lat: number; lng: number },
  polyline: [number, number][],
  maxDistanceMeters = 60
): SnapResult {
  if (!polyline || polyline.length === 0) {
    return {
      snappedLat: point.lat,
      snappedLng: point.lng,
      segmentIndex: -1,
      distanceToRoadMeters: 0,
      heading: null,
    };
  }

  if (polyline.length === 1) {
    const p = polyline[0]!;
    const dist = haversineDistanceMeters(point.lat, point.lng, p[0], p[1]);
    return {
      snappedLat: dist <= maxDistanceMeters ? p[0] : point.lat,
      snappedLng: dist <= maxDistanceMeters ? p[1] : point.lng,
      segmentIndex: 0,
      distanceToRoadMeters: dist,
      heading: null,
    };
  }

  let minDistance = Infinity;
  let bestSnapped: [number, number] = [point.lat, point.lng];
  let bestSegmentIndex = -1;
  let bestBearing: number | null = null;

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i]!;
    const b = polyline[i + 1]!;

    const projected = projectPointOnSegment(point.lat, point.lng, a[0], a[1], b[0], b[1]);
    const dist = haversineDistanceMeters(point.lat, point.lng, projected[0], projected[1]);

    if (dist < minDistance) {
      minDistance = dist;
      bestSnapped = projected;
      bestSegmentIndex = i;
      bestBearing = calculateBearing(a[0], a[1], b[0], b[1]);
    }
  }

  if (minDistance <= maxDistanceMeters) {
    return {
      snappedLat: bestSnapped[0],
      snappedLng: bestSnapped[1],
      segmentIndex: bestSegmentIndex,
      distanceToRoadMeters: Math.round(minDistance * 10) / 10,
      heading: bestBearing,
    };
  }

  return {
    snappedLat: point.lat,
    snappedLng: point.lng,
    segmentIndex: -1,
    distanceToRoadMeters: Math.round(minDistance * 10) / 10,
    heading: bestBearing,
  };
}

function projectPointOnSegment(
  pLat: number,
  pLng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): [number, number] {
  // Flat-earth approximation in small radius for projection parameter t
  const dx = (bLng - aLng) * Math.cos(((aLat + bLat) / 2) * (Math.PI / 180));
  const dy = bLat - aLat;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return [aLat, aLng];
  }

  const px = (pLng - aLng) * Math.cos(((aLat + bLat) / 2) * (Math.PI / 180));
  const py = pLat - aLat;

  let t = (px * dx + py * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  return [aLat + t * (bLat - aLat), aLng + t * (bLng - aLng)];
}

export function computeRemainingDistanceAndEta(
  polyline: [number, number][],
  snappedPoint: { lat: number; lng: number },
  segmentIndex: number,
  speedKmh = 20
): { remainingMeters: number; etaSeconds: number } {
  if (!polyline || polyline.length === 0) {
    return { remainingMeters: 0, etaSeconds: 0 };
  }

  let remainingMeters = 0;

  if (segmentIndex >= 0 && segmentIndex < polyline.length - 1) {
    // Distance from snapped point to next vertex
    const nextVertex = polyline[segmentIndex + 1]!;
    remainingMeters += haversineDistanceMeters(
      snappedPoint.lat,
      snappedPoint.lng,
      nextVertex[0],
      nextVertex[1]
    );

    // Sum distance of all subsequent segments
    for (let i = segmentIndex + 1; i < polyline.length - 1; i++) {
      const p1 = polyline[i]!;
      const p2 = polyline[i + 1]!;
      remainingMeters += haversineDistanceMeters(p1[0], p1[1], p2[0], p2[1]);
    }
  } else {
    // Fallback: direct distance to last point
    const last = polyline[polyline.length - 1]!;
    remainingMeters = haversineDistanceMeters(
      snappedPoint.lat,
      snappedPoint.lng,
      last[0],
      last[1]
    );
  }

  remainingMeters = Math.round(remainingMeters);
  const speedMs = Math.max(2.8, (speedKmh || 20) / 3.6); // ~10 km/h minimum floor
  const etaSeconds = Math.round(remainingMeters / speedMs);

  return { remainingMeters, etaSeconds };
}

export function detectOffRoute(
  distanceToRoadMeters: number,
  consecutiveOffRouteCount: number,
  thresholdMeters = 150
): { isOffRoute: boolean; newCount: number } {
  if (distanceToRoadMeters > thresholdMeters) {
    const newCount = consecutiveOffRouteCount + 1;
    return {
      isOffRoute: newCount >= 2,
      newCount,
    };
  }
  return {
    isOffRoute: false,
    newCount: 0,
  };
}
