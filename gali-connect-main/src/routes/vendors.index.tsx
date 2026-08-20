import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, X, Star, MapPin, Clock, Radio } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { PullToRefresh } from "@/components/system/pull-to-refresh";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type DailyLocationData, getNearbyDailyLocations } from "@/lib/api";
import type { Vendor, Category } from "@/types";
import { useAuth } from "@/context/auth-context";
import { useLocation } from "@/hooks/use-location";

export const Route = createFileRoute("/vendors/")({
  head: () => ({
    meta: [
      { title: "Live vendors near you — Vegamart" },
      { name: "description", content: "Browse verified local vendors and shops moving near you." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { q?: string; category?: string } => ({
    q: typeof search.q === "string" ? search.q : undefined,
    category: typeof search.category === "string" ? search.category : undefined,
  }),
  component: VendorsPage,
});

function VendorsPage() {
  const { isAuthenticated } = useAuth();
  const [activeCat, setActiveCat] = useState<string>("all");
  const { q: urlQ, category: urlCat } = useSearch({ from: "/vendors/" });
  const [query, setQuery] = useState<string>(urlQ || "");

  // Sync the selected category with the URL ?category= param (e.g. coming from the homepage).
  useEffect(() => {
    if (urlCat) {
      setActiveCat(urlCat);
    } else if (urlCat === undefined) {
      setActiveCat("all");
    }
  }, [urlCat]);

  const refresh = () => new Promise<void>((res) => setTimeout(res, 700));

  const queryClient = useQueryClient();
  const realRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["vendors"] }),
      queryClient.invalidateQueries({ queryKey: ["nearbyDailyLocations"] }),
    ]);
  };

  useEffect(() => {
    if (urlQ !== undefined && urlQ !== query) {
      setQuery(urlQ);
    }
  }, [urlQ]);

  const { activeAddress, displayLocation } = useLocation();

  const { data: vendorsRes, isLoading: loadingVendors } = useQuery({
    queryKey: ["vendors", activeAddress?.latitude, activeAddress?.longitude],
    queryFn: async () => {
      if (activeAddress?.latitude && activeAddress?.longitude) {
        const url = `/vendors/nearby?lat=${activeAddress.latitude}&lng=${activeAddress.longitude}`;
        const res = await api.get<Vendor[]>(url);
        if (res.data && res.data.length > 0) {
          return res;
        }
      }
      return api.get<Vendor[]>("/vendors");
    },
  });

  const { data: catsRes } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<Category[]>("/categories"),
  });

  // Fetch nearby daily locations when customer has coordinates
  const { data: dailyLocationsRes } = useQuery({
    queryKey: ["nearbyDailyLocations", activeAddress?.latitude, activeAddress?.longitude],
    queryFn: () => getNearbyDailyLocations(activeAddress!.latitude!, activeAddress!.longitude!, 10),
    enabled: !!activeAddress?.latitude && !!activeAddress?.longitude,
  });

  const dailyLocations: (DailyLocationData & { distance_km: number; business_name: string })[] =
    (dailyLocationsRes?.data as any) || [];

  const vendors = vendorsRes?.data || [];
  const categories = catsRes?.data || [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const activeCatName = categories.find(
      (c: any) => c.id === activeCat || c.slug === activeCat || c.name === activeCat,
    )?.name;
    const targetCat = activeCatName || activeCat;
    return vendors.filter((v) => {
      const profile: any = v.profile || v;
      const catMatch = targetCat === "all" || profile?.category === targetCat;
      if (!catMatch) return false;

      if (!q) return true;

      let tags: string[] = [];
      if (Array.isArray(profile?.tags)) {
        tags = profile.tags;
      } else if (typeof profile?.tags === "string" && profile.tags.trim()) {
        try {
          const parsed = JSON.parse(profile.tags);
          tags = Array.isArray(parsed) ? parsed : profile.tags.split(",");
        } catch (e) {
          tags = profile.tags.split(",");
        }
      }

      return (
        v.business_name.toLowerCase().includes(q) ||
        (profile?.address || "").toLowerCase().includes(q) ||
        tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [activeCat, query, vendors, categories]);

  const liveVendorsCount = vendors.filter((v: any) => v.profile?.is_open || v.is_open).length;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Live vendors"
        subtitle={`${filtered.length} shops near ${displayLocation}`}
        back={false}
      />
      <PullToRefresh onRefresh={realRefresh}>
        <main className="mx-auto max-w-6xl px-4 md:px-6 lg:px-8 pt-4 md:pt-8 pb-28 md:pb-16">
          {/* Live banner */}
          <div className="rounded-2xl bg-emerald-700 text-white p-4 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white/15">
              <Radio className="h-4 w-4" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-white/85">
                Live now
              </div>
              <div className="font-semibold">{liveVendorsCount} vendors moving near you</div>
            </div>
          </div>

          {/* Search */}
          <div className="mt-4 flex items-center gap-3 rounded-full bg-card border h-12 px-4 shadow-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search vendors, categories…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button
                aria-label="Clear"
                onClick={() => setQuery("")}
                className="grid h-7 w-7 place-items-center rounded-full hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Category chips */}
          <div className="mt-3 -mx-4 flex gap-2 overflow-x-auto no-scrollbar px-4 pb-1">
            <Chip active={activeCat === "all"} onClick={() => setActiveCat("all")}>
              All
            </Chip>
            {categories.map((c: any) => (
              <Chip key={c.id} active={activeCat === c.name} onClick={() => setActiveCat(c.name)}>
                {c.name}
              </Chip>
            ))}
          </div>

          {/* List */}
          {loadingVendors ? (
            <div className="mt-10 text-center text-sm text-muted-foreground">
              Loading vendors...
            </div>
          ) : (
            <ul className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {filtered.map((v) => {
                const profile: any = v.profile || v;
                const imageUrl =
                  profile.logo_url ||
                  "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=600&fit=crop";
                const isOpen = profile.is_open || false;
                let tags = ["Local vendor"];
                if (Array.isArray(profile.tags)) {
                  tags = profile.tags.length > 0 ? profile.tags : ["Local vendor"];
                } else if (typeof profile.tags === "string" && profile.tags.trim()) {
                  try {
                    const parsed = JSON.parse(profile.tags);
                    if (Array.isArray(parsed) && parsed.length > 0) tags = parsed;
                    else tags = [];
                  } catch (e) {}
                  if (tags.length === 0) {
                    tags = profile.tags
                      .split(",")
                      .map((t: string) => t.trim())
                      .filter(Boolean);
                  }
                }
                const hasDistance = typeof v.distance_km === "number";
                const etaText = profile.estimated_delivery_time || profile.delivery_configs?.estimated_delivery_time || (typeof v.eta_min === "number" ? `${v.eta_min} min` : null);
                const hasEta = Boolean(etaText);

                // Check if this vendor has an active daily location
                const dailyLoc = dailyLocations.find((dl) => dl.vendor_id === v.id && dl.is_active);

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
                            <span className="h-1 w-1 rounded-full bg-red-300 animate-pulse" /> LIVE
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <h3 className="font-semibold text-[15px] truncate">{v.business_name}</h3>
                          {v.is_verified && (
                            <span className="grid h-4 w-4 place-items-center rounded-full bg-primary text-primary-foreground text-[9px]">
                              ✓
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-muted-foreground truncate">{tags[0]}</p>
                        {dailyLoc && (
                          <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3" />
                            {dailyLoc.area}
                            {dailyLoc.distance_km !== undefined && (
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
                            {typeof profile?.rating === "number" && profile.rating > 0 ? profile.rating.toFixed(1) : "New"}
                            {typeof profile?.review_count === "number" && profile.review_count > 0 && (
                              <span className="font-semibold text-amber-600 ml-0.5">({profile.review_count})</span>
                            )}
                          </span>
                          {hasDistance && (
                            <span className="inline-flex items-center gap-1 text-muted-foreground font-medium">
                              <MapPin className="h-3 w-3" /> {v.distance_km!.toFixed(1)} km
                            </span>
                          )}
                          {hasEta && (
                            <span className="inline-flex items-center gap-1 text-muted-foreground font-medium">
                              <Clock className="h-3 w-3" /> {etaText}
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

          {!loadingVendors && filtered.length === 0 && (
            <div className="mt-10 text-center text-sm text-muted-foreground">
              <p>No vendors match your search or filters.</p>
              <button
                onClick={() => {
                  setQuery("");
                  setActiveCat("all");
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
              >
                <X className="h-3.5 w-3.5" /> Clear search & filters
              </button>
            </div>
          )}
        </main>
      </PullToRefresh>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition-colors border ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-foreground border-border hover:border-primary/40"
      }`}
    >
      {children}
    </button>
  );
}
