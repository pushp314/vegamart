import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface MultiStoreLiveBadgeProps {
  className?: string;
}

export function MultiStoreLiveBadge({ className = "" }: MultiStoreLiveBadgeProps) {
  const { data: settingsRes } = useQuery({
    queryKey: ["publicSettings"],
    queryFn: () => api.get<any>("/settings/public"),
    refetchInterval: 5000, // 5s live polling so rider online state reflects live!
  });

  const settings = settingsRes?.data || {};
  const isVegaMartFleetEnabled = settings["platform.vegamart_delivery_enabled"] !== false;
  const isPartnerOnline = !!settings.has_active_delivery_partners && isVegaMartFleetEnabled;

  if (isPartnerOnline) {
    return (
      <div className={`rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/5 p-3.5 flex items-center justify-between gap-3 text-xs shadow-soft transition-all ${className}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <div className="min-w-0">
            <div className="font-extrabold text-emerald-950 dark:text-emerald-300 flex items-center gap-1.5 text-xs sm:text-sm truncate">
              🟢 Multi-Store Ordering LIVE
            </div>
            <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-400 truncate">
              Multiple Stores • One Delivery
            </div>
          </div>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 text-[10.5px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2.5 py-1 rounded-full border border-emerald-300 dark:border-emerald-800 shadow-xs">
          ⚡ Rider Online
        </span>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 flex items-center justify-between gap-3 text-xs shadow-soft transition-all ${className}`}>
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="relative flex h-3 w-3 shrink-0">
          <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
        </span>
        <div className="min-w-0">
          <div className="font-extrabold text-rose-950 dark:text-rose-300 flex items-center gap-1.5 text-xs sm:text-sm truncate">
            🔴 Currently Limited
          </div>
          <div className="text-[11px] font-semibold text-rose-800 dark:text-rose-400 leading-tight truncate">
            Multi-Store Ordering will unlock when a Delivery Partner is Online.
          </div>
        </div>
      </div>
      <span className="shrink-0 inline-flex items-center gap-1 text-[10.5px] font-black uppercase tracking-wider text-rose-800 dark:text-rose-300 bg-rose-100 dark:bg-rose-950 px-2.5 py-1 rounded-full border border-rose-300 dark:border-rose-800 shadow-xs">
        1 Store / Order
      </span>
    </div>
  );
}
