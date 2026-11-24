import { loadEnv } from "../../config/env";
import log from "../../config/logger";
import { haversineDistanceMeters, normalizePolyline } from "./tracking.algo";

export interface RouteResult {
  points: [number, number][]; // [lat, lng] array
  distanceMeters: number;
  durationSeconds: number;
  provider: "google" | "ors" | "osrm" | "haversine";
}

export interface IRouteProvider {
  calculateRoute(waypoints: Array<{ lat: number; lng: number }>): Promise<RouteResult>;
}

const HTTP_TIMEOUT_MS = 5000;

export class DirectHaversineFallbackProvider implements IRouteProvider {
  async calculateRoute(waypoints: Array<{ lat: number; lng: number }>): Promise<RouteResult> {
    if (!waypoints || waypoints.length === 0) {
      return {
        points: [],
        distanceMeters: 0,
        durationSeconds: 0,
        provider: "haversine",
      };
    }

    const points: [number, number][] = waypoints.map((w) => [w.lat, w.lng]);
    let distanceMeters = 0;

    for (let i = 0; i < waypoints.length - 1; i++) {
      const a = waypoints[i]!;
      const b = waypoints[i + 1]!;
      distanceMeters += haversineDistanceMeters(a.lat, a.lng, b.lat, b.lng);
    }

    distanceMeters = Math.round(distanceMeters);
    // Estimated delivery speed: ~20 km/h (5.56 m/s)
    const durationSeconds = Math.round(distanceMeters / 5.56);

    return {
      points,
      distanceMeters,
      durationSeconds,
      provider: "haversine",
    };
  }
}

export class OsrmRouteProvider implements IRouteProvider {
  constructor(private baseUrl: string) {}

  async calculateRoute(waypoints: Array<{ lat: number; lng: number }>): Promise<RouteResult> {
    if (waypoints.length < 2) {
      return new DirectHaversineFallbackProvider().calculateRoute(waypoints);
    }

    const first = waypoints[0]!;
    const last = waypoints[waypoints.length - 1]!;
    const straightDist = haversineDistanceMeters(first.lat, first.lng, last.lat, last.lng);

    // If start and destination are already at doorstep (< 45 meters), avoid road routing loops
    if (straightDist < 45) {
      return new DirectHaversineFallbackProvider().calculateRoute(waypoints);
    }

    // OSRM coordinates format: lng,lat;lng,lat
    const coordsStr = waypoints.map((w) => `${w.lng},${w.lat}`).join(";");

    const urls = [
      `${this.baseUrl.replace(/\/+$/, "")}/route/v1/driving/${coordsStr}?overview=full&geometries=geojson&continue_straight=false`,
      `https://routing.openstreetmap.de/routed-bike/route/v1/bicycle/${coordsStr}?overview=full&geometries=geojson`,
      `https://routing.openstreetmap.de/routed-car/route/v1/driving/${coordsStr}?overview=full&geometries=geojson&continue_straight=false`,
      `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson&continue_straight=false`,
    ];

    for (const url of urls) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });

        if (!res.ok) continue;

        const json = (await res.json()) as any;
        const route = json.routes?.[0];
        if (!route || !route.geometry?.coordinates || !Array.isArray(route.geometry.coordinates)) {
          continue;
        }

        const routeDist = Math.round(route.distance || 0);
        // If route distance is more than 1.8x straight distance on short trips (<2.5 km), it's an unmapped rural phantom detour
        if (straightDist > 0 && straightDist < 2500 && routeDist > 1.8 * straightDist) {
          log.warn("OSRM returned abnormal detour around unmapped roads, checking alternative", {
            straightDist,
            routeDist,
            ratio: (routeDist / straightDist).toFixed(2),
          });
          continue;
        }

        const rawCoords: [number, number][] = route.geometry.coordinates;
        // Convert OSRM [lng, lat] GeoJSON to Leaflet [lat, lng]
        const points = normalizePolyline(rawCoords);
        if (points.length < 2) continue;

        return {
          points,
          distanceMeters: routeDist,
          durationSeconds: Math.round(route.duration || 0),
          provider: "osrm",
        };
      } catch {
        // Continue to next mirror
      } finally {
        clearTimeout(timer);
      }
    }

    throw new Error("All OSRM routing providers failed or timed out");
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

export class GoogleRouteProvider implements IRouteProvider {
  constructor(private apiKey: string) {}

  async calculateRoute(waypoints: Array<{ lat: number; lng: number }>): Promise<RouteResult> {
    if (waypoints.length < 2) {
      return new DirectHaversineFallbackProvider().calculateRoute(waypoints);
    }

    const origin = waypoints[0]!;
    const destination = waypoints[waypoints.length - 1]!;
    const intermediates = waypoints.slice(1, -1);

    let waypointsParam = "";
    if (intermediates.length > 0) {
      waypointsParam = `&waypoints=${intermediates.map((w) => `${w.lat},${w.lng}`).join("|")}`;
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}${waypointsParam}&mode=driving&key=${this.apiKey}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`Google Directions HTTP ${res.status}: ${res.statusText}`);
      }
      const data = (await res.json()) as any;
      if (data.status !== "OK" || !data.routes?.[0]) {
        throw new Error(`Google Directions API error: ${data.status} - ${data.error_message || "No route"}`);
      }

      const route = data.routes[0];
      const encodedPolyline = route.overview_polyline?.points;
      if (!encodedPolyline) {
        throw new Error("No overview_polyline in Google Directions response");
      }

      const points = decodeGooglePolyline(encodedPolyline);
      let totalDistance = 0;
      let totalDuration = 0;

      if (Array.isArray(route.legs)) {
        for (const leg of route.legs) {
          totalDistance += leg.distance?.value || 0;
          totalDuration += leg.duration?.value || 0;
        }
      }

      return {
        points,
        distanceMeters: Math.round(totalDistance),
        durationSeconds: Math.round(totalDuration),
        provider: "google",
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

export class OrsRouteProvider implements IRouteProvider {
  constructor(private apiKey: string) {}

  async calculateRoute(waypoints: Array<{ lat: number; lng: number }>): Promise<RouteResult> {
    if (waypoints.length < 2) {
      return new DirectHaversineFallbackProvider().calculateRoute(waypoints);
    }

    const url = "https://api.openrouteservice.org/v2/directions/driving-car/geojson";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: this.apiKey,
        },
        body: JSON.stringify({
          // ORS coordinates format: [lng, lat]
          coordinates: waypoints.map((w) => [w.lng, w.lat]),
        }),
      });

      if (!res.ok) {
        throw new Error(`ORS HTTP ${res.status}: ${res.statusText}`);
      }

      const json = (await res.json()) as any;
      const feature = json.features?.[0];
      const rawCoords: [number, number][] = feature?.geometry?.coordinates;
      if (!rawCoords || rawCoords.length === 0) {
        throw new Error("No route found in ORS response");
      }

      const points = normalizePolyline(rawCoords);
      const summary = feature?.properties?.summary || {};

      return {
        points,
        distanceMeters: Math.round(summary.distance || 0),
        durationSeconds: Math.round(summary.duration || 0),
        provider: "ors",
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

export class RoutingService implements IRouteProvider {
  private fallbackProvider = new DirectHaversineFallbackProvider();
  private primaryProvider: IRouteProvider;

  constructor() {
    const env = loadEnv();
    const googleKey = env.GOOGLE_MAPS_API_KEY || env.GOOGLE_DIRECTIONS_API_KEY;
    if ((env.ROUTING_PROVIDER === "google" || googleKey) && googleKey) {
      this.primaryProvider = new GoogleRouteProvider(googleKey);
    } else if (env.ROUTING_PROVIDER === "ors" && env.ORS_API_KEY) {
      this.primaryProvider = new OrsRouteProvider(env.ORS_API_KEY);
    } else {
      this.primaryProvider = new OsrmRouteProvider(env.OSRM_BASE_URL);
    }
  }

  async calculateRoute(waypoints: Array<{ lat: number; lng: number }>): Promise<RouteResult> {
    if (!waypoints || waypoints.length < 2) {
      return this.fallbackProvider.calculateRoute(waypoints);
    }

    try {
      return await this.primaryProvider.calculateRoute(waypoints);
    } catch (err) {
      log.warn("Primary routing provider failed or timed out, falling back to direct Haversine", {
        context: "routing-service",
        error: (err as Error).message,
        waypointsCount: waypoints.length,
      });
      return this.fallbackProvider.calculateRoute(waypoints);
    }
  }
}

export const routingService = new RoutingService();
