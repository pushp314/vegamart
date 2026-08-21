import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { HardDrive, AlertTriangle, AlertOctagon, X, Sparkles } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

export interface StorageMetrics {
  configured: boolean;
  bucket_name: string | null;
  total_bytes: number;
  total_objects: number;
  used_mb: number;
  used_gb: number;
  quota_gb: number;
  percent_used: number;
  is_near_full: boolean;
  is_full: boolean;
  status: "OK" | "WARNING" | "CRITICAL";
  message: string;
}

export function StorageAlertBanner() {
  const navigate = useNavigate();
  const [isDismissed, setIsDismissed] = useState(false);

  const { data: metricsRes } = useQuery({
    queryKey: ["adminStorageMetrics"],
    queryFn: () => api.get<any>("/admin/storage/metrics"),
    refetchInterval: 60000, // Check storage every 1 minute
  });

  const metrics: StorageMetrics | undefined = metricsRes?.data?.data || metricsRes?.data;

  if (!metrics || !metrics.configured || (!metrics.is_near_full && !metrics.is_full) || isDismissed) {
    return null;
  }

  const isCritical = metrics.is_full;

  return (
    <div
      className={`mb-6 rounded-2xl p-4 transition-all shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border ${
        isCritical
          ? "bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200"
          : "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${
            isCritical ? "bg-rose-500 text-white" : "bg-amber-500 text-black"
          }`}
        >
          {isCritical ? <AlertOctagon className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm">
              {isCritical
                ? "🚨 Cloudflare R2 Storage Critically Full!"
                : "⚠️ Cloudflare R2 Storage Warning: Almost Full"}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                isCritical ? "bg-rose-500 text-white" : "bg-amber-500/20 text-amber-800 dark:text-amber-300"
              }`}
            >
              {metrics.percent_used}% Used ({metrics.used_gb} GB / {metrics.quota_gb} GB)
            </span>
          </div>
          <p className="text-xs opacity-90 leading-relaxed max-w-2xl">
            {metrics.message} When storage is exhausted, vendors and admins will not be able to upload product images, logos, or store banners.
          </p>

          {/* Progress bar */}
          <div className="w-full max-w-md bg-black/10 dark:bg-white/10 h-2 rounded-full overflow-hidden mt-1.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isCritical ? "bg-rose-600" : "bg-amber-500"
              }`}
              style={{ width: `${Math.min(metrics.percent_used, 100)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end">
        <button
          onClick={() => navigate({ to: "/admin/settings" })}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold shadow-sm transition-transform active:scale-95 ${
            isCritical
              ? "bg-rose-600 hover:bg-rose-700 text-white"
              : "bg-amber-500 hover:bg-amber-400 text-black"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" /> Manage & Clean Storage
        </button>
        {!isCritical && (
          <button
            onClick={() => setIsDismissed(true)}
            className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground transition-colors"
            title="Dismiss warning"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
