import { MapPin, Clock, Navigation, StickyNote } from "lucide-react";
import type { DailyLocationData } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { calculateDistance, formatDistance } from "@/lib/utils/distance";
import { useState, useEffect } from "react";

interface VendorLocationCardProps {
  location: DailyLocationData;
  vendor: {
    business_name: string;
    category?: string | null;
    logo_url?: string | null;
    rating?: number;
    review_count?: number;
    is_verified?: boolean;
    roaming?: boolean;
  };
}

function formatTime12h(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function VendorLocationCard({ location, vendor }: VendorLocationCardProps) {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { maximumAge: 300000, timeout: 5000 },
      );
    }
  }, []);

  const distanceKm = userLocation
    ? calculateDistance(userLocation.lat, userLocation.lng, location.latitude, location.longitude)
    : null;

  const timeRange =
    location.start_time && location.end_time
      ? `${formatTime12h(location.start_time)} - ${formatTime12h(location.end_time)}`
      : null;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Status + Distance */}
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={location.is_active ? "default" : "secondary"} className="text-[10px]">
                {location.is_active ? "Active Now" : "Inactive"}
              </Badge>
              {distanceKm !== null && (
                <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                  <Navigation className="h-3 w-3" />
                  {formatDistance(distanceKm)}
                </span>
              )}
            </div>

            {/* Area */}
            <h4 className="font-display text-sm font-semibold leading-tight">{location.area}</h4>

            {/* Landmark */}
            {location.landmark && (
              <p className="mt-0.5 text-xs text-muted-foreground">{location.landmark}</p>
            )}

            {/* Address */}
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{location.address}</p>

            {/* Time Range */}
            {timeRange && (
              <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {timeRange}
              </div>
            )}

            {/* Notes */}
            {location.notes && (
              <div className="mt-2 flex items-start gap-1 text-[11px] text-muted-foreground">
                <StickyNote className="h-3 w-3 mt-0.5 shrink-0" />
                <span className="line-clamp-2">{location.notes}</span>
              </div>
            )}

            {/* Last Updated */}
            <p className="mt-2 text-[10px] text-muted-foreground">
              Updated {timeAgo(location.updated_at)}
            </p>
          </div>

          {/* Map Pin Icon */}
          <div className="shrink-0 rounded-full bg-primary/10 p-2">
            <MapPin className="h-4 w-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
