import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Wallet, Loader2 } from "lucide-react";

export const Route = createFileRoute("/vendor/earnings")({
  component: VendorEarningsPage,
});

function VendorEarningsPage() {
  const { data: vendorRes } = useQuery({
    queryKey: ["vendorProfile"],
    queryFn: () => api.get<{ data: any }>("/vendors/me"),
  });
  const vendor = vendorRes?.data?.data || vendorRes?.data;

  const [earningsMonthFilter, setEarningsMonthFilter] = useState("");

  const { data: earningsRes, isLoading: earningsLoading } = useQuery({
    queryKey: ["vendorEarnings", earningsMonthFilter],
    queryFn: () =>
      api.get<{ data: any }>(
        `/vendors/me/earnings${earningsMonthFilter ? `?month=${earningsMonthFilter}` : ""}`
      ),
    enabled: !!vendor?.id && vendor?.status === "approved",
  });

  const earnings = earningsRes?.data?.data || {};

  return (
    <div className="space-y-6">
      {earningsLoading ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground text-xs gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-amber-600" /> Calculating payouts...
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              Periodic Earnings
            </h3>
            <input
              type="month"
              value={earningsMonthFilter}
              onChange={(e) => setEarningsMonthFilter(e.target.value)}
              className="bg-card border border-border rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-3xl border border-border bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-5 space-y-2 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Wallet className="h-12 w-12" />
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                Today's Earnings
              </div>
              <div className="font-display text-2xl font-bold text-indigo-600">
                ₹{earnings.today_earnings || 0}
              </div>
              <div className="text-[11px] text-muted-foreground">Payout for today</div>
            </div>
            <div className="rounded-3xl border border-border bg-gradient-to-br from-blue-500/10 to-cyan-500/10 p-5 space-y-2 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Wallet className="h-12 w-12" />
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                Weekly Earnings
              </div>
              <div className="font-display text-2xl font-bold text-blue-600">
                ₹{earnings.weekly_earnings || 0}
              </div>
              <div className="text-[11px] text-muted-foreground">Payout for this week</div>
            </div>
            <div className="rounded-3xl border border-border bg-gradient-to-br from-teal-500/10 to-emerald-500/10 p-5 space-y-2 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Wallet className="h-12 w-12" />
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-teal-700">
                Monthly Earnings
              </div>
              <div className="font-display text-2xl font-bold text-teal-600">
                ₹{earnings.monthly_earnings || 0}
              </div>
              <div className="text-[11px] text-muted-foreground">Payout for this month</div>
            </div>
          </div>

          <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground mt-8">
            Lifetime Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-3xl border border-border bg-muted/50 p-5 space-y-2 shadow-2xl">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Gross Revenue
              </div>
              <div className="font-display text-2xl font-bold text-foreground">
                ₹{earnings.total_revenue || 0}
              </div>
              <div className="text-[11px] text-muted-foreground">Total order value</div>
            </div>
            <div className="rounded-3xl border border-border bg-muted/50 p-5 space-y-2 shadow-2xl">
              <div className="text-[10px] font-bold uppercase tracking-wider text-rose-500/80">
                Platform Fees
              </div>
              <div className="font-display text-2xl font-bold text-rose-500">
                -₹{earnings.total_commission || 0}
              </div>
              <div className="text-[11px] text-muted-foreground">Vegamart commission</div>
            </div>
            <div className="rounded-3xl border border-border bg-emerald-500/10 border-emerald-200 p-5 space-y-2 shadow-2xl">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                Net Payout
              </div>
              <div className="font-display text-2xl font-bold text-emerald-600">
                ₹{earnings.total_payout || 0}
              </div>
              <div className="text-[11px] text-emerald-700 font-semibold">
                Ready for withdrawal
              </div>
            </div>
            <div className="rounded-3xl border border-border bg-muted/50 p-5 space-y-2 shadow-2xl">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                Pending Payout
              </div>
              <div className="font-display text-2xl font-bold text-amber-600">
                ₹{earnings.pending_payout || 0}
              </div>
              <div className="text-[11px] text-amber-700 font-semibold">Active orders</div>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card shadow-2xl overflow-hidden mt-8">
            <div className="border-b border-border bg-muted/50 px-6 py-4">
              <h3 className="font-display font-bold">Recent Transactions</h3>
            </div>
            <div className="p-0 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/20">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Date</th>
                    <th className="px-6 py-4 font-semibold">Order ID</th>
                    <th className="px-6 py-4 font-semibold text-right">Amount</th>
                    <th className="px-6 py-4 font-semibold text-right">Commission</th>
                    <th className="px-6 py-4 font-semibold text-right">Net Earning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {earnings.transactions?.map((trx: any) => (
                    <tr key={trx.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                        {new Date(trx.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium">
                        #{trx.order_number || trx.id.slice(0, 8)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        ₹{trx.total_amount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-rose-500">
                        -₹{trx.commission_amount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-emerald-600">
                        ₹{trx.vendor_earning}
                      </td>
                    </tr>
                  ))}
                  {(!earnings.transactions || earnings.transactions.length === 0) && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-muted-foreground text-xs italic"
                      >
                        No transactions found for the selected period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
