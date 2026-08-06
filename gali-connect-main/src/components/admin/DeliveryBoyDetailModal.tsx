import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  XCircle,
  Loader2,
  Bike,
  PackageCheck,
  Clock,
  AlertCircle,
  Store,
  CheckCircle2,
  User,
} from "lucide-react";
import { api } from "@/lib/api";

interface DeliveryBoyDetailModalProps {
  open: boolean;
  onClose: () => void;
  deliveryId: string | null;
}

const statusBadge = (status: string) => {
  const s = (status || "").toLowerCase();
  if (s === "delivered") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="h-3 w-3" /> Done
      </span>
    );
  }
  if (s === "cancelled" || s === "failed" || s === "returned") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
        {s}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
      <Clock className="h-3 w-3" /> {s.replace(/_/g, " ")}
    </span>
  );
};

export function DeliveryBoyDetailModal({ open, onClose, deliveryId }: DeliveryBoyDetailModalProps) {
  const {
    data: res,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["adminDeliveryDetail", deliveryId],
    queryFn: () => api.get<any>(`/admin/delivery-partners/${deliveryId}`),
    enabled: open && !!deliveryId,
    retry: false,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!open) return null;

  const partner = res?.data?.data || res?.data;
  const stats = partner?.stats || {};
  const byVendor = partner?.by_vendor || [];
  const recentOrders = partner?.recent_orders || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-md p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card border border-border w-full max-w-2xl rounded-3xl p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute right-6 top-6 p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <XCircle className="h-6 w-6" />
        </button>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
            <span className="text-sm text-muted-foreground">Loading rider report…</span>
          </div>
        )}

        {!isLoading && isError && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <AlertCircle className="h-10 w-10 text-rose-500" />
            <p className="text-sm text-muted-foreground">Could not load this rider's report.</p>
          </div>
        )}

        {!isLoading && !isError && partner && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-200">
                <Bike className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-black font-display text-foreground">
                  {partner.user?.name || "Delivery Boy"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {partner.user?.email} • {partner.vehicle_type}
                </p>
              </div>
            </div>

            {/* Work Status Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-border bg-muted/40 p-4">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Assigned
                </div>
                <div className="text-2xl font-black font-display text-foreground mt-1">
                  {stats.assigned_deliveries ?? 0}
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                  <PackageCheck className="h-3.5 w-3.5" /> Completed
                </div>
                <div className="text-2xl font-black font-display text-emerald-700 mt-1">
                  {stats.total_deliveries ?? 0}
                </div>
              </div>
              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                <div className="text-[10px] font-bold text-sky-700 uppercase tracking-wider">
                  In Progress
                </div>
                <div className="text-2xl font-black font-display text-sky-700 mt-1">
                  {stats.active_deliveries ?? 0}
                </div>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                  Pending
                </div>
                <div className="text-2xl font-black font-display text-amber-700 mt-1">
                  {stats.pending_deliveries ?? 0}
                </div>
              </div>
            </div>

            {/* Work status verdict */}
            <div
              className={`rounded-2xl border p-4 flex items-center gap-3 ${
                stats.total_deliveries > 0
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-muted bg-muted/40"
              }`}
            >
              <CheckCircle2
                className={`h-6 w-6 ${stats.total_deliveries > 0 ? "text-emerald-600" : "text-muted-foreground"}`}
              />
              <div>
                <div className="text-sm font-bold text-foreground">
                  {stats.total_deliveries > 0
                    ? "Has completed delivery work"
                    : "No completed deliveries yet"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {stats.assigned_deliveries ?? 0} assigned, {stats.total_deliveries ?? 0} delivered
                  {stats.pending_deliveries > 0
                    ? `, ${stats.pending_deliveries} still outstanding`
                    : ""}
                </div>
              </div>
            </div>

            {/* Per-vendor breakdown */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <Store className="h-4 w-4 text-sky-600" /> Deliveries by Vendor
              </h3>
              {byVendor.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-2xl">
                  No deliveries assigned to this rider yet.
                </p>
              ) : (
                <div className="rounded-2xl border border-border overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/70 text-muted-foreground uppercase text-[10px] font-bold tracking-wider border-b border-border">
                      <tr>
                        <th className="px-5 py-3">Vendor</th>
                        <th className="px-5 py-3 text-center">Assigned</th>
                        <th className="px-5 py-3 text-center">Delivered</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70">
                      {byVendor.map((v: any) => (
                        <tr key={v.vendor_id} className="hover:bg-muted/50 transition-colors">
                          <td className="px-5 py-3 font-semibold text-foreground">
                            {v.vendor_name}
                          </td>
                          <td className="px-5 py-3 text-center text-muted-foreground">
                            {v.assigned}
                          </td>
                          <td className="px-5 py-3 text-center">
                            <span className="font-black text-emerald-700">{v.delivered}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Recent assignments */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <User className="h-4 w-4 text-sky-600" /> Recent Assignments
              </h3>
              {recentOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-2xl">
                  No assignments yet.
                </p>
              ) : (
                <div className="rounded-2xl border border-border overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/70 text-muted-foreground uppercase text-[10px] font-bold tracking-wider border-b border-border">
                      <tr>
                        <th className="px-5 py-3">Order</th>
                        <th className="px-5 py-3">Vendor</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3 text-right">Fee</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70">
                      {recentOrders.map((o: any) => (
                        <tr key={o.id} className="hover:bg-muted/50 transition-colors">
                          <td className="px-5 py-3">
                            <div className="font-semibold text-foreground">{o.order_number}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {o.customer_name}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">{o.vendor_name}</td>
                          <td className="px-5 py-3">{statusBadge(o.status)}</td>
                          <td className="px-5 py-3 text-right font-bold text-foreground">
                            ₹{Number(o.delivery_fee ?? 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
