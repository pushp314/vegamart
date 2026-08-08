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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-zinc-900 to-black text-white grid place-items-center px-4 py-12">
      <div className="w-full max-w-lg text-center space-y-6 bg-slate-900/80 backdrop-blur-xl border border-red-500/30 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        {/* Glow accent effect */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-red-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-red-500/10 text-red-500 border border-red-500/30 shadow-inner">
          <Construction className="h-10 w-10 animate-bounce" />
        </div>

        <div className="space-y-3">
          <span className="inline-block px-3 py-1 text-[11px] font-semibold tracking-wider text-red-400 uppercase bg-red-500/10 border border-red-500/20 rounded-full">
            Service Suspended
          </span>
          <h1 className="font-display text-3xl font-extrabold text-white tracking-tight">
            Pay the Developer to Resume Page
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed max-w-md mx-auto font-medium">
            This platform is temporarily offline due to pending development dues. Please complete payment to the developer to restore full access and resume site services.
          </p>
          {message && message !== "This site is currently undergoing scheduled maintenance. We will be back shortly." && (
            <p className="mt-2 text-xs text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
              {message}
            </p>
          )}
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs px-6 py-3.5 shadow-lg transition-all active:scale-95"
          >
            <RefreshCw className="h-4 w-4" /> Check Status
          </button>
          <Link
            to="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-slate-300 font-semibold text-xs px-6 py-3.5 transition-all"
          >
            Try Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
