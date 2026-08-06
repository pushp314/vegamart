import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { Crown, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/vendor/membership")({
  head: () => ({ meta: [{ title: "Membership — Vegamart Vendor" }] }),
  component: VendorMembershipLayout,
});

function VendorMembershipLayout() {
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  const isUpgradeTab = pathname.includes("upgrade");
  const isIndexTab = pathname === "/vendor/membership" || pathname === "/vendor/membership/";

  const tabClass = (active: boolean) =>
    cn(
      "px-5 py-2.5 text-xs rounded-xl font-semibold transition-all whitespace-nowrap",
      active
        ? "bg-slate-900 text-white font-bold shadow-md"
        : "text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/20">
            <Crown className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-black tracking-tight">
              Membership & Plans
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Manage your subscription, usage and billing in one place.
            </p>
          </div>
        </div>

        {!isUpgradeTab && (
          <Link to="/vendor/membership/upgrade">
            <Button
              size="lg"
              className="gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black uppercase tracking-wider shadow-lg shadow-amber-500/20 hover:from-amber-400/95 hover:to-amber-500/95"
            >
              Explore Plans <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        )}
      </div>

      {/* Tab navigation */}
      <div className="flex w-max max-w-full items-center gap-1.5 overflow-x-auto rounded-2xl border border-border bg-card p-1.5 shadow-sm">
        <Link to="/vendor/membership" className={tabClass(isIndexTab)}>
          My Current Plan
        </Link>
        <Link to="/vendor/membership/upgrade" className={tabClass(isUpgradeTab)}>
          Upgrade & Plans
        </Link>
      </div>

      {/* Sub-page content */}
      <div className="pt-1">
        <Outlet />
      </div>
    </div>
  );
}
