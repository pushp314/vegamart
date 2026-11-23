import { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Store,
  MapPin,
  Navigation,
  Search,
  Save,
  X,
  AlertTriangle,
  Loader2,
  Sparkles,
  Layers,
  Compass,
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapLayerToggle } from "@/components/maps/MapLayerToggle";
import { MAP_LAYERS, type MapLayerType } from "@/components/maps/map-layers";

interface VendorStoreLocationModalProps {
  vendor: any;
  isOpen?: boolean;
  onClose?: () => void;
}

const DISMISSED_SESSION_KEY = "vegamart_vendor_location_modal_dismissed";

// Smooth pan controller
function PanController({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.panTo(position, { animate: true });
  }, [map, position]);
  return null;
}

// Draggable Store Marker with map click listener
function DraggableStorePin({
  position,
  onChange,
}: {
  position: [number, number];
  onChange: (pos: [number, number]) => void;
}) {
  const markerRef = useRef<L.Marker>(null);

  useMapEvents({
    click(e) {
      onChange([e.latlng.lat, e.latlng.lng]);
    },
  });

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const latLng = marker.getLatLng();
          onChange([latLng.lat, latLng.lng]);
        }
      },
    }),
    [onChange]
  );

  const storeIcon = useMemo(() => {
    return L.divIcon({
      className: "custom-store-pin",
      html: `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: grab;">
          <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #16a34a, #15803d); border-radius: 9999px; box-shadow: 0 4px 14px rgba(22, 163, 74, 0.6); border: 3px solid #ffffff; display: flex; align-items: center; justify-content: center; font-size: 22px;">
            🏪
          </div>
          <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 8px solid #15803d; margin-top: -1px;"></div>
        </div>
      `,
      iconSize: [44, 52],
      iconAnchor: [22, 52],
    });
  }, []);

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
      icon={storeIcon}
    />
  );
}

export function VendorStoreLocationModal({
  vendor,
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
}: VendorStoreLocationModalProps) {
  const queryClient = useQueryClient();

  const isPinned = Boolean(
    vendor?.latitude &&
      vendor?.longitude &&
      Number(vendor.latitude) > 5 &&
      Number(vendor.longitude) > 60
  );

  const [internalOpen, setInternalOpen] = useState(false);
  const [position, setPosition] = useState<[number, number]>(() => {
    if (isPinned) {
      return [Number(vendor.latitude), Number(vendor.longitude)];
    }
    // Default to Sakti, Chhattisgarh
    return [21.9588, 82.9588];
  });

  const [hasUserSelected, setHasUserSelected] = useState<boolean>(isPinned);
  const [radiusKm, setRadiusKm] = useState<number>(() => Number(vendor?.delivery_radius_km || 5));
  const [mapLink, setMapLink] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [currentLayer, setCurrentLayer] = useState<MapLayerType>("streets");

  useEffect(() => {
    if (isPinned) {
      setPosition([Number(vendor.latitude), Number(vendor.longitude)]);
      setHasUserSelected(true);
    }
    if (vendor?.delivery_radius_km) {
      setRadiusKm(Number(vendor.delivery_radius_km));
    }
  }, [vendor?.latitude, vendor?.longitude, vendor?.delivery_radius_km, isPinned]);

  useEffect(() => {
    // If not controlled, auto-open if location is not set and hasn't been dismissed in session
    if (controlledIsOpen === undefined) {
      const isDismissed = sessionStorage.getItem(DISMISSED_SESSION_KEY) === "true";
      if (!isPinned && !isDismissed) {
        setInternalOpen(true);
      } else {
        setInternalOpen(false);
      }
    }
  }, [controlledIsOpen, isPinned]);

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalOpen;

  const handleClose = () => {
    sessionStorage.setItem(DISMISSED_SESSION_KEY, "true");
    if (controlledOnClose) {
      controlledOnClose();
    } else {
      setInternalOpen(false);
    }
  };

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = Math.round(pos.coords.latitude * 1000000) / 1000000;
        const lng = Math.round(pos.coords.longitude * 1000000) / 1000000;
        setPosition([lat, lng]);
        setHasUserSelected(true);
        toast.success("Shop location detected via GPS! 📍");
      },
      (err) => {
        setIsLocating(false);
        toast.error("Unable to retrieve GPS location. Please check browser permissions or search on map.");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleParseMapLink = () => {
    if (!mapLink.trim()) return;
    const trimmed = mapLink.trim();

    // 1. Raw coordinates
    const coordMatch = trimmed.match(/([-+]?\d{1,2}\.\d+)[,\s]+([-+]?\d{1,3}\.\d+)/);
    if (coordMatch && coordMatch[1] && coordMatch[2]) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        setPosition([lat, lng]);
        setHasUserSelected(true);
        toast.success("Coordinates extracted from input! 🎯");
        setMapLink("");
        return;
      }
    }

    // 2. Google Maps URL regexes
    const regexArray = [
      /@(-?\d+\.\d+),(-?\d+\.\d+)/,
      /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
      /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
      /destination=(-?\d+\.\d+),(-?\d+\.\d+)/,
    ];

    for (const regex of regexArray) {
      const match = trimmed.match(regex);
      if (match && match[1] && match[2]) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        setPosition([lat, lng]);
        setHasUserSelected(true);
        toast.success("Store location extracted from Google Maps link! 🎯");
        setMapLink("");
        return;
      }
    }

    toast.error("Could not find coordinates in this link. Try copying direct coordinates or click directly on the map.");
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        lat: position[0],
        lng: position[1],
        latitude: position[0],
        longitude: position[1],
        delivery_radius_km: radiusKm,
      };

      // Try canonical /vendors/me first
      const res = await api.put<any>("/vendors/me", payload);
      if (res.success) {
        return res.data;
      }

      // Fallback to /vendors/me/location
      const locRes = await api.put<any>("/vendors/me/location", {
        lat: position[0],
        lng: position[1],
      });
      if (locRes.success) {
        return locRes.data;
      }

      throw new Error(res.error?.message || locRes.error?.message || "Failed to save shop location");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorProfile"] });
      toast.success("🎉 Store location saved! Delivery partners can now navigate to your shop for order pickups.");
      sessionStorage.removeItem(DISMISSED_SESSION_KEY);
      handleClose();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save shop location");
    },
  });

  const handleSave = () => {
    if (!hasUserSelected) {
      toast.error("Please click on your shop or use 'Detect Shop Location' first.");
      return;
    }
    saveMutation.mutate();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[92vh] flex flex-col rounded-3xl bg-card border border-border/80 shadow-2xl text-card-foreground animate-in zoom-in-95 duration-200 overflow-hidden">
        {/* Subtle accent bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-primary shrink-0" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-border/60 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 sm:h-11 sm:w-11 shrink-0 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs">
              <Store className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300 border border-amber-500/25">
                  <AlertTriangle className="h-3 w-3" /> Compulsory Store Setup
                </span>
                {isPinned && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    Currently Pinned
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-display font-bold text-foreground mt-0.5">
                Pin Your Store Location
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5 leading-tight">
                Delivery partners need this exact GPS location to pick up customer orders directly from your shop.
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="h-8 w-8 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground grid place-items-center transition-colors shrink-0"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* Quick Input Bar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={handleCurrentLocation}
              disabled={isLocating}
              className="h-10 px-3.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-bold text-xs flex items-center justify-center gap-2 transition-colors shrink-0 shadow-xs"
            >
              {isLocating ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <Navigation className="h-4 w-4 text-emerald-600" />
              )}
              <span>Detect Shop Location</span>
            </button>

            <div className="flex flex-1 gap-1.5">
              <input
                type="text"
                placeholder="Paste Google Maps link or coordinates..."
                value={mapLink}
                onChange={(e) => setMapLink(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleParseMapLink()}
                className="h-10 flex-1 rounded-xl border border-border bg-background px-3 text-xs placeholder:text-muted-foreground/70 focus:outline-hidden focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="button"
                onClick={handleParseMapLink}
                className="h-10 px-3.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0"
              >
                <Search className="h-3.5 w-3.5" /> Find
              </button>
            </div>
          </div>

          {/* Interactive Map */}
          <div className="relative h-[240px] sm:h-[280px] rounded-2xl overflow-hidden border border-border bg-muted shadow-inner">
            <MapContainer
              center={position}
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
              <PanController position={position} />
              <DraggableStorePin
                position={position}
                onChange={(newPos) => {
                  setPosition(newPos);
                  setHasUserSelected(true);
                }}
              />
              {hasUserSelected && (
                <Circle
                  center={position}
                  radius={radiusKm * 1000}
                  pathOptions={{
                    fillColor: "#10b981",
                    fillOpacity: 0.15,
                    color: "#059669",
                    weight: 2,
                  }}
                />
              )}
            </MapContainer>

            {/* Satellite / Road Layer Toggle */}
            <MapLayerToggle
              currentLayer={currentLayer}
              onToggle={setCurrentLayer}
              className="bottom-3 left-3 shadow-md"
            />

            {/* Hint overlay */}
            <div className="absolute top-2.5 right-2.5 pointer-events-none rounded-xl bg-background/90 backdrop-blur-sm border border-border/80 px-2.5 py-1 text-[10px] font-bold text-foreground shadow-sm">
              📍 Tap or drag pin to your shop
            </div>
          </div>

          {/* Coordinates status & Delivery Radius */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div className="rounded-xl bg-muted/40 p-2.5 border border-border/50 text-[11px]">
              <span className="font-semibold text-muted-foreground">Coordinates: </span>
              <span className="font-mono font-bold text-foreground">
                {position[0].toFixed(5)}, {position[1].toFixed(5)}
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-muted-foreground">Delivery Radius:</span>
                <span className="font-bold text-primary">{radiusKm} km</span>
              </div>
              <input
                type="range"
                min="1"
                max="20"
                step="0.5"
                value={radiusKm}
                onChange={(e) => setRadiusKm(parseFloat(e.target.value))}
                className="w-full accent-primary h-1.5 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-border/60 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] text-muted-foreground text-center sm:text-left">
            Once saved, delivery riders will be routed directly to this pin for pickups.
          </p>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 sm:flex-none h-10 px-4 rounded-xl border border-border bg-background hover:bg-muted text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              Remind Later
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saveMutation.isPending || !hasUserSelected}
              className="flex-1 sm:flex-none h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Store Location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
