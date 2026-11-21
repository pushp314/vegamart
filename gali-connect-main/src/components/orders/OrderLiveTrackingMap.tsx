import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";

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
  heading?: number | null;
  speedKmh?: number | null;
  accuracy?: number | null;
  lastUpdatedAt?: string | Date | number | null;
  isLive?: boolean;
  isStale?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

// Controller to auto-fit map view to markers
function MapBoundsController({
  points,
  recenterTrigger,
}: {
  points: [number, number][];
  recenterTrigger: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1 && points[0]) {
      map.setView(points[0], 15, { animate: true });
    } else {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50], animate: true });
    }
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
  heading: incomingHeading,
  speedKmh,
  accuracy,
  lastUpdatedAt,
  isLive = true,
  isStale: serverStale = false,
  onRefresh,
  isRefreshing,
}: OrderLiveTrackingMapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [recenterCounter, setRecenterCounter] = useState(0);
  const [autoFollow, setAutoFollow] = useState(false);
  const [secondsAgo, setSecondsAgo] = useState(0);

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
    if (validDriver) return [validDriver.lat, validDriver.lng];
    if (validDelivery) return [validDelivery.lat, validDelivery.lng];
    if (validPickups.length > 0 && validPickups[0])
      return [validPickups[0].lat, validPickups[0].lng];
    return [12.9716, 77.5946];
  }, [validDriver, validDelivery, validPickups]);

  // Points for map bounds fitting
  const allPoints = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [];
    if (validDriver) pts.push([validDriver.lat, validDriver.lng]);
    if (validDelivery) pts.push([validDelivery.lat, validDelivery.lng]);
    validPickups.forEach((p) => pts.push([p.lat, p.lng]));
    return pts;
  }, [validDriver, validDelivery, validPickups]);

  // Split road route polyline into "Shrinking Trail" (already passed) and "Path Ahead"
  const { pathAhead, pathTrail } = useMemo(() => {
    if (!routePoints || routePoints.length === 0) {
      // Fallback straight-line polyline if no road route available
      const straight: [number, number][] = [];
      if (validDriver) straight.push([validDriver.lat, validDriver.lng]);
      validPickups.forEach((p) => straight.push([p.lat, p.lng]));
      if (validDelivery) straight.push([validDelivery.lat, validDelivery.lng]);
      return { pathAhead: straight, pathTrail: [] as [number, number][] };
    }

    const safeIndex = Math.max(0, Math.min(routeIndex, routePoints.length - 1));
    const trail = routePoints.slice(0, safeIndex + 1);

    const ahead: [number, number][] = [];
    if (validDriver) {
      ahead.push([validDriver.lat, validDriver.lng]);
    }
    for (let i = safeIndex + 1; i < routePoints.length; i++) {
      const pt = routePoints[i];
      if (pt) ahead.push(pt);
    }

    return { pathAhead: ahead, pathTrail: trail };
  }, [routePoints, routeIndex, validDriver, validPickups, validDelivery]);

  // Dynamic ETA display formatting
  const displayEta = useMemo(() => {
    if (etaSeconds != null && etaSeconds > 0) {
      const mins = Math.ceil(etaSeconds / 60);
      return mins <= 1 ? "1 min" : `${mins} mins`;
    }
    if (etaMinutes != null && etaMinutes > 0) {
      return etaMinutes <= 1 ? "1 min" : `${etaMinutes} mins`;
    }
    return null;
  }, [etaSeconds, etaMinutes]);

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

  const storeDivIcon = useMemo(() => {
    return L.divIcon({
      className: "store-marker-pin",
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center;">
          <div style="width: 34px; height: 34px; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 9999px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2); border: 2px solid #ffffff; font-size: 16px;">
            🏪
          </div>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
  }, []);

  const destinationDivIcon = useMemo(() => {
    return L.divIcon({
      className: "dest-marker-pin",
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center;">
          <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #e11d48, #be123c); border-radius: 9999px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 12px -2px rgba(225, 29, 72, 0.4); border: 2px solid #ffffff; font-size: 16px;">
            🏠
          </div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
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
                  : displayEta
                  ? `Arriving in ~${displayEta}`
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
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url={mapTileUrl}
            maxZoom={19}
          />

          <MapBoundsController
            points={allPoints}
            recenterTrigger={recenterCounter}
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

          {/* Upcoming Road Route Ahead (vibrant emerald line) */}
          {pathAhead.length >= 2 && (
            <Polyline
              positions={pathAhead}
              color="#059669"
              weight={5}
              opacity={0.95}
              lineCap="round"
              lineJoin="round"
            />
          )}

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

          {/* Store Pickup Pin(s) */}
          {validPickups.map((pickup, idx) => (
            <Marker
              key={idx}
              position={[pickup.lat, pickup.lng]}
              icon={storeDivIcon}
            >
              <Popup>
                <div className="p-1 space-y-0.5 text-xs">
                  <div className="font-bold text-amber-700 flex items-center gap-1">
                    🏪 {pickup.name || "Pickup Location"}
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
        </MapContainer>

        {/* Floating Status Pill */}
        <div className="absolute bottom-3 left-3 z-[400] pointer-events-none">
          <div className="bg-card/95 backdrop-blur-md border border-border px-3.5 py-1.5 rounded-2xl shadow-lg flex items-center gap-2 text-xs font-semibold">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isStale
                  ? "bg-amber-500"
                  : "bg-emerald-500 animate-pulse"
              }`}
            />
            <span className="text-foreground">
              {isStale
                ? "Waiting for rider signal…"
                : displayEta
                ? `En route • Arriving in ~${displayEta}`
                : "Rider is en route"}
            </span>
          </div>
        </div>
      </div>

      {/* Driver Contact & Vehicle Information Footer */}
      {driverInfo && (
        <div className="p-4 bg-card border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-black text-lg flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
              {driverInfo.name ? driverInfo.name.charAt(0).toUpperCase() : "D"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-foreground">
                  {driverInfo.name}
                </h4>
                <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                  <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                  {driverInfo.rating && driverInfo.rating > 0
                    ? driverInfo.rating.toFixed(1)
                    : "5.0"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {driverInfo.vehicle_type || "Delivery Partner"}
                {driverInfo.vehicle_number
                  ? ` • ${driverInfo.vehicle_number}`
                  : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {driverInfo.phone && (
              <a
                href={`tel:${driverInfo.phone}`}
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
