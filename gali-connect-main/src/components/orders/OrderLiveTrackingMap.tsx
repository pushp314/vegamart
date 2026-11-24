import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import React from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  CircleMarker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  Phone,
  Navigation,
  ShieldCheck,
  RefreshCw,
  Star,
  Radio,
  Clock,
  Compass,
  Volume2,
  VolumeX,
  Store,
  ChevronRight,
  Layers,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { playArrivalChime } from "@/lib/chime";
import { toast } from "sonner";
import { MAP_LAYERS, type MapLayerType } from "../maps/map-layers";
import { MapLayerToggle } from "../maps/MapLayerToggle";
import { fetchRoadRoute, snapPointToPolyline } from "@/lib/road-routing";

// Fix standard default icon assets
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

export interface LocationPoint {
  id?: string | number;
  lat: number;
  lng: number;
  name?: string;
  address?: string;
  phone?: string | null;
}

export interface DriverDetails {
  name: string;
  phone?: string | null;
  rating?: number;
  review_count?: number;
  vehicle_type?: string | null;
  vehicle_number?: string | null;
}

export interface OrderLiveTrackingMapProps {
  driverLocation?: { lat: number; lng: number } | null;
  snappedLocation?: { lat: number; lng: number } | null;
  routePoints?: [number, number][];
  routeIndex?: number;
  pickupLocations?: LocationPoint[];
  deliveryLocation?: LocationPoint | null;
  driverInfo?: DriverDetails | null;
  status?: string;
  etaMinutes?: number | null;
  etaSeconds?: number | null;
  remainingMeters?: number | null;
  heading?: number | null;
  speedKmh?: number | null;
  accuracy?: number | null;
  lastUpdatedAt?: string | Date | number | null;
  isLive?: boolean;
  isStale?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  isSelfPickup?: boolean;
  storeDirectionsUrl?: string | null;
  customerLiveLocation?: { lat: number; lng: number } | null;
  walkDirectionsUrl?: string | null;
  driveDirectionsUrl?: string | null;
  pickupPoint?: { name: string; lat: number; lng: number; instructions?: string | null } | null;
  inHouseRider?: { name: string; phone?: string | null; vehicle_number?: string | null } | null;
}

// Calculate geographic distance in meters between two coordinates
function getDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Controller to auto-fit map view to markers without overriding user manual zoom
function MapBoundsController({
  points,
  recenterTrigger,
  onUserInteract,
}: {
  points: [number, number][];
  recenterTrigger: number;
  onUserInteract?: () => void;
}) {
  const map = useMap();
  const hasInitialFitRef = useRef(false);
  const userInteractedRef = useRef(false);
  const lastRecenterRef = useRef(recenterTrigger);

  useMapEvents({
    zoomstart: () => {
      userInteractedRef.current = true;
      onUserInteract?.();
    },
    dragstart: () => {
      userInteractedRef.current = true;
      onUserInteract?.();
    },
    movestart: (e) => {
      if ((e as any).originalEvent) {
        userInteractedRef.current = true;
        onUserInteract?.();
      }
    },
  });

  useEffect(() => {
    // If user clicked the explicit "Recenter" button, clear user interaction lock
    if (recenterTrigger !== lastRecenterRef.current) {
      lastRecenterRef.current = recenterTrigger;
      userInteractedRef.current = false;
    }

    // Once user has manually zoomed or panned, NEVER auto zoom-out on GPS updates!
    if (userInteractedRef.current && hasInitialFitRef.current) {
      return;
    }

    const valid = points.filter(
      ([lat, lng]) =>
        typeof lat === "number" &&
        typeof lng === "number" &&
        !isNaN(lat) &&
        !isNaN(lng) &&
        lat > 5 &&
        lng > 60
    );

    if (valid.length === 0) return;

    if (valid.length === 1 && valid[0]) {
      map.setView(valid[0], 15, { animate: true });
    } else {
      const bounds = L.latLngBounds(valid);
      map.fitBounds(bounds, { padding: [50, 50], animate: true });
    }
    hasInitialFitRef.current = true;
  }, [points, recenterTrigger, map]);

  return null;
}

// Calculate bearing between two coordinates
function computeBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

export function OrderLiveTrackingMap({
  driverLocation,
  snappedLocation,
  routePoints = [],
  routeIndex = 0,
  pickupLocations = [],
  deliveryLocation,
  driverInfo,
  status = "out_for_delivery",
  etaMinutes,
  etaSeconds,
  remainingMeters,
  heading: incomingHeading,
  speedKmh,
  accuracy,
  lastUpdatedAt,
  isLive = true,
  isStale: serverStale = false,
  onRefresh,
  isRefreshing,
  isSelfPickup = false,
  storeDirectionsUrl = null,
  customerLiveLocation = null,
  walkDirectionsUrl = null,
  driveDirectionsUrl = null,
  pickupPoint = null,
  inHouseRider = null,
}: OrderLiveTrackingMapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [recenterCounter, setRecenterCounter] = useState(0);
  const [autoFollow, setAutoFollow] = useState(false);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [currentLayer, setCurrentLayer] = useState<MapLayerType>("streets");
  const hasChimedRef = useRef(false);

  // Proximity trigger: chime once when rider is within 500m or 2 mins of doorstep
  useEffect(() => {
    if (!soundEnabled || hasChimedRef.current) return;
    if (status !== "out_for_delivery") return;

    const isCloseByDistance = remainingMeters != null && remainingMeters > 0 && remainingMeters <= 500;
    const isCloseByEta = etaSeconds != null && etaSeconds > 0 && etaSeconds <= 120;

    if (isCloseByDistance || isCloseByEta) {
      hasChimedRef.current = true;
      playArrivalChime();
      toast.success("🛵 Delivery partner is arriving at your doorstep in ~2 minutes!", {
        duration: 7000,
      });
    }
  }, [remainingMeters, etaSeconds, status, soundEnabled]);

  // References to keep Leaflet instances without remounting
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const bikeRotatorRef = useRef<HTMLDivElement | null>(null);

  // Animation interpolation state
  const animRef = useRef<{
    rafId: number | null;
    startLat: number;
    startLng: number;
    targetLat: number;
    targetLng: number;
    startTime: number;
    duration: number;
    currentHeading: number;
  }>({
    rafId: null,
    startLat: 0,
    startLng: 0,
    targetLat: 0,
    targetLng: 0,
    startTime: 0,
    duration: 3500,
    currentHeading: 0,
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Compute seconds elapsed since last update
  useEffect(() => {
    const updateTicker = () => {
      if (!lastUpdatedAt) {
        setSecondsAgo(0);
        return;
      }
      const updateMs =
        typeof lastUpdatedAt === "number"
          ? lastUpdatedAt
          : new Date(lastUpdatedAt).getTime();
      const diffSec = Math.max(0, Math.floor((Date.now() - updateMs) / 1000));
      setSecondsAgo(diffSec);
    };

    updateTicker();
    const interval = setInterval(updateTicker, 1000);
    return () => clearInterval(interval);
  }, [lastUpdatedAt]);

  const isStale = serverStale || secondsAgo > 45;

  // Active target coordinates (favor snapped road position for smooth aesthetics)
  const targetLat = snappedLocation?.lat ?? driverLocation?.lat ?? null;
  const targetLng = snappedLocation?.lng ?? driverLocation?.lng ?? null;

  const validDriver =
    targetLat != null && targetLng != null ? { lat: targetLat, lng: targetLng } : null;
  const validDelivery =
    deliveryLocation && deliveryLocation.lat && deliveryLocation.lng
      ? deliveryLocation
      : null;
  const validPickups = useMemo(
    () => pickupLocations.filter((p) => p && p.lat && p.lng),
    [pickupLocations]
  );

  // Fallback center coordinates
  const defaultCenter = useMemo<[number, number]>(() => {
    if (pickupPoint) return [pickupPoint.lat, pickupPoint.lng];
    if (isSelfPickup && customerLiveLocation) return [customerLiveLocation.lat, customerLiveLocation.lng];
    if (validDriver) return [validDriver.lat, validDriver.lng];
    if (validDelivery) return [validDelivery.lat, validDelivery.lng];
    if (validPickups.length > 0 && validPickups[0])
      return [validPickups[0].lat, validPickups[0].lng];
    return [21.9588, 82.9588]; // Sakti, Chhattisgarh default
  }, [validDriver, validDelivery, validPickups, isSelfPickup, customerLiveLocation, pickupPoint]);

  // Client-side real road network route calculation if backend did not supply detailed road points
  const [clientRoadRoute, setClientRoadRoute] = useState<[number, number][]>([]);
  const [clientRoadMeta, setClientRoadMeta] = useState<{ distanceKm: number; durationMinutes: number } | null>(null);

  // A real road route contains curves and street geometry (more than 3 points)
  const hasDetailedBackendRoute = Boolean(routePoints && routePoints.length > 3);

  useEffect(() => {
    if (hasDetailedBackendRoute) return;

    let active = true;
    const waypoints: Array<{ lat: number; lng: number }> = [];
    const isOutForDelivery = status === "out_for_delivery" || status === "delivered";

    if (isSelfPickup && customerLiveLocation && validPickups[0]) {
      waypoints.push({ lat: customerLiveLocation.lat, lng: customerLiveLocation.lng });
      waypoints.push({ lat: validPickups[0].lat, lng: validPickups[0].lng });
    } else if (isOutForDelivery) {
      // In delivery phase, the rider already picked up the order! Target is ONLY customer doorstep.
      if (validDriver && validDelivery) {
        const dist = getDistanceMeters(validDriver.lat, validDriver.lng, validDelivery.lat, validDelivery.lng);
        if (dist <= 45) {
          // Rider is already at the doorstep (< 45m). Clear road route to eliminate phantom OSRM loops.
          setClientRoadRoute([]);
          setClientRoadMeta({ distanceKm: 0, durationMinutes: 1 });
          return;
        }
      }

      if (validDriver) {
        waypoints.push({ lat: validDriver.lat, lng: validDriver.lng });
      } else if (validPickups[0]) {
        waypoints.push({ lat: validPickups[0].lat, lng: validPickups[0].lng });
      }
      if (validDelivery) {
        waypoints.push({ lat: validDelivery.lat, lng: validDelivery.lng });
      }
    } else {
      // Pickup phase: route rider to unpicked vendor stores then to customer
      if (validDriver) {
        waypoints.push({ lat: validDriver.lat, lng: validDriver.lng });
      }
      validPickups.forEach((p) => {
        waypoints.push({ lat: p.lat, lng: p.lng });
      });
      if (validDelivery) {
        waypoints.push({ lat: validDelivery.lat, lng: validDelivery.lng });
      }
    }

    if (waypoints.length >= 2) {
      fetchRoadRoute(waypoints).then((res) => {
        if (active && res && res.coordinates.length > 3) {
          setClientRoadRoute(res.coordinates);
          setClientRoadMeta({ distanceKm: res.distanceKm, durationMinutes: res.durationMinutes });
        }
      });
    }

    return () => {
      active = false;
    };
  }, [hasDetailedBackendRoute, isSelfPickup, customerLiveLocation, validDriver, validPickups, validDelivery, status]);

  // Points for map bounds fitting
  const allPoints = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [];
    if (validDriver) pts.push([validDriver.lat, validDriver.lng]);
    if (validDelivery) pts.push([validDelivery.lat, validDelivery.lng]);
    if (isSelfPickup && customerLiveLocation) pts.push([customerLiveLocation.lat, customerLiveLocation.lng]);
    if (pickupPoint) pts.push([pickupPoint.lat, pickupPoint.lng]);
    validPickups.forEach((p) => pts.push([p.lat, p.lng]));
    return pts;
  }, [validDriver, validDelivery, validPickups, isSelfPickup, customerLiveLocation, pickupPoint]);

  // Real active road route (must contain real street network >3 points)
  const activeRoadRoute = useMemo<[number, number][]>(() => {
    if (hasDetailedBackendRoute) return routePoints;
    if (clientRoadRoute && clientRoadRoute.length > 3) return clientRoadRoute;
    return [];
  }, [hasDetailedBackendRoute, routePoints, clientRoadRoute]);

  // Split road route polyline into "Shrinking Trail" (already passed) and "Path Ahead" (upcoming)
  // Snaps driver position perpendicularly to the road so the line NEVER loops backwards across fields!
  const { pathAhead, pathTrail, riderOffRoadConnector, doorstepConnector } = useMemo(() => {
    if (activeRoadRoute.length < 2) {
      return {
        pathAhead: [] as [number, number][],
        pathTrail: [] as [number, number][],
        riderOffRoadConnector: null as [number, number][] | null,
        doorstepConnector: null as [number, number][] | null,
      };
    }

    // 1. If rider has arrived at doorstep (< 45m), clear remaining path ahead completely
    if (validDriver && validDelivery) {
      const distToDoorstep = getDistanceMeters(
        validDriver.lat,
        validDriver.lng,
        validDelivery.lat,
        validDelivery.lng
      );
      if (distToDoorstep <= 45) {
        return {
          pathAhead: [] as [number, number][],
          pathTrail: activeRoadRoute,
          riderOffRoadConnector: null,
          doorstepConnector: null,
        };
      }
    }

    // 2. If no driver location yet, display full upcoming route
    if (!validDriver) {
      let doorstep: [number, number][] | null = null;
      if (validDelivery && activeRoadRoute.length > 0) {
        const roadEnd = activeRoadRoute[activeRoadRoute.length - 1]!;
        const dToHouse = getDistanceMeters(roadEnd[0], roadEnd[1], validDelivery.lat, validDelivery.lng);
        if (dToHouse >= 15 && dToHouse <= 1500) {
          doorstep = [roadEnd, [validDelivery.lat, validDelivery.lng]];
        }
      }
      return {
        pathAhead: activeRoadRoute,
        pathTrail: [] as [number, number][],
        riderOffRoadConnector: null,
        doorstepConnector: doorstep,
      };
    }

    // 3. Snap driver's live GPS perpendicularly onto the nearest road segment
    const snap = snapPointToPolyline(validDriver, activeRoadRoute);
    const segIdx = snap.segmentIndex;
    const snappedPoint: [number, number] = [snap.lat, snap.lng];

    // Trail: Start of route up to rider's current road position
    const trail: [number, number][] = [
      ...activeRoadRoute.slice(0, segIdx + 1),
      snappedPoint,
    ];

    // Ahead: From rider's snapped road position forward to the road terminus (NEVER backwards!)
    const ahead: [number, number][] = [
      snappedPoint,
      ...activeRoadRoute.slice(segIdx + 1),
    ];

    // Dotted off-road connector from rider's exact GPS to road entrance (Google Maps style)
    let offRoad: [number, number][] | null = null;
    if (snap.distanceMeters > 12 && snap.distanceMeters <= 800) {
      offRoad = [[validDriver.lat, validDriver.lng], snappedPoint];
    }

    // Dotted doorstep connector from road end to customer house pin
    let doorstep: [number, number][] | null = null;
    if (validDelivery && ahead.length > 0) {
      const roadEnd = ahead[ahead.length - 1]!;
      const dToHouse = getDistanceMeters(roadEnd[0], roadEnd[1], validDelivery.lat, validDelivery.lng);
      if (dToHouse >= 15 && dToHouse <= 1500) {
        doorstep = [roadEnd, [validDelivery.lat, validDelivery.lng]];
      }
    }

    return {
      pathAhead: ahead,
      pathTrail: trail,
      riderOffRoadConnector: offRoad,
      doorstepConnector: doorstep,
    };
  }, [activeRoadRoute, validDriver, validDelivery]);

  // 1-Tap Google Maps Turn-by-Turn Navigation URL for rider & customer
  const googleMapsDirectionsUrl = useMemo(() => {
    if (!validDelivery) return null;
    const origin = validDriver || validPickups[0];
    if (origin) {
      return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${validDelivery.lat},${validDelivery.lng}&travelmode=driving`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${validDelivery.lat},${validDelivery.lng}`;
  }, [validDriver, validPickups, validDelivery]);

  // Clean directional arrow chevrons along the road route
  const directionArrows = useMemo(() => {
    const coords = pathAhead.length > 3 ? pathAhead : activeRoadRoute;
    if (coords.length < 4) return [];
    const count = Math.min(5, Math.max(2, Math.floor(coords.length / 10)));
    const step = Math.floor(coords.length / (count + 1));
    const list: Array<{ pos: [number, number]; bearing: number }> = [];
    for (let i = step; i < coords.length - 1; i += step) {
      const p1 = coords[i];
      const p2 = coords[i + 1];
      if (p1 && p2) {
        const b = computeBearing(p1[0], p1[1], p2[0], p2[1]);
        list.push({ pos: p1, bearing: b });
      }
    }
    return list;
  }, [pathAhead, activeRoadRoute]);

  // Distance calculation helper (km)
  const getHaversineKm = (c1: { lat: number; lng: number }, c2: { lat: number; lng: number }) => {
    const R = 6371;
    const dLat = ((c2.lat - c1.lat) * Math.PI) / 180;
    const dLng = ((c2.lng - c1.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((c1.lat * Math.PI) / 180) *
        Math.cos((c2.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Real Road Distance computation
  const displayDistance = useMemo(() => {
    if (remainingMeters != null && remainingMeters > 0) {
      if (remainingMeters >= 1000) {
        return `${(remainingMeters / 1000).toFixed(1)} km`;
      }
      return `${Math.round(remainingMeters)} m`;
    }
    if (clientRoadMeta?.distanceKm && clientRoadMeta.distanceKm > 0) {
      return `${clientRoadMeta.distanceKm.toFixed(1)} km`;
    }
    if (isSelfPickup && customerLiveLocation && validPickups[0]) {
      const direct = getHaversineKm(customerLiveLocation, validPickups[0]);
      return `${(direct * 1.3).toFixed(1)} km`;
    }
    const origin = validDriver || validPickups[0];
    const destination = validDelivery;
    if (origin && destination) {
      const direct = getHaversineKm(origin, destination);
      return `${(direct * 1.3).toFixed(1)} km`;
    }
    return null;
  }, [remainingMeters, clientRoadMeta, isSelfPickup, customerLiveLocation, validPickups, validDriver, validDelivery]);

  // Dynamic ETA display formatting
  const displayEta = useMemo(() => {
    if (etaSeconds != null && etaSeconds > 0) {
      const mins = Math.ceil(etaSeconds / 60);
      return mins <= 1 ? "1 min" : `${mins} min`;
    }
    if (etaMinutes != null && etaMinutes > 0) {
      return etaMinutes <= 1 ? "1 min" : `${etaMinutes} min`;
    }
    if (clientRoadMeta?.durationMinutes && clientRoadMeta.durationMinutes > 0) {
      const mins = Math.ceil(clientRoadMeta.durationMinutes);
      return mins <= 1 ? "1 min" : `${mins} min`;
    }
    if (displayDistance) {
      const km = parseFloat(displayDistance);
      if (!isNaN(km) && km > 0) {
        const mins = Math.max(3, Math.ceil((km / 20) * 60) + 3);
        return `${mins} min`;
      }
    }
    return null;
  }, [etaSeconds, etaMinutes, clientRoadMeta, displayDistance]);

  // Active rider normalization (VegaMart fleet or in-house shop rider)
  const activeRider = useMemo(() => {
    if (driverInfo) return driverInfo;
    if (inHouseRider) {
      return {
        name: inHouseRider.name || "Shop Delivery Partner",
        phone: inHouseRider.phone || null,
        rating: 5.0,
        review_count: 0,
        vehicle_type: "Shop In-House Delivery",
        vehicle_number: inHouseRider.vehicle_number || null,
      };
    }
    return null;
  }, [driverInfo, inHouseRider]);

  // Traffic / Railway Crossing pause detection
  const [stationarySeconds, setStationarySeconds] = useState(0);
  const lastRiderPosRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!validDriver || status !== "out_for_delivery") {
      setStationarySeconds(0);
      return;
    }

    const interval = setInterval(() => {
      if (lastRiderPosRef.current && validDriver) {
        const dLat = Math.abs(validDriver.lat - lastRiderPosRef.current.lat);
        const dLng = Math.abs(validDriver.lng - lastRiderPosRef.current.lng);
        // If movement is under ~15m and speed is under 3 km/h
        if (dLat < 0.00015 && dLng < 0.00015 && (speedKmh == null || speedKmh < 3)) {
          setStationarySeconds((s) => s + 3);
        } else {
          setStationarySeconds(0);
        }
      }
      lastRiderPosRef.current = { lat: validDriver.lat, lng: validDriver.lng };
    }, 3000);

    return () => clearInterval(interval);
  }, [validDriver, status, speedKmh]);

  const isStationaryInTraffic = stationarySeconds >= 75 && (remainingMeters == null || remainingMeters > 150);

  // Contextual live milestone messages for customer trust & excitement
  const contextualMilestone = useMemo(() => {
    if (isSelfPickup) {
      return "🏪 Store Pickup • Ready for collection at shop counter";
    }
    if (status === "delivered") {
      return "🎉 Order delivered successfully to your doorstep!";
    }
    if (status === "confirmed" || status === "preparing" || status === "ready_for_pickup") {
      const storeName = validPickups[0]?.name || "merchant";
      return `🏪 Rider ${storeName} par samaan pack karwa raha hai`;
    }
    if (remainingMeters != null && remainingMeters > 0 && remainingMeters <= 200) {
      return "📍 Rider aapki gali ke mod par pahunch chuka hai!";
    }
    if (isStationaryInTraffic) {
      return "🚦 Railway crossing / traffic signal par ruka hua hai";
    }
    return `🛵 Rider raste me hai • ${displayDistance || "1 km"} away`;
  }, [isSelfPickup, status, validPickups, remainingMeters, isStationaryInTraffic, displayDistance]);

  // Custom Div Icons for visual excellence
  const driverDivIcon = useMemo(() => {
    return L.divIcon({
      className: "driver-marker-container",
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 48px; height: 48px;">
          <span style="position: absolute; width: 48px; height: 48px; border-radius: 9999px; background-color: rgba(16, 185, 129, 0.25); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
          <div class="driver-bike-rotator" style="position: relative; z-index: 10; width: 40px; height: 40px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 9999px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px -2px rgba(5, 150, 105, 0.5); border: 2.5px solid #ffffff; font-size: 20px; transition: transform 0.3s ease-out; will-change: transform;">
            🛵
          </div>
        </div>
      `,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });
  }, []);

  const getStoreDivIcon = useCallback((index: number, total: number) => {
    return L.divIcon({
      className: "store-marker-pin",
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center;">
          <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 9999px; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 12px -2px rgba(217, 119, 6, 0.45); border: 2.5px solid #ffffff; font-size: 16px;">
            🏪
          </div>
          ${
            total > 1
              ? `<span style="position: absolute; top: -3px; right: -3px; background: #0f172a; color: #ffffff; font-size: 10px; font-weight: 800; border-radius: 9999px; width: 17px; height: 17px; display: flex; align-items: center; justify-content: center; border: 1.5px solid #ffffff;">${index + 1}</span>`
              : ""
          }
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
  }, []);

  const destinationDivIcon = useMemo(() => {
    return L.divIcon({
      className: "dest-marker-pin",
      html: `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0 6px 12px rgba(16, 185, 129, 0.4));">
          <div style="width: 44px; height: 44px; background: #ffffff; border-radius: 9999px; border: 3.5px solid #10b981; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.15);">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="#10b981" stroke="#10b981" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" fill="#ffffff" stroke="#10b981"/>
            </svg>
          </div>
          <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 8px solid #10b981; margin-top: -1px;"></div>
          <div style="width: 6px; height: 6px; border-radius: 9999px; background: #10b981; margin-top: 1px;"></div>
        </div>
      `,
      iconSize: [44, 54],
      iconAnchor: [22, 54],
    });
  }, []);

  // Blue Pulsating GPS Dot for Customer Live Location
  const customerDivIcon = useMemo(() => {
    return L.divIcon({
      className: "customer-marker-pin",
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px;">
          <span style="position: absolute; width: 44px; height: 44px; border-radius: 9999px; background-color: rgba(37, 99, 235, 0.25); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
          <div style="position: relative; z-index: 10; width: 22px; height: 22px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); border-radius: 9999px; box-shadow: 0 0 12px rgba(37, 99, 235, 0.8); border: 3px solid #ffffff; display: flex; align-items: center; justify-content: center;">
            <div style="width: 6px; height: 6px; background: #ffffff; border-radius: 9999px;"></div>
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });
  }, []);

  // Emerald / Cyan Pin for Store Pickup Point / Entrance
  const pickupPointDivIcon = useMemo(() => {
    return L.divIcon({
      className: "pickup-point-pin",
      html: `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
          <div style="width: 34px; height: 34px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 9999px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.5); border: 2.5px solid #ffffff; display: flex; align-items: center; justify-content: center; color: #ffffff; font-size: 15px;">
            🚪
          </div>
          <div style="width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid #059669; margin-top: -1px;"></div>
        </div>
      `,
      iconSize: [34, 40],
      iconAnchor: [17, 40],
    });
  }, []);

  // 60 FPS RequestAnimationFrame Movement Interpolation
  useEffect(() => {
    if (!validDriver || !markerRef.current) return;

    const anim = animRef.current;
    const currentLatLng = markerRef.current.getLatLng();

    // Initialize start position on first ping
    if (anim.startLat === 0 && anim.startLng === 0) {
      anim.startLat = currentLatLng.lat || validDriver.lat;
      anim.startLng = currentLatLng.lng || validDriver.lng;
    } else {
      anim.startLat = currentLatLng.lat;
      anim.startLng = currentLatLng.lng;
    }

    anim.targetLat = validDriver.lat;
    anim.targetLng = validDriver.lng;
    anim.startTime = performance.now();
    anim.duration = 3800; // Smooth 3.8s transition between typical 5s GPS updates

    // Heading calculation: favor incoming GPS heading; if null, calculate forward bearing
    let targetHeading = incomingHeading;
    if (
      targetHeading == null ||
      isNaN(targetHeading) ||
      (anim.startLat === anim.targetLat && anim.startLng === anim.targetLng)
    ) {
      if (
        Math.abs(anim.targetLat - anim.startLat) > 0.00001 ||
        Math.abs(anim.targetLng - anim.startLng) > 0.00001
      ) {
        targetHeading = computeBearing(
          anim.startLat,
          anim.startLng,
          anim.targetLat,
          anim.targetLng
        );
      } else {
        targetHeading = anim.currentHeading;
      }
    }

    if (anim.rafId !== null) {
      cancelAnimationFrame(anim.rafId);
      anim.rafId = null;
    }

    // If tab is currently hidden/backgrounded, pause rAF to conserve CPU/battery and snap marker directly
    if (typeof document !== "undefined" && document.hidden) {
      markerRef.current.setLatLng([validDriver.lat, validDriver.lng]);
      anim.startLat = validDriver.lat;
      anim.startLng = validDriver.lng;

      if (targetHeading != null && !isNaN(targetHeading)) {
        anim.currentHeading = targetHeading;
        const markerEl = markerRef.current.getElement();
        const rotator = (markerEl?.querySelector(".driver-bike-rotator") as HTMLElement | null) ||
          (document.getElementById("driver-bike-rotator") as HTMLElement | null);
        if (rotator) {
          rotator.style.transform = `rotate(${Math.round(targetHeading)}deg)`;
        }
      }
      return;
    }

    const animate = (currentTime: number) => {
      // Pause animation if document becomes hidden mid-frame
      if (typeof document !== "undefined" && document.hidden) {
        if (markerRef.current) {
          markerRef.current.setLatLng([anim.targetLat, anim.targetLng]);
        }
        anim.startLat = anim.targetLat;
        anim.startLng = anim.targetLng;
        anim.rafId = null;
        return;
      }

      const elapsed = currentTime - anim.startTime;
      const progress = Math.min(1, Math.max(0, elapsed / anim.duration));

      // Standard cubic ease-out for natural deceleration
      const ease = 1 - Math.pow(1 - progress, 3);

      const curLat = anim.startLat + (anim.targetLat - anim.startLat) * ease;
      const curLng = anim.startLng + (anim.targetLng - anim.startLng) * ease;

      if (markerRef.current) {
        markerRef.current.setLatLng([curLat, curLng]);
      }

      // Smooth heading rotation ONLY on inner child element (never Leaflet's translate3d marker wrapper)
      if (targetHeading != null && !isNaN(targetHeading)) {
        anim.currentHeading = targetHeading;
        const markerEl = markerRef.current?.getElement();
        const rotator = (markerEl?.querySelector(".driver-bike-rotator") as HTMLElement | null) ||
          (document.getElementById("driver-bike-rotator") as HTMLElement | null);
        if (rotator) {
          rotator.style.transform = `rotate(${Math.round(targetHeading)}deg)`;
        }
      }

      // Smooth pan map if auto-follow is active
      if (autoFollow && mapRef.current) {
        mapRef.current.panTo([curLat, curLng], { animate: false });
      }

      if (progress < 1) {
        anim.rafId = requestAnimationFrame(animate);
      } else {
        anim.rafId = null;
      }
    };

    anim.rafId = requestAnimationFrame(animate);

    // Re-sync on tab visibility resume
    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && !document.hidden && markerRef.current) {
        markerRef.current.setLatLng([anim.targetLat, anim.targetLng]);
        anim.startLat = anim.targetLat;
        anim.startLng = anim.targetLng;
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (anim.rafId !== null) {
        cancelAnimationFrame(anim.rafId);
        anim.rafId = null;
      }
    };
  }, [validDriver?.lat, validDriver?.lng, incomingHeading, autoFollow]);

  if (!isMounted) {
    return (
      <div className="rounded-3xl border bg-card overflow-hidden shadow-soft h-80 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="h-10 w-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
        <p className="text-xs font-bold text-muted-foreground">Initializing Live GPS Map…</p>
      </div>
    );
  }

  const envTileUrl = import.meta.env.VITE_MAP_TILE_URL;
  const mapTileUrl =
    envTileUrl && (!envTileUrl.includes("cartocdn.com") || envTileUrl.includes("api_key="))
      ? envTileUrl
      : "https://tile.openstreetmap.de/{z}/{x}/{y}.png";

  return (
    <div className="rounded-3xl border bg-card overflow-hidden shadow-soft flex flex-col">
      {/* Top Blinkit-style Live Radar Header Bar */}
      <div className="p-4 bg-emerald-50/90 dark:bg-emerald-950/40 border-b border-emerald-100 dark:border-emerald-900/40 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3.5 w-3.5">
            {!isStale && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span
              className={`relative inline-flex rounded-full h-3.5 w-3.5 ${
                isStale ? "bg-amber-500" : "bg-emerald-500"
              }`}
            ></span>
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-foreground">
                {isStale
                  ? "Waiting for rider signal…"
                  : isSelfPickup
                  ? "Self Pickup Active"
                  : displayEta
                  ? `Arriving in ~${displayEta}${displayDistance ? ` • ${displayDistance} away` : ""}`
                  : "Live Tracking Active"}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full font-extrabold text-[10px] uppercase tracking-wider ${
                  isStale
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                    : "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                }`}
              >
                {isStale
                  ? "Signal paused"
                  : validDriver
                  ? "60 FPS Live"
                  : "Awaiting GPS"}
              </span>
            </div>
            <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <Clock className="h-3 w-3 inline text-emerald-600 dark:text-emerald-400" />
              {secondsAgo <= 3
                ? "Updated just now"
                : `Updated ${secondsAgo}s ago`}
              {speedKmh != null && speedKmh > 0 && (
                <>
                  <span>•</span>
                  <span>{Math.round(speedKmh)} km/h</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {googleMapsDirectionsUrl && (
            <a
              href={googleMapsDirectionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-8 px-2.5 text-xs font-bold rounded-xl border border-sky-400 bg-sky-50 hover:bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800 transition-colors shadow-2xs shrink-0"
              title="Open real turn-by-turn route in Google Maps"
            >
              <Navigation className="h-3.5 w-3.5 mr-1 text-sky-600 dark:text-sky-400" />
              Google Maps
            </a>
          )}

          {/* Audio Chime Alert Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next) playArrivalChime();
            }}
            className={`h-8 px-2.5 text-xs font-bold rounded-xl transition-all ${
              soundEnabled
                ? "border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-700 dark:bg-card dark:border-emerald-800"
                : "border-muted bg-muted/40 text-muted-foreground"
            }`}
            title={soundEnabled ? "Audio Chime Enabled (Plays on arrival)" : "Audio Chime Muted"}
          >
            {soundEnabled ? (
              <Volume2 className="h-3.5 w-3.5 mr-1 text-emerald-600" />
            ) : (
              <VolumeX className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
            )}
            {soundEnabled ? "Chime On" : "Muted"}
          </Button>

          {/* Map Layer Mode Toggle (Roads / Satellite) */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentLayer(currentLayer === "streets" ? "satellite" : "streets")}
            className={`h-8 px-2.5 text-xs font-bold rounded-xl transition-all ${
              currentLayer === "satellite"
                ? "border-slate-800 bg-slate-900 text-white shadow-xs"
                : "border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-800 dark:bg-card dark:border-emerald-800 dark:text-emerald-300"
            }`}
            title={currentLayer === "satellite" ? "Switch to High-Contrast Road Map" : "Switch to Free Satellite View"}
          >
            <Layers className="h-3.5 w-3.5 mr-1 text-emerald-600" />
            {currentLayer === "satellite" ? "🛰️ Satellite" : "🛣️ Roads"}
          </Button>

          {/* Follow Rider Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoFollow(!autoFollow)}
            className={`h-8 px-2.5 text-xs font-bold rounded-xl transition-all ${
              autoFollow
                ? "bg-emerald-600 text-white hover:bg-emerald-500 border-emerald-600"
                : "border-emerald-200 bg-white hover:bg-emerald-50 dark:bg-card dark:border-emerald-900"
            }`}
            title={autoFollow ? "Disable Follow Mode" : "Auto-follow Rider"}
          >
            <Compass
              className={`h-3.5 w-3.5 mr-1 ${autoFollow ? "animate-spin" : ""}`}
            />
            {autoFollow ? "Following" : "Follow"}
          </Button>

          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="h-8 px-2.5 text-xs font-bold rounded-xl border-emerald-200 bg-white hover:bg-emerald-100 dark:bg-emerald-900/30 dark:border-emerald-800"
              title="Refresh GPS"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 mr-1 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setAutoFollow(false);
              setRecenterCounter((c) => c + 1);
            }}
            className="h-8 px-2.5 text-xs font-bold rounded-xl border-emerald-200 bg-white hover:bg-emerald-100 dark:bg-emerald-900/30 dark:border-emerald-800"
            title="Recenter Map"
          >
            <Navigation className="h-3.5 w-3.5 mr-1 text-emerald-600" />
            Recenter
          </Button>
        </div>
      </div>

      {/* Multi-Store Pickup Pipeline Ribbon (visual progress across multiple vendor stores) */}
      {validPickups.length > 1 && (
        <div className="px-4 py-2.5 bg-amber-500/10 dark:bg-amber-950/20 border-b border-amber-500/20 flex items-center justify-between gap-2 overflow-x-auto text-xs">
          <div className="flex items-center gap-1.5 shrink-0 font-bold text-amber-900 dark:text-amber-200">
            <Store className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span>Multi-Store Order ({validPickups.length} Stores):</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto shrink-0 text-[11px] font-semibold text-muted-foreground">
            {validPickups.map((pickup, idx) => (
              <React.Fragment key={pickup.id || idx}>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white dark:bg-card border shadow-2xs text-foreground">
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-white font-extrabold text-[9px] flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="truncate max-w-[110px]">{pickup.name}</span>
                </span>
                <ChevronRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />
              </React.Fragment>
            ))}
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-bold">
              🏠 Drop-off
            </span>
          </div>
        </div>
      )}

      {/* Main Map Canvas */}
      <div className="relative h-80 sm:h-96 w-full bg-muted">
        <MapContainer
          center={defaultCenter}
          zoom={14}
          scrollWheelZoom={false}
          className="h-full w-full z-0"
          ref={(m) => {
            if (m) mapRef.current = m;
          }}
        >
          <TileLayer
            key={currentLayer}
            attribution={MAP_LAYERS[currentLayer].attribution}
            url={MAP_LAYERS[currentLayer].url}
            subdomains={MAP_LAYERS[currentLayer].subdomains}
            maxZoom={19}
          />

          <MapBoundsController
            points={allPoints}
            recenterTrigger={recenterCounter}
            onUserInteract={() => setAutoFollow(false)}
          />

          {/* Shrinking Trail (already travelled route) */}
          {pathTrail.length >= 2 && (
            <Polyline
              positions={pathTrail}
              color="#94a3b8"
              weight={3.5}
              dashArray="4, 6"
              opacity={0.5}
            />
          )}

          {/* Upcoming Road Route Ahead (vibrant emerald line with road casing) */}
          {pathAhead.length >= 2 && (
            <>
              {/* Outer road border/casing */}
              <Polyline
                positions={pathAhead}
                color="#064e3b"
                weight={7}
                opacity={0.85}
                lineCap="round"
                lineJoin="round"
              />
              {/* Inner bright emerald road line */}
              <Polyline
                positions={pathAhead}
                color="#10b981"
                weight={4.5}
                opacity={1}
                lineCap="round"
                lineJoin="round"
              />
            </>
          )}

          {/* Off-Road Connector from Rider to Street (Google Maps style dotted access pathway) */}
          {riderOffRoadConnector && (
            <Polyline
              positions={riderOffRoadConnector}
              color="#0284c7"
              weight={3}
              dashArray="5, 7"
              opacity={0.9}
              lineCap="round"
            />
          )}

          {/* Dotted Footpath Connector to Doorstep (Google Maps style off-road access line) */}
          {doorstepConnector && (
            <Polyline
              positions={doorstepConnector}
              color="#059669"
              weight={3}
              dashArray="6, 8"
              opacity={0.85}
              lineCap="round"
            />
          )}

          {/* Direction Chevrons along Road Route */}
          {directionArrows.map((arrow, idx) => (
            <Marker
              key={`dir-arrow-${idx}`}
              position={arrow.pos}
              icon={L.divIcon({
                className: "route-direction-arrow",
                html: `
                  <div style="transform: rotate(${Math.round(arrow.bearing)}deg); display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; pointer-events: none;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6));">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </div>
                `,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
              })}
              interactive={false}
            />
          ))}

          {/* Driver Vehicle Pin with 60fps Lerp */}
          {validDriver && (
            <Marker
              position={[validDriver.lat, validDriver.lng]}
              icon={driverDivIcon}
              ref={(m) => {
                if (m) markerRef.current = m;
              }}
            >
              <Popup>
                <div className="p-1 space-y-1 text-xs">
                  <div className="font-black text-emerald-700 flex items-center gap-1">
                    🛵 {driverInfo?.name || "Delivery Partner"}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {driverInfo?.vehicle_type || "Vehicle"}{" "}
                    {driverInfo?.vehicle_number
                      ? `(${driverInfo.vehicle_number})`
                      : ""}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Road-snapped 60fps tracking
                  </p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Store Pickup Pin(s) with Numbered Waypoint Badges */}
          {validPickups.map((pickup, idx) => (
            <Marker
              key={pickup.id || idx}
              position={[pickup.lat, pickup.lng]}
              icon={getStoreDivIcon(idx, validPickups.length)}
            >
              <Popup>
                <div className="p-1 space-y-0.5 text-xs">
                  <div className="font-bold text-amber-700 flex items-center gap-1">
                    🏪 {validPickups.length > 1 ? `Store ${idx + 1}: ` : ""}{pickup.name || "Pickup Location"}
                  </div>
                  {pickup.address && (
                    <p className="text-[11px] text-muted-foreground max-w-[180px]">
                      {pickup.address}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Customer Drop-off Pin */}
          {validDelivery && (
            <Marker
              position={[validDelivery.lat, validDelivery.lng]}
              icon={destinationDivIcon}
            >
              <Popup>
                <div className="p-1 space-y-0.5 text-xs">
                  <div className="font-bold text-rose-700 flex items-center gap-1">
                    🏠 Delivery Address
                  </div>
                  {validDelivery.address && (
                    <p className="text-[11px] text-muted-foreground max-w-[180px]">
                      {validDelivery.address}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          )}

          {/* Customer Live GPS Marker (for Store Pickup / Advance Booking) */}
          {isSelfPickup && customerLiveLocation && (
            <Marker
              position={[customerLiveLocation.lat, customerLiveLocation.lng]}
              icon={customerDivIcon}
            >
              <Popup>
                <div className="p-1 space-y-0.5 text-xs">
                  <div className="font-bold text-blue-700 flex items-center gap-1">
                    📍 You Are Here
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Your current live GPS position
                  </p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Real Road Route for Self Pickup & Advance Booking (True street network) */}
          {isSelfPickup && activeRoadRoute.length > 3 && (
            <>
              <Polyline
                positions={activeRoadRoute}
                color="#2563eb"
                weight={10}
                opacity={0.2}
                lineCap="round"
                lineJoin="round"
              />
              <Polyline
                positions={activeRoadRoute}
                color="#2563eb"
                weight={4.5}
                opacity={0.9}
                lineCap="round"
                lineJoin="round"
              />
            </>
          )}

          {/* Store Entrance / Pickup Bay Marker */}
          {pickupPoint && (
            <Marker position={[pickupPoint.lat, pickupPoint.lng]} icon={pickupPointDivIcon}>
              <Popup>
                <div className="p-1 space-y-0.5 text-xs">
                  <div className="font-bold text-emerald-700 flex items-center gap-1">
                    🚪 Entrance: {pickupPoint.name}
                  </div>
                  {pickupPoint.instructions && (
                    <p className="text-[11px] text-muted-foreground">{pickupPoint.instructions}</p>
                  )}
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${pickupPoint.lat},${pickupPoint.lng}&travelmode=walking`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-1 font-bold text-[11px] text-emerald-600 hover:underline"
                  >
                    🚶 Walk to this Entrance &rarr;
                  </a>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>

        {/* 🚦 Live Traffic / Railway Crossing Alert Banner */}
        {isStationaryInTraffic && (
          <div className="absolute top-3 left-3 right-3 sm:right-auto z-[400] max-w-sm bg-amber-500/95 text-white backdrop-blur-md px-3.5 py-2.5 rounded-2xl shadow-xl border border-amber-300 text-xs font-bold flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2">
            <span className="text-lg shrink-0">🚦</span>
            <span className="leading-snug">Rider railway crossing / traffic signal par ruka hua hai, chinta na karein.</span>
          </div>
        )}

        {/* 📡 Network Re-connecting Indicator */}
        {secondsAgo > 18 && !isSelfPickup && (
          <div className="absolute bottom-16 left-4 z-[400] bg-zinc-950/85 text-amber-300 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-semibold shadow-lg border border-amber-500/30 flex items-center gap-2 animate-in fade-in">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>Network re-connecting... Last seen {secondsAgo}s ago</span>
          </div>
        )}

        {/* Google Maps-style Satellite / Streets toggle thumbnail (Bottom-Left matching Google Maps) */}
        <MapLayerToggle
          currentLayer={currentLayer}
          onToggle={setCurrentLayer}
          className="bottom-3 left-3 shadow-md"
        />
      </div>

      {/* ETA & Distance Card - Moved Below Map Canvas for 100% Unobstructed Map View */}
      <div className="p-3.5 sm:p-4 bg-muted/40 dark:bg-zinc-900/40 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-900/40 shadow-xs">
            <Clock className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <span>{isSelfPickup ? "Store Distance" : "Estimated delivery"}</span>
              {!isSelfPickup && validDriver && !isStale && (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              )}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-base sm:text-lg font-black text-foreground">
                {displayEta || (status === "delivered" ? "Delivered" : isSelfPickup ? "Ready for Pickup" : "10-15 min")}
              </span>
              {displayDistance && (
                <>
                  <span className="text-xs text-muted-foreground/60">•</span>
                  <span className="text-xs font-bold text-muted-foreground">
                    {displayDistance} away
                  </span>
                </>
              )}
            </div>
            {contextualMilestone && (
              <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 mt-1 truncate">
                {contextualMilestone}
              </p>
            )}
          </div>
        </div>

        {/* Self-Pickup Walk / Drive Direction CTAs */}
        {isSelfPickup && (walkDirectionsUrl || driveDirectionsUrl || storeDirectionsUrl || pickupPoint) && (
          <div className="flex items-center gap-2 shrink-0">
            {pickupPoint && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${pickupPoint.lat},${pickupPoint.lng}&travelmode=walking`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl shadow-xs transition-all active:scale-95"
                title={`Walk to ${pickupPoint.name}`}
              >
                <span>🚪 Entrance</span>
              </a>
            )}
            {walkDirectionsUrl && (
              <a
                href={walkDirectionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold bg-card hover:bg-muted text-foreground border border-border px-3 py-2 rounded-xl shadow-xs transition-all active:scale-95"
                title="Open walking directions in Google Maps"
              >
                <span>🚶 Walk</span>
              </a>
            )}
            <a
              href={driveDirectionsUrl || storeDirectionsUrl || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-xl shadow-xs transition-all active:scale-95"
              title="Open driving navigation in Google Maps"
            >
              <Navigation className="h-3.5 w-3.5" />
              <span>Drive</span>
            </a>
          </div>
        )}
      </div>

      {/* Driver Contact & Vehicle Information Footer */}
      {activeRider && (
        <div className="p-4 bg-card border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-black text-lg flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
              {activeRider.name ? activeRider.name.charAt(0).toUpperCase() : "D"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-foreground">
                  {activeRider.name}
                </h4>
                <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                  <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                  {activeRider.rating && activeRider.rating > 0
                    ? activeRider.rating.toFixed(1)
                    : "5.0"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {activeRider.vehicle_type || "Delivery Partner"}
                {activeRider.vehicle_number
                  ? ` • ${activeRider.vehicle_number}`
                  : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {googleMapsDirectionsUrl && (
              <a
                href={googleMapsDirectionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 h-10 px-3.5 rounded-xl font-bold text-xs bg-sky-50 hover:bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800 transition-colors shadow-2xs"
                title="Open turn-by-turn route in Google Maps"
              >
                <Navigation className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                Google Maps
              </a>
            )}
            {activeRider.phone && (
              <a
                href={`tel:${activeRider.phone}`}
                className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-xs"
              >
                <Phone className="h-3.5 w-3.5" /> Call Rider
              </a>
            )}
            <div className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground bg-muted/60 px-3 py-2 rounded-xl border border-border">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Verified Fleet
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
