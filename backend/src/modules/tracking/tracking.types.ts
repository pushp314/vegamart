export interface CompactLocationUpdate {
  lat: number;
  lng: number;
  snappedLat: number;
  snappedLng: number;
  heading: number | null;
  speedKmh: number | null;
  accuracy: number | null;
  seq: number;
  ts: number; // epoch ms
  etaSeconds: number | null;
  remainingMeters: number | null;
  routeIndex: number;
  routeVersion: number;
  staleAfterSec: number;
}

export interface DecodedRoadRoute {
  points: [number, number][]; // [lat, lng] array
  distanceMeters: number;
  durationSeconds: number;
  version: number;
  updatedAt: number;
  provider: "google" | "ors" | "osrm" | "haversine";
}

export interface LiveTrackingState {
  masterOrderId: string;
  orderId: string;
  riderId: string;
  status: string;
  lastPing: {
    lat: number;
    lng: number;
    snappedLat: number;
    snappedLng: number;
    heading: number | null;
    speedKmh: number | null;
    accuracy: number | null;
    seq: number;
    ts: number;
  };
  routeIndex: number;
  routeVersion: number;
  remainingMeters: number | null;
  etaSeconds: number | null;
  lastDbPersistAt: number;
  consecutiveOffRouteCount: number;
  rerouteCount: number;
  lastRerouteAt: number;
  updatedAt: number;
}

export interface LiveTrackingSnapshot {
  order_id: string;
  master_order_id: string;
  masterOrderId: string;
  status: string;
  is_live: boolean;
  isLive: boolean;
  isStale: boolean;
  current_lat: number | null;
  current_lng: number | null;
  snapped_lat: number | null;
  snapped_lng: number | null;
  heading: number | null;
  speed_kmh: number | null;
  accuracy: number | null;
  eta_seconds: number | null;
  eta_minutes: number | null;
  remaining_meters: number | null;
  distance_km: number | null;
  route_index: number;
  route: {
    points: [number, number][];
    distance_meters: number;
    duration_seconds: number;
    version: number;
  } | null;
  pickup_locations: Array<{
    id: string;
    name: string;
    address?: string;
    lat: number | null;
    lng: number | null;
    phone?: string | null;
  }>;
  delivery_location: {
    lat: number | null;
    lng: number | null;
    address: string;
  };
  driver: {
    id: string;
    name: string | null;
    phone: string | null;
    rating?: number | null;
    review_count?: number | null;
    vehicle_type?: string | null;
    vehicle_number?: string | null;
  } | null;
  last_updated_at: string | null;
  lastUpdatedAt: string | null;
}

export interface GPSPingPayload {
  lat: number;
  lng: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  capturedAt?: string | number | null;
  sequence?: number | null;
  orderId?: string;
}
