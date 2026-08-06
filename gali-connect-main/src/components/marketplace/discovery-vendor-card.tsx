import { memo, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  Star,
  MapPin,
  Footprints,
  Phone,
  Heart,
  BellRing,
  ChevronRight,
  Clock,
} from "lucide-react";
import type { DiscoveryVendor } from "@/lib/discovery";
import { colorForCategory, walkTimeMinutes, distanceFrom, relativeTime } from "@/lib/discovery";

interface DiscoveryVendorCardProps {
  vendor: DiscoveryVendor;
  userLocation?: { lat: number; lng: number } | null;
  isFavorited?: boolean;
  isFollowing?: boolean;
  onToggleFavorite?: (id: string) => void;
  onToggleFollow?: (id: string) => void;
  compact?: boolean;
}

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800&h=600&fit=crop";

export const DiscoveryVendorCard = memo(function DiscoveryVendorCard({
  vendor,
  userLocation,
  isFavorited,
  isFollowing,
  onToggleFavorite,
  onToggleFollow,
  compact,
}: DiscoveryVendorCardProps) {
  const distance = useMemo(() => {
    if (vendor.distance_km != null) return vendor.distance_km;
    if (userLocation && vendor.latitude != null && vendor.longitude != null) {
      return distanceFrom(userLocation.lat, userLocation.lng, vendor);
    }
    return null;
  }, [vendor, userLocation]);

  const walkMin = useMemo(() => walkTimeMinutes(distance ?? undefined), [distance]);
  const color = colorForCategory(vendor.category);
  const img = vendor.logo_url || vendor.banner_url || FALLBACK_IMG;
  const open = Boolean(vendor.is_open);
  const area = vendor.area || vendor.landmark || vendor.address;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      className="glass group relative overflow-hidden rounded-3xl shadow-soft transition-shadow hover:shadow-glow"
    >
      <div className="flex gap-3 p-3">
        {/* Photo */}
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-muted sm:h-28 sm:w-28">
          <img
            src={img}
            alt={vendor.business_name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
          {vendor.is_sponsored && (
            <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-md bg-rose-500 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-sm">
              <Star className="h-2.5 w-2.5 fill-white" /> Sponsored
            </span>
          )}
          {open && (
            <span
              className={`absolute left-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-black text-white shadow-sm ${
                vendor.is_sponsored ? "top-8" : "top-1.5"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> OPEN
            </span>
          )}
          {!open && (
            <span
              className={`absolute left-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-black text-white backdrop-blur-sm ${
                vendor.is_sponsored ? "top-8" : "top-1.5"
              }`}
            >
              CLOSED
            </span>
          )}
          <button
            type="button"
            aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleFavorite?.(vendor.id);
            }}
            className="absolute bottom-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-full bg-white/85 shadow-sm backdrop-blur transition hover:bg-white"
          >
            <motion.span
              key={String(isFavorited)}
              initial={{ scale: 0.4 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 14 }}
            >
              <Heart
                className={`h-4 w-4 ${isFavorited ? "fill-rose-500 text-rose-500" : "text-muted-foreground"}`}
              />
            </motion.span>
          </button>
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <h3 className="truncate font-display text-[15px] font-bold leading-tight">
                  {vendor.business_name}
                </h3>
                {vendor.is_verified && (
                  <BadgeCheck className="h-4 w-4 shrink-0 fill-sky-500 text-white" />
                )}
              </div>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
                <span className="capitalize">{vendor.category ?? "Local vendor"}</span>
                <span>•</span>
                <span className="capitalize">
                  {vendor.vendor_type === "roaming" ? "Street cart" : "Shop"}
                </span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-amber-100/80 px-1.5 py-0.5 text-[11px] font-black text-amber-700">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {vendor.rating > 0 ? vendor.rating.toFixed(1) : "New"}
              {vendor.review_count > 0 && (
                <span className="font-semibold text-amber-600">({vendor.review_count})</span>
              )}
            </div>
          </div>

          {/* location line */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            {distance != null && (
              <span className="inline-flex items-center gap-0.5 font-semibold text-foreground">
                <MapPin className="h-3 w-3 text-primary" />
                {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)} km`}
              </span>
            )}
            {walkMin != null && (
              <span className="inline-flex items-center gap-0.5">
                <Footprints className="h-3 w-3" />
                {walkMin} min walk
              </span>
            )}
            {area && (
              <span className="truncate max-w-full">
                {area}
                {vendor.landmark && vendor.landmark !== area ? ` · near ${vendor.landmark}` : ""}
              </span>
            )}
          </div>

          {/* open until / last updated */}
          <div className="mt-1.5 flex items-center gap-1.5 text-[10.5px] font-medium text-muted-foreground">
            {open &&
              (vendor.available_to ||
                (vendor.business_hours && vendor.business_hours.includes("–"))) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-emerald-700 ring-1 ring-emerald-200/60">
                  <Clock className="h-3 w-3" /> open till{" "}
                  {vendor.available_to ?? vendor.business_hours?.split("–")[1]?.trim() ?? "close"}
                </span>
              )}
            {vendor.vendor_type === "roaming" && vendor.updated_at && (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                updated {relativeTime(vendor.updated_at)}
              </span>
            )}
          </div>

          {/* actions */}
          <div className="mt-2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFollow?.(vendor.id);
              }}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[10.5px] font-bold transition-colors ${
                isFollowing
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground hover:bg-muted/70"
              }`}
            >
              <BellRing className="h-3 w-3" />
              {isFollowing ? "Following" : "Follow"}
            </button>
            {vendor.phone && (
              <a
                href={`tel:${vendor.phone}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1.5 text-[10.5px] font-bold text-foreground transition-colors hover:bg-muted/70"
              >
                <Phone className="h-3 w-3 text-emerald-600" /> Call
              </a>
            )}
            {!compact && (
              <Link
                to="/vendors/$vendorId"
                params={{ vendorId: vendor.id }}
                onClick={(e) => e.stopPropagation()}
                className="ml-auto inline-flex items-center gap-0.5 rounded-full bg-primary px-3 py-1.5 text-[10.5px] font-bold text-primary-foreground shadow-sm transition-transform hover:scale-[1.02]"
              >
                View shop <ChevronRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </motion.article>
  );
});
