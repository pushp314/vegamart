import { loadEnv } from "../../config/env";
import log from "../../config/logger";
import { haversineDistanceMeters, normalizePolyline } from "./tracking.algo";

export interface RouteResult {
  points: [number, number][]; // [lat, lng] array
  distanceMeters: number;
  durationSeconds: number;
  provider: "ors" | "osrm" | "haversine";
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

    // OSRM coordinates format: lng,lat;lng,lat
    const coordsStr = waypoints.map((w) => `${w.lng},${w.lat}`).join(";");
    const urls = [
      `${this.baseUrl.replace(/\/+$/, "")}/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`,
      `https://routing.openstreetmap.de/routed-car/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`,
      `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`,
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

        const rawCoords: [number, number][] = route.geometry.coordinates;
        // Convert OSRM [lng, lat] GeoJSON to Leaflet [lat, lng]
        const points = normalizePolyline(rawCoords);
        if (points.length < 2) continue;

        return {
          points,
          distanceMeters: Math.round(route.distance || 0),
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
    if (env.ROUTING_PROVIDER === "ors" && env.ORS_API_KEY) {
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
