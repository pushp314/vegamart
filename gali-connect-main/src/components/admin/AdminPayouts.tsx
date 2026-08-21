import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Banknote,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  HelpCircle,
  Loader2,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface PayoutSummary {
  total_pending_amount: number;
  total_pending_records: number;
  total_settled_amount: number;
  total_settled_records: number;
  vendors_awaiting_payout: number;
  total_linked_accounts: number;
}

interface VendorPayoutItem {
  vendor_id: string;
  business_name: string;
  owner_name: string;
  phone: string;
  email: string;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_account_holder_name: string | null;
  bank_name: string | null;
  upi_id: string | null;
  razorpay_account_id: string | null;
  payout_enabled: boolean;
  has_valid_bank: boolean;
  pending_amount: number;
  unsettled_orders_count: number;
}

export function AdminPayouts() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"balances" | "requests">("balances");
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"ALL" | "READY" | "MISSING_BANK">("ALL");
  const [selectedVendor, setSelectedVendor] = useState<VendorPayoutItem | null>(null);
  const [isDisburseModalOpen, setIsDisburseModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [payoutMode, setPayoutMode] = useState<"DIRECT_TRANSFER" | "MANUAL_SETTLE">("MANUAL_SETTLE");
  const [transactionRef, setTransactionRef] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // Withdrawal Requests processing state
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [isProcessRequestModalOpen, setIsProcessRequestModalOpen] = useState(false);
  const [requestAction, setRequestAction] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [adminNotes, setAdminNotes] = useState("");

  // Fetch summary
  const {
    data: summaryRes,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ["adminPayoutsSummary"],
    queryFn: () => api.get<any>("/admin/payouts/summary"),
  });
  const summary: PayoutSummary | undefined = (summaryRes?.data?.data || summaryRes?.data) as PayoutSummary | undefined;

  // Fetch vendors with pending payouts
  const {
    data: vendorsRes,
    isLoading: isVendorsLoading,
    refetch: refetchVendors,
  } = useQuery({
    queryKey: ["adminPayoutsVendors"],
    queryFn: () => api.get<any>("/admin/payouts/vendors"),
  });
  const rawVendors = vendorsRes?.data?.data || vendorsRes?.data || [];
  const vendors: VendorPayoutItem[] = Array.isArray(rawVendors) ? rawVendors : [];

  // Fetch vendor withdrawal requests queue
  const {
    data: requestsRes,
    isLoading: isRequestsLoading,
    refetch: refetchRequests,
  } = useQuery({
    queryKey: ["adminPayoutsRequests"],
    queryFn: () => api.get<any>("/admin/payouts/requests"),
  });
  const payoutRequests: any[] = requestsRes?.data?.data || requestsRes?.data || [];

  // Single disburse mutation
  const disburseMutation = useMutation({
    mutationFn: ({ vendorId, mode, reference }: { vendorId: string; mode: string; reference?: string }) =>
      api.post(`/admin/payouts/disburse/${vendorId}`, { mode, reference }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["adminPayoutsSummary"] });
      queryClient.invalidateQueries({ queryKey: ["adminPayoutsVendors"] });
      toast.success(res?.message || "Vendor payout disbursed and settled successfully!");
      setIsDisburseModalOpen(false);
      setSelectedVendor(null);
      setTransactionRef("");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to disburse payout");
    },
  });

  // Batch disburse mutation
  const batchDisburseMutation = useMutation({
    mutationFn: ({ reference }: { reference?: string }) =>
      api.post("/admin/payouts/disburse-all", { reference }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["adminPayoutsSummary"] });
      queryClient.invalidateQueries({ queryKey: ["adminPayoutsVendors"] });
      toast.success(`Disbursed payouts to ${res?.data?.vendors_count || 0} vendors!`);
      setIsBatchModalOpen(false);
      setTransactionRef("");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to batch disburse payouts");
    },
  });

  // Process On-Demand Withdrawal Request mutation
  const processRequestMutation = useMutation({
    mutationFn: ({ requestId, action, utr, notes }: { requestId: string; action: "APPROVE" | "REJECT"; utr?: string; notes?: string }) =>
      api.post(`/admin/payouts/requests/${requestId}/process`, {
        action,
        utr_reference: utr,
        admin_notes: notes,
      }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["adminPayoutsRequests"] });
      queryClient.invalidateQueries({ queryKey: ["adminPayoutsSummary"] });
      toast.success(res?.message || "Withdrawal request processed successfully! 🎉");
      setIsProcessRequestModalOpen(false);
      setSelectedRequest(null);
      setTransactionRef("");
      setAdminNotes("");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to process withdrawal request");
    },
  });

  // Export CSV handler
  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      const res = await fetch("/api/v1/admin/payouts/export-csv", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vegamart-vendor-payouts-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Bank Payout CSV exported successfully!");
    } catch {
      toast.error("Failed to export CSV");
    } finally {
      setIsExporting(false);
    }
  };

  const filteredVendors = vendors.filter((v) => {
    const matchesSearch =
      v.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.owner_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.bank_account_number && v.bank_account_number.includes(searchTerm)) ||
      (v.upi_id && v.upi_id.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;
    if (filter === "READY") return v.has_valid_bank;
    if (filter === "MISSING_BANK") return !v.has_valid_bank;
    return true;
  });

  const totalEligibleAmount = vendors
    .filter((v) => v.has_valid_bank)
    .reduce((sum, v) => sum + v.pending_amount, 0);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <Banknote className="h-7 w-7" />
            </span>
            Vendor Payouts Hub
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Review pending merchant balances, disburse single or batch payouts, and export bank transfer sheets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchSummary();
              refetchVendors();
              toast.info("Refreshed payout balances");
            }}
            className="rounded-xl"
          >
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={isExporting || vendors.length === 0}
            className="rounded-xl border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Export Bank CSV
          </Button>

          <Button
            size="sm"
            onClick={() => setIsBatchModalOpen(true)}
            disabled={vendors.filter((v) => v.has_valid_bank && v.pending_amount > 0).length === 0}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-600/20"
          >
            <Send className="h-4 w-4 mr-2" /> Disburse All (₹{totalEligibleAmount.toLocaleString("en-IN")})
          </Button>
        </div>
      </div>

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total Pending Balance
            </span>
            <div className="h-10 w-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 font-display text-3xl font-black text-foreground">
            {isSummaryLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              `₹${(summary?.total_pending_amount ?? 0).toLocaleString("en-IN")}`
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Across {summary?.total_pending_records ?? 0} unpaid order earnings
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Vendors Awaiting Payout
            </span>
            <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Building2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 font-display text-3xl font-black text-foreground">
            {isSummaryLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              summary?.vendors_awaiting_payout ?? 0
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Eligible for immediate disbursement
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Bank / UPI Linked
            </span>
            <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 font-display text-3xl font-black text-foreground">
            {isSummaryLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              summary?.total_linked_accounts ?? 0
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Configured for direct transfers
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total Settled All-Time
            </span>
            <div className="h-10 w-10 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 font-display text-3xl font-black text-foreground">
            {isSummaryLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              `₹${(summary?.total_settled_amount ?? 0).toLocaleString("en-IN")}`
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Across {summary?.total_settled_records ?? 0} settled transactions
          </p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-border pb-1">
        <button
          onClick={() => setActiveTab("balances")}
          className={`px-4 py-2.5 text-xs font-bold rounded-2xl transition-all flex items-center gap-2 ${
            activeTab === "balances"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          }`}
        >
          <Building2 className="h-4 w-4" />
          Pending Vendor Balances ({vendors.length})
        </button>

        <button
          onClick={() => setActiveTab("requests")}
          className={`px-4 py-2.5 text-xs font-bold rounded-2xl transition-all flex items-center gap-2 ${
            activeTab === "requests"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          }`}
        >
          <Send className="h-4 w-4" />
          On-Demand Withdrawal Requests ({payoutRequests.length})
          {payoutRequests.filter((r) => r.status === "PENDING").length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-black font-extrabold animate-pulse">
              {payoutRequests.filter((r) => r.status === "PENDING").length} Pending
            </span>
          )}
        </button>
      </div>

      {activeTab === "balances" ? (
        /* Filter and Search Bar for Vendor Balances */
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search vendor, bank account, or UPI..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 rounded-xl"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant={filter === "ALL" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("ALL")}
                className="rounded-xl text-xs"
              >
                All ({vendors.length})
              </Button>
              <Button
                variant={filter === "READY" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("READY")}
                className="rounded-xl text-xs"
              >
                Bank Linked ({vendors.filter((v) => v.has_valid_bank).length})
              </Button>
              <Button
                variant={filter === "MISSING_BANK" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("MISSING_BANK")}
                className="rounded-xl text-xs text-amber-600"
              >
                Missing Bank ({vendors.filter((v) => !v.has_valid_bank).length})
              </Button>
            </div>
          </div>

          {/* Vendors Payout Table */}
          {isVendorsLoading ? (
            <div className="flex items-center justify-center p-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredVendors.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground border-2 border-dashed border-border rounded-2xl">
              <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500 mb-2 opacity-80" />
              <div className="font-bold text-foreground">No Pending Payouts Found</div>
              <p className="text-xs mt-1">All vendor accounts are up to date and settled.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/30 text-xs uppercase font-bold text-muted-foreground tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4 rounded-l-xl">Vendor Business</th>
                    <th className="py-3.5 px-4">Bank / UPI Details</th>
                    <th className="py-3.5 px-4 text-center">Unpaid Orders</th>
                    <th className="py-3.5 px-4 text-right">Payable Balance</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right rounded-r-xl">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredVendors.map((v) => (
                    <tr key={v.vendor_id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-4 px-4">
                        <div className="font-bold text-foreground">{v.business_name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {v.owner_name} • {v.phone || v.email}
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        {v.bank_account_number ? (
                          <div>
                            <div className="font-mono text-xs font-bold text-foreground">
                              A/C: ••••{v.bank_account_number.slice(-4)} ({v.bank_ifsc})
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {v.bank_account_holder_name || v.owner_name}
                              {v.bank_name ? ` • ${v.bank_name}` : ""}
                            </div>
                          </div>
                        ) : v.upi_id ? (
                          <div className="font-mono text-xs font-bold text-foreground">
                            UPI: {v.upi_id}
                          </div>
                        ) : (
                          <span className="text-xs text-amber-600 font-semibold flex items-center gap-1">
                            <ShieldAlert className="h-3.5 w-3.5" /> No bank details
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-center">
                        <Badge variant="outline" className="font-mono text-xs">
                          {v.unsettled_orders_count} orders
                        </Badge>
                      </td>

                      <td className="py-4 px-4 text-right">
                        <div className="font-display font-black text-base text-foreground">
                          ₹{v.pending_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </div>
                      </td>

                      <td className="py-4 px-4 text-center">
                        {v.has_valid_bank ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                            <HelpCircle className="h-3.5 w-3.5" /> Needs Setup
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-right">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedVendor(v);
                            setIsDisburseModalOpen(true);
                          }}
                          disabled={v.pending_amount <= 0}
                          className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 px-3.5 shadow-sm"
                        >
                          <Banknote className="h-3.5 w-3.5 mr-1.5" /> Disburse
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* On-Demand Withdrawal Requests Queue */
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-base text-foreground">
                Vendor Withdrawal Requests Queue
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Review and disburse on-demand payout requests initiated by vendors.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchRequests()}
              className="rounded-xl text-xs flex items-center gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>

          {isRequestsLoading ? (
            <div className="flex items-center justify-center p-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : payoutRequests.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground border-2 border-dashed border-border rounded-2xl">
              <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500 mb-2 opacity-80" />
              <div className="font-bold text-foreground">No Withdrawal Requests in Queue</div>
              <p className="text-xs mt-1">Vendors haven't initiated any pending withdrawal requests.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/30 text-xs uppercase font-bold text-muted-foreground tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4 rounded-l-xl">Requested Date</th>
                    <th className="py-3.5 px-4">Vendor</th>
                    <th className="py-3.5 px-4 text-right">Amount</th>
                    <th className="py-3.5 px-4">Destination</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4">UTR Reference</th>
                    <th className="py-3.5 px-4 text-right rounded-r-xl">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payoutRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-4 px-4 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(req.created_at).toLocaleString()}
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-bold text-foreground">{req.vendor_name}</div>
                        <div className="text-xs text-muted-foreground">{req.owner_name}</div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="font-display font-black text-base text-foreground">
                          ₹{req.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-xs">
                        {req.payout_mode === "UPI" ? (
                          <div className="font-mono font-bold text-foreground">
                            UPI: {req.upi_id}
                          </div>
                        ) : (
                          <div>
                            <div className="font-mono font-bold text-foreground">
                              A/C: ••••{(req.account_number || "").slice(-4)} ({req.ifsc_code})
                            </div>
                            <div className="text-muted-foreground">{req.bank_name || req.account_holder}</div>
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center">
                        {req.status === "COMPLETED" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" /> Transferred
                          </span>
                        ) : req.status === "REJECTED" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-700 dark:text-rose-400 px-2.5 py-1 rounded-full border border-rose-500/20">
                            Declined
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-full border border-amber-500/20 animate-pulse">
                            <Clock className="h-3 w-3" /> Pending Review
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 font-mono text-xs text-muted-foreground">
                        {req.utr_reference || "—"}
                      </td>
                      <td className="py-4 px-4 text-right">
                        {req.status === "PENDING" ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedRequest(req);
                                setRequestAction("APPROVE");
                                setTransactionRef("");
                                setIsProcessRequestModalOpen(true);
                              }}
                              className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-3"
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedRequest(req);
                                setRequestAction("REJECT");
                                setAdminNotes("");
                                setIsProcessRequestModalOpen(true);
                              }}
                              className="rounded-xl font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 text-xs h-8 px-3 border-rose-200 dark:border-rose-900"
                            >
                              Decline
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Processed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Process On-Demand Withdrawal Request Modal */}
      <Dialog open={isProcessRequestModalOpen} onOpenChange={setIsProcessRequestModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl font-bold">
              {requestAction === "APPROVE" ? (
                <>
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  Approve & Disburse Payout
                </>
              ) : (
                <>
                  <ShieldAlert className="h-6 w-6 text-rose-600" />
                  Decline Withdrawal Request
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {requestAction === "APPROVE"
                ? "Enter the Bank IMPS/UPI reference number to confirm settlement."
                : "Specify the reason for declining this withdrawal request."}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-3 py-2">
              <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vendor:</span>
                  <span className="font-bold text-foreground">{selectedRequest.vendor_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-black text-sm text-emerald-600">₹{selectedRequest.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Destination:</span>
                  <span className="font-mono font-bold text-foreground">
                    {selectedRequest.payout_mode === "UPI"
                      ? selectedRequest.upi_id
                      : `A/C: ••••${(selectedRequest.account_number || "").slice(-4)} (${selectedRequest.ifsc_code})`}
                  </span>
                </div>
              </div>

              {requestAction === "APPROVE" ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Bank Transfer UTR / Reference ID
                  </label>
                  <Input
                    placeholder="e.g. UTR-982348123 or IMPS-8291823"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    className="rounded-xl text-sm font-mono"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Decline Reason (Shown to vendor)
                  </label>
                  <Input
                    placeholder="e.g. Incorrect bank account number or KYC discrepancy"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="rounded-xl text-sm"
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsProcessRequestModalOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (selectedRequest) {
                  processRequestMutation.mutate({
                    requestId: selectedRequest.id,
                    action: requestAction,
                    utr: transactionRef || undefined,
                    notes: adminNotes || undefined,
                  });
                }
              }}
              disabled={processRequestMutation.isPending}
              className={`rounded-xl font-bold text-white ${
                requestAction === "APPROVE"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-rose-600 hover:bg-rose-700"
              }`}
            >
              {processRequestMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : requestAction === "APPROVE" ? (
                "Confirm & Mark Transferred"
              ) : (
                "Decline Request"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Vendor Disburse Modal */}
      <Dialog open={isDisburseModalOpen} onOpenChange={setIsDisburseModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl font-bold">
              <Banknote className="h-6 w-6 text-emerald-600" />
              Disburse Vendor Payout
            </DialogTitle>
            <DialogDescription>
              Disburse pending balance and mark earnings as settled.
            </DialogDescription>
          </DialogHeader>

          {selectedVendor && (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-2xl bg-muted/50 border border-border space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Vendor:</span>
                  <span className="font-bold text-foreground">{selectedVendor.business_name}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Beneficiary Name:</span>
                  <span className="font-semibold text-foreground">
                    {selectedVendor.bank_account_holder_name || selectedVendor.owner_name}
                  </span>
                </div>
                {selectedVendor.bank_account_number && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Bank A/C & IFSC:</span>
                    <span className="font-mono font-bold text-foreground">
                      {selectedVendor.bank_account_number} ({selectedVendor.bank_ifsc})
                    </span>
                  </div>
                )}
                {selectedVendor.upi_id && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">UPI ID:</span>
                    <span className="font-mono text-foreground">{selectedVendor.upi_id}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-border flex justify-between items-center">
                  <span className="font-bold text-foreground">Total Amount to Pay:</span>
                  <span className="font-display font-black text-xl text-emerald-600">
                    ₹{selectedVendor.pending_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Settlement Mode Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Disbursement Mode
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPayoutMode("MANUAL_SETTLE")}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      payoutMode === "MANUAL_SETTLE"
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="font-bold text-xs text-foreground">Manual / IMPS / UPI</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Pay via bank app & mark settled
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPayoutMode("DIRECT_TRANSFER")}
                    disabled={!selectedVendor.razorpay_account_id}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      payoutMode === "DIRECT_TRANSFER"
                        ? "border-emerald-600 bg-emerald-500/5 ring-2 ring-emerald-500/20"
                        : "border-border hover:bg-muted/40 disabled:opacity-40 disabled:cursor-not-allowed"
                    }`}
                  >
                    <div className="font-bold text-xs text-foreground">Razorpay Route</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {selectedVendor.razorpay_account_id
                        ? "Direct linked transfer"
                        : "Account not linked yet"}
                    </div>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Bank Reference / UTR / Note (Optional)
                </label>
                <Input
                  placeholder="e.g. UTR-982348123 or GPay-Ref-38291"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  className="rounded-xl text-sm"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDisburseModalOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (selectedVendor) {
                  disburseMutation.mutate({
                    vendorId: selectedVendor.vendor_id,
                    mode: payoutMode,
                    reference: transactionRef || undefined,
                  });
                }
              }}
              disabled={disburseMutation.isPending}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {disburseMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Disbursing...
                </>
              ) : (
                "Confirm & Mark Settled"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Disburse Confirmation Modal */}
      <Dialog open={isBatchModalOpen} onOpenChange={setIsBatchModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl font-bold">
              <Send className="h-6 w-6 text-emerald-600" />
              Batch Disburse All Payouts
            </DialogTitle>
            <DialogDescription>
              Disburse all pending balances across {vendors.filter((v) => v.has_valid_bank).length} bank-configured vendors.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 space-y-3">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
              <div className="text-xs uppercase font-bold tracking-wider text-emerald-800 dark:text-emerald-300">
                Total Payout Amount
              </div>
              <div className="font-display font-black text-3xl text-emerald-600 mt-1">
                ₹{totalEligibleAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Batch Transfer Note / Reference
              </label>
              <Input
                placeholder="e.g. WEEKLY-SETTLEMENT-BATCH-01"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                className="rounded-xl text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsBatchModalOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                batchDisburseMutation.mutate({
                  reference: transactionRef || undefined,
                });
              }}
              disabled={batchDisburseMutation.isPending}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {batchDisburseMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing Batch...
                </>
              ) : (
                "Confirm Batch Disbursement"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
