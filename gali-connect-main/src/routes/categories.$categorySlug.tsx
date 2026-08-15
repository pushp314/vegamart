import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Star, MapPin, Clock, Search, Store, ChevronRight } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { PullToRefresh } from "@/components/system/pull-to-refresh";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getNearbyDailyLocations, type DailyLocationData } from "@/lib/api";
import type { Vendor, Category, VendorProfile } from "@/types";
import { useLocation } from "@/hooks/use-location";

export const Route = createFileRoute("/categories/$categorySlug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.categorySlug.replace(/-/g, " ")} — Vegamart` },
      { name: "description", content: "Browse local vendors selling this category near you." },
    ],
  }),
  component: CategoryPage,
});

type DailyLocationWithDistance = DailyLocationData & { distance_km?: number };

function CategoryPage() {
  const { categorySlug } = Route.useParams();
  const { activeAddress, displayLocation } = useLocation();
  const queryClient = useQueryClient();

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["vendors"] }),
      queryClient.invalidateQueries({ queryKey: ["categories"] }),
    ]);
  };

  const { data: catsRes, isLoading: loadingCats } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<Category[]>("/categories"),
  });
  const categories = useMemo(() => catsRes?.data || [], [catsRes?.data]);

  const activeCategory = useMemo(
    () => categories.find((c) => c.slug === categorySlug || c.id === categorySlug) || null,
    [categories, categorySlug],
  );

  const { data: vendorsRes, isLoading: loadingVendors } = useQuery({
    queryKey: ["vendors", activeCategory?.id],
    queryFn: () => {
      const params = new URLSearchParams({ per_page: "100" });
      if (activeCategory) params.set("category_id", activeCategory.id);
      return api.get<Vendor[]>(`/vendors?${params.toString()}`);
    },
    enabled: !!activeCategory,
    staleTime: 5 * 60 * 1000,
  });

  const { data: dailyLocationsRes } = useQuery({
    queryKey: ["nearbyDailyLocations", activeAddress?.latitude, activeAddress?.longitude],
    queryFn: () => getNearbyDailyLocations(activeAddress!.latitude!, activeAddress!.longitude!, 10),
    enabled: !!activeAddress?.latitude && !!activeAddress?.longitude,
  });

  const dailyLocations: DailyLocationWithDistance[] =
    (dailyLocationsRes?.data as DailyLocationWithDistance[]) || [];

  const vendors = vendorsRes?.data || [];

  if (loadingCats) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader title="Categories" back={false} />
        <main className="mx-auto max-w-6xl px-4 md:px-6 lg:px-8 pt-4 pb-28 md:pb-16">
          <div className="mt-10 text-center text-sm text-muted-foreground">
            Loading categories...
          </div>
        </main>
      </div>
    );
  }

  if (!activeCategory) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader title="Category not found" />
        <main className="mx-auto max-w-6xl px-4 md:px-6 lg:px-8 pt-4 pb-28 md:pb-16">
          <div className="mt-10 text-center text-sm text-muted-foreground">
            This category does not exist.
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title={activeCategory.name}
        subtitle={`${vendors.length} shops near ${displayLocation}`}
        back={false}
      />
      <PullToRefresh onRefresh={refresh}>
        <main className="mx-auto max-w-6xl md:px-6 lg:px-8 md:pt-8 pb-28 md:pb-16">
          <div className="flex items-start lg:grid lg:grid-cols-[240px_1fr] lg:gap-8">
            {/* Mobile sidebar */}
            <aside className="lg:hidden w-[85px] shrink-0 bg-muted/30 sticky top-[65px] h-[calc(100dvh-65px)] overflow-y-auto no-scrollbar border-r flex flex-col z-20">
              {categories.map((c) => {
                const isActive = c.slug === activeCategory.slug;
                return (
                  <Link
                    key={c.id}
                    to="/categories/$categorySlug"
                    params={{ categorySlug: c.slug }}
                    className={`flex flex-col items-center gap-1.5 p-2 py-4 text-center relative transition-colors ${
                      isActive ? "bg-background" : "hover:bg-background/50"
                    }`}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand rounded-r-md" />
                    )}
                    <div className="h-[46px] w-[46px] overflow-hidden rounded-[14px] bg-background flex items-center justify-center shadow-sm border border-border/50 p-1">
                      {c.image_url ? (
                        <img
                          src={c.image_url}
                          alt={c.name}
                          className="w-full h-full object-cover rounded-[10px]"
                        />
                      ) : c.icon ? (
                        <span className="text-2xl">{c.icon}</span>
                      ) : (
                        <div className="w-full h-full bg-brand/10 rounded-[10px]" />
                      )}
                    </div>
                    <span
                      className={`text-[10px] leading-[1.2] ${
                        isActive ? "font-bold text-foreground" : "font-medium text-muted-foreground"
                      }`}
                    >
                      {c.name}
                    </span>
                  </Link>
                );
              })}
            </aside>
            {/* Desktop sidebar */}
            <aside className="hidden lg:block">
              <div className="sticky top-24 rounded-2xl bg-card border p-3">
                <div className="px-2 pb-2 text-[10.5px] font-black uppercase tracking-wider text-muted-foreground">
                  Shop by category
                </div>
                <ul className="space-y-0.5">
                  {categories.map((c) => (
                    <li key={c.id}>
                      <Link
                        to="/categories/$categorySlug"
                        params={{ categorySlug: c.slug }}
                        className={`flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-sm font-semibold transition-colors ${
                          c.slug === activeCategory.slug
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:bg-muted"
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          {c.icon ? (
                            <span className="text-base">{c.icon}</span>
                          ) : (
                            <Store className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                          <span className="truncate">{c.name}</span>
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          {typeof c.vendor_count === "number" ? (
                            <span className="text-[11px] font-bold">{c.vendor_count}</span>
                          ) : null}
                          <ChevronRight className="h-3.5 w-3.5" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>

            {/* Content */}
            <div className="min-w-0 flex-1 px-3 py-4 lg:px-0 lg:py-0 w-full">
              {loadingVendors ? (
                <div className="mt-6 text-center text-sm text-muted-foreground">
                  Loading vendors...
                </div>
              ) : (
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  {vendors.map((v) => {
                    const profile: VendorProfile | undefined = v.profile;
                    const imageUrl =
                      profile?.logo_url ||
                      v.logo_url ||
                      "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=600&fit=crop";
                    const isOpen = profile?.is_open || v.is_open || false;
                    const dailyLoc = dailyLocations.find(
                      (dl) => dl.vendor_id === v.id && dl.is_active,
                    );
                    return (
                      <li key={v.id}>
                        <Link
                          to="/vendors/$vendorId"
                          params={{ vendorId: v.id }}
                          className="flex gap-3 p-3 rounded-2xl bg-card border shadow-sm hover:border-primary/40 transition-colors"
                        >
                          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                            <img
                              src={imageUrl}
                              alt={v.business_name}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                            {isOpen && (
                              <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-md bg-emerald-700 px-1.5 py-0.5 text-[9px] font-bold text-white">
                                <span className="h-1 w-1 rounded-full bg-red-300 animate-pulse" />{" "}
                                LIVE
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <h3 className="font-semibold text-[15px] truncate">
                                {v.business_name}
                              </h3>
                              {v.is_verified && (
                                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground text-[9px]">
                                  ✓
                                </span>
                              )}
                            </div>
                            <p className="text-[12px] text-muted-foreground truncate">
                              {activeCategory.name}
                            </p>
                            {dailyLoc && (
                              <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
                                <MapPin className="h-3 w-3" />
                                {String(dailyLoc.area ?? "")}
                                {typeof dailyLoc.distance_km === "number" && (
                                  <span className="text-muted-foreground font-normal">
                                    ·{" "}
                                    {dailyLoc.distance_km < 1
                                      ? `${Math.round(dailyLoc.distance_km * 1000)}m`
                                      : `${dailyLoc.distance_km.toFixed(1)} km`}
                                  </span>
                                )}
                              </p>
                            )}
                            <div className="mt-2 flex items-center gap-3 text-[11px]">
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100/80 px-1.5 py-0.5 text-[10px] font-black text-amber-700">
                                <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                                {typeof profile?.rating === "number" && profile.rating > 0
                                  ? profile.rating.toFixed(1)
                                  : "New"}
                                {typeof profile?.review_count === "number" &&
                                  profile.review_count > 0 && (
                                    <span className="font-semibold text-amber-600 ml-0.5">
                                      ({profile.review_count})
                                    </span>
                                  )}
                              </span>
                              {typeof v.distance_km === "number" && (
                                <span className="inline-flex items-center gap-1 text-muted-foreground font-medium">
                                  <MapPin className="h-3 w-3" /> {v.distance_km!.toFixed(1)} km
                                </span>
                              )}
                              {typeof v.eta_min === "number" && (
                                <span className="inline-flex items-center gap-1 text-muted-foreground font-medium">
                                  <Clock className="h-3 w-3" /> {v.eta_min} min
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}

              {!loadingVendors && vendors.length === 0 && (
                <div className="mt-10 text-center">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground">
                    <Search className="h-6 w-6" />
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    No vendors selling {activeCategory.name.toLowerCase()} right now.
                  </p>
                </div>
              )}
            </div>
          </div>
        </main>
      </PullToRefresh>
    </div>
  );
}
