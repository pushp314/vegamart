import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
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
import { toast } from "sonner";

export interface RiderLiveNavigationProps {
  order: any;
  riderCoords: { lat: number; lng: number } | null;
  onUpdateStatus?: (status: string) => void;
  onOpenOtpModal?: () => void;
  className?: string;
  defaultFullscreen?: boolean;
}

// Controller to auto-fit map view or follow rider
function NavigationCameraController({
  allPoints,
  riderPosition,
  autoFollow,
  recenterCount,
}: {
  allPoints: [number, number][];
  riderPosition: [number, number] | null;
  autoFollow: boolean;
  recenterCount: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (autoFollow && riderPosition) {
      map.panTo(riderPosition, { animate: true });
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
  className = "",
  defaultFullscreen = false,
}: RiderLiveNavigationProps) {
  const [isFullscreen, setIsFullscreen] = useState(defaultFullscreen);
  const [currentLayer, setCurrentLayer] = useState<MapLayerType>("streets");
  const [route, setRoute] = useState<RoadRoute | null>(null);
  const [autoFollow, setAutoFollow] = useState(false);
  const [recenterCount, setRecenterCount] = useState(0);

  // Extract vendors list (supports multi-store master orders)
  const vendorList: any[] = useMemo(() => {
    if (order?.sub_orders && order.sub_orders.length > 0) {
      return order.sub_orders
        .map((so: any) => so.vendor)
        .filter(Boolean);
    }
    if (order?.vendor) return [order.vendor];
    return [];
  }, [order]);

  const firstVendor = vendorList[0];
  const vLat = Number(firstVendor?.latitude || firstVendor?.lat || 0);
  const vLng = Number(firstVendor?.longitude || firstVendor?.lng || 0);

  const cLat = Number(order?.address?.latitude || order?.delivery_address?.latitude || 0);
  const cLng = Number(order?.address?.longitude || order?.delivery_address?.longitude || 0);

  const isPickupPhase =
    order?.status === "CONFIRMED" ||
    order?.status === "READY_FOR_PICKUP" ||
    order?.status === "PREPARING";

  // Determine Origin (Rider live position or fallback to Sakti center)
  const origin = useMemo(() => {
    if (riderCoords && riderCoords.lat > 5 && riderCoords.lng > 60) {
      return riderCoords;
    }
    if (vLat > 5 && vLng > 60) {
      return { lat: vLat - 0.003, lng: vLng - 0.003 };
    }
    return { lat: 21.9588, lng: 82.9588 }; // Sakti center
  }, [riderCoords, vLat, vLng]);

  // Intermediate stops for multi-vendor pickups
  const intermediateStops = useMemo(() => {
    if (vendorList.length <= 1) return [];
    return vendorList.slice(1).map((v: any, idx: number) => ({
      lat: Number(v.latitude || v.lat),
      lng: Number(v.longitude || v.lng),
      label: v.business_name || `Merchant #${idx + 2}`,
    })).filter((p) => p.lat > 5 && p.lng > 60);
  }, [vendorList]);

  // Destination Target (Shop for pickup, or Customer for dropoff)
  const destination = useMemo(() => {
    if (isPickupPhase) {
      const lat = vLat > 5 ? vLat : origin.lat + 0.005;
      const lng = vLng > 60 ? vLng : origin.lng + 0.005;
      return {
        lat,
        lng,
        label: firstVendor?.business_name || "Merchant Store",
        address: firstVendor?.address || "",
        phone: firstVendor?.phone || "",
        type: "store" as const,
      };
    }

    const lat = cLat > 5 ? cLat : (vLat > 5 ? vLat + 0.006 : origin.lat + 0.006);
    const lng = cLng > 60 ? cLng : (vLng > 60 ? vLng + 0.006 : origin.lng + 0.006);
    return {
      lat,
      lng,
      label: order?.user?.name || order?.customer?.name || "Customer",
      address: order?.address?.full_address || order?.address?.line1 || "Customer Doorstep",
      phone: order?.user?.phone || order?.customer?.phone || order?.address?.phone || "",
      type: "customer" as const,
    };
  }, [isPickupPhase, vLat, vLng, cLat, cLng, origin, firstVendor, order]);

  // Calculate real road route along street network
  useEffect(() => {
    let active = true;

    async function loadRoute() {
      const waypoints = [
        origin,
        ...intermediateStops,
        { lat: destination.lat, lng: destination.lng },
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

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=driving`;

  return (
    <div
      className={`relative rounded-3xl overflow-hidden border border-border shadow-lg bg-card transition-all ${
        isFullscreen
          ? "fixed inset-0 z-50 rounded-none border-none h-screen w-screen flex flex-col"
          : `h-[380px] sm:h-[420px] ${className}`
      }`}
    >
      {/* 🧭 Turn-by-Turn Maneuver HUD Banner (Top of Map, matching Google Maps/Blinkit) */}
      <div className="absolute top-3 inset-x-3 sm:inset-x-4 z-[400] bg-[#064e3b] text-white rounded-2xl p-3 sm:p-3.5 shadow-2xl border border-white/10 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-11 w-11 rounded-xl bg-white/15 grid place-items-center shrink-0 border border-white/20 shadow-xs">
            {getManeuverIcon(nextStep)}
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 flex items-center gap-1">
              {isPickupPhase ? "Pickup Navigation" : "Doorstep Dropoff"} • {displayDist}
            </span>
            <h4 className="font-bold text-sm text-white truncate leading-tight mt-0.5">
              {nextStep?.instruction || `Head towards ${destination.label}`}
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <span className="text-lg font-black text-white leading-none block">
              {displayEta}
            </span>
            <span className="text-[10px] font-bold text-emerald-200 uppercase">ETA</span>
          </div>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="h-9 w-9 rounded-xl bg-white/10 hover:bg-white/20 text-white grid place-items-center transition-colors shrink-0"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Navigation"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* 🗺️ Leaflet Road Map Canvas */}
      <div className="flex-1 w-full h-full relative">
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

          {/* Road Network Polyline (Emerald route tracing exact streets and turns) */}
          {route && route.coordinates.length >= 2 && (
            <>
              {/* Outer soft glow */}
              <Polyline
                positions={route.coordinates}
                color="#10b981"
                weight={10}
                opacity={0.25}
                lineCap="round"
                lineJoin="round"
              />
              {/* Core road line */}
              <Polyline
                positions={route.coordinates}
                color="#059669"
                weight={5}
                opacity={0.95}
                lineCap="round"
                lineJoin="round"
              />
            </>
          )}
        </MapContainer>

        {/* ⌖ Floating Recenter / Auto-Follow Button */}
        <button
          onClick={() => {
            setAutoFollow(true);
            setRecenterCount((c) => c + 1);
            toast.success("Locked camera onto your GPS location ⌖");
          }}
          className={`absolute bottom-4 right-4 z-[400] h-11 w-11 rounded-full shadow-xl border border-black/10 dark:border-white/10 grid place-items-center active:scale-95 transition-all ${
            autoFollow
              ? "bg-emerald-600 text-white"
              : "bg-white dark:bg-card text-foreground hover:bg-muted"
          }`}
          title="Recenter & follow rider"
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

      {/* 📱 Bottom Navigation Action Footer (Directly inside Rider App) */}
      <div className="p-3 sm:p-4 bg-card/95 backdrop-blur-md border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 z-10">
        <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 grid place-items-center shrink-0">
            {isPickupPhase ? <Store className="h-5 w-5" /> : <MapPin className="h-5 w-5 text-emerald-600" />}
          </div>
          <div className="min-w-0 flex-1">
            <h5 className="font-bold text-xs text-foreground truncate">
              {destination.label}
            </h5>
            <p className="text-[11px] text-muted-foreground truncate">
              {destination.address}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* 1-Tap Direct Call */}
          {destination.phone && (
            <a
              href={`tel:${destination.phone}`}
              className="h-10 px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors shrink-0"
              title={`Call ${destination.label}`}
            >
              <Phone className="h-3.5 w-3.5" /> Call
            </a>
          )}

          {/* Quick External Google Maps Backup (Client requested Google Maps should still be available) */}
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-10 px-3.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shrink-0"
            title="Open Turn-by-Turn Voice GPS in Google Maps"
          >
            <Navigation className="h-3.5 w-3.5 text-blue-600" />
            <span className="hidden sm:inline">Google Maps</span>
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>

          {/* In-App Delivery Workflow Action */}
          {isPickupPhase ? (
            <button
              onClick={() => onUpdateStatus?.("out_for_delivery")}
              className="flex-1 sm:flex-none h-10 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition-colors"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Confirm Pickup
            </button>
          ) : (
            <button
              onClick={onOpenOtpModal}
              className="flex-1 sm:flex-none h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition-colors"
            >
              <Package className="h-3.5 w-3.5" /> Enter Delivery OTP
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
