import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Crown,
  Loader2,
  LayoutDashboard,
  Package,
  ClipboardList,
  Wallet,
  Settings,
  MapPin,
  Star,
  BarChart3,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { PortalLayout } from "@/components/layout/portal-layout";
import { useAuth } from "@/context/auth-context";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const Route = createFileRoute("/vendor/membership")({
  head: () => ({ meta: [{ title: "Membership — Vegamart Vendor" }] }),
  component: VendorMembershipLayout,
});

type VendorProfileShape = {
  id: string;
  business_name: string;
  status: string;
};

function VendorMembershipLayout() {
  const navigate = useNavigate();
  const routerState = useRouterState();
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  
  const pathname = routerState.location.pathname;

  const { data: vendorRes } = useQuery({
    queryKey: ["vendorProfile"],
    queryFn: () => api.get<{ data: VendorProfileShape }>("/vendors/me"),
    enabled: isAuthenticated,
  });
  const vendor = (vendorRes?.data?.data ?? vendorRes?.data) as VendorProfileShape | undefined;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!isAuthenticated || !vendor) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <main className="flex-1 max-w-md w-full mx-auto px-6 py-16 text-center space-y-4">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/10 text-emerald-500">
            <Crown className="h-8 w-8" />
          </div>
          <h2 className="font-display text-xl font-bold">Login as a Vendor</h2>
          <p className="text-xs text-muted-foreground">
            Please log in with your vendor account to manage your membership.
          </p>
          <Link
            to="/vendor/login"
            className="inline-flex items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold text-sm h-12 px-6"
          >
            Vendor Login
          </Link>
        </main>
      </div>
    );
  }

  const navItems = [
    { id: "overview", title: "Overview", icon: LayoutDashboard, url: "/vendor" },
    { id: "products", title: "Products", icon: Package, url: "/vendor/products" },
    { id: "orders", title: "Orders", icon: ClipboardList, url: "/vendor/orders" },
    { id: "earnings", title: "Earnings", icon: Wallet, url: "/vendor/earnings" },
    { id: "membership", title: "Membership", icon: Crown, url: "/vendor/membership" },
    { id: "location", title: "Location", icon: MapPin, url: "/vendor/location" },
    { id: "reviews", title: "Reviews", icon: Star, url: "/vendor/reviews" },
    { id: "analytics", title: "Analytics", icon: BarChart3, url: "/vendor/analytics" },
    { id: "settings", title: "Settings", icon: Settings, url: "/vendor/settings" },
  ];

  return (
    <PortalLayout
      navItems={navItems}
      activeItemId="membership"
      portalName="Vendor Hub"
      userEmail={vendor.business_name}
      onLogout={() => {
        logout();
        navigate({ to: "/login" });
      }}
    >
      <div className="space-y-6">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-8 text-white shadow-2xl border border-indigo-500/20">
          {/* Decorative ambient background glows */}
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />

          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none hidden sm:block">
            <Crown className="w-56 h-56 rotate-12 text-amber-400" />
          </div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500/20 to-indigo-500/20 px-3 py-1 text-xs font-bold text-amber-300 backdrop-blur-md border border-amber-500/30">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                Vegamart Growth Portal
              </div>
              <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight">
                Vendor Membership & Plans
              </h1>
              <p className="text-slate-300 max-w-xl text-sm leading-relaxed">
                Supercharge your store with reduced commission rates, priority search ranking, unlimited product listings, and dedicated seller support.
              </p>
            </div>

            <div className="shrink-0">
              <Link
                to="/vendor/membership/upgrade"
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 px-5 py-3 text-xs font-black text-slate-950 uppercase tracking-wider shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 hover:scale-[1.02] transition-all"
              >
                Explore Plans <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Tab Navigation for Sub-pages */}
        <div className="flex items-center gap-2 rounded-2xl bg-card p-1.5 w-max border border-border shadow-sm">
          <Link
            to="/vendor/membership"
            activeProps={{ className: "bg-slate-900 text-white font-bold shadow-md" }}
            inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
            className={`px-6 py-2.5 text-xs rounded-xl transition-all font-semibold ${
              pathname === "/vendor/membership" || pathname === "/vendor/membership/"
                ? "bg-slate-900 text-white font-bold shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            My Current Plan
          </Link>
          <Link
            to="/vendor/membership/upgrade"
            activeProps={{ className: "bg-slate-900 text-white font-bold shadow-md" }}
            inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
            className={`px-6 py-2.5 text-xs rounded-xl transition-all font-semibold ${
              pathname.includes("upgrade")
                ? "bg-slate-900 text-white font-bold shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Upgrade & Plans
          </Link>
        </div>

        {/* Sub-page Content */}
        <div className="pt-2">
          <Outlet />
        </div>
      </div>
    </PortalLayout>
  );
}
