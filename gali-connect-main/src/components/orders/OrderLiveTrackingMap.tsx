import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Phone, Navigation, ShieldCheck, RefreshCw, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

// Fix standard default icon assets if needed
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
  pickupLocations?: LocationPoint[];
  deliveryLocation?: LocationPoint | null;
  driverInfo?: DriverDetails | null;
  status?: string;
  etaMinutes?: number | null;
  lastUpdatedAt?: string | Date | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

// Helper to auto-fit map view to markers
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

// Calculate straight-line distance in km (Haversine formula)
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
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

export function OrderLiveTrackingMap({
  driverLocation,
  pickupLocations = [],
  deliveryLocation,
  driverInfo,
  status = "out_for_delivery",
  etaMinutes,
  lastUpdatedAt,
  onRefresh,
  isRefreshing,
}: OrderLiveTrackingMapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [recenterCounter, setRecenterCounter] = useState(0);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Filter valid points
  const validDriver = driverLocation && driverLocation.lat && driverLocation.lng ? driverLocation : null;
  const validDelivery = deliveryLocation && deliveryLocation.lat && deliveryLocation.lng ? deliveryLocation : null;
  const validPickups = pickupLocations.filter((p) => p && p.lat && p.lng);

  // Fallback center coordinates (e.g. Delhi NCR center if no coordinates available yet)
  const defaultCenter = useMemo<[number, number]>(() => {
    if (validDriver) return [validDriver.lat, validDriver.lng];
    if (validDelivery) return [validDelivery.lat, validDelivery.lng];
    if (validPickups.length > 0 && validPickups[0]) return [validPickups[0].lat, validPickups[0].lng];
    return [28.6139, 77.209];
  }, [validDriver, validDelivery, validPickups]);

  // Points for map bounds fitting
  const allPoints = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [];
    if (validDriver) pts.push([validDriver.lat, validDriver.lng]);
    if (validDelivery) pts.push([validDelivery.lat, validDelivery.lng]);
    validPickups.forEach((p) => pts.push([p.lat, p.lng]));
    return pts;
  }, [validDriver, validDelivery, validPickups]);

  // Route path coordinates (Driver -> Pickups -> Delivery Destination)
  const routePolyline = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [];
    if (validDriver) pts.push([validDriver.lat, validDriver.lng]);
    validPickups.forEach((p) => pts.push([p.lat, p.lng]));
    if (validDelivery) pts.push([validDelivery.lat, validDelivery.lng]);
    return pts;
  }, [validDriver, validPickups, validDelivery]);

  // Distance estimate between driver and customer
  const distanceKm = useMemo(() => {
    if (validDriver && validDelivery) {
      return calculateDistanceKm(validDriver.lat, validDriver.lng, validDelivery.lat, validDelivery.lng);
    }
    return null;
  }, [validDriver, validDelivery]);

  // Custom Div Icons for visual excellence
  const driverDivIcon = useMemo(() => {
    return L.divIcon({
      className: "driver-marker-pin",
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center;">
          <span style="position: absolute; width: 44px; height: 44px; border-radius: 9999px; background-color: rgba(16, 185, 129, 0.4); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
          <div style="position: relative; z-index: 10; width: 38px; height: 38px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 9999px; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3); border: 2px solid #ffffff; font-size: 18px;">
            🛵
          </div>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
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

  if (!isMounted) {
    return (
      <div className="rounded-3xl border bg-card overflow-hidden shadow-soft h-80 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="h-10 w-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
        <p className="text-xs font-bold text-muted-foreground">Initializing Live GPS Map…</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border bg-card overflow-hidden shadow-soft flex flex-col">
      {/* Top Header Bar */}
      <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-100 dark:border-emerald-900/40 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black text-emerald-950 dark:text-emerald-100">
                Live GPS Radar Active
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-extrabold text-[10px] uppercase tracking-wider">
                {validDriver ? "Rider Connected" : "Awaiting GPS Signal"}
              </span>
            </div>
            {distanceKm != null && (
              <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                Driver is approx. <span className="font-bold">{distanceKm} km</span> from delivery location
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="h-8 px-2.5 text-xs font-bold rounded-xl border-emerald-200 bg-white hover:bg-emerald-100 dark:bg-emerald-900/30 dark:border-emerald-800"
              title="Refresh GPS"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setRecenterCounter((c) => c + 1)}
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
        >
          <TileLayer
            attribution='&copy; <a href="https://www.google.com/maps">Google Maps</a>'
            url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          />

          <MapBoundsController points={allPoints} recenterTrigger={recenterCounter} />

          {/* Route Polyline (dashed navigation line) */}
          {routePolyline.length >= 2 && (
            <Polyline
              positions={routePolyline}
              color="#059669"
              weight={4}
              dashArray="6, 8"
              opacity={0.85}
            />
          )}

          {/* Driver Vehicle Pin */}
          {validDriver && (
            <Marker position={[validDriver.lat, validDriver.lng]} icon={driverDivIcon}>
              <Popup>
                <div className="p-1 space-y-1 text-xs">
                  <div className="font-black text-emerald-700 flex items-center gap-1">
                    🛵 {driverInfo?.name || "Delivery Partner"}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {driverInfo?.vehicle_type || "Vehicle"} {driverInfo?.vehicle_number ? `(${driverInfo.vehicle_number})` : ""}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Live GPS Broadcast</p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Store Pickup Pin(s) */}
          {validPickups.map((pickup, idx) => (
            <Marker key={idx} position={[pickup.lat, pickup.lng]} icon={storeDivIcon}>
              <Popup>
                <div className="p-1 space-y-0.5 text-xs">
                  <div className="font-bold text-amber-700 flex items-center gap-1">
                    🏪 {pickup.name || "Pickup Location"}
                  </div>
                  {pickup.address && (
                    <p className="text-[11px] text-muted-foreground max-w-[180px]">{pickup.address}</p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Customer Drop-off Pin */}
          {validDelivery && (
            <Marker position={[validDelivery.lat, validDelivery.lng]} icon={destinationDivIcon}>
              <Popup>
                <div className="p-1 space-y-0.5 text-xs">
                  <div className="font-bold text-rose-700 flex items-center gap-1">
                    🏠 Delivery Address
                  </div>
                  {validDelivery.address && (
                    <p className="text-[11px] text-muted-foreground max-w-[180px]">{validDelivery.address}</p>
                  )}
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>

        {/* Floating Signal Status Pill */}
        <div className="absolute bottom-3 left-3 z-[400] pointer-events-none">
          <div className="bg-card/95 backdrop-blur-md border border-border px-3 py-1.5 rounded-2xl shadow-lg flex items-center gap-2 text-xs font-semibold">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-foreground">
              {validDriver ? "Rider is en route" : "Waiting for rider location…"}
            </span>
            {etaMinutes != null && (
              <span className="text-muted-foreground font-normal">
                • ETA ~{etaMinutes} mins
              </span>
            )}
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
                <h4 className="text-sm font-black text-foreground">{driverInfo.name}</h4>
                <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                  <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                  {driverInfo.rating && driverInfo.rating > 0 ? driverInfo.rating.toFixed(1) : "5.0"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {driverInfo.vehicle_type || "Delivery Partner"}
                {driverInfo.vehicle_number ? ` • ${driverInfo.vehicle_number}` : ""}
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
