import { createFileRoute, useNavigate, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Store as StoreIcon,
  ClipboardList,
  Wallet,
  Settings,
  MapPin,
  Star,
  BarChart3,
  Power,
  Ban,
  Clock,
  Ticket,
  Crown,
} from "lucide-react";
import { PortalLayout } from "@/components/layout/portal-layout";
import { VendorKYCForm } from "@/components/vendor/shared";
import { VendorPlanOnboarding } from "@/components/vendor/VendorPlanOnboarding";

export const Route = createFileRoute("/vendor")({
  component: VendorParentLayout,
});

function VendorParentLayout() {
  const { pathname } = Route.useMatch();

  // If we are exactly on these sub-routes, render them without the PortalLayout
  // because they have their own full-page UI (like login)
  if (pathname === "/vendor/login") {
    return <Outlet />;
  }

  return <VendorDashboard />;
}

function VendorDashboard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate({ to: "/" });
  };

  useEffect(() => {
    if (user && user.role !== "vendor") {
      toast.error("Access restricted: Vendor account required.");
      if (user.role === "delivery") navigate({ to: "/delivery" });
      else if (user.role === "admin" || user.role === "super_admin") navigate({ to: "/admin" });
      else navigate({ to: "/" });
    }
  }, [user, navigate]);

  const { data: vendorRes, isLoading: vendorLoading } = useQuery({
    queryKey: ["vendorProfile"],
    queryFn: () => api.get<{ data: any }>("/vendors/me"),
    enabled: isAuthenticated,
  });

  const vendor = vendorRes?.data?.data || vendorRes?.data;

  useEffect(() => {
    const vType = vendor?.profile?.vendor_type || vendor?.vendor_type;
    if (vendor && vType === "roaming") {
      navigate({ to: "/vendor" });
    }
  }, [vendor, navigate]);

  const { data: kycRes } = useQuery({
    queryKey: ["vendorKYC"],
    queryFn: () => api.get<{ data: any }>("/vendors/me/kyc"),
    enabled: !!vendor?.id,
  });

  const kyc = kycRes?.data?.data || kycRes?.data;

  const { data: membershipRes } = useQuery({
    queryKey: ["vendorMembership"],
    queryFn: () => api.get<{ tier: string; plan: { id: string } | null }>("/vendors/me/membership"),
    enabled: !!vendor?.id,
  });
  const membership = membershipRes?.data;
  const hasChosenPlan = !!membership?.plan;
  const membershipTier = membership?.tier;

  const toggleAvailabilityMutation = useMutation({
    mutationFn: (isOpen: boolean) => api.put("/vendors/me/availability", { is_open: isOpen }),
    onSuccess: (_, isOpen) => {
      queryClient.invalidateQueries({ queryKey: ["vendorProfile"] });
      toast.success(isOpen ? "Store is now LIVE 🟢" : "Store marked as CLOSED 🔴");
    },
  });

  const navigation = [
    { id: "overview", title: "Overview", icon: LayoutDashboard, url: "/vendor" },
    { id: "products", title: "Products", icon: StoreIcon, url: "/vendor/products" },
    { id: "orders", title: "Orders", icon: ClipboardList, url: "/vendor/orders" },
    { id: "earnings", title: "Earnings", icon: Wallet, url: "/vendor/earnings" },
    { id: "membership", title: "Membership", icon: Crown, url: "/vendor/membership" },
    { id: "location", title: "Location", icon: MapPin, url: "/vendor/location" },
    { id: "reviews", title: "Reviews", icon: Star, url: "/vendor/reviews" },
    { id: "analytics", title: "Analytics", icon: BarChart3, url: "/vendor/analytics" },
    { id: "coupons", title: "Coupons", icon: Ticket, url: "/vendor/coupons" },
    { id: "settings", title: "Settings", icon: Settings, url: "/vendor/settings" },
  ];

  const currentPath = location.pathname;
  let activeTab = "overview";
  if (currentPath === "/vendor") activeTab = "overview";
  else {
    const matchedNav = navigation.find((n) => n.url !== "/vendor" && currentPath.startsWith(n.url));
    if (matchedNav) activeTab = matchedNav.id;
  }

  // Handle Loading State
  if (!isAuthenticated) return null;
  if (vendorLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse space-y-4 text-center">
          <div className="mx-auto h-16 w-16 rounded-3xl bg-primary/20" />
          <div className="h-4 w-32 rounded bg-muted" />
        </div>
      </div>
    );
  }

  const vendorStatus = (vendor?.status || "").toLowerCase();
  const kycStatus = (kyc?.status || "").toLowerCase();
  const isApproved = vendorStatus === "approved" || kycStatus === "approved";
  const isSuspended = vendorStatus === "suspended";

  // Handle Suspended Vendor
  if (vendor && isSuspended) {
    return (
      <div className="min-h-screen bg-background/50 p-6 flex items-center justify-center">
        <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-2xl space-y-6 max-w-xl">
          <div className="grid h-20 w-20 mx-auto place-items-center rounded-full bg-rose-500/10 text-rose-500">
            <Ban className="h-10 w-10" />
          </div>
          <h2 className="font-display text-2xl font-bold text-rose-600">
            Account Suspended
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Your vendor account has been temporarily suspended. Please contact our support team to resolve this issue and restore your account access.
          </p>
          <a
            href="mailto:support@vegamart.com"
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Ticket className="h-4 w-4" />
            Contact Support
          </a>
          <button
            onClick={handleLogout}
            className="mt-4 w-full rounded-2xl border border-border/50 bg-muted/50 px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // Handle KYC or Pending Approval
  if (vendor && !isApproved) {
    return (
      <div className="min-h-screen bg-background/50 p-6 flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-80 shrink-0 space-y-4">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <h2 className="font-display font-bold text-lg mb-2">Account Setup</h2>
            <p className="text-xs text-muted-foreground mb-6">
              Complete your profile to start accepting orders.
            </p>
            <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-3.5 before:w-0.5 before:bg-border/50">
              <div className="relative flex items-start gap-4">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-500 text-white z-10 shadow-[0_0_0_4px_hsl(var(--card))]">
                  <span className="text-xs font-bold">1</span>
                </div>
                <div className="pt-1">
                  <p className="text-sm font-bold text-foreground">Basic Profile</p>
                  <p className="text-[10px] text-muted-foreground">Completed</p>
                </div>
              </div>
              <div className="relative flex items-start gap-4">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-primary bg-background text-primary z-10 shadow-[0_0_0_4px_hsl(var(--card))]">
                  <span className="text-xs font-bold">2</span>
                </div>
                <div className="pt-1">
                  <p className="text-sm font-bold text-foreground">KYC Verification</p>
                  <p className="text-[10px] text-muted-foreground">Action required</p>
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="mt-8 w-full rounded-2xl border border-border/50 bg-muted/50 px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="flex-1">
          {kyc && kyc.status === "pending" ? (
            <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-2xl space-y-4 max-w-xl">
              <div className="grid h-20 w-20 mx-auto place-items-center rounded-full bg-amber-500/10 text-amber-500">
                <Clock className="h-10 w-10" />
              </div>
              <h2 className="font-display text-2xl font-bold">KYC Under Review</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Your documents have been submitted successfully and are currently being reviewed by
                our team. This usually takes 1-2 business days.
              </p>
            </div>
          ) : vendor.status === "rejected" ? (
            <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-2xl space-y-4 max-w-xl">
              <div className="grid h-20 w-20 mx-auto place-items-center rounded-full bg-rose-500/10 text-rose-500">
                <Ban className="h-10 w-10" />
              </div>
              <h2 className="font-display text-2xl font-bold text-rose-600">
                Application Rejected
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Unfortunately, your application to become a vendor has been rejected. Please contact
                support for more details.
              </p>
            </div>
          ) : (
            <VendorKYCForm
              vendor={vendor}
              initialData={kyc}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ["vendorKYC"] });
              }}
            />
          )}
        </div>
      </div>
    );
  }

  // First-time approved vendors: ask them to pick a plan before they start.
  if (isApproved && !hasChosenPlan) {
    if (currentPath === "/vendor/membership/upgrade") {
      return (
        <div className="min-h-screen bg-background py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </div>
      );
    }
    return <VendorPlanOnboarding />;
  }

  return (
    <PortalLayout
      portalName="Vendor Hub"
      navItems={navigation}
      activeItemId={activeTab}
      userEmail={user?.email}
      onLogout={handleLogout}
    >
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-border bg-card p-4 sm:p-6 shadow-2xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="relative">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-sm">
              <StoreIcon className="h-6 w-6" />
            </div>
            <div
              className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-background ${vendor?.is_open ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-rose-500"}`}
            />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight capitalize group-hover:text-primary transition-colors">
              {vendor?.business_name || vendor?.name || "Your Store"}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border border-border/50">
                {vendor?.profile?.vendor_type || vendor?.vendor_type || "Vendor"}
              </span>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider ${vendor?.is_open ? "text-emerald-500" : "text-rose-500"}`}
              >
                {vendor?.is_open ? "Accepting Orders" : "Store Closed"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          <button
            onClick={() => toggleAvailabilityMutation.mutate(!vendor?.is_open)}
            disabled={toggleAvailabilityMutation.isPending}
            className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all shadow-sm ${
              vendor?.is_open
                ? "bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 hover:border-rose-300"
                : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 hover:border-emerald-300"
            }`}
          >
            <Power className="h-4 w-4" />
            {vendor?.is_open ? "Close Store" : "Open Store"}
          </button>
        </div>
      </div>

      <Outlet />
    </PortalLayout>
  );
}
