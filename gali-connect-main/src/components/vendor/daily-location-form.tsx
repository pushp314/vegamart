import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Navigation, Clock, Trash2, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  getMyDailyLocation,
  upsertDailyLocation,
  removeDailyLocation,
  type UpsertDailyLocationPayload,
  type DailyLocationData,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface DailyLocationFormProps {
  vendorProfile: { id: string; business_name: string; roaming: boolean };
}

export function DailyLocationForm({ vendorProfile }: DailyLocationFormProps) {
  const queryClient = useQueryClient();
  const [isLocating, setIsLocating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["myDailyLocation"],
    queryFn: () => getMyDailyLocation(),
  });

  const existing: DailyLocationData | null = data?.data?.location ?? null;

  const [form, setForm] = useState<UpsertDailyLocationPayload>({
    area: "",
    landmark: "",
    address: "",
    latitude: 0,
    longitude: 0,
    start_time: "",
    end_time: "",
    notes: "",
    is_active: true,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        area: existing.area || "",
        landmark: existing.landmark || "",
        address: existing.address || "",
        latitude: existing.latitude || 0,
        longitude: existing.longitude || 0,
        start_time: existing.start_time || "",
        end_time: existing.end_time || "",
        notes: existing.notes || "",
        is_active: existing.is_active,
      });
    }
  }, [existing]);

  const upsertMutation = useMutation({
    mutationFn: (payload: UpsertDailyLocationPayload) => upsertDailyLocation(payload),
    onSuccess: () => {
      toast.success("Today's location updated!");
      queryClient.invalidateQueries({ queryKey: ["myDailyLocation"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update location");
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => removeDailyLocation(),
    onSuccess: () => {
      toast.success("Today's location removed.");
      queryClient.invalidateQueries({ queryKey: ["myDailyLocation"] });
      setForm({
        area: "",
        landmark: "",
        address: "",
        latitude: 0,
        longitude: 0,
        start_time: "",
        end_time: "",
        notes: "",
        is_active: true,
      });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to remove location");
    },
  });

  const handleUseCurrentLocation = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          latitude: Math.round(pos.coords.latitude * 10000) / 10000,
          longitude: Math.round(pos.coords.longitude * 10000) / 10000,
        }));
        setIsLocating(false);
        toast.success("Current location captured!");
      },
      () => {
        setIsLocating(false);
        toast.error("Unable to retrieve your location. Please enter coordinates manually.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.area.trim()) {
      toast.error("Area is required.");
      return;
    }
    if (!form.address.trim()) {
      toast.error("Address is required.");
      return;
    }
    if (!form.latitude || !form.longitude) {
      toast.error("Latitude and longitude are required.");
      return;
    }
    upsertMutation.mutate(form);
  };

  if (!vendorProfile.roaming) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <MapPin className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Daily location broadcasting is available for roaming vendors only.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-display">Today's Location</CardTitle>
          {existing && (
            <Badge variant={existing.is_active ? "default" : "secondary"}>
              {existing.is_active ? "Active" : "Inactive"}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Set your selling location for today. Customers will see this on the map.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Area */}
            <div className="space-y-1.5">
              <Label htmlFor="area" className="text-xs font-medium">
                Area / Neighborhood *
              </Label>
              <Input
                id="area"
                placeholder="e.g. Koramangala 4th Block"
                value={form.area}
                onChange={(e) => setForm((prev) => ({ ...prev, area: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>

            {/* Landmark */}
            <div className="space-y-1.5">
              <Label htmlFor="landmark" className="text-xs font-medium">
                Landmark
              </Label>
              <Input
                id="landmark"
                placeholder="e.g. Near Jyoti Nivas College"
                value={form.landmark || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, landmark: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <Label htmlFor="address" className="text-xs font-medium">
                Full Address *
              </Label>
              <Textarea
                id="address"
                placeholder="Enter your selling address"
                rows={2}
                value={form.address}
                onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                className="text-sm resize-none"
              />
            </div>

            {/* Coordinates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="latitude" className="text-xs font-medium">
                  Latitude *
                </Label>
                <Input
                  id="latitude"
                  type="number"
                  step="0.0001"
                  min="-90"
                  max="90"
                  placeholder="12.9716"
                  value={form.latitude || ""}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, latitude: parseFloat(e.target.value) || 0 }))
                  }
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="longitude" className="text-xs font-medium">
                  Longitude *
                </Label>
                <Input
                  id="longitude"
                  type="number"
                  step="0.0001"
                  min="-180"
                  max="180"
                  placeholder="77.5946"
                  value={form.longitude || ""}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, longitude: parseFloat(e.target.value) || 0 }))
                  }
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {/* Use Current Location */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUseCurrentLocation}
              disabled={isLocating}
              className="w-full"
            >
              {isLocating ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Navigation className="mr-2 h-3.5 w-3.5" />
              )}
              Use Current Location
            </Button>

            {/* Time Range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="start_time" className="text-xs font-medium">
                  Start Time
                </Label>
                <Input
                  id="start_time"
                  type="time"
                  value={form.start_time || ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, start_time: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end_time" className="text-xs font-medium">
                  End Time
                </Label>
                <Input
                  id="end_time"
                  type="time"
                  value={form.end_time || ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, end_time: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs font-medium">
                Notes
              </Label>
              <Textarea
                id="notes"
                placeholder="e.g. Near the bus stop, look for the blue cart"
                rows={2}
                value={form.notes || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                className="text-sm resize-none"
              />
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Active Today</Label>
                <p className="text-xs text-muted-foreground">
                  {form.is_active
                    ? "Customers can see your location"
                    : "Your location is hidden from customers"}
                </p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_active: checked }))}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={upsertMutation.isPending} className="flex-1">
                {upsertMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {existing ? "Update Location" : "Publish Location"}
              </Button>
              {existing && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={() => removeMutation.mutate()}
                  disabled={removeMutation.isPending}
                >
                  {removeMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>

            {/* Last Updated */}
            {existing && (
              <p className="text-center text-[11px] text-muted-foreground">
                Last updated: {new Date(existing.updated_at).toLocaleString()}
              </p>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
