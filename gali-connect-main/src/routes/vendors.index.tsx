import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, X, Star, MapPin, Clock, Radio } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { PullToRefresh } from "@/components/system/pull-to-refresh";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
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
  component: VendorsPage,
});

function VendorsPage() {
  const { isAuthenticated } = useAuth();
  const [activeCat, setActiveCat] = useState<string>("all");
  const [query, setQuery] = useState("");

  // Initialize activeCat from URL if present
  useMemo(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const cat = urlParams.get("category");
      if (cat && activeCat === "all") {
        setActiveCat(cat);
      }
    }
  }, []);

  const refresh = () => new Promise<void>((res) => setTimeout(res, 700));

  const { activeAddress, displayLocation } = useLocation();

  const { data: vendorsRes, isLoading: loadingVendors } = useQuery({
    queryKey: ["vendors", activeAddress?.latitude, activeAddress?.longitude],
    queryFn: () => {
      let url = "/vendors";
      if (activeAddress?.latitude && activeAddress?.longitude) {
        url += `?lat=${activeAddress.latitude}&lng=${activeAddress.longitude}`;
      }
      return api.get<Vendor[]>(url);
    },
  });

  const { data: catsRes } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<Category[]>("/categories"),
  });

  const vendors = vendorsRes?.data || [];
  const categories = catsRes?.data || [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vendors.filter((v) => {
      const profile = v.profile;
      const catMatch = activeCat === "all" || profile?.category === activeCat;
      if (!catMatch) return false;

      if (!q) return true;

      let tags: string[] = [];
      try {
        tags = JSON.parse(profile?.tags || "[]");
      } catch (e) {}

      return (
        v.business_name.toLowerCase().includes(q) ||
        (profile?.address || "").toLowerCase().includes(q) ||
        tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [activeCat, query, vendors]);

  const liveVendorsCount = vendors.filter((v) => v.profile?.is_open).length;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Live vendors"
        subtitle={`${filtered.length} shops near ${displayLocation}`}
        back={false}
      />
      <PullToRefresh onRefresh={refresh}>
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
            {categories.map((c) => (
              <Chip key={c.id} active={activeCat === c.id} onClick={() => setActiveCat(c.id)}>
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
                const profile = v.profile || ({} as any);
                const imageUrl =
                  profile.logo_url ||
                  "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=600&fit=crop";
                const isOpen = profile.is_open || false;
                let tags = ["Local vendor"];
                try {
                  tags = JSON.parse(profile.tags || "[]");
                  if (tags.length === 0) tags = ["Local vendor"];
                } catch (e) {}

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
                        <div className="mt-2 flex items-center gap-3 text-[11px]">
                          <span className="inline-flex items-center gap-1 font-bold">
                            <Star className="h-3 w-3 fill-primary text-primary" />
                            {profile?.rating || "0.0"}
                          </span>
                          <span className="inline-flex items-center gap-1 text-muted-foreground font-medium">
                            <MapPin className="h-3 w-3" />{" "}
                            {v.distance_km ? v.distance_km.toFixed(1) : "1.2"} km
                          </span>
                          <span className="inline-flex items-center gap-1 text-muted-foreground font-medium">
                            <Clock className="h-3 w-3" /> {v.eta_min ? v.eta_min.toString() : "15"}{" "}
                            min
                          </span>
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
              No vendors match. Try clearing search or filters.
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
