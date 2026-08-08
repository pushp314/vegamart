import { useState, useMemo, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { StreetVendorMap } from "@/components/marketplace/street-vendor-map";
import { Store, Phone, Star, Sparkles, Navigation } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const Route = createFileRoute("/street-vendors")({
  head: () => ({ meta: [{ title: "Live Street Vendors & Roaming Carts — Vegamart" }] }),
  component: StreetVendorsRoute,
});

function StreetVendorsRoute() {
  const { data: vendorsRes, isLoading } = useQuery({
    queryKey: ["allVendors"],
    queryFn: () => api.get<any[]>("/vendors"),
  });

  const vendorList: any[] = Array.isArray(vendorsRes?.data)
    ? vendorsRes.data
    : Array.isArray((vendorsRes?.data as any)?.data)
      ? (vendorsRes?.data as any).data
      : [];

  const filteredVendors = useMemo(() => {
    return vendorList; // Show all vendors as requested
  }, [vendorList]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-8">
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 space-y-4">
        {/* Map Section */}
        <div className="rounded-3xl border bg-card overflow-hidden shadow-soft relative h-[420px] md:h-[520px]">
          <StreetVendorMap />
        </div>

        {/* Live Vendors Cards */}
        <div className="flex items-center justify-between px-1">
          <h2 className="font-display text-lg font-black text-foreground flex items-center gap-2">
            <Navigation className="h-5 w-5 text-emerald-600" />
            Live Street Vendors
          </h2>
          <span className="text-xs font-bold text-muted-foreground">
            {filteredVendors.length} nearby
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-xs font-semibold text-muted-foreground">Loading vendors...</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredVendors.map((vendor) => {
              const profile = vendor.profile || {};
              const isRoaming = vendor.roaming === true || profile.roaming === true;
              const phoneNum = profile.phone || vendor.phone || "+919876543210";

              return (
                <div
                  key={vendor.id}
                  className="rounded-2xl border bg-card p-4 shadow-soft hover:shadow-glow hover:border-emerald-500/40 transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
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
                              <Sparkles className="h-3 w-3 text-amber-600" /> Roaming
                            </>
                          ) : (
                            <>
                              <Store className="h-3 w-3 text-emerald-600" /> Fixed
                            </>
                          )}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                          🟢 Live
                        </span>
                      </div>
                      <h3 className="font-display text-sm font-bold text-foreground truncate">
                        {vendor.business_name || vendor.name}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1 font-semibold text-amber-500">
                          <Star className="h-3 w-3 fill-amber-400" />
                          {profile.rating || "4.8"}
                        </span>
                        <span>•</span>
                        <span className="capitalize font-medium">
                          {profile.category || vendor.category || "General"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted/60 rounded-xl p-2 text-xs text-muted-foreground flex items-center justify-between gap-2">
                    <span className="truncate font-medium">
                      📍 {profile.address || "Main Market Street"}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 shrink-0">
                      {isRoaming ? "Moving" : "Open Now"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={`tel:${phoneNum}`}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-muted hover:bg-muted/80 text-foreground font-bold text-[11px] h-9 transition-colors"
                    >
                      <Phone className="h-3 w-3 text-emerald-600" /> Call
                    </a>
                    <Link
                      to="/vendors/$vendorId"
                      params={{ vendorId: vendor.id }}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-primary text-primary-foreground font-bold text-[11px] h-9 shadow-xs hover:bg-primary/90 transition-colors"
                    >
                      View Stock →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
