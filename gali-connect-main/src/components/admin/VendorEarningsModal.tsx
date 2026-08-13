import { useState } from "react";
import { X, Wallet, TrendingUp, ShoppingCart, Package } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface VendorEarningsModalProps {
  vendor: any;
  onClose: () => void;
}

export function VendorEarningsModal({ vendor, onClose }: VendorEarningsModalProps) {
  const [monthFilter, setMonthFilter] = useState("");

  const { data: earningsRes, isLoading } = useQuery({
    queryKey: ["adminVendorEarnings", vendor.id, monthFilter],
    queryFn: () => api.get<any>(`/admin/vendors/${vendor.id}/earnings${monthFilter ? `?month=${monthFilter}` : ""}`),
  });

  const earnings = earningsRes?.data?.data || earningsRes?.data || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl rounded-3xl border border-border bg-card shadow-2xl p-6 sm:p-8 overflow-y-auto max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute right-6 top-6 rounded-full p-2 text-muted-foreground hover:bg-muted transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold">Vendor Earnings</h2>
            <p className="text-muted-foreground text-sm mt-1">
              {vendor.business_name || "Unnamed Vendor"}'s earnings and stats
            </p>
          </div>
          <div>
            <input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="bg-card border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground">
            Loading earnings...
          </div>
        ) : (
          <div className="space-y-8">
            <div>
              <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4">
                Periodic Earnings
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-border bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-5 space-y-2 relative overflow-hidden">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                    Today's Earnings
                  </div>
                  <div className="font-display text-2xl font-bold text-indigo-600">
                    ₹{earnings.today_earnings || 0}
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-gradient-to-br from-blue-500/10 to-cyan-500/10 p-5 space-y-2 relative overflow-hidden">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                    Weekly Earnings
                  </div>
                  <div className="font-display text-2xl font-bold text-blue-600">
                    ₹{earnings.weekly_earnings || 0}
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-gradient-to-br from-teal-500/10 to-emerald-500/10 p-5 space-y-2 relative overflow-hidden">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-teal-700">
                    Monthly Earnings
                  </div>
                  <div className="font-display text-2xl font-bold text-teal-600">
                    ₹{earnings.monthly_earnings || 0}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4">
                Lifetime Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-border bg-muted/50 p-4 space-y-1 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Total Revenue
                  </div>
                  <div className="font-bold">₹{earnings.total_revenue || 0}</div>
                </div>
                <div className="rounded-2xl border border-border bg-muted/50 p-4 space-y-1 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Platform Fees
                  </div>
                  <div className="font-bold text-rose-500">-₹{earnings.total_commission || 0}</div>
                </div>
                <div className="rounded-2xl border border-border bg-emerald-500/10 p-4 space-y-1 text-center border-emerald-200">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                    Net Payout
                  </div>
                  <div className="font-bold text-emerald-600">
                    ₹{earnings.total_payout || 0}
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-muted/50 p-4 space-y-1 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                    Pending
                  </div>
                  <div className="font-bold text-amber-600">₹{earnings.pending_earnings || 0}</div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4">
                Order & Product Stats
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-border bg-card p-4 space-y-1 flex flex-col items-center justify-center text-center">
                  <ShoppingCart className="h-5 w-5 text-muted-foreground mb-1" />
                  <div className="font-bold">{earnings.total_orders || 0}</div>
                  <div className="text-[10px] font-medium text-muted-foreground uppercase">
                    Total Orders
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-card p-4 space-y-1 flex flex-col items-center justify-center text-center">
                  <TrendingUp className="h-5 w-5 text-muted-foreground mb-1" />
                  <div className="font-bold text-blue-600">{earnings.active_orders || 0}</div>
                  <div className="text-[10px] font-medium text-muted-foreground uppercase">
                    Active Orders
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-card p-4 space-y-1 flex flex-col items-center justify-center text-center">
                  <Package className="h-5 w-5 text-muted-foreground mb-1" />
                  <div className="font-bold">{earnings.product_count || 0}</div>
                  <div className="text-[10px] font-medium text-muted-foreground uppercase">
                    Total Products
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-card p-4 space-y-1 flex flex-col items-center justify-center text-center">
                  <X className="h-5 w-5 text-rose-500 mb-1" />
                  <div className="font-bold text-rose-600">{earnings.out_of_stock_count || 0}</div>
                  <div className="text-[10px] font-medium text-muted-foreground uppercase">
                    Out of Stock
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
