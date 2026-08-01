import { Link } from "@tanstack/react-router";
import { Star, Clock, MapPin } from "lucide-react";
import type { Vendor } from "@/types";
import { useState, useEffect } from "react";
import { calculateDistance, formatDistance } from "@/lib/utils/distance";

export function VendorCard({ vendor, index }: { vendor: Vendor; index?: number }) {
  const profile = vendor.profile || ({} as any);
  const image = profile.logo_url || "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=600&fit=crop";
  const name = vendor.business_name;
  const rating = profile.rating || 0;
  const isOpen = profile.is_open || false;
  
  let tags = ["Local vendor"];
  if (profile.tags) {
    try { tags = JSON.parse(profile.tags); } catch(e) {}
  }
  
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}, // silently fail — we'll just hide the distance
        { maximumAge: 300000, timeout: 5000 }
      );
    }
  }, []);

  const vendorLat = profile.latitude;
  const vendorLng = profile.longitude;

  let distanceText = "";
  let etaMin = 15;
  if (userLocation && vendorLat && vendorLng) {
    const km = calculateDistance(userLocation.lat, userLocation.lng, vendorLat, vendorLng);
    distanceText = formatDistance(km);
    // Rough ETA: assume 20km/h average speed for delivery
    etaMin = Math.max(5, Math.round((km / 20) * 60));
  }

  return (
    <Link
      to="/vendors/$vendorId"
      params={{ vendorId: vendor.id }}
      className="group block overflow-hidden rounded-xl sm:rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:shadow-soft"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <img
          src={image}
          alt={name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {typeof index === "number" && (
          <div className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 font-display text-[10px] font-semibold tracking-wider text-foreground">
            {String(index + 1).padStart(2, "0")}
          </div>
        )}
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-background/90 px-1.5 py-0.5 text-[10px] font-semibold">
          <span
            className={`h-1.5 w-1.5 rounded-full ${isOpen ? "bg-brand" : "bg-muted-foreground"}`}
          />
          {isOpen ? "Open" : "Closed"}
        </div>
      </div>
      <div className="p-2.5 sm:p-3.5">
        <div className="flex items-start justify-between gap-1.5">
          <h3 className="font-display text-sm sm:text-base font-semibold leading-tight truncate">
            {name}
          </h3>
          <div className="flex shrink-0 items-center gap-0.5 text-xs font-semibold">
            <Star className="h-3 w-3 fill-foreground text-foreground" />
            {rating}
          </div>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <MapPin className="h-3 w-3" />
            {distanceText || "Nearby"}
          </span>
          <span className="h-0.5 w-0.5 rounded-full bg-border" />
          <span className="flex items-center gap-0.5">
            <Clock className="h-3 w-3" />
            {etaMin}m
          </span>
        </div>
        <div className="mt-2 hidden sm:flex flex-wrap gap-1">
          {tags.slice(0, 2).map((t: string) => (
            <span
              key={t}
              className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
