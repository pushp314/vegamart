import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { MapLayerToggle } from "@/components/maps/MapLayerToggle";
import { MAP_LAYERS, type MapLayerType } from "@/components/maps/map-layers";
import { Navigation, MapPin, Store, Bike, Clock, Compass, ExternalLink } from "lucide-react";
import L from "leaflet";

// Fix leaflet default icon assets
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

export interface IntermediateStop {
  lat: number;
  lng: number;
  label: string;
  type?: "store" | "customer";
}

interface DeliveryMapModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  startLocation: { lat: number; lng: number; label: string };
  endLocation: { lat: number; lng: number; label: string; address?: string };
  intermediatePoints?: IntermediateStop[];
  directionsUrl?: string | null;
}

// Controller to auto-fit map bounds tightly to valid local coordinates
function MapBoundsController({ points }: { points: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
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
      map.setView(valid[0], 15, { animate: true });
    } else {
      const bounds = L.latLngBounds(valid);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16, animate: true });
    }
  }, [map, points]);

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
}: DeliveryMapModalProps) {
  const [currentLayer, setCurrentLayer] = useState<MapLayerType>("streets");
  const [roadPolyline, setRoadPolyline] = useState<[number, number][]>([]);
  const [roadDistanceKm, setRoadDistanceKm] = useState<number | null>(null);
  const [roadEtaMinutes, setRoadEtaMinutes] = useState<number | null>(null);

  // Validate start and end coordinates (reject 0 or negative coordinates)
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

  // Safe fallback coordinates near Sakti (21.9588, 82.9588) if coordinates were missing
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

    async function fetchRoadRoute() {
      try {
        const waypoints = [
          `${safeStart.lng},${safeStart.lat}`,
          ...validIntermediate.map((p) => `${p.lng},${p.lat}`),
          `${safeEnd.lng},${safeEnd.lat}`,
        ].join(";");

        const url = `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });

        if (!res.ok) throw new Error("OSRM routing returned non-200");
        const data = await res.json();
        const route = data.routes?.[0];

        if (route?.geometry?.coordinates && Array.isArray(route.geometry.coordinates)) {
          // OSRM coordinates are [lon, lat], convert to Leaflet [lat, lon]
          const mapped: [number, number][] = route.geometry.coordinates.map(
            (c: [number, number]) => [c[1], c[0]]
          );
          if (active) {
            setRoadPolyline(mapped);
            if (typeof route.distance === "number") {
              setRoadDistanceKm(Math.round((route.distance / 1000) * 10) / 10);
            }
            if (typeof route.duration === "number") {
              setRoadEtaMinutes(Math.max(1, Math.round(route.duration / 60)));
            }
          }
        }
      } catch {
        if (active) {
          // Fallback to straight line connecting waypoints
          const straight: [number, number][] = [
            [safeStart.lat, safeStart.lng],
            ...validIntermediate.map((p): [number, number] => [p.lat, p.lng]),
            [safeEnd.lat, safeEnd.lng],
          ];
          setRoadPolyline(straight);
          setRoadDistanceKm(straightDistanceKm);
          setRoadEtaMinutes(Math.max(2, Math.round((straightDistanceKm / 25) * 60)));
        }
      }
    }

    fetchRoadRoute();
    return () => {
      active = false;
    };
  }, [safeStart, safeEnd, validIntermediate, straightDistanceKm]);

  // Custom Div Icons
  const riderDivIcon = useMemo(() => {
    return L.divIcon({
      className: "custom-rider-marker",
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px;">
          <span style="position: absolute; width: 44px; height: 44px; border-radius: 9999px; background-color: rgba(16, 185, 129, 0.3); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
          <div style="position: relative; z-index: 10; width: 36px; height: 36px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 9999px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.6); border: 2.5px solid #ffffff; font-size: 18px;">
            🛵
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });
  }, []);

  const storeDivIcon = useMemo(() => {
    return L.divIcon({
      className: "custom-store-marker",
      html: `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
          <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 9999px; box-shadow: 0 4px 14px rgba(245, 158, 11, 0.5); border: 2.5px solid #ffffff; display: flex; align-items: center; justify-content: center; font-size: 17px;">
            🏪
          </div>
          <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 6px solid #d97706; margin-top: -1px;"></div>
        </div>
      `,
      iconSize: [36, 42],
      iconAnchor: [18, 42],
    });
  }, []);

  const customerDivIcon = useMemo(() => {
    return L.divIcon({
      className: "custom-customer-marker",
      html: `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
          <div style="width: 38px; height: 38px; background: linear-gradient(135deg, #ef4444, #b91c1c); border-radius: 9999px; box-shadow: 0 4px 14px rgba(239, 68, 68, 0.5); border: 2.5px solid #ffffff; display: flex; align-items: center; justify-content: center; font-size: 18px;">
            📍
          </div>
          <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 6px solid #b91c1c; margin-top: -1px;"></div>
        </div>
      `,
      iconSize: [38, 44],
      iconAnchor: [19, 44],
    });
  }, []);

  const isStorePickup = title.toLowerCase().includes("store") || title.toLowerCase().includes("pickup");
  const displayDist = roadDistanceKm ?? straightDistanceKm;
  const displayEta = roadEtaMinutes ?? Math.max(2, Math.round((displayDist / 25) * 60));

  const fallbackMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${safeStart.lat},${safeStart.lng}&destination=${safeEnd.lat},${safeEnd.lng}&travelmode=driving`;
  const liveNavigationUrl = directionsUrl || fallbackMapsUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl w-[96vw] max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-3xl border border-border shadow-2xl bg-card">
        {/* Header */}
        <DialogHeader className="p-4 sm:px-6 border-b border-border bg-card/95 backdrop-blur-md flex flex-row items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                {isStorePickup ? <Store className="h-4 w-4" /> : <MapPin className="h-4 w-4 text-rose-600" />}
              </span>
              <DialogTitle className="text-base sm:text-lg font-black tracking-tight text-foreground truncate">
                {title}
              </DialogTitle>
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5 ml-8">
              To: <strong className="text-foreground">{safeEnd.label}</strong>
              {safeEnd.address ? ` · ${safeEnd.address}` : ""}
            </p>
          </div>

          {/* Quick Stats & Navigation CTA */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-2 text-xs font-bold bg-muted/80 px-3 py-1.5 rounded-xl border border-border">
              <span className="text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                <Compass className="h-3.5 w-3.5" /> {displayDist} km
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-foreground flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> ~{displayEta} mins
              </span>
            </div>

            <a
              href={liveNavigationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 rounded-xl shadow-xs transition-all shrink-0"
              title="Open full turn-by-turn navigation in Google Maps app"
            >
              <Navigation className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">Navigate</span>
              <ExternalLink className="h-3 w-3 opacity-80" />
            </a>
          </div>
        </DialogHeader>

        {/* Map Container */}
        <div className="flex-1 min-h-[380px] sm:min-h-[440px] bg-muted relative">
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

            {/* Auto-fit map bounds tightly to India/Sakti neighborhood */}
            <MapBoundsController points={allFitPoints} />

            {/* Rider Starting Position */}
            <Marker position={[safeStart.lat, safeStart.lng]} icon={riderDivIcon}>
              <Popup>
                <div className="p-1 text-xs">
                  <strong className="block text-emerald-700 text-sm font-bold flex items-center gap-1">
                    <Bike className="h-3.5 w-3.5" /> {safeStart.label}
                  </strong>
                  <span className="text-muted-foreground text-[11px]">
                    Current GPS Dispatch Position
                  </span>
                </div>
              </Popup>
            </Marker>

            {/* Intermediate Multi-Vendor Store Stops */}
            {validIntermediate.map((stop, i) => (
              <Marker key={i} position={[stop.lat, stop.lng]} icon={storeDivIcon}>
                <Popup>
                  <div className="p-1 text-xs">
                    <strong className="block text-amber-700 text-sm font-bold flex items-center gap-1">
                      <Store className="h-3.5 w-3.5" /> Pickup Stop #{i + 1}
                    </strong>
                    <span className="text-foreground font-semibold">{stop.label}</span>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Destination Target (Store or Customer) */}
            <Marker
              position={[safeEnd.lat, safeEnd.lng]}
              icon={isStorePickup ? storeDivIcon : customerDivIcon}
            >
              <Popup>
                <div className="p-1 text-xs">
                  <strong
                    className={`block text-sm font-bold flex items-center gap-1 ${
                      isStorePickup ? "text-amber-700" : "text-rose-700"
                    }`}
                  >
                    {isStorePickup ? (
                      <Store className="h-3.5 w-3.5" />
                    ) : (
                      <MapPin className="h-3.5 w-3.5" />
                    )}{" "}
                    {isStorePickup ? "Store Pickup" : "Customer Dropoff"}
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

            {/* Road Route Ahead (Vibrant Emerald Polyline) */}
            {roadPolyline.length >= 2 && (
              <Polyline
                positions={roadPolyline}
                color="#059669"
                weight={5}
                opacity={0.9}
                lineCap="round"
                lineJoin="round"
              />
            )}
          </MapContainer>

          {/* Map Layer Toggle (Satellite vs Street) */}
          <MapLayerToggle
            currentLayer={currentLayer}
            onToggle={setCurrentLayer}
            className="bottom-3 left-3 shadow-md"
          />

          {/* Floating Mobile Distance/ETA Pill */}
          <div className="sm:hidden absolute top-3 left-3 z-[400] bg-card/90 backdrop-blur-md border border-border px-3 py-1 rounded-full text-xs font-bold shadow-md flex items-center gap-1.5">
            <Compass className="h-3.5 w-3.5 text-emerald-600" />
            <span>{displayDist} km</span>
            <span className="text-muted-foreground">·</span>
            <span>~{displayEta} mins</span>
          </div>
        </div>

        {/* Footer Quick Action */}
        <div className="p-3 sm:p-4 bg-card border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-muted-foreground">
                Origin: <strong className="text-foreground">Your GPS Position</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
              <span className="text-muted-foreground">
                Target: <strong className="text-foreground">{safeEnd.label}</strong>
              </span>
            </div>
          </div>

          <a
            href={liveNavigationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-2xl shadow-sm transition-all"
          >
            <Navigation className="h-4 w-4" /> Start Turn-by-Turn GPS in Google Maps
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
