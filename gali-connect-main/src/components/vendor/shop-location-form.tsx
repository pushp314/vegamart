import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from "react-leaflet";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

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
  vendorProfile: {
    id: string;
    latitude?: number;
    longitude?: number;
    delivery_radius_km?: number;
  };
}

function LocationMarker({
  position,
  setPosition,
}: {
  position: L.LatLng | null;
  setPosition: (p: L.LatLng) => void;
}) {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  return position === null ? null : <Marker position={position}></Marker>;
}

export function ShopLocationForm({ vendorProfile }: ShopLocationFormProps) {
  const queryClient = useQueryClient();
  const [position, setPosition] = useState<L.LatLng | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(5);

  useEffect(() => {
    if (vendorProfile.latitude && vendorProfile.longitude) {
      setPosition(new L.LatLng(vendorProfile.latitude, vendorProfile.longitude));
    }
    if (vendorProfile.delivery_radius_km) {
      setRadiusKm(vendorProfile.delivery_radius_km);
    }
  }, [vendorProfile]);

  const updateMutation = useMutation({
    mutationFn: (data: { lat: number; lng: number; delivery_radius_km: number }) =>
      api.put("/vendors/me", {
        latitude: data.lat,
        longitude: data.lng,
        delivery_radius_km: data.delivery_radius_km,
      }),
    onSuccess: () => {
      toast.success("Shop location updated successfully");
      queryClient.invalidateQueries({ queryKey: ["vendorProfile"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update location");
    },
  });

  const handleSave = () => {
    if (!position) {
      toast.error("Please select a location on the map");
      return;
    }
    updateMutation.mutate({
      lat: position.lat,
      lng: position.lng,
      delivery_radius_km: radiusKm,
    });
  };

  const defaultCenter = position || new L.LatLng(12.9716, 77.5946); // Bangalore default

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-display">Shop Location & Service Area</CardTitle>
        <p className="text-xs text-muted-foreground">
          Pinpoint your shop on the map and define your delivery radius.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="h-[400px] rounded-lg overflow-hidden border border-border relative z-0">
          <MapContainer center={defaultCenter} zoom={13} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <LocationMarker position={position} setPosition={setPosition} />
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
              max="20"
              step="0.5"
              value={radiusKm}
              onChange={(e) => setRadiusKm(parseFloat(e.target.value))}
              className="flex-1"
            />
            <span className="text-sm font-bold w-12 text-right">{radiusKm} km</span>
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
          Save Location
        </Button>
      </CardContent>
    </Card>
  );
}
