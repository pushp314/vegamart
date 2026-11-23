import { useState, useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
import { MapLayerToggle } from "@/components/maps/MapLayerToggle";
import { MAP_LAYERS, type MapLayerType } from "@/components/maps/map-layers";
import { fetchRoadRoute } from "@/lib/road-routing";
import {
  ArrowLeft,
  Store,
  MapPin,
  Navigation,
  Clock,
  Phone,
  Check,
  Package,
  LocateFixed,
  Share2,
  ExternalLink,
  Bike,
  Sparkles,
} from "lucide-react";
import L from "leaflet";
import { toast } from "sonner";

export interface IntermediateStop {
  lat: number;
  lng: number;
  label: string;
  type?: "store" | "customer";
}

export interface DeliveryMapModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  startLocation: { lat: number; lng: number; label: string };
  endLocation: { lat: number; lng: number; label: string; address?: string };
  intermediatePoints?: IntermediateStop[];
  directionsUrl?: string | null;
  orderNumber?: string;
  storeName?: string;
  customerName?: string;
  customerPhone?: string | null;
  storePhone?: string | null;
  status?: string;
  isPickupPhase?: boolean;
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

// Controller to auto-fit map view to markers without overriding user manual zoom
function MapBoundsController({
  points,
  recenterTrigger,
}: {
  points: [number, number][];
  recenterTrigger: number;
}) {
  const map = useMap();
  const hasInitialFitRef = useRef(false);
  const userInteractedRef = useRef(false);
  const lastRecenterRef = useRef(recenterTrigger);

  useMapEvents({
    zoomstart: () => {
      userInteractedRef.current = true;
    },
    dragstart: () => {
      userInteractedRef.current = true;
    },
    movestart: (e) => {
      if ((e as any).originalEvent) {
        userInteractedRef.current = true;
      }
    },
  });

  useEffect(() => {
    // If user clicked explicit recenter, clear lock
    if (recenterTrigger !== lastRecenterRef.current) {
      lastRecenterRef.current = recenterTrigger;
      userInteractedRef.current = false;
    }

    // Once user has manually zoomed or panned, NEVER auto zoom-out!
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
        lng > 60 // Valid coordinate within India bounds
    );

    if (valid.length === 0) return;

    if (valid.length === 1 && valid[0]) {
      map.setView(valid[0], 16, { animate: true });
    } else {
      const bounds = L.latLngBounds(valid);
      map.fitBounds(bounds, { padding: [70, 70], maxZoom: 16, animate: true });
    }
    hasInitialFitRef.current = true;
  }, [map, points, recenterTrigger]);

  return null;
}

function calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function DeliveryMapModal({
  open,
  onOpenChange,
  title,
  startLocation,
  endLocation,
  intermediatePoints = [],
  directionsUrl,
  orderNumber,
  storeName,
  customerName,
  customerPhone,
  storePhone,
  status = "OUT_FOR_DELIVERY",
  isPickupPhase = false,
}: DeliveryMapModalProps) {
  const [currentLayer, setCurrentLayer] = useState<MapLayerType>("streets");
  const [roadPolyline, setRoadPolyline] = useState<[number, number][]>([]);
  const [roadDistanceKm, setRoadDistanceKm] = useState<number | null>(null);
  const [roadEtaMinutes, setRoadEtaMinutes] = useState<number | null>(null);
  const [recenterCount, setRecenterCount] = useState<number>(0);

  // Validate start and end coordinates
  const isValidStart =
    startLocation &&
    typeof startLocation.lat === "number" &&
    typeof startLocation.lng === "number" &&
    startLocation.lat > 5 &&
    startLocation.lng > 60;

  const isValidEnd =
    endLocation &&
    typeof endLocation.lat === "number" &&
    typeof endLocation.lng === "number" &&
    endLocation.lat > 5 &&
    endLocation.lng > 60;

  // Safe fallback coordinates anchored near Sakti (21.9588, 82.9588)
  const safeStart = useMemo(() => {
    if (isValidStart) return startLocation;
    if (isValidEnd) return { ...startLocation, lat: endLocation.lat - 0.005, lng: endLocation.lng - 0.005 };
    return { ...startLocation, lat: 21.9588, lng: 82.9588 };
  }, [isValidStart, isValidEnd, startLocation, endLocation]);

  const safeEnd = useMemo(() => {
    if (isValidEnd) return endLocation;
    if (isValidStart) return { ...endLocation, lat: startLocation.lat + 0.005, lng: startLocation.lng + 0.005 };
    return { ...endLocation, lat: 21.965, lng: 82.965 };
  }, [isValidEnd, isValidStart, endLocation, startLocation]);

  // Collect valid intermediate stops
  const validIntermediate = useMemo(() => {
    return intermediatePoints.filter(
      (p) => typeof p.lat === "number" && typeof p.lng === "number" && p.lat > 5 && p.lng > 60
    );
  }, [intermediatePoints]);

  // Points to fit inside map view
  const allFitPoints = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [
      [safeStart.lat, safeStart.lng],
      [safeEnd.lat, safeEnd.lng],
    ];
    validIntermediate.forEach((p) => pts.push([p.lat, p.lng]));
    return pts;
  }, [safeStart, safeEnd, validIntermediate]);

  const center = useMemo<[number, number]>(() => {
    return [(safeStart.lat + safeEnd.lat) / 2, (safeStart.lng + safeEnd.lng) / 2];
  }, [safeStart, safeEnd]);

  // Fallback Haversine straight-line distance
  const straightDistanceKm = useMemo(() => {
    return calculateHaversineKm(safeStart.lat, safeStart.lng, safeEnd.lat, safeEnd.lng);
  }, [safeStart, safeEnd]);

  // Fetch real road route geometry from OSRM
  useEffect(() => {
    let active = true;

    async function loadRoute() {
      const waypoints = [
        safeStart,
        ...validIntermediate,
        safeEnd,
      ];

      const res = await fetchRoadRoute(waypoints);
      if (active && res) {
        setRoadPolyline(res.coordinates);
        setRoadDistanceKm(res.distanceKm);
        setRoadEtaMinutes(res.durationMinutes);
      }
    }

    loadRoute();
    return () => {
      active = false;
    };
  }, [safeStart, safeEnd, validIntermediate]);

  // Full continuous road coordinates connected seamlessly from rider to destination
  const fullRouteCoordinates = useMemo<[number, number][]>(() => {
    if (roadPolyline.length < 2) {
      return [
        [safeStart.lat, safeStart.lng],
        [safeEnd.lat, safeEnd.lng],
      ];
    }
    const coords: [number, number][] = [[safeStart.lat, safeStart.lng]];
    for (const pt of roadPolyline) {
      coords.push(pt);
    }
    coords.push([safeEnd.lat, safeEnd.lng]);
    return coords;
  }, [roadPolyline, safeStart, safeEnd]);

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

  // 1. Custom 3D Scooter Rider Marker (Matching client reference)
  const riderDivIcon = useMemo(() => {
    return L.divIcon({
      className: "custom-scooter-rider",
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 56px; height: 56px; cursor: pointer;">
          <div style="position: absolute; width: 56px; height: 56px; border-radius: 9999px; background: radial-gradient(circle, rgba(16, 185, 129, 0.45) 0%, rgba(16, 185, 129, 0) 70%);"></div>
          <div style="position: relative; z-index: 10; width: 44px; height: 44px; background: linear-gradient(135deg, #10b981, #047857); border-radius: 9999px; display: flex; align-items: center; justify-content: center; border: 3px solid #ffffff; box-shadow: 0 4px 14px rgba(4, 120, 87, 0.5); font-size: 22px;">
            🛵
          </div>
        </div>
      `,
      iconSize: [56, 56],
      iconAnchor: [28, 28],
    });
  }, []);

  // 2. Custom Destination House Pin (Matching client reference)
  const homeDivIcon = useMemo(() => {
    return L.divIcon({
      className: "custom-home-pin",
      html: `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0 6px 12px rgba(16, 185, 129, 0.4)); cursor: pointer;">
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

  // 3. Custom Store Pickup Pin
  const storeDivIcon = useMemo(() => {
    return L.divIcon({
      className: "custom-store-pin",
      html: `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0 6px 12px rgba(245, 158, 11, 0.4)); cursor: pointer;">
          <div style="width: 44px; height: 44px; background: #ffffff; border-radius: 9999px; border: 3.5px solid #f59e0b; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.15); font-size: 20px;">
            🏪
          </div>
          <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 8px solid #f59e0b; margin-top: -1px;"></div>
          <div style="width: 6px; height: 6px; border-radius: 9999px; background: #f59e0b; margin-top: 1px;"></div>
        </div>
      `,
      iconSize: [44, 54],
      iconAnchor: [22, 54],
    });
  }, []);

  const displayDist = roadDistanceKm ?? straightDistanceKm;
  const displayEta = roadEtaMinutes ?? Math.max(2, Math.round((displayDist / 25) * 60));

  const fallbackMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${safeStart.lat},${safeStart.lng}&destination=${safeEnd.lat},${safeEnd.lng}&travelmode=driving`;
  const liveNavigationUrl = directionsUrl || fallbackMapsUrl;

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `Track Order #${orderNumber || "Vegamart"}`,
        text: `Live delivery route to ${safeEnd.label}`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Live route link copied to clipboard!");
    }
  };

  const handleRecenter = () => {
    setRecenterCount((prev) => prev + 1);
  };

  const activePhone = isPickupPhase ? storePhone : customerPhone;

  // Determine active step index (0: Confirmed, 1: Preparing, 2: Out for Delivery, 3: Delivered)
  const normStatus = (status || "").toUpperCase();
  let stepIndex = 2; // Default to Out for Delivery
  if (normStatus === "DELIVERED") {
    stepIndex = 3;
  } else if (normStatus === "CONFIRMED") {
    stepIndex = 0;
  } else if (normStatus === "PREPARING" || normStatus === "READY_FOR_PICKUP") {
    stepIndex = 1;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-full h-[94vh] sm:h-[86vh] flex flex-col p-0 overflow-hidden rounded-[28px] sm:rounded-[36px] border border-border shadow-2xl bg-card">
        {/* Top Header Bar (Emerald Green matching screenshot) */}
        <div className="bg-[#064e3b] text-white p-3.5 sm:px-5 flex items-center justify-between gap-3 shrink-0 shadow-md z-10">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => onOpenChange(false)}
              className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white grid place-items-center transition-colors shrink-0"
              title="Close"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <div className="h-9 w-9 rounded-full bg-white/15 text-white grid place-items-center text-lg shrink-0">
              🏪
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-display font-bold text-sm sm:text-base text-white truncate">
                  {storeName || "Vegamart Store"}
                </h3>
                <span className="h-4 w-4 rounded-full bg-emerald-400 text-[#064e3b] grid place-items-center text-[10px] font-black shrink-0">
                  ✓
                </span>
              </div>
              <p className="text-xs text-emerald-200/80 truncate">
                Order #{orderNumber || "VM-LIVE"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleShare}
              className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white grid place-items-center transition-colors"
              title="Share Tracking"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <a
              href={liveNavigationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-3 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
              title="Open Google Maps App"
            >
              <Navigation className="h-3.5 w-3.5 text-emerald-300" />
              <span className="hidden xs:inline">Google Maps</span>
            </a>
          </div>
        </div>

        {/* Map Body Area */}
        <div className="flex-1 min-h-[320px] bg-muted relative overflow-hidden">
          {/* Floating Top ETA Card (Exact replica of screenshot) */}
          <div className="absolute top-3.5 inset-x-3.5 sm:inset-x-5 z-[400] bg-white/95 dark:bg-card/95 backdrop-blur-md rounded-2xl p-3.5 shadow-xl border border-black/5 dark:border-white/10 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 grid place-items-center shrink-0">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Estimated delivery
                </p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                    {displayEta} min
                  </span>
                  <span className="text-muted-foreground/40 font-bold">|</span>
                  <span className="text-xs sm:text-sm font-bold text-muted-foreground">
                    {displayDist} km away
                  </span>
                </div>
              </div>
            </div>

            <div className="hidden xs:flex flex-col items-end">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Target
              </span>
              <span className="text-xs font-bold text-foreground max-w-[120px] truncate text-right">
                {safeEnd.label}
              </span>
            </div>
          </div>

          {/* Leaflet Map */}
          <MapContainer
            center={center}
            zoom={14}
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

            <MapBoundsController points={allFitPoints} recenterTrigger={recenterCount} />

            {/* Rider Position (Scooter Icon) */}
            <Marker position={[safeStart.lat, safeStart.lng]} icon={riderDivIcon}>
              <Popup>
                <div className="p-1 text-xs">
                  <strong className="block text-emerald-700 font-bold flex items-center gap-1">
                    <Bike className="h-3.5 w-3.5" /> Your Live Location
                  </strong>
                  <span className="text-muted-foreground text-[11px]">
                    Dispatch position on route
                  </span>
                </div>
              </Popup>
            </Marker>

            {/* Intermediate Multi-Vendor Store Stops */}
            {validIntermediate.map((stop, i) => (
              <Marker key={i} position={[stop.lat, stop.lng]} icon={storeDivIcon}>
                <Popup>
                  <div className="p-1 text-xs">
                    <strong className="block text-amber-700 font-bold flex items-center gap-1">
                      <Store className="h-3.5 w-3.5" /> Pickup Stop #{i + 1}
                    </strong>
                    <span className="text-foreground font-semibold">{stop.label}</span>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Destination Target (Home Pin or Store Pin) */}
            <Marker
              position={[safeEnd.lat, safeEnd.lng]}
              icon={isPickupPhase ? storeDivIcon : homeDivIcon}
            >
              <Popup>
                <div className="p-1 text-xs">
                  <strong
                    className={`block font-bold flex items-center gap-1 ${
                      isPickupPhase ? "text-amber-700" : "text-emerald-700"
                    }`}
                  >
                    {isPickupPhase ? (
                      <Store className="h-3.5 w-3.5" />
                    ) : (
                      <MapPin className="h-3.5 w-3.5" />
                    )}{" "}
                    {isPickupPhase ? "Merchant Pickup" : "Customer Doorstep"}
                  </strong>
                  <span className="text-foreground font-semibold block mt-0.5">{safeEnd.label}</span>
                  {safeEnd.address && (
                    <span className="text-muted-foreground text-[11px] block mt-0.5">
                      {safeEnd.address}
                    </span>
                  )}
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
                key={`modal-dir-arrow-${idx}`}
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

          {/* Floating Recenter Target Button ⌖ (Bottom Right of Map, matching screenshot) */}
          <button
            onClick={handleRecenter}
            className="absolute bottom-4 right-4 z-[400] h-11 w-11 rounded-full bg-white dark:bg-card text-foreground shadow-xl border border-black/10 dark:border-white/10 grid place-items-center hover:bg-muted active:scale-95 transition-all"
            title="Recenter Map View"
          >
            <LocateFixed className="h-5 w-5 text-emerald-600" />
          </button>

          {/* Satellite vs Street Map Layer Toggle (Bottom Left of Map) */}
          <MapLayerToggle
            currentLayer={currentLayer}
            onToggle={setCurrentLayer}
            className="bottom-4 left-4 shadow-xl"
          />
        </div>

        {/* Bottom Card / Sheet (Exact replica of screenshot) */}
        <div className="p-4 sm:p-5 bg-card border-t border-border shadow-2xl space-y-4 shrink-0 rounded-t-[28px] sm:rounded-b-[36px]">
          {/* Horizontal Progress Stepper */}
          <div className="px-2">
            <div className="relative flex items-center justify-between">
              {/* Stepper Connecting Background Line */}
              <div className="absolute top-4 inset-x-5 h-0.5 bg-muted -z-0" />
              {/* Stepper Active Filled Line */}
              <div
                className="absolute top-4 left-5 h-0.5 bg-emerald-500 transition-all duration-500 -z-0"
                style={{
                  width: `${(stepIndex / 3) * 88}%`,
                }}
              />

              {/* Step 1: Order Confirmed */}
              <div className="flex flex-col items-center relative z-10">
                <div
                  className={`h-8 w-8 rounded-full grid place-items-center font-bold text-xs transition-colors shadow-xs ${
                    stepIndex >= 0
                      ? "bg-emerald-500 text-white shadow-emerald-500/30"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Check className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-bold text-foreground mt-1.5 text-center leading-tight">
                  Order<br />Confirmed
                </span>
              </div>

              {/* Step 2: Preparing */}
              <div className="flex flex-col items-center relative z-10">
                <div
                  className={`h-8 w-8 rounded-full grid place-items-center font-bold text-xs transition-colors shadow-xs ${
                    stepIndex >= 1
                      ? "bg-emerald-500 text-white shadow-emerald-500/30"
                      : "bg-muted text-muted-foreground border border-border"
                  }`}
                >
                  <Check className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-bold text-foreground mt-1.5 text-center leading-tight">
                  Preparing
                </span>
              </div>

              {/* Step 3: Out for Delivery (Active in screenshot) */}
              <div className="flex flex-col items-center relative z-10">
                <div
                  className={`h-8 w-8 rounded-full grid place-items-center font-bold text-xs transition-colors shadow-xs ${
                    stepIndex >= 2
                      ? "bg-emerald-500 text-white ring-4 ring-emerald-500/25 shadow-emerald-500/40"
                      : "bg-muted text-muted-foreground border border-border"
                  }`}
                >
                  <Bike className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400 mt-1.5 text-center leading-tight">
                  Out for<br />Delivery
                </span>
              </div>

              {/* Step 4: Delivered */}
              <div className="flex flex-col items-center relative z-10">
                <div
                  className={`h-8 w-8 rounded-full grid place-items-center font-bold text-xs transition-colors shadow-xs ${
                    stepIndex >= 3
                      ? "bg-emerald-500 text-white"
                      : "bg-muted text-muted-foreground border border-border"
                  }`}
                >
                  <Package className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground mt-1.5 text-center leading-tight">
                  Delivered
                </span>
              </div>
            </div>
          </div>

          {/* Rider / Target Info Card with Call Button (Exact replica of screenshot) */}
          <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-muted/40 border border-border/60">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold shrink-0 shadow-xs text-xl">
                🛵
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-sm text-foreground truncate">
                  {isPickupPhase ? "Pick up from Store" : (customerName ? `Dropoff: ${customerName}` : "Rider is on the way")}
                </h4>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {safeEnd.address || "Your order is on the way to you"}
                </p>
              </div>
            </div>

            {/* Green Call Action Button */}
            {activePhone ? (
              <a
                href={`tel:${activePhone}`}
                className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500 text-white shadow-md hover:bg-emerald-600 active:scale-95 transition-all shrink-0"
                title="Call directly"
              >
                <Phone className="h-5 w-5" />
              </a>
            ) : (
              <a
                href={liveNavigationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500 text-white shadow-md hover:bg-emerald-600 active:scale-95 transition-all shrink-0"
                title="Open Navigation"
              >
                <Navigation className="h-5 w-5" />
              </a>
            )}
          </div>

          {/* Google Maps External Turn-by-Turn GPS Button */}
          <a
            href={liveNavigationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-11 rounded-2xl bg-[#064e3b] hover:bg-[#065f46] text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <Navigation className="h-4 w-4 text-emerald-300" />
            <span>Open in Google Maps (Voice GPS)</span>
            <ExternalLink className="h-3.5 w-3.5 opacity-80" />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
