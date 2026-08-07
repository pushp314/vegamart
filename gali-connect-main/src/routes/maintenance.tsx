import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Construction, RefreshCw } from "lucide-react";

import { checkMaintenanceStatus } from "../lib/api";

export const Route = createFileRoute("/maintenance")({
  head: () => ({ meta: [{ title: "Maintenance — Vegamart" }] }),
  component: MaintenancePage,
});

function MaintenancePage() {
  const { data: statusRes } = useQuery({
    queryKey: ["maintenanceStatus"],
    queryFn: () => checkMaintenanceStatus(),
    refetchInterval: 15000,
  });

  const maintenanceKnown = statusRes?.success === true;
  const maintenanceOn = maintenanceKnown && statusRes.data?.maintenance === true;

  useEffect(() => {
    if (maintenanceKnown && maintenanceOn === false) {
      window.location.replace("/");
    }
  }, [maintenanceKnown, maintenanceOn]);

  const message =
    maintenanceOn && statusRes?.data?.message
      ? statusRes.data.message
      : "This site is currently undergoing scheduled maintenance. We will be back shortly.";

  return (
    <div className="min-h-screen bg-background grid place-items-center px-4 py-12">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-amber-100 text-amber-600">
          <Construction className="h-10 w-10" />
        </div>

        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            We're Under Maintenance
          </h1>
          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
            {message}
          </p>
          <p className="mt-3 text-[11px] text-muted-foreground/80">
            You'll be redirected back automatically once maintenance is complete.
          </p>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-2xl bg-primary text-primary-foreground font-bold text-xs px-6 py-3 shadow-xs hover:bg-primary/90"
        >
          <RefreshCw className="h-4 w-4" /> Check Again
        </button>

        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-2xl border border-border text-muted-foreground font-bold text-xs px-6 py-3 hover:bg-muted"
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
