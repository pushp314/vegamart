import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Search,
  ExternalLink,
  Copy,
  Check,
  Download,
  ShieldCheck,
  Building2,
  Clock,
  AlertCircle,
  HelpCircle,
  CreditCard,
  DollarSign,
  TrendingUp,
  Receipt,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface RazorpayOverviewData {
  is_configured: boolean;
  merchant_key_id: string | null;
  currency: string;
  balances: {
    current_unsettled_balance: number;
    total_withdrawn_to_bank: number;
    gross_online_collected: number;
    total_gateway_fees: number;
    total_taxes: number;
    total_refunded: number;
    net_earned: number;
  };
  settlements_summary: {
    total_count: number;
    processed_count: number;
    latest_settlement: {
      id: string;
      amount: number;
      status: string;
      utr: string;
      date: string;
      timestamp: number;
    } | null;
  };
  payments_summary: {
    total_count: number;
    captured_count: number;
    failed_count: number;
  };
  db_metrics: {
    total_db_orders_paid_online: number;
    total_db_online_volume: number;
  };
  on_demand: {
    allowed: boolean;
    max_amount?: number;
    min_amount?: number;
    instant_settlement_enabled?: boolean;
    message?: string;
  };
  dashboard_url: string;
}

interface SettlementItem {
  id: string;
  amount: number;
  fees: number;
  tax: number;
  status: string;
  utr: string;
  created_at: number;
  date: string;
  currency: string;
}

interface PaymentItem {
  id: string;
  order_id: string;
  amount: number;
  fee: number;
  tax: number;
  status: string;
  method: string;
  vpa: string | null;
  bank: string | null;
  email: string | null;
  contact: string | null;
  created_at: number;
  date: string;
  error_description: string | null;
}

export function AdminRazorpayFinance() {
  const [activeTab, setActiveTab] = useState<"settlements" | "payments" | "info">("settlements");
  const [settlementSearch, setSettlementSearch] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [copiedUtr, setCopiedUtr] = useState<string | null>(null);

  // 1. Fetch live Overview & Balances
  const {
    data: overviewRes,
    isLoading: isOverviewLoading,
    isFetching: isOverviewFetching,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: ["adminRazorpayOverview"],
    queryFn: () => api.get<RazorpayOverviewData>("/admin/razorpay/overview"),
  });
  const overview: RazorpayOverviewData | undefined = overviewRes?.data;

  // 2. Fetch live Settlements (Withdrawals)
  const {
    data: settlementsRes,
    isLoading: isSettlementsLoading,
    isFetching: isSettlementsFetching,
    refetch: refetchSettlements,
  } = useQuery({
    queryKey: ["adminRazorpaySettlements"],
    queryFn: () => api.get<{ items: SettlementItem[]; count: number; has_more: boolean }>("/admin/razorpay/settlements?count=100"),
  });
  const settlements = settlementsRes?.data?.items || [];

  // 3. Fetch live Customer Payments
  const {
    data: paymentsRes,
    isLoading: isPaymentsLoading,
    isFetching: isPaymentsFetching,
    refetch: refetchPayments,
  } = useQuery({
    queryKey: ["adminRazorpayPayments"],
    queryFn: () => api.get<{ items: PaymentItem[]; count: number; has_more: boolean }>("/admin/razorpay/payments?count=100"),
  });
  const payments = paymentsRes?.data?.items || [];

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUtr(text);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => setCopiedUtr(null), 2000);
  };

  const handleRefreshAll = () => {
    refetchOverview();
    refetchSettlements();
    refetchPayments();
    toast.info("Refreshed live Razorpay data");
  };

  // Filtered settlements
  const filteredSettlements = useMemo(() => {
    if (!settlementSearch.trim()) return settlements;
    const q = settlementSearch.toLowerCase();
    return settlements.filter(
      (s) =>
        s.id.toLowerCase().includes(q) ||
        (s.utr && s.utr.toLowerCase().includes(q)) ||
        s.amount.toString().includes(q)
    );
  }, [settlements, settlementSearch]);

  // Filtered payments
  const filteredPayments = useMemo(() => {
    if (!paymentSearch.trim()) return payments;
    const q = paymentSearch.toLowerCase();
    return payments.filter(
      (p) =>
        p.id.toLowerCase().includes(q) ||
        (p.order_id && p.order_id.toLowerCase().includes(q)) ||
        (p.contact && p.contact.toLowerCase().includes(q)) ||
        (p.email && p.email.toLowerCase().includes(q)) ||
        (p.vpa && p.vpa.toLowerCase().includes(q))
    );
  }, [payments, paymentSearch]);

  const exportSettlementsCsv = () => {
    if (settlements.length === 0) {
      toast.error("No settlements to export");
      return;
    }
    const headers = ["Settlement ID", "Date", "Amount (INR)", "Fees (INR)", "Tax (INR)", "Bank UTR", "Status"];
    const rows = settlements.map((s) => [
      s.id,
      new Date(s.created_at * 1000).toLocaleString(),
      s.amount,
      s.fees,
      s.tax,
      s.utr,
      s.status,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `vegamart_settlements_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Settlements exported to CSV");
  };

  const isRefreshing = isOverviewFetching || isSettlementsFetching || isPaymentsFetching;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border rounded-3xl p-6 shadow-soft">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-500/10 text-blue-600 border border-blue-500/20">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
                Razorpay Account &amp; Withdrawals
              </h1>
              <p className="text-xs text-muted-foreground font-medium">
                Live gateway balance, automatic bank settlements, and customer transaction records.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {overview?.is_configured ? (
            <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1.5 py-1 px-3 font-bold text-xs">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Live Gateway Active ({overview.merchant_key_id})
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1.5 py-1 px-3 font-bold text-xs">
              <AlertCircle className="h-3.5 w-3.5" />
              Gateway Inactive
            </Badge>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="rounded-xl font-bold text-xs h-9 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
            Refresh Live Data
          </Button>

          <a
            href={overview?.dashboard_url || "https://dashboard.razorpay.com"}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs px-3.5 h-9 shadow-sm hover:bg-primary/90 transition-colors"
          >
            Razorpay Dashboard <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Main Balances & Financial Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Available Unsettled Balance */}
        <div className="rounded-3xl border bg-gradient-to-br from-emerald-500/10 via-card to-card p-5 shadow-soft space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Current Available Balance
            </span>
            <div className="h-8 w-8 rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 grid place-items-center">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="font-display text-3xl font-black tracking-tight text-foreground">
              ₹{overview ? overview.balances.current_unsettled_balance.toFixed(2) : "0.00"}
            </div>
            <p className="text-[11px] text-muted-foreground font-medium mt-1 flex items-center gap-1">
              <Clock className="h-3 w-3 text-emerald-600" />
              Accumulated in Razorpay (next scheduled transfer)
            </p>
          </div>
        </div>

        {/* Card 2: Total Settled / Withdrawn to Bank */}
        <div className="rounded-3xl border bg-gradient-to-br from-blue-500/10 via-card to-card p-5 shadow-soft space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total Withdrawn to Bank
            </span>
            <div className="h-8 w-8 rounded-xl bg-blue-500/20 text-blue-700 dark:text-blue-300 grid place-items-center">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="font-display text-3xl font-black tracking-tight text-foreground">
              ₹{overview ? overview.balances.total_withdrawn_to_bank.toFixed(2) : "0.00"}
            </div>
            <p className="text-[11px] text-muted-foreground font-medium mt-1">
              Transferred across {overview?.settlements_summary.processed_count || 0} settlements
            </p>
          </div>
        </div>

        {/* Card 3: Gross Online Volume Collected */}
        <div className="rounded-3xl border bg-card p-5 shadow-soft space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total Online Volume
            </span>
            <div className="h-8 w-8 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400 grid place-items-center">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="font-display text-3xl font-black tracking-tight text-foreground">
              ₹{overview ? overview.balances.gross_online_collected.toFixed(2) : "0.00"}
            </div>
            <p className="text-[11px] text-muted-foreground font-medium mt-1">
              {overview?.payments_summary.captured_count || 0} successful customer payments
            </p>
          </div>
        </div>

        {/* Card 4: Net Revenue (After Fees) */}
        <div className="rounded-3xl border bg-card p-5 shadow-soft space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Net Online Revenue
            </span>
            <div className="h-8 w-8 rounded-xl bg-purple-500/15 text-purple-700 dark:text-purple-400 grid place-items-center">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="font-display text-3xl font-black tracking-tight text-foreground">
              ₹{overview ? overview.balances.net_earned.toFixed(2) : "0.00"}
            </div>
            <p className="text-[11px] text-muted-foreground font-medium mt-1">
              Gateway fees: ₹{overview ? overview.balances.total_gateway_fees.toFixed(2) : "0.00"} + GST
            </p>
          </div>
        </div>
      </div>

      {/* Latest Bank Settlement Highlight Banner */}
      {overview?.settlements_summary.latest_settlement && (
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold">
              <ArrowDownLeft className="h-4 w-4" />
            </span>
            <div>
              <p className="font-bold text-foreground text-sm">
                Latest Bank Transfer: ₹{overview.settlements_summary.latest_settlement.amount.toFixed(2)}
              </p>
              <p className="text-muted-foreground">
                Processed on {new Date(overview.settlements_summary.latest_settlement.date).toLocaleString()} • ID:{" "}
                <span className="font-mono">{overview.settlements_summary.latest_settlement.id}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-background px-3 py-1.5 rounded-xl border">
              <span className="text-muted-foreground font-medium">Bank UTR:</span>
              <span className="font-mono font-bold text-foreground">
                {overview.settlements_summary.latest_settlement.utr}
              </span>
              <button
                type="button"
                onClick={() =>
                  handleCopy(overview.settlements_summary.latest_settlement!.utr, "Bank UTR")
                }
                className="p-1 hover:bg-muted rounded-md text-muted-foreground transition-colors"
                title="Copy UTR"
              >
                {copiedUtr === overview.settlements_summary.latest_settlement.utr ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation Controls */}
      <div className="flex items-center justify-between border-b pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-muted/60 border">
          <button
            onClick={() => setActiveTab("settlements")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "settlements"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Bank Withdrawals (Settlements) ({settlements.length})
          </button>
          <button
            onClick={() => setActiveTab("payments")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "payments"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Live Customer Payments ({payments.length})
          </button>
          <button
            onClick={() => setActiveTab("info")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "info"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Settlement Rules &amp; Operations
          </button>
        </div>

        {activeTab === "settlements" && (
          <Button
            variant="outline"
            size="sm"
            onClick={exportSettlementsCsv}
            className="rounded-xl font-bold text-xs h-9 gap-1.5"
          >
            <Download className="h-3.5 w-3.5" /> Export Settlements CSV
          </Button>
        )}
      </div>

      {/* TAB 1: BANK SETTLEMENTS (WITHDRAWALS) */}
      {activeTab === "settlements" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by UTR or Settlement ID..."
                value={settlementSearch}
                onChange={(e) => setSettlementSearch(e.target.value)}
                className="pl-9 h-10 rounded-2xl text-xs"
              />
            </div>
            <span className="text-xs text-muted-foreground font-semibold">
              Showing {filteredSettlements.length} settlements
            </span>
          </div>

          <div className="rounded-3xl border bg-card shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b text-[11px] font-bold uppercase text-muted-foreground">
                  <tr>
                    <th className="py-3.5 px-4">Settlement ID</th>
                    <th className="py-3.5 px-4">Transfer Date &amp; Time</th>
                    <th className="py-3.5 px-4 text-right">Net Amount</th>
                    <th className="py-3.5 px-4">Bank UTR Reference</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-medium">
                  {isSettlementsLoading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground">
                        Loading Razorpay withdrawal records...
                      </td>
                    </tr>
                  ) : filteredSettlements.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground">
                        No settlements found.
                      </td>
                    </tr>
                  ) : (
                    filteredSettlements.map((s) => (
                      <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                          {s.id}
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground">
                          {new Date(s.created_at * 1000).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-foreground text-sm">
                          ₹{s.amount.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="inline-flex items-center gap-1.5 font-mono font-semibold bg-muted px-2 py-1 rounded-lg">
                            <span>{s.utr || "Pending UTR"}</span>
                            {s.utr && (
                              <button
                                type="button"
                                onClick={() => handleCopy(s.utr, "UTR")}
                                className="text-muted-foreground hover:text-foreground"
                                title="Copy UTR"
                              >
                                {copiedUtr === s.utr ? (
                                  <Check className="h-3 w-3 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <Badge
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              s.status === "processed"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                : s.status === "failed"
                                  ? "bg-rose-500/10 text-rose-700 border-rose-500/30"
                                  : "bg-amber-500/10 text-amber-700 border-amber-500/30"
                            }`}
                          >
                            {s.status === "processed"
                              ? "PROCESSED"
                              : s.status === "failed"
                                ? "FAILED"
                                : "INITIATED"}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <a
                            href={`https://dashboard.razorpay.com/app/settlements/${s.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                          >
                            Details <ExternalLink className="h-3 w-3" />
                          </a>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LIVE CUSTOMER PAYMENTS */}
      {activeTab === "payments" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by Payment ID, Contact, or VPA..."
                value={paymentSearch}
                onChange={(e) => setPaymentSearch(e.target.value)}
                className="pl-9 h-10 rounded-2xl text-xs"
              />
            </div>
            <span className="text-xs text-muted-foreground font-semibold">
              Showing {filteredPayments.length} transactions
            </span>
          </div>

          <div className="rounded-3xl border bg-card shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b text-[11px] font-bold uppercase text-muted-foreground">
                  <tr>
                    <th className="py-3.5 px-4">Payment ID</th>
                    <th className="py-3.5 px-4">Date &amp; Time</th>
                    <th className="py-3.5 px-4">Customer / VPA</th>
                    <th className="py-3.5 px-4">Payment Method</th>
                    <th className="py-3.5 px-4 text-right">Gross Amount</th>
                    <th className="py-3.5 px-4 text-right">Gateway Fee</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-medium">
                  {isPaymentsLoading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground">
                        Loading live customer payment records...
                      </td>
                    </tr>
                  ) : filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground">
                        No payments found.
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                          {p.id}
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground">
                          {new Date(p.created_at * 1000).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-foreground">
                            {p.contact || p.email || "Guest"}
                          </div>
                          {p.vpa && (
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {p.vpa}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 uppercase font-semibold text-muted-foreground">
                          {p.method}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-foreground">
                          ₹{p.amount.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-right text-muted-foreground">
                          ₹{p.fee.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <Badge
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              p.status === "captured"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                : p.status === "failed"
                                  ? "bg-rose-500/10 text-rose-700 border-rose-500/30"
                                  : "bg-amber-500/10 text-amber-700 border-amber-500/30"
                            }`}
                          >
                            {p.status === "captured" ? (
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> CAPTURED
                              </span>
                            ) : p.status === "failed" ? (
                              <span className="flex items-center gap-1">
                                <XCircle className="h-3 w-3" /> FAILED
                              </span>
                            ) : (
                              p.status.toUpperCase()
                            )}
                          </Badge>
                          {p.error_description && (
                            <div className="text-[10px] text-rose-500 mt-0.5 max-w-xs truncate mx-auto">
                              {p.error_description}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SETTLEMENT RULES & OPERATIONS */}
      {activeTab === "info" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-3xl border bg-card p-6 shadow-soft space-y-4">
            <div className="flex items-center gap-2.5">
              <Building2 className="h-5 w-5 text-primary" />
              <h2 className="font-display text-base font-bold text-foreground">
                Automatic Bank Settlement Cycle
              </h2>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              In standard payment gateway operation, customer payments collected today are held securely in your Razorpay merchant account and automatically disbursed to your verified bank account according to Razorpay&apos;s standard T+1 or T+2 settlement schedule.
            </p>
            <div className="space-y-2 text-xs border rounded-2xl p-4 bg-muted/40">
              <div className="flex justify-between py-1 border-b">
                <span className="font-semibold text-muted-foreground">Settlement Currency:</span>
                <span className="font-bold text-foreground">INR (Indian Rupee)</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="font-semibold text-muted-foreground">Transfer Route:</span>
                <span className="font-bold text-foreground">NEFT / RTGS / IMPS via RBI clearing</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="font-semibold text-muted-foreground">Bank UTR Reference:</span>
                <span className="font-bold text-foreground">Generated per settlement batch</span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border bg-card p-6 shadow-soft space-y-4">
            <div className="flex items-center gap-2.5">
              <CreditCard className="h-5 w-5 text-emerald-600" />
              <h2 className="font-display text-base font-bold text-foreground">
                On-Demand Instant Withdrawals
              </h2>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              If your Razorpay account has <strong>Instant Settlements (On-Demand)</strong> enabled in your Razorpay dashboard, you can trigger withdrawals to your bank account at any hour of the day without waiting for the next morning&apos;s scheduled cycle.
            </p>
            <div className="rounded-2xl border bg-muted/30 p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-muted-foreground">Instant Settlement Status:</span>
                <Badge
                  variant={overview?.on_demand.allowed ? "default" : "secondary"}
                  className="font-bold text-[10px]"
                >
                  {overview?.on_demand.allowed ? "Enabled" : "Standard Daily Cycle"}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                To activate Instant Settlements for your account, enable it in your Razorpay Merchant Dashboard under Account Settings &gt; Settlements.
              </p>
              <a
                href="https://dashboard.razorpay.com/app/settlements/ondemand"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-primary font-bold text-xs hover:underline pt-1"
              >
                Configure Instant Settlements <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
