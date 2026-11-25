import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2, Save, Navigation, Search, MapPin } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { KNOWN_CITY_COORDS } from "@/hooks/use-location";
import { normalizeCityName } from "@/lib/deliverability";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MapLayerToggle } from "@/components/maps/MapLayerToggle";
import { MAP_LAYERS, type MapLayerType } from "@/components/maps/map-layers";

// Fix Leaflet icon issue
import L from "leaflet";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

interface ShopLocationFormProps {
  vendorProfile?: {
    id: string;
    latitude?: number;
    longitude?: number;
    delivery_radius_km?: number;
    city?: string;
    state?: string;
    pincode?: string;
    address?: string;
  };
}

function LocationMarker({
  position,
  onPick,
}: {
  position: L.LatLng | null;
  onPick: (p: L.LatLng) => void;
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng);
    },
  });

  return position === null ? null : <Marker position={position}></Marker>;
}

function MapUpdater({ center }: { center: L.LatLng }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, map.getZoom());
  }, [center, map]);
  return null;
}

export function ShopLocationForm({ vendorProfile }: ShopLocationFormProps) {
  const queryClient = useQueryClient();
  const [position, setPosition] = useState<L.LatLng | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [city, setCity] = useState<string>("");
  const [stateName, setStateName] = useState<string>("");
  const [pincode, setPincode] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [mapLink, setMapLink] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [currentLayer, setCurrentLayer] = useState<MapLayerType>("streets");

  const reverseGeocodePoint = async (lat: number, lng: number) => {
    try {
      const res = await api.get<any>(`/locations/reverse-geocode?lat=${lat}&lng=${lng}`);
      const geo = res?.data;
      if (geo?.city) setCity(geo.city);
      if (geo?.state) setStateName(geo.state);
      if (geo?.pincode) setPincode(geo.pincode);
      if (geo?.line1 && !address) {
        setAddress(`${geo.line1}${geo.line2 ? `, ${geo.line2}` : ""}`);
      }
    } catch {
      // ignore fallback errors
    }
  };

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setIsLocating(false);
        const newPos = new L.LatLng(pos.coords.latitude, pos.coords.longitude);
        setPosition(newPos);
        await reverseGeocodePoint(pos.coords.latitude, pos.coords.longitude);
        toast.success("Location & city detected via GPS");
      },
      () => {
        setIsLocating(false);
        toast.error("Unable to retrieve your location. Please check browser permissions.");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleParseMapLink = async () => {
    if (!mapLink.trim()) return;
    try {
      const trimmed = mapLink.trim();
      const coordMatch = trimmed.match(/([-+]?\d{1,2}\.\d+)[,\s]+([-+]?\d{1,3}\.\d+)/);
      const regexArray = [
        /@(-?\d+\.\d+),(-?\d+\.\d+)/,
        /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
        /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
      ];

      let lat: number | null = null;
      let lng: number | null = null;
      if (coordMatch && coordMatch[1] && coordMatch[2]) {
        lat = parseFloat(coordMatch[1]);
        lng = parseFloat(coordMatch[2]);
      } else {
        for (const regex of regexArray) {
          const match = trimmed.match(regex);
          if (match) {
            lat = parseFloat(match[1]);
            lng = parseFloat(match[2]);
            break;
          }
        }
      }

      if (lat && lng) {
        const newPos = new L.LatLng(lat, lng);
        setPosition(newPos);
        await reverseGeocodePoint(lat, lng);
        toast.success("Location & city extracted from link");
        setMapLink("");
      } else {
        toast.error("Could not find coordinates in this link. Try a different format or click directly on the map.");
      }
    } catch {
      toast.error("Invalid link format");
    }
  };

  useEffect(() => {
    if (!vendorProfile) return;
    if (vendorProfile.latitude && vendorProfile.longitude) {
      setPosition(new L.LatLng(vendorProfile.latitude, vendorProfile.longitude));
    }
    if (vendorProfile.delivery_radius_km) {
      setRadiusKm(vendorProfile.delivery_radius_km);
    }
    if (vendorProfile.city) setCity(vendorProfile.city);
    if (vendorProfile.state) setStateName(vendorProfile.state);
    if (vendorProfile.pincode) setPincode(vendorProfile.pincode);
    if (vendorProfile.address) setAddress(vendorProfile.address);
  }, [vendorProfile]);

  const updateMutation = useMutation({
    mutationFn: async (data: {
      lat: number;
      lng: number;
      delivery_radius_km: number;
      city?: string;
      state?: string;
      pincode?: string;
      address?: string;
    }) => {
      const payload: Record<string, unknown> = {
        latitude: data.lat,
        longitude: data.lng,
        lat: data.lat,
        lng: data.lng,
        delivery_radius_km: data.delivery_radius_km,
      };
      if (data.city?.trim()) payload.city = data.city.trim();
      if (data.state?.trim()) payload.state = data.state.trim();
      if (data.pincode?.trim()) payload.pincode = data.pincode.trim();
      if (data.address?.trim()) payload.address = data.address.trim();

      const res = await api.put("/vendors/me", payload);
      if (res.success) {
        return res.data;
      }

      const locRes = await api.put("/vendors/me/location", payload);
      if (locRes.success) {
        return locRes.data;
      }

      throw new Error(res.error?.message || locRes.error?.message || "Failed to save location");
    },
    onSuccess: () => {
      toast.success("Shop location & service city saved successfully");
      queryClient.invalidateQueries({ queryKey: ["vendorProfile"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["serviceableCities"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save location");
    },
  });

  const handleSave = () => {
    if (!position) {
      toast.error("Please select a location on the map");
      return;
    }
    if (!city.trim()) {
      toast.error("Please enter or detect your shop's city");
      return;
    }
    updateMutation.mutate({
      lat: position.lat,
      lng: position.lng,
      delivery_radius_km: radiusKm,
      city,
      state: stateName,
      pincode,
      address,
    });
  };

  const known = KNOWN_CITY_COORDS[normalizeCityName(city || vendorProfile?.city)];
  const defaultCenter =
    position ||
    (known ? new L.LatLng(known.lat, known.lng) : new L.LatLng(21.1938, 81.3509));

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg font-display">Shop Location & Service Area</CardTitle>
            <p className="text-xs text-muted-foreground">
              Pinpoint your shop on the map, verify your city, and set your delivery radius.
            </p>
          </div>
          {(city || vendorProfile?.city) && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 px-3 py-1 text-xs font-bold">
              <MapPin className="h-3.5 w-3.5" /> Live City: {city || vendorProfile?.city}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-col md:flex-row gap-3">
          <Button
            variant="outline"
            onClick={handleCurrentLocation}
            disabled={isLocating}
            className="flex-shrink-0"
          >
            {isLocating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Navigation className="mr-2 h-4 w-4" />}
            Current Location
          </Button>
          <div className="flex flex-1 gap-2">
            <Input
              placeholder="Paste Google Maps Link or coordinates..."
              value={mapLink}
              onChange={(e) => setMapLink(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleParseMapLink()}
            />
            <Button variant="secondary" onClick={handleParseMapLink}>
              <Search className="h-4 w-4 mr-2" /> Find
            </Button>
          </div>
        </div>

        <div className="h-[360px] rounded-lg overflow-hidden border border-border relative z-0">
          <MapContainer center={defaultCenter} zoom={13} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              key={currentLayer}
              attribution={MAP_LAYERS[currentLayer].attribution}
              url={MAP_LAYERS[currentLayer].url}
              subdomains={MAP_LAYERS[currentLayer].subdomains}
              maxZoom={19}
            />
            <LocationMarker
              position={position}
              onPick={(latlng) => {
                setPosition(latlng);
                void reverseGeocodePoint(latlng.lat, latlng.lng);
              }}
            />
            {position && <MapUpdater center={position} />}
            {position && (
              <Circle
                center={position}
                radius={radiusKm * 1000}
                pathOptions={{
                  fillColor: "var(--color-emerald-500)",
                  color: "var(--color-emerald-600)",
                }}
              />
            )}
          </MapContainer>

          <MapLayerToggle
            currentLayer={currentLayer}
            onToggle={setCurrentLayer}
            className="bottom-3 left-3 shadow-md"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label htmlFor="vendor-city" className="text-xs font-medium">
              City *
            </Label>
            <Input
              id="vendor-city"
              placeholder="e.g. Bhilai"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="vendor-state" className="text-xs font-medium">
              State
            </Label>
            <Input
              id="vendor-state"
              placeholder="e.g. Chhattisgarh"
              value={stateName}
              onChange={(e) => setStateName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="vendor-pincode" className="text-xs font-medium">
              Pincode
            </Label>
            <Input
              id="vendor-pincode"
              placeholder="e.g. 490020"
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="vendor-address" className="text-xs font-medium">
            Street Address / Landmark
          </Label>
          <Input
            id="vendor-address"
            placeholder="Shop No, Market, Street"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="radius" className="text-xs font-medium">
            Delivery Radius (km)
          </Label>
          <div className="flex items-center gap-4">
            <Input
              id="radius"
              type="range"
              min="1"
              max="30"
              step="0.5"
              value={radiusKm}
              onChange={(e) => setRadiusKm(parseFloat(e.target.value))}
              className="flex-1"
            />
            <span className="text-sm font-bold w-14 text-right">{radiusKm} km</span>
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          {updateMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Location & City
        </Button>
      </CardContent>
    </Card>
  );
}
