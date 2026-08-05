import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  Home,
  Map as MapIcon,
  ShoppingBag,
  Bell,
  User,
  Heart,
  BellRing,
  Sparkles,
  Loader2,
  MapPin,
  Store,
} from "lucide-react";

import { useAuth } from "@/context/auth-context";
import { useLocation } from "@/hooks/use-location";
import { api } from "@/lib/api";
import {
  fetchNearbyVendors,
  fetchNearbyDailyLocations,
  fetchMyFavorites,
  fetchMyFollows,
  fetchSearchHistory,
  toggleFavoriteVendor,
  toggleFollowVendor,
  clearSearchHistory,
  DISCOVERY_CATEGORIES,
  DEFAULT_FILTERS,
  type DiscoveryFilters,
  type DiscoveryVendor,
} from "@/lib/discovery";
import { IllustratedCityMap } from "@/components/marketplace/illustrated-city-map";
import { DiscoverySearch } from "@/components/marketplace/discovery-search";
import { CategoryPills } from "@/components/marketplace/category-pills";
import { DiscoveryFiltersPanel } from "@/components/marketplace/discovery-filters";
import { DiscoveryBottomSheet, type SheetSnap } from "@/components/marketplace/discovery-bottom-sheet";
import { DiscoveryVendorCard } from "@/components/marketplace/discovery-vendor-card";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore — Discover Nearby Vendors | Gali Connect" },
      {
        name: "description",
        content:
          "Discover street vendors, carts and shops near you on a beautiful illustrated map. Live locations, ratings, favourites and more.",
      },
    ],
  }),
  component: Explore,
});

const DEFAULT_CENTER = { lat: 12.9715, lng: 77.6405 };
const BOTTOM_NAV_PAD = 72;

function pillIdForCategory(category: string | null | undefined): string {
  if (!category) return "all";
  const c = category.toLowerCase();
  for (const pill of DISCOVERY_CATEGORIES) {
    if (pill.id === "all") continue;
    if (c.includes(pill.id) || pill.label.toLowerCase().includes(c)) return pill.id;
  }
  return "groceries";
}

function matchesQuery(v: DiscoveryVendor, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return [v.business_name, v.category, v.area, v.landmark, v.address]
    .filter(Boolean)
    .some((field) => String(field).toLowerCase().includes(s));
}

function matchesFilters(v: DiscoveryVendor, f: DiscoveryFilters): boolean {
  if (f.minRating > 0 && v.rating < f.minRating) return false;
  if (f.verifiedOnly && !v.is_verified) return false;
  if (f.kinds.length > 0 && !f.kinds.includes(v.vendor_type)) return false;
  if (f.openNow && !v.is_open) return false;
  if (f.hasOffers) {
    const tags = Array.isArray(v.tags) ? v.tags.join(" ") : String(v.tags ?? "");
    if (!/(offer|sale|deal|discount)/i.test(tags)) return false;
  }
  return true;
}

function Explore() {
  const { activeAddress } = useLocation();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const baseCenter = useMemo(() => {
    const lat = Number(activeAddress?.latitude);
    const lng = Number(activeAddress?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0
      ? { lat, lng }
      : DEFAULT_CENTER;
  }, [activeAddress?.latitude, activeAddress?.longitude]);

  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [recenterKey, setRecenterKey] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<DiscoveryFilters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [snap, setSnap] = useState<SheetSnap>("collapsed");
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [followIds, setFollowIds] = useState<Set<string>>(new Set());

  /* -------- geolocation (client only) -------- */
  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    const onPos = (p: GeolocationPosition) =>
      setUserLoc({
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        accuracy: p.coords.accuracy,
      });
    navigator.geolocation.getCurrentPosition(onPos, () => {}, {
      enableHighAccuracy: true,
      timeout: 8000,
    });
    const watchId = navigator.geolocation.watchPosition(onPos, () => {}, {
      enableHighAccuracy: true,
      maximumAge: 15000,
    });
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const effectiveCenter = userLoc ?? baseCenter;

  /* -------- data -------- */
  const nearbyQuery = useQuery({
    queryKey: [
      "discovery",
      "nearby",
      effectiveCenter.lat.toFixed(4),
      effectiveCenter.lng.toFixed(4),
      filters.radiusKm,
      selectedCategory,
      filters.openNow,
    ],
    queryFn: () =>
      fetchNearbyVendors({
        lat: effectiveCenter.lat,
        lng: effectiveCenter.lng,
        radiusKm: filters.radiusKm,
        category: selectedCategory === "all" ? undefined : selectedCategory,
        isOpen: filters.openNow,
      }),
    staleTime: 30_000,
  });

  const dailyQuery = useQuery({
    queryKey: [
      "discovery",
      "daily",
      effectiveCenter.lat.toFixed(4),
      effectiveCenter.lng.toFixed(4),
      filters.radiusKm,
      selectedCategory,
      filters.openNow,
    ],
    queryFn: () =>
      fetchNearbyDailyLocations({
        lat: effectiveCenter.lat,
        lng: effectiveCenter.lng,
        radiusKm: filters.radiusKm,
        category: selectedCategory === "all" ? undefined : selectedCategory,
        isOpen: filters.openNow,
      }),
    staleTime: 30_000,
  });

  const allVendors = useMemo(() => {
    const map = new Map<string, DiscoveryVendor>();
    for (const v of dailyQuery.data?.locations ?? []) map.set(v.id, v);
    for (const v of nearbyQuery.data?.vendors ?? []) {
      if (!map.has(v.id)) map.set(v.id, v);
    }
    return [...map.values()];
  }, [dailyQuery.data, nearbyQuery.data]);

  const filteredVendors = useMemo(() => {
    return allVendors
      .filter((v) => matchesQuery(v, query) && matchesFilters(v, filters))
      .sort((a, b) => {
        const da = a.distance_km ?? Infinity;
        const db = b.distance_km ?? Infinity;
        if (da !== db) return da - db;
        return b.rating - a.rating;
      });
  }, [allVendors, query, filters]);

  const countByCategory = useMemo(() => {
    const counts: Record<string, number> = { all: allVendors.length };
    for (const v of allVendors) {
      const id = pillIdForCategory(v.category);
      counts[id] = (counts[id] ?? 0) + 1;
    }
    return counts;
  }, [allVendors]);

  /* -------- engagement -------- */
  const favsQuery = useQuery({
    queryKey: ["discovery", "favorites"],
    queryFn: fetchMyFavorites,
    enabled: isAuthenticated,
  });
  const followsQuery = useQuery({
    queryKey: ["discovery", "follows"],
    queryFn: fetchMyFollows,
    enabled: isAuthenticated,
  });

  useEffect(() => {
    setFavIds(new Set((favsQuery.data ?? []).map((v) => v.id)));
  }, [favsQuery.data]);
  useEffect(() => {
    setFollowIds(new Set((followsQuery.data ?? []).map((v) => v.id)));
  }, [followsQuery.data]);

  const historyQuery = useQuery({
    queryKey: ["discovery", "history"],
    queryFn: fetchSearchHistory,
    enabled: isAuthenticated,
  });
  const recentSearches = useMemo(
    () => (historyQuery.data ?? []).map((h) => h.query).filter(Boolean),
    [historyQuery.data],
  );

  const clearHistory = useMutation({
    mutationFn: clearSearchHistory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discovery", "history"] });
      toast.success("Search history cleared");
    },
  });

  const requireAuth = useCallback(() => {
    if (!isAuthenticated) {
      toast.info("Please log in to save and follow vendors");
      navigate({ to: "/login" });
      return false;
    }
    return true;
  }, [isAuthenticated, navigate]);

  const handleToggleFavorite = useCallback(
    (id: string) => {
      if (!requireAuth()) return;
      setFavIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      toggleFavoriteVendor(id)
        .then((res) => {
          if (!res.success) throw new Error(res.error?.message);
          queryClient.invalidateQueries({ queryKey: ["discovery", "favorites"] });
        })
        .catch(() => {
          setFavIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
            return next;
          });
          toast.error("Could not update favourites");
        });
    },
    [requireAuth, queryClient],
  );

  const handleToggleFollow = useCallback(
    (id: string) => {
      if (!requireAuth()) return;
      setFollowIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      toggleFollowVendor(id)
        .then((res) => {
          if (!res.success) throw new Error(res.error?.message);
          queryClient.invalidateQueries({ queryKey: ["discovery", "follows"] });
        })
        .catch(() => {
          setFollowIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
            return next;
          });
          toast.error("Could not update follow status");
        });
    },
    [requireAuth, queryClient],
  );

  /* -------- interactions -------- */
  const handleSelectVendor = useCallback((id: string) => {
    setSelectedVendorId(id);
    setSnap("half");
  }, []);

  const handleOpenVendorSheet = useCallback(
    (id: string) => {
      navigate({ to: "/vendors/$vendorId", params: { vendorId: id } });
    },
    [navigate],
  );

  const handleLocate = useCallback(() => {
    if (userLoc) {
      setRecenterKey((k) => k + 1);
      toast.success("Centred on your location");
    } else {
      toast.info("Locating you…");
      navigator.geolocation?.getCurrentPosition(
        (p) =>
          setUserLoc({
            lat: p.coords.latitude,
            lng: p.coords.longitude,
            accuracy: p.coords.accuracy,
          }),
        () => toast.error("Could not get your location"),
        { enableHighAccuracy: true, timeout: 8000 },
      );
    }
  }, [userLoc]);

  const filtersActive =
    filters.radiusKm !== DEFAULT_FILTERS.radiusKm ||
    filters.categories.length > 0 ||
    filters.minRating > 0 ||
    filters.openNow ||
    filters.verifiedOnly ||
    filters.kinds.length > 0 ||
    filters.hasOffers;

  const loading = nearbyQuery.isLoading || dailyQuery.isLoading;
  const selectedVendor = selectedVendorId
    ? allVendors.find((v) => v.id === selectedVendorId) ?? null
    : null;

  const areaLabel =
    (activeAddress?.line1 ?? "") && (activeAddress?.city ?? "")
      ? `${activeAddress.line1}, ${activeAddress.city}`
      : userLoc
        ? "Current location"
        : "Around you";

  return (
    <div className="relative overflow-hidden bg-background text-foreground">
      {/* ───────────── Mobile: full-screen map + sheet ───────────── */}
      <div
        className="relative overflow-hidden lg:hidden"
        style={{ height: `calc(100dvh + ${BOTTOM_NAV_PAD}px)` }}
      >
        <IllustratedCityMap
          className="absolute inset-0"
          center={effectiveCenter}
          userLocation={userLoc}
          accuracyMeters={userLoc?.accuracy}
          vendors={allVendors}
          selectedVendorId={selectedVendorId}
          onSelectVendor={handleSelectVendor}
          onOpenVendorSheet={handleOpenVendorSheet}
          onLocate={handleLocate}
          recenterKey={recenterKey}
        />

        {/* floating search + pills */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-40 space-y-2 px-3"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}
        >
          <div className="pointer-events-auto">
            <DiscoverySearch
              areaLabel={areaLabel}
              vendors={allVendors}
              vendorsCount={allVendors.length}
              query={query}
              onQueryChange={setQuery}
              onSelectVendor={handleSelectVendor}
              onOpenFilters={() => setFiltersOpen(true)}
              filtersActive={filtersActive}
              recentSearches={recentSearches}
              onRunRecentSearch={(q) => setQuery(q)}
            />
          </div>
          <div className="pointer-events-auto">
            <CategoryPills
              selected={selectedCategory}
              onSelect={setSelectedCategory}
              countByCategory={countByCategory}
            />
          </div>
        </div>

        {/* filters overlay */}
        <AnimatePresence>
          {filtersOpen && (
            <DiscoveryFiltersPanel
              filters={filters}
              onChange={setFilters}
              onClose={() => setFiltersOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* bottom sheet */}
        <DiscoveryBottomSheet
          snap={snap}
          onSnapChange={setSnap}
          title={selectedVendor ? "Vendor details" : "Vendors nearby"}
          subtitle={selectedVendor?.business_name ?? "Discover your gali"}
          count={selectedVendor ? undefined : filteredVendors.length}
          onOpenFilters={() => setFiltersOpen(true)}
          onClose={selectedVendor ? () => setSelectedVendorId(null) : undefined}
          collapsedPreview={
            <div className="space-y-1.5">
              {filteredVendors.slice(0, 2).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => handleSelectVendor(v.id)}
                  className="flex w-full items-center gap-2 rounded-2xl bg-white/70 px-3 py-2 text-left ring-1 ring-black/5"
                >
                  <span className="text-base">{DISCOVERY_CATEGORIES.find((c) => c.id === pillIdForCategory(v.category))?.emoji ?? "🛒"}</span>
                  <span className="min-w-0 flex-1 truncate text-[12px] font-bold">
                    {v.business_name}
                  </span>
                  <span className="text-[10px] font-black text-emerald-700">
                    {v.is_open ? "OPEN" : "CLOSED"}
                  </span>
                </button>
              ))}
            </div>
          }
        >
          {loading ? (
            <VendorListSkeleton />
          ) : selectedVendor ? (
            <div className="space-y-2">
              <DiscoveryVendorCard
                vendor={selectedVendor}
                userLocation={userLoc}
                isFavorited={favIds.has(selectedVendor.id)}
                isFollowing={followIds.has(selectedVendor.id)}
                onToggleFavorite={handleToggleFavorite}
                onToggleFollow={handleToggleFollow}
              />
              <button
                type="button"
                onClick={() => setSelectedVendorId(null)}
                className="w-full rounded-2xl bg-muted py-3 text-xs font-bold text-muted-foreground"
              >
                Show all {filteredVendors.length} vendors
              </button>
            </div>
          ) : filteredVendors.length === 0 ? (
            <EmptyState onReset={() => setFilters(DEFAULT_FILTERS)} />
          ) : (
            <div className="space-y-2.5">
              {filteredVendors.map((v) => (
                <button key={v.id} type="button" onClick={() => handleSelectVendor(v.id)} className="block w-full text-left">
                  <DiscoveryVendorCard
                    vendor={v}
                    userLocation={userLoc}
                    isFavorited={favIds.has(v.id)}
                    isFollowing={followIds.has(v.id)}
                    onToggleFavorite={handleToggleFavorite}
                    onToggleFollow={handleToggleFollow}
                  />
                </button>
              ))}
            </div>
          )}
        </DiscoveryBottomSheet>
      </div>

      {/* ───────────── Desktop: split layout ───────────── */}
      <div className="hidden lg:grid lg:h-[calc(100vh-64px)] lg:grid-cols-[300px_minmax(0,1fr)_400px]">
        <ExploreSidebar
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          favorites={favsQuery.data ?? []}
          onSelectFavorite={(id) => handleSelectVendor(id)}
          filtersActive={filtersActive}
          onOpenFilters={() => setFiltersOpen(true)}
        />

        <div className="relative min-w-0 border-x border-border">
          <IllustratedCityMap
            className="absolute inset-0"
            center={effectiveCenter}
            userLocation={userLoc}
            accuracyMeters={userLoc?.accuracy}
            vendors={allVendors}
            selectedVendorId={selectedVendorId}
            onSelectVendor={handleSelectVendor}
            onOpenVendorSheet={handleOpenVendorSheet}
            onLocate={handleLocate}
            recenterKey={recenterKey}
          />
          <AnimatePresence>
            {filtersOpen && (
              <div className="absolute inset-x-4 top-4 z-40">
                <DiscoveryFiltersPanel
                  filters={filters}
                  onChange={setFilters}
                  onClose={() => setFiltersOpen(false)}
                />
              </div>
            )}
          </AnimatePresence>
        </div>

        <ExploreRightPanel
          areaLabel={areaLabel}
          vendors={allVendors}
          filteredVendors={filteredVendors}
          loading={loading}
          query={query}
          onQueryChange={setQuery}
          onSelectVendor={handleSelectVendor}
          onOpenFilters={() => setFiltersOpen(true)}
          filtersActive={filtersActive}
          favorites={favsQuery.data ?? []}
          following={followsQuery.data ?? []}
          userLoc={userLoc}
          favIds={favIds}
          followIds={followIds}
          onToggleFavorite={handleToggleFavorite}
          onToggleFollow={handleToggleFollow}
          recentSearches={recentSearches}
          onClearHistory={() => clearHistory.mutate()}
          selectedVendor={selectedVendor}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────── Desktop panels ─────────────────────────── */

const SIDEBAR_NAV = [
  { label: "Home", icon: Home, to: "/" },
  { label: "Explore", icon: MapIcon, to: "/explore" },
  { label: "Orders", icon: ShoppingBag, to: "/orders" },
  { label: "Notifications", icon: Bell, to: "/notifications" },
  { label: "Profile", icon: User, to: "/profile" },
];

function ExploreSidebar({
  selectedCategory,
  onSelectCategory,
  favorites,
  onSelectFavorite,
  filtersActive,
  onOpenFilters,
}: {
  selectedCategory: string;
  onSelectCategory: (id: string) => void;
  favorites: DiscoveryVendor[];
  onSelectFavorite: (id: string) => void;
  filtersActive: boolean;
  onOpenFilters: () => void;
}) {
  return (
    <aside className="flex flex-col overflow-y-auto border-r border-border bg-card/40 p-5">
      <Link to="/" className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
          <MapPin className="h-4 w-4" />
        </span>
        <div>
          <div className="font-display text-sm font-bold leading-none">Gali Connect</div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">Discover local</div>
        </div>
      </Link>

      <nav className="mt-6 space-y-1">
        {SIDEBAR_NAV.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className={`flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-[13px] font-bold transition-colors ${
              item.to === "/explore"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-7 flex items-center justify-between">
        <h3 className="font-display text-xs font-black uppercase tracking-wider text-muted-foreground">
          Categories
        </h3>
        <button
          type="button"
          onClick={onOpenFilters}
          className="relative rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-foreground"
        >
          Filters
          {filtersActive && (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-rose-500" />
          )}
        </button>
      </div>
      <div className="mt-3 space-y-0.5">
        {DISCOVERY_CATEGORIES.filter((c) => c.id !== "all").map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelectCategory(cat.id)}
            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-semibold transition-colors ${
              selectedCategory === cat.id
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <span className="text-sm">{cat.emoji}</span>
            {cat.label}
          </button>
        ))}
      </div>

      <div className="mt-7">
        <h3 className="flex items-center gap-1.5 font-display text-xs font-black uppercase tracking-wider text-muted-foreground">
          <Heart className="h-3.5 w-3.5 text-rose-400" /> Saved vendors
        </h3>
        {favorites.length === 0 ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Tap the heart on any vendor to save them here.
          </p>
        ) : (
          <div className="mt-2 space-y-1">
            {favorites.slice(0, 8).map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => onSelectFavorite(v.id)}
                className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-[12px] font-semibold text-foreground hover:bg-muted"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: "var(--primary)" }}
                />
                <span className="truncate">{v.business_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

type PanelTab = "nearby" | "saved" | "following";

function ExploreRightPanel({
  areaLabel,
  vendors,
  filteredVendors,
  loading,
  query,
  onQueryChange,
  onSelectVendor,
  onOpenFilters,
  filtersActive,
  favorites,
  following,
  userLoc,
  favIds,
  followIds,
  onToggleFavorite,
  onToggleFollow,
  recentSearches,
  onClearHistory,
  selectedVendor,
}: {
  areaLabel: string;
  vendors: DiscoveryVendor[];
  filteredVendors: DiscoveryVendor[];
  loading: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  onSelectVendor: (id: string) => void;
  onOpenFilters: () => void;
  filtersActive: boolean;
  favorites: DiscoveryVendor[];
  following: DiscoveryVendor[];
  userLoc: { lat: number; lng: number } | null;
  favIds: Set<string>;
  followIds: Set<string>;
  onToggleFavorite: (id: string) => void;
  onToggleFollow: (id: string) => void;
  recentSearches: string[];
  onClearHistory: () => void;
  selectedVendor: DiscoveryVendor | null;
}) {
  const [tab, setTab] = useState<PanelTab>("nearby");

  return (
    <div className="flex flex-col overflow-hidden bg-card/30">
      <div className="border-b border-border p-4">
        <DiscoverySearch
          areaLabel={areaLabel}
          vendors={vendors}
          vendorsCount={filteredVendors.length}
          query={query}
          onQueryChange={onQueryChange}
          onSelectVendor={onSelectVendor}
          onOpenFilters={onOpenFilters}
          filtersActive={filtersActive}
          recentSearches={recentSearches}
          onRunRecentSearch={onQueryChange}
        />
        <div className="mt-3 flex items-center gap-1 rounded-2xl bg-muted p-1">
          {(
            [
              { id: "nearby", label: "Nearby", count: 0 },
              { id: "saved", label: "Saved", count: favorites.length },
              { id: "following", label: "Following", count: following.length },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-xl py-1.5 text-xs font-bold transition-colors ${
                tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {t.label}
              {typeof t.count === "number" && t.count > 0 ? ` (${t.count})` : ""}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4">
        {tab === "saved" &&
          (favorites.length === 0 ? (
            <PanelEmpty text="No saved vendors yet. Tap the heart on a card." />
          ) : (
            favorites.map((v) => (
              <DiscoveryVendorCard
                key={v.id}
                vendor={v}
                userLocation={userLoc}
                isFavorited
                onToggleFavorite={onToggleFavorite}
                onToggleFollow={onToggleFollow}
              />
            ))
          ))}

        {tab === "following" &&
          (following.length === 0 ? (
            <PanelEmpty text="You're not following anyone yet. Follow vendors to get updates." />
          ) : (
            following.map((v) => (
              <DiscoveryVendorCard
                key={v.id}
                vendor={v}
                userLocation={userLoc}
                isFollowing
                onToggleFavorite={onToggleFavorite}
                onToggleFollow={onToggleFollow}
              />
            ))
          ))}

        {tab === "nearby" && (
          <>
            {loading ? (
              <VendorListSkeleton />
            ) : filteredVendors.length === 0 ? (
              <EmptyState onReset={() => onQueryChange("")} />
            ) : (
              filteredVendors.map((v) => (
                <div
                  key={v.id}
                  className="cursor-pointer"
                  onClick={() => onSelectVendor(v.id)}
                >
                  <DiscoveryVendorCard
                    vendor={v}
                    userLocation={userLoc}
                    isFavorited={favIds.has(v.id)}
                    isFollowing={followIds.has(v.id)}
                    onToggleFavorite={onToggleFavorite}
                    onToggleFollow={onToggleFollow}
                    compact={selectedVendor?.id !== v.id}
                  />
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── Small pieces ─────────────────────────── */

function VendorListSkeleton() {
  return (
    <div className="space-y-2.5" aria-label="Loading vendors">
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 1.4, delay: i * 0.15 }}
          className="glass h-32 rounded-3xl"
        />
      ))}
    </div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border p-8 text-center">
      <Store className="h-9 w-9 text-muted-foreground/60" />
      <p className="text-sm font-semibold">No vendors found here</p>
      <p className="max-w-xs text-xs text-muted-foreground">
        Try widening your radius, clearing filters, or searching a nearby area.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-1 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
      >
        Reset
      </button>
    </div>
  );
}

function PanelEmpty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border p-8 text-center">
      <Sparkles className="h-8 w-8 text-muted-foreground/60" />
      <p className="text-xs font-medium text-muted-foreground">{text}</p>
    </div>
  );
}
