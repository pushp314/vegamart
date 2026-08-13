import { createFileRoute, Link, notFound, useSearch } from "@tanstack/react-router";
import {
  Star,
  Clock,
  MapPin,
  Phone,
  Share2,
  Heart,
  ShieldCheck,
  ArrowLeft,
  Sparkles,
  Store,
  Radio,
  Bell,
  BellRing,
  Loader2,
  Navigation,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { api, authStorage, getVendorDailyLocation, type DailyLocationData } from "@/lib/api";
import type { Vendor, Product } from "@/types";
import { useCart } from "@/context/cart-context";
import { useLocation } from "@/hooks/use-location";
import { ProductCard } from "@/components/marketplace/product-card";
import { VendorLocationCard } from "@/components/vendor/vendor-location-card";
import { ReviewModal } from "@/components/marketplace/review-modal";
import { calculateDistance, formatDistance } from "@/lib/utils/distance";
import { toast } from "sonner";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
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

export const Route = createFileRoute("/vendors/$vendorId")({
  validateSearch: (search: Record<string, unknown>): { product?: string } => ({
    product: typeof search.product === "string" ? search.product : undefined,
  }),
  loader: async ({ params }) => {
    const res = await api.get<Vendor>(`/vendors/${params.vendorId}`);
    if (!res.success || !res.data) throw notFound();
    return { vendor: res.data };
  },
  head: ({ loaderData }) => {
    const vendor = loaderData?.vendor as any;
    const name = vendor?.business_name || "Vendor";
    const address = vendor?.address || vendor?.profile?.address || "";
    const cover =
      vendor?.banner_url ||
      vendor?.profile?.banner_url ||
      "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=600&fit=crop";
    return {
      meta: vendor
        ? [
            { title: `${name} — Vegamart` },
            { name: "description", content: `Order from ${name}. ${address}` },
            { property: "og:image", content: cover },
          ]
        : [{ title: "Vendor not found" }],
    };
  },
  component: VendorDetail,
});

function VendorDetail() {
  const { vendor } = Route.useLoaderData();
  const profile: any = vendor.profile || (vendor as any);
  const { addToCart } = useCart();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const { product: pinnedProductId } = useSearch({ from: "/vendors/$vendorId" });

  const toggleSubscriptionMutation = useMutation({
    mutationFn: async () => {
      if (!authStorage.getAccessToken()) throw new Error("Please login to subscribe");
      const res = await api.post<any>("/users/me/subscriptions", { vendor_id: vendor.id });
      if (!res.success) throw new Error(res.error?.message || "Failed to subscribe");
      return res.data;
    },
    onSuccess: (data: any) => {
      setIsSubscribed(data?.subscribed);
      if (data?.subscribed) {
        toast.success(
          `You will now receive notifications when ${vendor.business_name || "the vendor"} is nearby! 🔔`,
        );
      } else {
        toast.info(`Unsubscribed from ${vendor.business_name || "the vendor"}'s alerts.`);
      }
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  const handleNotifyMe = () => {
    toggleSubscriptionMutation.mutate();
  };

  const { data: productsRes, isLoading } = useQuery({
    queryKey: ["products", { vendor_id: vendor.id }],
    queryFn: () => api.get<Product[]>(`/products?vendor_id=${vendor.id}`),
  });

  const rawShowcase = productsRes?.data || [];

  const showcase = useMemo(() => {
    if (!pinnedProductId) return rawShowcase;
    const sorted = [...rawShowcase];
    const idx = sorted.findIndex((p) => p.id === pinnedProductId);
    if (idx <= 0) return sorted;
    const [pinned] = sorted.splice(idx, 1);
    return [pinned, ...sorted];
  }, [rawShowcase, pinnedProductId]);

  const coverUrl =
    profile.banner_url ||
    "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=600&fit=crop";
  const logoUrl = profile.logo_url || null;

  const lat = typeof profile.latitude === "number" ? profile.latitude : null;
  const lng = typeof profile.longitude === "number" ? profile.longitude : null;

  const { activeAddress } = useLocation();
  const distanceKm =
    lat != null && lng != null && activeAddress?.latitude && activeAddress?.longitude
      ? calculateDistance(activeAddress.latitude, activeAddress.longitude, lat, lng)
      : null;

  const ownerName = profile.owner_name || vendor.business_name || "Verified Merchant";
  const phone = profile.phone || (vendor as any).phone || null;
  const isRoaming =
    profile.vendor_type === "roaming" || profile.roaming === true || profile.roaming === "true";

  // Fetch daily location for this vendor (must be after isRoaming declaration)
  const { data: dailyLocRes } = useQuery({
    queryKey: ["vendorDailyLocation", vendor.id],
    queryFn: () => getVendorDailyLocation(vendor.id),
    enabled: isRoaming,
  });

  const dailyLocation: DailyLocationData | null = dailyLocRes?.data?.location ?? null;

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Store link copied to clipboard!");
    } else {
      toast.info("Share URL: " + window.location.href);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-28 md:pb-16">
      {/* Hero Cover Banner */}
      <div className="relative h-60 sm:h-72 lg:h-80 overflow-hidden">
        <img src={coverUrl} alt={vendor.business_name} className="h-full w-full object-cover" />
        {/* Dark Overlay for High Contrast Text */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        {/* Top Controls */}
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
          <Link
            to="/vendors"
            aria-label="Back"
            className="grid h-10 w-10 place-items-center rounded-full bg-background/80 backdrop-blur-md shadow-md text-foreground hover:bg-background transition-all"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex gap-2">
            <button
              onClick={handleShare}
              aria-label="Share Store"
              className="grid h-10 w-10 place-items-center rounded-full bg-background/80 backdrop-blur-md shadow-md text-foreground hover:bg-background transition-all"
            >
              <Share2 className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Live Status Badge */}
        <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/90 backdrop-blur-md px-3 py-1 text-xs font-black text-white shadow-md">
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
            {isRoaming ? "🟢 LIVE ROAMING CART" : "🟢 STORE OPEN NOW"}
          </span>
        </div>
      </div>

      {/* Main Vendor Header Card */}
      <main className="mx-auto max-w-6xl px-4 md:px-6 lg:px-8 relative -mt-16 z-20 space-y-6">
        <section className="rounded-3xl bg-card border p-6 md:p-8 shadow-xl space-y-5">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={vendor.business_name}
                  className="h-20 w-20 md:h-24 md:w-24 rounded-2xl object-cover ring-4 ring-background shadow-md shrink-0"
                />
              ) : (
                <span className="grid h-20 w-20 md:h-24 md:w-24 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 ring-4 ring-background shadow-md">
                  <Store className="h-9 w-9" />
                </span>
              )}
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl md:text-3xl font-black tracking-tight text-foreground">
                    {vendor.business_name}
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-xs font-extrabold px-2.5 py-0.5">
                    <ShieldCheck className="h-3.5 w-3.5" /> Verified
                  </span>
                </div>

                <p className="text-xs text-muted-foreground font-semibold">
                  By <strong className="text-foreground">{ownerName}</strong> •{" "}
                  {profile.category || "Fresh Produce & Grocery"}
                </p>

                <div className="flex flex-wrap items-center gap-3 text-xs pt-1">
                  <button
                    onClick={() => setReviewOpen(true)}
                    className="inline-flex items-center gap-1 font-bold text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition-colors cursor-pointer"
                  >
                    <Star className="h-3.5 w-3.5 fill-amber-400" />
                    {typeof profile.rating === "number"
                      ? profile.rating.toFixed(1)
                      : profile.rating || "0.0"}
                    <span className="text-muted-foreground font-normal ml-0.5">
                      ({profile.review_count ?? 0})
                    </span>
                  </button>

                  <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                    <MapPin className="h-3.5 w-3.5" /> 1.2 km away
                  </span>

                  <span className="inline-flex items-center gap-1 text-muted-foreground font-medium">
                    <Clock className="h-3.5 w-3.5" /> ~15 min delivery
                  </span>
                </div>
              </div>
            </div>

            {/* Direct Action CTAs */}
            <div className="flex items-center gap-2.5 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-border">
              {phone ? (
                <a
                  href={`tel:${phone}`}
                  className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 rounded-2xl border bg-muted hover:bg-muted/80 text-foreground font-bold text-xs h-11 px-5 transition-colors"
                >
                  <Phone className="h-4 w-4 text-emerald-600" /> Call Store
                </a>
              ) : (
                <span className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 rounded-2xl border bg-muted/50 text-muted-foreground font-bold text-xs h-11 px-5 cursor-not-allowed opacity-60">
                  <Phone className="h-4 w-4" /> No Phone
                </span>
              )}
              <button
                onClick={handleNotifyMe}
                disabled={toggleSubscriptionMutation.isPending}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                  isSubscribed
                    ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                    : "bg-white text-foreground border-border hover:bg-muted"
                }`}
              >
                {toggleSubscriptionMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isSubscribed ? (
                  <>
                    <BellRing className="h-4 w-4 text-amber-600 animate-pulse" /> Subscribed
                  </>
                ) : (
                  <>
                    <Bell className="h-4 w-4" /> Notify Me
                  </>
                )}
              </button>
              <button
                onClick={handleShare}
                className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground font-bold text-xs h-11 px-6 shadow-md hover:bg-primary/90 transition-colors"
              >
                <Share2 className="h-4 w-4" /> Share Store
              </button>
            </div>
          </div>

          {/* Address & Operational Info */}
          {profile.address && (
            <div className="rounded-2xl bg-muted/60 p-3.5 text-xs text-muted-foreground flex items-center gap-2 border">
              <MapPin className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="font-semibold text-foreground truncate">{profile.address}</span>
            </div>
          )}
        </section>

        {/* Shop Location on Map */}
        {!isRoaming && lat != null && lng != null && (
          <section className="rounded-3xl bg-card border p-5 md:p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-emerald-600" />
              <h2 className="font-display text-lg font-bold text-foreground">Shop location</h2>
              {typeof distanceKm === "number" && (
                <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                  <Navigation className="h-3.5 w-3.5 text-emerald-600" />{" "}
                  {formatDistanceLabel(distanceKm)} away
                </span>
              )}
            </div>
            <div className="h-[240px] md:h-[300px] overflow-hidden rounded-2xl border relative z-0">
              <MapContainer
                center={[lat, lng]}
                zoom={15}
                scrollWheelZoom={false}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.google.com/maps">Google Maps</a>'
                  url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                />
                <Marker position={[lat, lng]}>
                  <Popup>
                    <div className="text-xs font-semibold">{vendor.business_name}</div>
                    <div className="text-[11px] text-muted-foreground">{profile.address}</div>
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
            >
              <Navigation className="h-3.5 w-3.5" /> Get directions
            </a>
          </section>
        )}

        {/* Today's Location (for roaming vendors with active daily location) */}
        {isRoaming && dailyLocation && dailyLocation.is_active && (
          <VendorLocationCard
            location={dailyLocation}
            vendor={{
              business_name: vendor.business_name,
              category: profile.category,
              logo_url: profile.logo_url,
              rating: profile.rating,
              review_count: profile.review_count,
              is_verified: vendor.is_verified,
              roaming: true,
            }}
          />
        )}

        {/* Available Products Catalog */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-black text-foreground flex items-center gap-2">
              <Store className="h-5 w-5 text-emerald-600" /> Available Catalog & Menu
            </h2>
            <span className="text-xs font-bold text-muted-foreground">
              {showcase.length} items available
            </span>
          </div>

          {pinnedProductId && showcase[0]?.id === pinnedProductId && (
            <div className="flex items-center gap-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-xs font-semibold text-amber-800 dark:text-amber-300">
              <Sparkles className="h-4 w-4 shrink-0 text-amber-500" />
              You selected <span className="font-bold">{showcase[0]?.name}</span> — it's shown
              first.
            </div>
          )}

          {isLoading ? (
            <div className="rounded-3xl border bg-card p-12 text-center text-sm font-semibold text-muted-foreground">
              Loading store items...
            </div>
          ) : showcase.length === 0 ? (
            <div className="rounded-3xl border bg-card p-12 text-center space-y-3">
              <Store className="h-10 w-10 text-muted-foreground mx-auto opacity-50" />
              <h3 className="font-bold text-base text-foreground">No products available</h3>
              <p className="text-xs text-muted-foreground">
                This store has not added items to their catalog yet. Check back soon!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {showcase.map((p) => (
                <div key={p.id} className={p.id === pinnedProductId ? "relative" : ""}>
                  {p.id === pinnedProductId && (
                    <span className="absolute -top-2 -right-1 z-10 rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-sm">
                      Selected
                    </span>
                  )}
                  <ProductCard key={p.id} product={p} />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <ReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        targetId={vendor.id}
        targetName={vendor.business_name}
        targetType="vendor"
        onSuccess={() => setReviewOpen(false)}
      />
    </div>
  );
}

function formatDistanceLabel(km: number): string {
  return formatDistance(km);
}
