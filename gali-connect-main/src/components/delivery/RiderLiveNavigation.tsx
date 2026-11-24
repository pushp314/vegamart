import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
  Navigation,
  MapPin,
  Store,
  Bike,
  Clock,
  Phone,
  Maximize2,
  Minimize2,
  LocateFixed,
  ArrowUp,
  CornerUpLeft,
  CornerUpRight,
  RotateCcw,
  Flag,
  CheckCircle2,
  ExternalLink,
  Layers,
  ChevronRight,
  Package,
} from "lucide-react";
import { MapLayerToggle } from "@/components/maps/MapLayerToggle";
import { MAP_LAYERS, type MapLayerType } from "@/components/maps/map-layers";
import {
  fetchRoadRoute,
  snapPointToPolyline,
  formatDistance,
  formatDuration,
  type RoadRoute,
  type ManeuverStep,
} from "@/lib/road-routing";
import {
  buildMultiStoreDeliveryPlan,
  type MultiStoreDeliveryPlan,
  type StoreItem,
} from "@/lib/multistore-routing";
import { toast } from "sonner";

export interface RiderLiveNavigationProps {
  order: any;
  riderCoords: { lat: number; lng: number } | null;
  onUpdateStatus?: (status: string) => void;
  onOpenOtpModal?: () => void;
  onConfirmStorePickup?: (subOrderId: string) => void;
  className?: string;
  defaultFullscreen?: boolean;
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

// Calculate bearing in degrees between two coordinates
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

// Controller to auto-fit map view or follow rider without unexpected zoom-outs
function NavigationCameraController({
  allPoints,
  riderPosition,
  autoFollow,
  recenterCount,
  onUserInteraction,
}: {
  allPoints: [number, number][];
  riderPosition: [number, number] | null;
  autoFollow: boolean;
  recenterCount: number;
  onUserInteraction?: () => void;
}) {
  const map = useMap();
  const hasInitialFitRef = useRef(false);
  const lastRecenterRef = useRef(recenterCount);

  useMapEvents({
    dragstart: () => onUserInteraction?.(),
    zoomstart: () => onUserInteraction?.(),
  });

  useEffect(() => {
    // If user clicked explicit recenter button, trigger camera re-lock
    const isExplicitRecenter = recenterCount !== lastRecenterRef.current;
    if (isExplicitRecenter) {
      lastRecenterRef.current = recenterCount;
    }

    if (autoFollow && riderPosition) {
      map.setView(riderPosition, Math.max(map.getZoom(), 17), { animate: true });
      return;
    }

    if (!autoFollow) return; // In free-look, NEVER override user's manual view or zoom

    if (hasInitialFitRef.current && !isExplicitRecenter) {
      return;
    }

    const valid = allPoints.filter(
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
      map.setView(valid[0], 16, { animate: true });
    } else {
      const bounds = L.latLngBounds(valid);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16, animate: true });
    }
    hasInitialFitRef.current = true;
  }, [map, allPoints, riderPosition, autoFollow, recenterCount]);

  return null;
}

function getManeuverIcon(step?: ManeuverStep) {
  if (!step) return <ArrowUp className="h-5 w-5 text-white" />;
  const mod = step.modifier?.toLowerCase() || "";
  const type = step.type?.toLowerCase() || "";

  if (type === "arrive") return <Flag className="h-5 w-5 text-emerald-400" />;
  if (mod.includes("left")) return <CornerUpLeft className="h-5 w-5 text-white" />;
  if (mod.includes("right")) return <CornerUpRight className="h-5 w-5 text-white" />;
  if (mod.includes("uturn")) return <RotateCcw className="h-5 w-5 text-white" />;
  return <ArrowUp className="h-5 w-5 text-white" />;
}

export function RiderLiveNavigation({
  order,
  riderCoords,
  onUpdateStatus,
  onOpenOtpModal,
  onConfirmStorePickup,
  className = "",
  defaultFullscreen = false,
}: RiderLiveNavigationProps) {
  const [isFullscreen, setIsFullscreen] = useState(defaultFullscreen);
  const [currentLayer, setCurrentLayer] = useState<MapLayerType>("streets");
  const [route, setRoute] = useState<RoadRoute | null>(null);
  const [autoFollow, setAutoFollow] = useState(true); // Default to locked navigation follow
  const [isFreeLook, setIsFreeLook] = useState(false);
  const [freeLookCountdown, setFreeLookCountdown] = useState(5);
  const [recenterCount, setRecenterCount] = useState(0);

  const freeLookTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Screen WakeLock: keep rider's phone screen awake during active navigation
  useEffect(() => {
    let wakeLock: any = null;
    let released = false;

    async function requestWakeLock() {
      if (typeof navigator !== "undefined" && "wakeLock" in navigator) {
        try {
          wakeLock = await (navigator as any).wakeLock.request("screen");
        } catch {
          // Ignore if permission denied or unsupported in browser
        }
      }
    }

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (wakeLock !== null && document.visibilityState === "visible" && !released) {
        requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      released = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLock) {
        wakeLock.release().catch(() => {});
      }
      if (freeLookTimerRef.current) clearTimeout(freeLookTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  const handleRecenter = useCallback(() => {
    if (freeLookTimerRef.current) clearTimeout(freeLookTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setIsFreeLook(false);
    setAutoFollow(true);
    setFreeLookCountdown(5);
    setRecenterCount((c) => c + 1);
    toast.success("Locked camera onto your GPS location ⌖", { duration: 1500 });
  }, []);

  const handleUserMapInteraction = useCallback(() => {
    setIsFreeLook(true);
    setAutoFollow(false);
    setFreeLookCountdown(5);

    if (freeLookTimerRef.current) clearTimeout(freeLookTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    countdownIntervalRef.current = setInterval(() => {
      setFreeLookCountdown((prev) => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // After 5 seconds of untouched free look, auto-snap back onto rider
    freeLookTimerRef.current = setTimeout(() => {
      setIsFreeLook(false);
      setAutoFollow(true);
      setFreeLookCountdown(5);
      setRecenterCount((c) => c + 1);
      toast.info("Auto-centering camera on your GPS ⌖", { duration: 2000 });
    }, 5000);
  }, []);

  // Intelligent Multi-Store Delivery Plan: Sequences Shop 1 -> Shop 2 -> Customer Doorstep
  const deliveryPlan = useMemo<MultiStoreDeliveryPlan>(() => {
    return buildMultiStoreDeliveryPlan(order, riderCoords);
  }, [order, riderCoords]);

  const isPickupPhase = deliveryPlan.phase === "PICKUP";

  // Determine Origin (Rider live position or fallback to Sakti center)
  const origin = useMemo(() => {
    if (riderCoords && riderCoords.lat > 5 && riderCoords.lng > 60) {
      return riderCoords;
    }
    const firstWp = deliveryPlan.allWaypoints[0];
    if (firstWp && firstWp.lat > 5 && firstWp.lng > 60) {
      return { lat: firstWp.lat, lng: firstWp.lng };
    }
    return { lat: 21.9588, lng: 82.9588 }; // Sakti center
  }, [riderCoords, deliveryPlan]);

  // Intermediate stops for multi-vendor pickups (remaining pending stores)
  const intermediateStops = useMemo(() => {
    if (deliveryPlan.sequencedPendingStores.length <= 1) return [];
    return deliveryPlan.sequencedPendingStores.slice(1).map((s, idx) => ({
      lat: s.lat,
      lng: s.lng,
      label: s.businessName,
      itemsCount: s.items.length,
      stopNumber: (deliveryPlan.activeTarget.stopNumber || 1) + idx + 1,
    }));
  }, [deliveryPlan]);

  // Destination Target (Shop for pickup, or Customer for dropoff)
  const destination = useMemo(() => {
    return {
      lat: deliveryPlan.activeTarget.lat,
      lng: deliveryPlan.activeTarget.lng,
      label: deliveryPlan.activeTarget.label,
      title: deliveryPlan.activeTarget.title,
      subtitle: deliveryPlan.activeTarget.subtitle,
      address: deliveryPlan.activeTarget.address,
      phone: deliveryPlan.activeTarget.phone,
      landmark: deliveryPlan.activeTarget.landmark,
      exact_location: deliveryPlan.activeTarget.exact_location,
      items: deliveryPlan.activeTarget.items,
      subOrderId: deliveryPlan.activeTarget.subOrderId,
      type: deliveryPlan.activeTarget.type.toLowerCase() as "store" | "customer",
    };
  }, [deliveryPlan]);

  // Calculate real road route along street network
  useEffect(() => {
    let active = true;

    async function loadRoute() {
      const waypoints = [
        origin,
        { lat: destination.lat, lng: destination.lng },
        ...intermediateStops.map((s) => ({ lat: s.lat, lng: s.lng })),
      ];

      const res = await fetchRoadRoute(waypoints);
      if (active && res) {
        setRoute(res);
      }
    }

    loadRoute();
    return () => {
      active = false;
    };
  }, [origin, intermediateStops, destination]);

  // Snap rider to road polyline to obtain smooth heading
  const snappedRider = useMemo(() => {
    if (!route || route.coordinates.length < 2) {
      return {
        lat: origin.lat,
        lng: origin.lng,
        heading: 0,
      };
    }
    return snapPointToPolyline(origin, route.coordinates);
  }, [origin, route]);

  // All points to fit within camera view
  const allPoints = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [
      [origin.lat, origin.lng],
      [destination.lat, destination.lng],
    ];
    intermediateStops.forEach((s) => pts.push([s.lat, s.lng]));
    return pts;
  }, [origin, destination, intermediateStops]);

  // Live icons
  const riderIcon = useMemo(() => {
    const heading = Math.round(snappedRider.heading || 0);
    return L.divIcon({
      className: "custom-nav-rider",
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 54px; height: 54px;">
          <div style="position: absolute; width: 54px; height: 54px; border-radius: 9999px; background: radial-gradient(circle, rgba(16, 185, 129, 0.45) 0%, rgba(16, 185, 129, 0) 70%);"></div>
          <div style="position: relative; z-index: 10; width: 44px; height: 44px; background: linear-gradient(135deg, #10b981, #047857); border-radius: 9999px; display: flex; align-items: center; justify-content: center; border: 3px solid #ffffff; box-shadow: 0 4px 14px rgba(4, 120, 87, 0.5); font-size: 22px; transform: rotate(${heading}deg); transition: transform 0.3s ease;">
            🛵
          </div>
        </div>
      `,
      iconSize: [54, 54],
      iconAnchor: [27, 27],
    });
  }, [snappedRider.heading]);

  const targetIcon = useMemo(() => {
    const isStore = destination.type === "store";
    return L.divIcon({
      className: "custom-nav-target",
      html: `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0 6px 12px ${isStore ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.4)'});">
          <div style="width: 44px; height: 44px; background: #ffffff; border-radius: 9999px; border: 3.5px solid ${isStore ? '#f59e0b' : '#10b981'}; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.15); font-size: 20px;">
            ${isStore ? '🏪' : '🏠'}
          </div>
          <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 8px solid ${isStore ? '#f59e0b' : '#10b981'}; margin-top: -1px;"></div>
          <div style="width: 6px; height: 6px; border-radius: 9999px; background: ${isStore ? '#f59e0b' : '#10b981'}; margin-top: 1px;"></div>
        </div>
      `,
      iconSize: [44, 54],
      iconAnchor: [22, 54],
    });
  }, [destination.type]);

  const nextStep = route?.steps?.[0];
  const displayDist = route ? `${route.distanceKm} km` : "Calculating...";
  const displayEta = route ? `${route.durationMinutes} min` : "...";

  // Google Maps-style arrival clock time (e.g. 1:50 pm)
  const arrivalTime = useMemo(() => {
    if (!route?.durationMinutes) return null;
    const arrivalDate = new Date(Date.now() + route.durationMinutes * 60 * 1000);
    return arrivalDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }, [route?.durationMinutes]);

  // Full continuous road coordinates connected seamlessly from rider to destination
  const fullRouteCoordinates = useMemo<[number, number][]>(() => {
    if (!route || !route.coordinates || route.coordinates.length < 2) {
      return [
        [snappedRider.lat, snappedRider.lng],
        [destination.lat, destination.lng],
      ];
    }
    const coords: [number, number][] = [[snappedRider.lat, snappedRider.lng]];
    for (const pt of route.coordinates) {
      coords.push(pt);
    }
    coords.push([destination.lat, destination.lng]);
    return coords;
  }, [route, snappedRider, destination]);

  // Directional arrow chevrons along the road route
  const directionArrows = useMemo(() => {
    if (fullRouteCoordinates.length < 4) return [];
    const count = Math.min(6, Math.max(2, Math.floor(fullRouteCoordinates.length / 8)));
    const step = Math.floor(fullRouteCoordinates.length / (count + 1));
    const list: Array<{ pos: [number, number]; bearing: number }> = [];
    for (let i = step; i < fullRouteCoordinates.length - 1; i += step) {
      const p1 = fullRouteCoordinates[i];
      const p2 = fullRouteCoordinates[i + 1];
      if (p1 && p2) {
        const b = computeBearing(p1[0], p1[1], p2[0], p2[1]);
        list.push({ pos: p1, bearing: b });
      }
    }
    return list;
  }, [fullRouteCoordinates]);

  const googleMapsUrl = deliveryPlan.googleMapsActiveUrl;

  return (
    <div
      className={`relative rounded-3xl overflow-hidden border border-border shadow-lg bg-card transition-all flex flex-col ${
        isFullscreen
          ? "fixed inset-0 z-50 rounded-none border-none h-screen w-screen"
          : `h-[460px] sm:h-[490px] ${className}`
      }`}
    >
      {/* 🧭 Turn-by-Turn Maneuver Bar (Top Header - No Map Obstruction) */}
      <div className="bg-[#064e3b] text-white p-3 px-4 flex items-center justify-between gap-3 shrink-0 shadow-md z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-white/15 grid place-items-center shrink-0 border border-white/20 shadow-xs">
            {getManeuverIcon(nextStep)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 block leading-tight">
                {destination.title || (isPickupPhase ? "Store Pickup" : "Doorstep Dropoff")}
              </span>
              {deliveryPlan.isMultiStore && (
                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-400 text-amber-950 leading-none">
                  Multi-Store ({deliveryPlan.totalStoresCount} Stores)
                </span>
              )}
            </div>
            <h4 className="font-bold text-xs sm:text-sm text-white truncate leading-tight mt-0.5">
              {nextStep?.instruction || destination.subtitle || `Head towards ${destination.label}`}
            </h4>
          </div>
        </div>

        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="h-8 w-8 rounded-xl bg-white/10 hover:bg-white/20 text-white grid place-items-center transition-colors shrink-0"
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Navigation"}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>

      {/* 🗺️ Leaflet Road Map Canvas (Middle - Totally Unobstructed) */}
      <div className="flex-1 w-full relative min-h-[260px] bg-muted">
        <MapContainer
          center={[origin.lat, origin.lng]}
          zoom={15}
          scrollWheelZoom={true}
          className="h-full w-full z-0"
        >
          <TileLayer
            key={currentLayer}
            attribution={MAP_LAYERS[currentLayer].attribution}
            url={MAP_LAYERS[currentLayer].url}
            subdomains={MAP_LAYERS[currentLayer].subdomains}
            maxZoom={19}
          />

          <NavigationCameraController
            allPoints={allPoints}
            riderPosition={[snappedRider.lat, snappedRider.lng]}
            autoFollow={autoFollow}
            recenterCount={recenterCount}
            onUserInteraction={handleUserMapInteraction}
          />

          {/* Live Rider Marker (Scooter heading forward) */}
          <Marker position={[snappedRider.lat, snappedRider.lng]} icon={riderIcon}>
            <Popup>
              <div className="p-1 text-xs">
                <strong className="block text-emerald-700 font-bold flex items-center gap-1">
                  <Bike className="h-3.5 w-3.5" /> Your GPS Position
                </strong>
                <span className="text-muted-foreground text-[11px]">
                  Speed: Live GPS • Snapped to road
                </span>
              </div>
            </Popup>
          </Marker>

          {/* Intermediate Multi-Merchant Stops */}
          {intermediateStops.map((stop, i) => (
            <Marker key={i} position={[stop.lat, stop.lng]} icon={targetIcon}>
              <Popup>
                <div className="p-1 text-xs">
                  <strong className="block text-amber-700 font-bold">
                    Stop #{i + 1}: {stop.label}
                  </strong>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Target Destination Marker (Shop or Customer House) */}
          <Marker position={[destination.lat, destination.lng]} icon={targetIcon}>
            <Popup>
              <div className="p-1 text-xs">
                <strong className="block text-foreground font-bold text-sm">
                  {destination.label}
                </strong>
                <span className="text-muted-foreground text-[11px] block mt-0.5">
                  {destination.address}
                </span>
              </div>
            </Popup>
          </Marker>

          {/* Solid Emerald Road Route (With Outer Casing) */}
          {fullRouteCoordinates.length >= 2 && (
            <>
              {/* Outer road casing */}
              <Polyline
                positions={fullRouteCoordinates}
                color="#064e3b"
                weight={7}
                opacity={0.85}
                lineCap="round"
                lineJoin="round"
              />
              {/* Inner bright road polyline */}
              <Polyline
                positions={fullRouteCoordinates}
                color="#10b981"
                weight={4.5}
                opacity={1}
                lineCap="round"
                lineJoin="round"
              />
            </>
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
        </MapContainer>

        {/* Free-Look Banner with 5s Countdown */}
        {isFreeLook && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] bg-zinc-950/90 text-white px-3.5 py-1.5 rounded-full text-xs font-bold shadow-2xl border border-emerald-500/50 backdrop-blur-md flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Free Look ({freeLookCountdown}s)</span>
            </span>
            <button
              onClick={handleRecenter}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-colors"
            >
              Recenter ⌖
            </button>
          </div>
        )}

        {/* ⌖ Floating Recenter / Auto-Follow Button */}
        <button
          onClick={handleRecenter}
          className={`absolute bottom-4 right-4 z-[400] h-11 w-11 rounded-full shadow-xl border border-black/10 dark:border-white/10 grid place-items-center active:scale-95 transition-all ${
            autoFollow
              ? "bg-emerald-600 text-white shadow-emerald-500/30"
              : "bg-white dark:bg-card text-foreground hover:bg-muted ring-2 ring-emerald-500 animate-pulse"
          }`}
          title="Recenter & lock camera to rider"
        >
          <LocateFixed className="h-5 w-5" />
        </button>

        {/* 🗺️ Satellite vs Street Toggle */}
        <MapLayerToggle
          currentLayer={currentLayer}
          onToggle={setCurrentLayer}
          className="bottom-4 left-4 shadow-xl"
        />
      </div>

      {/* 📱 Bottom Navigation Action Footer - ETA & Distance Card directly below map */}
      <div className="p-3 sm:p-4 bg-card border-t border-border flex flex-col gap-2.5 shrink-0 z-10">
        {/* Google Maps-style Big ETA & Distance Bar */}
        <div className="flex items-center justify-between bg-muted/50 dark:bg-muted/20 px-3.5 py-2.5 rounded-2xl border border-border/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 grid place-items-center shrink-0">
              <Clock className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 leading-tight">
                  {displayEta}
                </span>
                <span className="text-xs font-bold text-muted-foreground">
                  {displayDist}
                </span>
                {arrivalTime && (
                  <>
                    <span className="text-xs text-muted-foreground/60">•</span>
                    <span className="text-xs font-bold text-foreground">
                      {arrivalTime}
                    </span>
                  </>
                )}
              </div>
              <p className="text-[10.5px] font-semibold text-muted-foreground truncate">
                {isPickupPhase ? "Merchant Pickup" : "Doorstep Delivery"}
              </p>
            </div>
          </div>

          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-bold text-[11px] transition-colors shrink-0"
            title="Open Turn-by-Turn Voice GPS in Google Maps"
          >
            <Navigation className="h-3.5 w-3.5 text-blue-600" />
            <span>Maps</span>
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
        </div>

        {/* Multi-Store Progress Sequence Strip */}
        {deliveryPlan.nextTarget && (
          <div className="flex items-center justify-between text-[11px] px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 text-amber-900 dark:text-amber-200">
            <span className="font-bold flex items-center gap-1 truncate">
              <ChevronRight className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span>Next Stop: {deliveryPlan.nextTarget.label}</span>
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0 font-medium">
              {deliveryPlan.nextTarget.subtitle}
            </span>
          </div>
        )}

        {/* Store Items To Collect Preview (Only during pickup phase) */}
        {isPickupPhase && destination.items && destination.items.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 text-[11px] text-muted-foreground">
            <span className="font-bold text-foreground shrink-0 flex items-center gap-1">
              <Package className="h-3 w-3 text-emerald-600" /> Collect ({destination.items.length}):
            </span>
            {destination.items.slice(0, 3).map((it, idx) => (
              <span key={idx} className="shrink-0 bg-muted/60 px-2 py-0.5 rounded-lg border text-[10px] font-semibold text-foreground">
                {it.name} × {it.quantity}
              </span>
            ))}
            {destination.items.length > 3 && (
              <span className="shrink-0 text-[10px] text-muted-foreground font-bold">
                +{destination.items.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Destination Information & Action Buttons */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-0.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="h-9 w-9 rounded-xl bg-muted grid place-items-center shrink-0">
              {isPickupPhase ? (
                <Store className="h-4.5 w-4.5 text-amber-600" />
              ) : (
                <MapPin className="h-4.5 w-4.5 text-emerald-600" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h5 className="font-bold text-xs text-foreground truncate">
                {destination.label}
              </h5>
              <p className="text-[11px] text-muted-foreground truncate">
                {destination.address}
              </p>
              {"landmark" in destination && (destination as any).landmark && (
                <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800/40">
                  <span>📍 Landmark: {(destination as any).landmark}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            {destination.phone && (
              <a
                href={`tel:${destination.phone}`}
                className="h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors shrink-0"
                title={`Call ${destination.label}`}
              >
                <Phone className="h-3.5 w-3.5" /> Call
              </a>
            )}

            {isPickupPhase ? (
              <button
                onClick={() => {
                  if (destination.subOrderId && onConfirmStorePickup) {
                    onConfirmStorePickup(destination.subOrderId);
                  } else {
                    onUpdateStatus?.("out_for_delivery");
                  }
                }}
                className="flex-1 sm:flex-none h-9 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {deliveryPlan.isMultiStore
                  ? `Pick Up Store ${deliveryPlan.activeTarget.stopNumber || 1}`
                  : "Confirm Pickup"}
              </button>
            ) : (
              <button
                onClick={onOpenOtpModal}
                className="flex-1 sm:flex-none h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Package className="h-3.5 w-3.5" /> Enter Delivery OTP
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
