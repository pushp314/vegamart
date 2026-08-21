import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Wallet, Loader2, Percent, Landmark, CheckCircle2, ArrowRight } from "lucide-react";

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

          <div className="flex items-center justify-between mt-8 mb-4">
            <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              Lifetime Summary
            </h3>
            <span className="inline-flex items-center gap-1 font-bold text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-3 py-1 rounded-xl">
              <Percent className="h-3.5 w-3.5 text-amber-600" />
              Store Commission: {earnings.commission_rate ?? 5}%
            </span>
          </div>
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

          {/* Active Direct Settlement & Payout Method */}
          <div className="rounded-3xl border border-border bg-card/60 backdrop-blur-sm p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
                <Landmark className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-display text-sm font-bold text-foreground">
                    Direct Payout Destination
                  </h4>
                  {earnings.bank_details?.razorpay_account_id ? (
                    <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Razorpay Route Active
                    </span>
                  ) : earnings.bank_details?.configured ? (
                    <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Bank Account Configured
                    </span>
                  ) : (
                    <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                      ⚠️ Action Required
                    </span>
                  )}
                </div>
                {earnings.bank_details?.configured ? (
                  <p className="text-xs text-muted-foreground">
                    Settling directly to{" "}
                    <span className="font-bold text-foreground font-mono">
                      {earnings.bank_details.bank_account_number}
                    </span>{" "}
                    ({earnings.bank_details.bank_ifsc || "Direct IMPS"}) • {earnings.bank_details.bank_name || "Linked Bank"}
                    {earnings.bank_details.upi_id && (
                      <span className="ml-1.5 text-[11px] font-mono text-emerald-600 font-semibold">
                        • UPI: {earnings.bank_details.upi_id}
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Add your bank account number and IFSC code to receive automated order payouts.
                  </p>
                )}
              </div>
            </div>

            <Link
              to="/vendor/settings"
              className="inline-flex items-center justify-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border shrink-0 transition-colors cursor-pointer"
            >
              <span>{earnings.bank_details?.configured ? "Update Bank Details" : "Configure Bank Account"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
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
                    <th className="px-6 py-4 font-semibold text-center">Rate (%)</th>
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
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center gap-0.5 font-bold px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs">
                          {trx.commission_rate ?? earnings.commission_rate ?? 5}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-rose-500 font-semibold">
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
                        colSpan={6}
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
