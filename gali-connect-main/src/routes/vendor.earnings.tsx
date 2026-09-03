import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Wallet,
  Loader2,
  Percent,
  Landmark,
  CheckCircle2,
  ArrowRight,
  Download,
  Clock,
  ArrowUpRight,
  TrendingUp,
  AlertCircle,
  Smartphone,
  ShieldCheck,
  History,
  FileText,
  BadgeIndianRupee,
  Receipt,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VendorBankDetailsModal } from "@/components/vendor/VendorBankDetailsModal";
import { VendorWithdrawalModal } from "@/components/vendor/VendorWithdrawalModal";
import { VendorMonthlyInvoiceModal } from "@/components/vendor/VendorMonthlyInvoiceModal";
import { toast } from "sonner";

export const Route = createFileRoute("/vendor/earnings")({
  component: VendorEarningsPage,
});

function VendorEarningsPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "payouts" | "ledger">("overview");
  const [earningsMonthFilter, setEarningsMonthFilter] = useState("");
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { data: vendorRes } = useQuery({
    queryKey: ["vendorProfile"],
    queryFn: () => api.get<{ data: any }>("/vendors/me"),
  });
  const vendor = vendorRes?.data?.data || vendorRes?.data;

  // Real-time Wallet Overview (Available, Escrow, Withdrawn, Bank details, Payout Requests, Ledger)
  const { data: walletRes, isLoading: walletLoading } = useQuery({
    queryKey: ["vendorWallet"],
    queryFn: () => api.get<{ data: any }>("/vendors/me/wallet"),
    enabled: !!vendor?.id && vendor?.status?.toUpperCase() === "APPROVED",
  });
  const wallet = walletRes?.data?.data || walletRes?.data || {};

  // Periodic earnings
  const { data: earningsRes, isLoading: earningsLoading } = useQuery({
    queryKey: ["vendorEarnings", earningsMonthFilter],
    queryFn: () =>
      api.get<{ data: any }>(
        `/vendors/me/earnings${earningsMonthFilter ? `?month=${earningsMonthFilter}` : ""}`
      ),
    enabled: !!vendor?.id && vendor?.status?.toUpperCase() === "APPROVED",
  });
  const earnings = earningsRes?.data?.data || {};

  const availableBalance = Number(wallet.available_balance ?? earnings.total_payout ?? 0);
  const pendingEscrow = Number(wallet.pending_escrow ?? earnings.pending_payout ?? 0);
  const totalWithdrawn = Number(wallet.total_withdrawn ?? 0);
  const deficitBalance = Number(wallet.deficit_balance ?? 0);
  const bankDetails = wallet.bank_details || earnings.bank_details || {};
  const isBankConfigured = Boolean(wallet.bank_configured || earnings.bank_details?.configured);

  const handleExportStatement = async () => {
    setIsExporting(true);
    try {
      const token = localStorage.getItem("accessToken") || "";
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/v1/vendors/me/wallet/statement/export`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to export statement");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vegamart-wallet-statement-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Wallet statement downloaded successfully! 📄");
    } catch {
      toast.error("Failed to export wallet statement");
    } finally {
      setIsExporting(false);
    }
  };

  if (walletLoading || earningsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-muted-foreground text-xs gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" /> Loading Vendor Wallet & Balance...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-black text-foreground flex items-center gap-2.5">
            <Wallet className="h-7 w-7 text-emerald-600" />
            Vendor Wallet & Payouts Hub
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time balance, instant on-demand withdrawals, and direct bank settlement history.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => setInvoiceModalOpen(true)}
            className="rounded-2xl border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-500/5 hover:bg-emerald-500/10 h-11 text-xs font-bold flex items-center gap-1.5 shadow-xs"
          >
            <Receipt className="h-4 w-4 text-emerald-600" />
            Monthly Tax Invoice
          </Button>

          <Button
            variant="outline"
            onClick={handleExportStatement}
            disabled={isExporting}
            className="rounded-2xl border-border h-11 text-xs font-bold flex items-center gap-1.5 shadow-xs"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 text-muted-foreground" />}
            Export Statement (CSV)
          </Button>

          <Button
            onClick={() => setWithdrawalModalOpen(true)}
            className="rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs h-11 px-5 flex items-center gap-2 shadow-md hover:shadow-emerald-500/20"
          >
            <ArrowUpRight className="h-4 w-4" />
            Withdraw Funds
          </Button>
        </div>
      </div>

      {/* ⚠️ Deficit Alert Banner if negative balance exists */}
      {deficitBalance > 0 && (
        <div className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-200 flex items-start gap-3 animate-in fade-in">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <span className="font-bold">Wallet Deficit Balance: -₹{deficitBalance.toFixed(2)}</span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              A customer dispute refund was reversed after funds were already disbursed. Incoming order earnings will
              automatically replenish this deficit until your available balance returns to positive.
            </p>
          </div>
        </div>
      )}

      {/* 💼 Wallet Core Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
        {/* Available Balance Card */}
        <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-teal-500/10 p-5 shadow-soft relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Wallet className="h-16 w-16 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Available Wallet Balance
              </span>
              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                Ready to Disburse
              </span>
            </div>
            <div className="font-display text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
              ₹{availableBalance.toFixed(2)}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-emerald-500/20 flex items-center justify-between text-xs">
            <span className="text-muted-foreground text-[11px]">Minimum ₹100 req.</span>
            <button
              onClick={() => setWithdrawalModalOpen(true)}
              className="font-bold text-emerald-700 dark:text-emerald-300 hover:underline flex items-center gap-1 text-xs"
            >
              Withdraw <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* In-Escrow Pending Balance Card */}
        <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-orange-500/10 p-5 shadow-soft relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Clock className="h-16 w-16 text-amber-600" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Pending in Escrow
              </span>
              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
                24h Dispute Hold
              </span>
            </div>
            <div className="font-display text-3xl font-black text-amber-600 dark:text-amber-400 mt-2">
              ₹{pendingEscrow.toFixed(2)}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-amber-500/20 text-[11px] text-muted-foreground">
            Releases to Available balance 24h after delivery (Dispute Protection).
          </div>
        </div>

        {/* Total Lifetime Withdrawn Card */}
        <div className="rounded-3xl border border-blue-500/30 bg-gradient-to-br from-blue-500/15 via-blue-500/5 to-indigo-500/10 p-5 shadow-soft relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Landmark className="h-16 w-16 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-800 dark:text-blue-300">
                Total Withdrawn
              </span>
              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase bg-blue-500/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                Settled to Bank
              </span>
            </div>
            <div className="font-display text-3xl font-black text-blue-600 dark:text-blue-400 mt-2">
              ₹{totalWithdrawn.toFixed(2)}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-blue-500/20 text-[11px] text-muted-foreground">
            Cumulative payouts credited to your account.
          </div>
        </div>

        {/* Commission Rate & Membership Tier */}
        <div className="rounded-3xl border border-purple-500/30 bg-gradient-to-br from-purple-500/15 via-purple-500/5 to-pink-500/10 p-5 shadow-soft relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Percent className="h-16 w-16 text-purple-600" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-800 dark:text-purple-300">
                Platform Commission
              </span>
              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase bg-purple-500/20 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">
                {vendor?.membership_tier || "Basic"} Tier
              </span>
            </div>
            <div className="font-display text-3xl font-black text-purple-600 dark:text-purple-400 mt-2">
              {wallet.commission_rate ?? earnings.commission_rate ?? 5}%
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-purple-500/20 flex items-center justify-between text-xs">
            <span className="text-[11px] text-muted-foreground">Per completed order</span>
            <Link to="/vendor/membership" className="font-bold text-purple-700 dark:text-purple-300 hover:underline text-xs">
              Upgrade Tier
            </Link>
          </div>
        </div>
      </div>

      {/* 🏦 Direct Bank & Payout Destination Banner */}
      <div className="rounded-3xl border border-border bg-card/80 backdrop-blur-sm p-5 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
            <Landmark className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display text-sm font-bold text-foreground">
                Direct Payout Destination
              </h3>
              {bankDetails?.razorpay_account_id ? (
                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Razorpay Route Active
                </span>
              ) : isBankConfigured ? (
                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Bank Account Linked
                </span>
              ) : (
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Action Required
                </span>
              )}
            </div>

            {isBankConfigured ? (
              <p className="text-xs text-muted-foreground">
                Disbursements transferred directly to{" "}
                <span className="font-bold text-foreground font-mono">
                  {bankDetails.bank_account_number ? `•••• ${bankDetails.bank_account_number.slice(-4)}` : "Direct IMPS"}
                </span>{" "}
                ({bankDetails.bank_ifsc || "IMPS"}) • {bankDetails.bank_name || "Linked Bank"}
                {bankDetails.upi_id && (
                  <span className="ml-2 font-mono text-emerald-600 font-semibold">
                    • UPI: {bankDetails.upi_id}
                  </span>
                )}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Add your bank account number and IFSC code to receive automated order payouts and withdrawals.
              </p>
            )}
          </div>
        </div>

        <Button
          onClick={() => setBankModalOpen(true)}
          variant="outline"
          className="rounded-xl h-10 px-4 text-xs font-bold shrink-0 border-border"
        >
          {isBankConfigured ? "Update Bank & UPI Details" : "Configure Bank Account"}
        </Button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-1">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2.5 text-xs font-bold rounded-2xl transition-all flex items-center gap-2 ${
            activeTab === "overview"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          Revenue & Performance
        </button>

        <button
          onClick={() => setActiveTab("payouts")}
          className={`px-4 py-2.5 text-xs font-bold rounded-2xl transition-all flex items-center gap-2 ${
            activeTab === "payouts"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          }`}
        >
          <History className="h-4 w-4" />
          Payouts & Withdrawals
          {wallet.recent_withdrawals?.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500 text-black font-extrabold">
              {wallet.recent_withdrawals.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("ledger")}
          className={`px-4 py-2.5 text-xs font-bold rounded-2xl transition-all flex items-center gap-2 ${
            activeTab === "ledger"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          }`}
        >
          <FileText className="h-4 w-4" />
          Wallet Statements
        </button>
      </div>

      {/* Tab 1: Revenue Overview & Periodic Analytics */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              Periodic Breakdown
            </h3>
            <input
              type="month"
              value={earningsMonthFilter}
              onChange={(e) => setEarningsMonthFilter(e.target.value)}
              className="bg-card border border-border rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="rounded-3xl border border-border bg-card p-5 space-y-2 shadow-soft">
              <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                Today's Earnings
              </div>
              <div className="font-display text-2xl font-bold text-foreground">
                ₹{earnings.today_earnings || 0}
              </div>
              <div className="text-[11px] text-muted-foreground">Net earnings for today</div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-5 space-y-2 shadow-soft">
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                Weekly Earnings
              </div>
              <div className="font-display text-2xl font-bold text-foreground">
                ₹{earnings.weekly_earnings || 0}
              </div>
              <div className="text-[11px] text-muted-foreground">Net earnings for this week</div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-5 space-y-2 shadow-soft">
              <div className="text-[10px] font-bold uppercase tracking-wider text-teal-600">
                Monthly Earnings
              </div>
              <div className="font-display text-2xl font-bold text-foreground">
                ₹{earnings.monthly_earnings || 0}
              </div>
              <div className="text-[11px] text-muted-foreground">Net earnings for this month</div>
            </div>
          </div>

          {/* Recent Order Commissions Table */}
          <div className="rounded-3xl border border-border bg-card shadow-soft overflow-hidden">
            <div className="border-b border-border bg-muted/40 px-6 py-4 flex items-center justify-between">
              <h3 className="font-display font-bold text-sm">Recent Order Earnings & Commissions</h3>
            </div>
            <div className="p-0 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/20">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Date</th>
                    <th className="px-6 py-4 font-semibold">Order ID</th>
                    <th className="px-6 py-4 font-semibold text-right">Order Gross</th>
                    <th className="px-6 py-4 font-semibold text-center">Commission %</th>
                    <th className="px-6 py-4 font-semibold text-right">Fee Deducted</th>
                    <th className="px-6 py-4 font-semibold text-right">Net Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {earnings.transactions?.map((trx: any) => (
                    <tr key={trx.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-muted-foreground text-xs">
                        {new Date(trx.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-mono font-bold text-xs">
                        #{trx.order_number || trx.id.slice(0, 8)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-medium">
                        ₹{trx.total_amount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center font-bold px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs">
                          {trx.commission_rate ?? earnings.commission_rate ?? 5}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-rose-500 font-semibold text-xs">
                        -₹{trx.commission_amount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-black text-emerald-600">
                        +₹{trx.vendor_earning}
                      </td>
                    </tr>
                  ))}
                  {(!earnings.transactions || earnings.transactions.length === 0) && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground text-xs italic">
                        No transactions found for the selected period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Payouts & Withdrawal Requests */}
      {activeTab === "payouts" && (
        <div className="space-y-4">
          <div className="rounded-3xl border border-border bg-card shadow-soft overflow-hidden">
            <div className="border-b border-border bg-muted/40 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-sm">Payout Requests & Direct Settlements</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Track the status of all on-demand withdrawal requests and bank disbursements.
                </p>
              </div>
              <Button
                onClick={() => setWithdrawalModalOpen(true)}
                className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs h-9 px-4 flex items-center gap-1.5 shadow-sm"
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
                New Withdrawal
              </Button>
            </div>
            <div className="p-0 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/20">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Request Date</th>
                    <th className="px-6 py-4 font-semibold">Amount</th>
                    <th className="px-6 py-4 font-semibold">Destination</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">UTR / Reference ID</th>
                    <th className="px-6 py-4 font-semibold">Processed At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {wallet.recent_withdrawals?.map((w: any) => (
                    <tr key={w.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-muted-foreground text-xs">
                        {new Date(w.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-display font-black text-foreground">
                        ₹{w.amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs">
                        <span className="font-medium text-foreground">
                          {w.payout_mode === "UPI" ? `UPI (${w.upi_id})` : `Bank IMPS (...${(w.account_number || "").slice(-4)})`}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {w.status === "COMPLETED" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" /> Transferred
                          </span>
                        ) : w.status === "REJECTED" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-700 dark:text-rose-400 px-2.5 py-1 rounded-full border border-rose-500/20">
                            Declined
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-full border border-amber-500/20">
                            <Clock className="h-3 w-3 animate-spin" /> Processing
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {w.utr_reference || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-muted-foreground">
                        {w.processed_at ? new Date(w.processed_at).toLocaleString() : "Pending Admin / Gateway"}
                      </td>
                    </tr>
                  ))}
                  {(!wallet.recent_withdrawals || wallet.recent_withdrawals.length === 0) && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground text-xs italic">
                        No withdrawal requests initiated yet. You can withdraw your available balance anytime!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Line-by-Line Wallet Ledger */}
      {activeTab === "ledger" && (
        <div className="space-y-4">
          <div className="rounded-3xl border border-border bg-card shadow-soft overflow-hidden">
            <div className="border-b border-border bg-muted/40 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-sm">Line-by-Line Wallet Ledger Statement</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Detailed debit/credit audit trail for every completed order, commission deduction, and withdrawal.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleExportStatement}
                disabled={isExporting}
                className="rounded-xl h-9 px-3.5 text-xs font-bold border-border flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Download Statement
              </Button>
            </div>
            <div className="p-0 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/20">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Timestamp</th>
                    <th className="px-6 py-4 font-semibold">Order / Reference</th>
                    <th className="px-6 py-4 font-semibold">Type</th>
                    <th className="px-6 py-4 font-semibold text-right">Order Value</th>
                    <th className="px-6 py-4 font-semibold text-right">Net Amount</th>
                    <th className="px-6 py-4 font-semibold text-center">Settlement Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {wallet.wallet_ledger?.map((entry: any) => (
                    <tr key={entry.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-muted-foreground text-xs">
                        {new Date(entry.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-xs font-bold">
                        {entry.order_number ? `#${entry.order_number}` : entry.reference_id || entry.id.slice(0, 8)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs">
                        <span className="font-bold text-foreground">
                          {entry.type === "ORDER_COMMISSION"
                            ? "Order Earning Credit"
                            : entry.type === "REFUND"
                            ? "Refund Reversal"
                            : entry.type === "WITHDRAWAL"
                            ? "Payout Debit"
                            : entry.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-medium">
                        {entry.order_total ? `₹${entry.order_total.toFixed(2)}` : "—"}
                      </td>
                      <td
                        className={`px-6 py-4 whitespace-nowrap text-right font-black ${
                          entry.amount >= 0 ? "text-emerald-600" : "text-rose-500"
                        }`}
                      >
                        {entry.amount >= 0 ? `+₹${entry.amount.toFixed(2)}` : `-₹${Math.abs(entry.amount).toFixed(2)}`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {entry.status === "SETTLED" ? (
                          <span className="inline-flex items-center text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                            Settled
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">
                            Escrow Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(!wallet.wallet_ledger || wallet.wallet_ledger.length === 0) && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground text-xs italic">
                        No ledger statement records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* In-App Modals */}
      <VendorBankDetailsModal
        isOpen={bankModalOpen}
        onClose={() => setBankModalOpen(false)}
        currentBankDetails={bankDetails}
      />

      <VendorWithdrawalModal
        isOpen={withdrawalModalOpen}
        onClose={() => setWithdrawalModalOpen(false)}
        availableBalance={availableBalance}
        bankDetails={bankDetails}
        onOpenBankModal={() => setBankModalOpen(true)}
      />

      <VendorMonthlyInvoiceModal
        isOpen={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
      />
    </div>
  );
}
