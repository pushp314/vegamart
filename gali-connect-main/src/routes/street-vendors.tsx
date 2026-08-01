import { useState, useMemo, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { StreetVendorMap } from "@/components/marketplace/street-vendor-map";
import {
  ArrowLeft,
  Search,
  MapPin,
  Sparkles,
  Store,
  Phone,
  Radio,
  Star,
  Navigation,
  BellRing,
  Megaphone,
  Clock,
  Bell,
  CheckCircle2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getStreetBroadcasts, fetchRemoteBroadcasts, StreetBroadcast } from "@/lib/street-broadcasts";
import { toast } from "sonner";

export const Route = createFileRoute("/street-vendors")({
  head: () => ({ meta: [{ title: "Live Street Vendors & Roaming Carts — Vegamart" }] }),
  component: StreetVendorsRoute,
});

function StreetVendorsRoute() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [vendorTypeFilter, setVendorTypeFilter] = useState<"all" | "roaming" | "shop">("all");
  const [broadcasts, setBroadcasts] = useState<StreetBroadcast[]>([]);

  useEffect(() => {
    setBroadcasts(getStreetBroadcasts());
    fetchRemoteBroadcasts().then((data) => setBroadcasts(data));

    const handleUpdate = () => {
      setBroadcasts(getStreetBroadcasts());
    };
    window.addEventListener("vegamart-broadcast-updated", handleUpdate);
    return () => {
      window.removeEventListener("vegamart-broadcast-updated", handleUpdate);
    };
  }, []);

  // Fetch real vendors from backend
  const { data: vendorsRes, isLoading } = useQuery({
    queryKey: ["allVendors"],
    queryFn: () => api.get<any[]>("/vendors"),
  });

  const vendorList: any[] = Array.isArray(vendorsRes?.data)
    ? vendorsRes.data
    : Array.isArray((vendorsRes?.data as any)?.data)
    ? (vendorsRes?.data as any).data
    : [];

  // Filter vendors based on category, type, and search query
  const filteredVendors = useMemo(() => {
    return vendorList.filter((v) => {
      const vType = v.profile?.vendor_type || v.vendor_type || "shop";
      const vCat = (v.profile?.category || v.category || "").toLowerCase();
      const vName = (v.business_name || v.name || "").toLowerCase();

      const matchesType = vendorTypeFilter === "all" || vType === vendorTypeFilter;
      const matchesCat = selectedCategory === "all" || vCat.includes(selectedCategory.toLowerCase());
      const matchesSearch = !searchQuery || vName.includes(searchQuery.toLowerCase()) || vCat.includes(searchQuery.toLowerCase());

      return matchesType && matchesCat && matchesSearch;
    });
  }, [vendorList, vendorTypeFilter, selectedCategory, searchQuery]);

  const roamingCount = vendorList.filter(
    (v) => (v.profile?.vendor_type || v.vendor_type) === "roaming"
  ).length;

  const categories = [
    { id: "all", label: "All Fleet", emoji: "🛒" },
    { id: "vegetables", label: "Vegetables", emoji: "🥦" },
    { id: "fruits", label: "Fruits", emoji: "🍎" },
    { id: "juice", label: "Chai & Juice", emoji: "☕" },
    { id: "dairy", label: "Dairy & Milk", emoji: "🥛" },
    { id: "bakery", label: "Bakery", emoji: "🥐" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Top Hero Header Panel (Non-sticky, clean flow) */}
        <div className="rounded-3xl border bg-card p-5 md:p-6 shadow-soft space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="grid h-10 w-10 place-items-center rounded-2xl border bg-muted hover:bg-card transition-colors shrink-0"
                aria-label="Go Back"
              >
                <ArrowLeft className="h-5 w-5 text-foreground" />
              </Link>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-xl md:text-2xl font-black text-foreground">
                    Live Street Vendors & Roaming Carts
                  </h1>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-0.5 text-xs font-extrabold text-emerald-600 animate-pulse">
                    <Radio className="h-3 w-3" /> Live Gali Radar
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Track moving push-carts and fixed merchants in real-time in your neighborhood.
                </p>
              </div>
            </div>

            {/* Quick Search Control */}
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-2xl bg-muted border border-border h-11 px-3 w-full md:w-72">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search carts, vegetables, chai..."
                  className="min-w-0 flex-1 bg-transparent px-2.5 text-xs outline-none font-medium"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="text-xs text-muted-foreground hover:text-foreground">
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/60">
            {/* Vendor Model Selector */}
            <div className="flex items-center gap-1.5 bg-muted p-1 rounded-2xl border border-border">
              <button
                onClick={() => setVendorTypeFilter("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  vendorTypeFilter === "all"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({vendorList.length})
              </button>
              <button
                onClick={() => setVendorTypeFilter("roaming")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                  vendorTypeFilter === "roaming"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Street Carts ({roamingCount})
              </button>
              <button
                onClick={() => setVendorTypeFilter("shop")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                  vendorTypeFilter === "shop"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Store className="h-3.5 w-3.5" /> Fixed Stores
              </button>
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border flex items-center gap-1.5 ${
                    selectedCategory === cat.id
                      ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-xs"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <span>{cat.emoji}</span> {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Today's Street Arrival Schedule & Announcements Section */}
        <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-teal-500/10 p-5 md:p-6 shadow-soft space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-2xl bg-amber-500 text-black font-black shrink-0">
                <Megaphone className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display font-black text-lg md:text-xl text-foreground">
                  Today's Street Arrival Schedule (Gali Schedule)
                </h2>
                <p className="text-xs text-muted-foreground">
                  Live announcements from roaming street carts informing you when they are coming to your street!
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-100/80 px-3 py-1 rounded-full shrink-0 self-start sm:self-auto">
              📢 {broadcasts.length} Active Street Announcements Today
            </span>
          </div>

          {/* Broadcast Cards Slider / Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {broadcasts.map((bcast) => (
              <div
                key={bcast.id}
                className="rounded-2xl border bg-card p-4 shadow-sm hover:border-amber-500/50 transition-all flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display font-extrabold text-sm text-foreground truncate">
                      {bcast.vendorName}
                    </span>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shrink-0">
                      🟢 Schedule Broadcast
                    </span>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <span className="truncate">{bcast.street}</span>
                    </div>

                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <Clock className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      <span>{bcast.arrivalTime}</span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-muted p-2.5 text-xs text-muted-foreground space-y-1">
                    <div className="font-bold text-foreground text-[11px] truncate">
                      🥦 Stock: {bcast.produce}
                    </div>
                    {bcast.note && (
                      <p className="italic text-[10.5px] leading-tight text-emerald-700">
                        "{bcast.note}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Card CTAs */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/50">
                  <button
                    onClick={() => toast.success(`🔔 Reminder set for ${bcast.vendorName} arrival at ${bcast.street}!`)}
                    className="flex items-center justify-center gap-1 rounded-xl border bg-muted hover:bg-card text-foreground font-bold text-[11px] h-9 transition-colors"
                  >
                    <Bell className="h-3.5 w-3.5 text-amber-500" /> Remind Me
                  </button>
                  <a
                    href={`tel:${bcast.phone}`}
                    className="flex items-center justify-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] h-9 shadow-xs transition-colors"
                  >
                    <Phone className="h-3.5 w-3.5" /> Call Cart
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2-Column Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Live Google/OSM Map (7 Columns) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-3xl border bg-card overflow-hidden shadow-lg relative h-[520px] lg:h-[600px]">
              <StreetVendorMap />

              {/* Map Floating Header Overlay */}
              <div className="absolute top-4 left-4 right-4 z-20 pointer-events-none flex items-center justify-between">
                <div className="pointer-events-auto bg-background/90 backdrop-blur-md border border-border/60 rounded-2xl px-3.5 py-2 shadow-md flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-xs font-black text-foreground">
                    Live GPS Radar Tracking
                  </span>
                </div>
              </div>
            </div>

            {/* How Live Tracking Works Banner */}
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-xs flex items-start gap-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-500 text-white font-bold">
                <BellRing className="h-5 w-5" />
              </div>
              <div className="space-y-1 text-xs">
                <div className="font-extrabold text-sm text-emerald-900">
                  How Hyperlocal Street Radar Works
                </div>
                <p className="text-emerald-800 leading-relaxed">
                  Street vendors continuously broadcast their GPS locations as they move through your gali.
                  Tap on any vendor cart on the map or list to view available stock!
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Live Vendors Fleet Cards Grid (5 Columns) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="font-display text-lg font-black text-foreground flex items-center gap-2">
                <Navigation className="h-5 w-5 text-emerald-600" />
                Active Vendors Near You
              </h2>
              <span className="text-xs font-bold text-muted-foreground">
                Showing {filteredVendors.length} results
              </span>
            </div>

            {isLoading ? (
              <div className="rounded-3xl border bg-card p-8 text-center space-y-3 shadow-soft">
                <div className="animate-spin text-emerald-500 mx-auto w-6 h-6">⏳</div>
                <div className="text-xs font-semibold text-muted-foreground">Loading nearby street vendor fleet...</div>
              </div>
            ) : filteredVendors.length === 0 ? (
              <div className="rounded-3xl border bg-card p-8 text-center space-y-3 shadow-soft">
                <Store className="h-10 w-10 text-muted-foreground mx-auto opacity-50" />
                <h3 className="font-bold text-sm text-foreground">No vendors found</h3>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Try clearing your search query or switching category filters to discover more local stores.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("all");
                    setVendorTypeFilter("all");
                  }}
                  className="inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xs px-4 py-2 mt-2 shadow-xs"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="space-y-3.5 max-h-[600px] overflow-y-auto pr-1">
                {filteredVendors.map((vendor) => {
                  const profile = vendor.profile || {};
                  const isRoaming = (profile.vendor_type || vendor.vendor_type) === "roaming";
                  const phoneNum = profile.phone || vendor.phone || "+919876543210";

                  return (
                    <div
                      key={vendor.id}
                      className="rounded-3xl border bg-card p-4 shadow-soft hover:shadow-glow hover:border-emerald-500/40 transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                                isRoaming
                                  ? "bg-amber-50 text-amber-800 border-amber-200"
                                  : "bg-emerald-50 text-emerald-800 border-emerald-200"
                              }`}
                            >
                              {isRoaming ? (
                                <>
                                  <Sparkles className="h-3 w-3 text-amber-600" /> Roaming Cart
                                </>
                              ) : (
                                <>
                                  <Store className="h-3 w-3 text-emerald-600" /> Fixed Shop
                                </>
                              )}
                            </span>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                              🟢 Live
                            </span>
                          </div>

                          <h3 className="font-display text-base font-bold text-foreground truncate">
                            {vendor.business_name || vendor.name}
                          </h3>

                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1 font-semibold text-amber-500">
                              <Star className="h-3.5 w-3.5 fill-amber-400" />
                              {profile.rating || "4.8"}
                            </span>
                            <span>•</span>
                            <span className="capitalize font-medium">{profile.category || vendor.category || "General"}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-emerald-600 font-bold">
                              <MapPin className="h-3 w-3" /> 0.3 km away
                            </span>
                          </div>
                        </div>

                        <Link
                          to="/vendors/$vendorId"
                          params={{ vendorId: vendor.id }}
                          className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors shrink-0"
                          title="View Store"
                        >
                          <ArrowLeft className="h-4 w-4 rotate-180" />
                        </Link>
                      </div>

                      {/* Address & Status Pill */}
                      <div className="bg-muted/60 rounded-2xl p-2.5 text-xs text-muted-foreground flex items-center justify-between gap-2">
                        <span className="truncate font-medium">
                          📍 {profile.address || "Main Market Street, Bengaluru"}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 shrink-0">
                          {isRoaming ? "Moving ~15 min ETA" : "Open Now"}
                        </span>
                      </div>

                      {/* Action CTAs */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <a
                          href={`tel:${phoneNum}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-muted hover:bg-muted/80 text-foreground font-bold text-xs h-10 transition-colors"
                        >
                          <Phone className="h-3.5 w-3.5 text-emerald-600" /> Call Vendor
                        </a>

                        <Link
                          to="/vendors/$vendorId"
                          params={{ vendorId: vendor.id }}
                          className="flex items-center justify-center gap-1.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs h-10 shadow-xs hover:bg-primary/90 transition-colors"
                        >
                          View Live Stock &rarr;
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
