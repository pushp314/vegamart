import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  Clock,
  ExternalLink,
  HelpCircle,
  Loader2,
  Receipt,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
  Store,
  User,
  Zap,
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
import { format } from "date-fns";
import { AdminPaginationBar, type PaginationMeta } from "./AdminPaginationBar";

interface DisputeItem {
  id: string;
  order_number: string;
  total: number | string;
  status: string;
  payment_status: string;
  payment_method: string;
  refund_reason: string | null;
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  } | null;
  vendor: {
    id: string;
    business_name: string;
    phone: string | null;
  } | null;
  items: Array<{
    id: string;
    product_name: string;
    quantity: number;
    unit_price: number | string;
    total_price: number | string;
    status: string;
  }>;
  payment: {
    id: string;
    amount: number | string;
    refund_amount: number | string | null;
    status: string;
    gateway_payment_id: string | null;
  } | null;
}

export function AdminRefunds() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "REFUNDED">("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDispute, setSelectedDispute] = useState<DisputeItem | null>(null);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundType, setRefundType] = useState<"FULL" | "PARTIAL">("FULL");
  const [customRefundAmount, setCustomRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");

  // Manual ad-hoc search
  const [manualOrderId, setManualOrderId] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [isManualProcessing, setIsManualProcessing] = useState(false);

  // Fetch disputes queue
  const { data: disputesRes, isLoading, refetch } = useQuery({
    queryKey: ["adminDisputes", page, filter],
    queryFn: () =>
      api.get<any>(
        `/admin/disputes?page=${page}&per_page=15${filter !== "ALL" ? `&status=${filter}` : ""}`
      ),
  });

  const disputes: DisputeItem[] = Array.isArray(disputesRes?.data?.data)
    ? disputesRes.data.data
    : Array.isArray(disputesRes?.data)
      ? disputesRes.data
      : [];

  const pagination = disputesRes?.data?.pagination as PaginationMeta | undefined;
  const stats = disputesRes?.data?.stats;

  // Process refund mutation
  const refundMutation = useMutation({
    mutationFn: ({
      orderId,
      amount,
      reason,
    }: {
      orderId: string;
      amount?: number;
      reason?: string;
    }) => api.post(`/payments/${orderId}/refund`, { amount, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminDisputes"] });
      toast.success("Refund processed successfully via Razorpay gateway!");
      setIsRefundModalOpen(false);
      setSelectedDispute(null);
      setCustomRefundAmount("");
      setRefundReason("");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to process refund");
    },
  });

  const handleOpenRefundModal = (dispute: DisputeItem, type: "FULL" | "PARTIAL") => {
    setSelectedDispute(dispute);
    setRefundType(type);
    const paidAmt = Number(dispute.payment?.amount || dispute.total || 0);
    const alreadyRefunded = Number(dispute.payment?.refund_amount || 0);
    const maxRefund = Math.max(0, paidAmt - alreadyRefunded);

    setCustomRefundAmount(type === "FULL" ? maxRefund.toString() : "");
    setRefundReason(dispute.refund_reason || "Customer dispute resolved by admin");
    setIsRefundModalOpen(true);
  };

  const handleManualRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualOrderId || !manualAmount) return;

    try {
      setIsManualProcessing(true);
      const res = await api.post<any>(`/payments/${manualOrderId.trim()}/refund`, {
        amount: parseFloat(manualAmount),
        reason: manualReason || "Admin manual refund",
      });

      if (res.success) {
        toast.success("Manual refund processed successfully!");
        setManualOrderId("");
        setManualAmount("");
        setManualReason("");
        queryClient.invalidateQueries({ queryKey: ["adminDisputes"] });
      } else {
        toast.error(res.error?.message || "Failed to process refund");
      }
    } catch (err: any) {
      toast.error(err?.message || "Error processing refund");
    } finally {
      setIsManualProcessing(false);
    }
  };

  const filteredDisputes = disputes.filter((d) => {
    const term = searchTerm.toLowerCase();
    return (
      d.order_number?.toLowerCase().includes(term) ||
      d.user?.name?.toLowerCase().includes(term) ||
      d.user?.phone?.includes(term) ||
      d.vendor?.business_name?.toLowerCase().includes(term) ||
      d.refund_reason?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-600 border border-rose-500/20">
              <RotateCcw className="h-7 w-7" />
            </span>
            Disputes & 1-Click Refund Manager
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Resolve customer complaints, damaged goods, or order cancellations with 1-click Razorpay gateway refunds.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            refetch();
            toast.info("Refreshed disputes queue");
          }}
          className="rounded-xl"
        >
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Pending Dispute Reviews
            </span>
            <div className="h-10 w-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 font-display text-3xl font-black text-amber-600">
            {stats?.pending_count ?? 0}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Awaiting admin review or refund action</p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total Refunded (All-Time)
            </span>
            <div className="h-10 w-10 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
              <Banknote className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 font-display text-3xl font-black text-foreground">
            ₹{(stats?.total_refunded_amount ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Processed back to customer accounts</p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total Cases Tracked
            </span>
            <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 font-display text-3xl font-black text-foreground">
            {stats?.total_cases ?? 0}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Total disputes and cancellations</p>
        </div>
      </div>

      {/* Disputes Table Section */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search order #, customer, or vendor..."
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
              All Cases
            </Button>
            <Button
              variant={filter === "PENDING" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("PENDING")}
              className="rounded-xl text-xs text-amber-600"
            >
              Pending ({stats?.pending_count ?? 0})
            </Button>
            <Button
              variant={filter === "REFUNDED" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("REFUNDED")}
              className="rounded-xl text-xs text-emerald-600"
            >
              Refunded
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredDisputes.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground border-2 border-dashed border-border rounded-2xl">
            <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500 mb-2 opacity-80" />
            <div className="font-bold text-foreground">No Disputes or Pending Refunds</div>
            <p className="text-xs mt-1">All customer orders and claims are in good standing.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredDisputes.map((dispute) => {
              const paidAmt = Number(dispute.payment?.amount || dispute.total || 0);
              const refundedAmt = Number(dispute.payment?.refund_amount || 0);
              const isFullyRefunded = dispute.payment_status === "REFUNDED" || (paidAmt > 0 && refundedAmt >= paidAmt);
              const isEligibleForRefund =
                dispute.payment_method !== "COD" &&
                !isFullyRefunded &&
                dispute.payment_status !== "FAILED";

              return (
                <div
                  key={dispute.id}
                  className="p-5 rounded-2xl border border-border bg-muted/20 hover:bg-muted/30 transition-all space-y-3"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-base text-foreground">
                        Order #{dispute.order_number}
                      </span>
                      <Badge
                        className={`text-[10px] font-bold uppercase ${
                          isFullyRefunded
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                        }`}
                      >
                        {isFullyRefunded ? "✓ Refunded" : "⏳ Dispute / Review"}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-bold">
                        {dispute.payment_method}
                      </Badge>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Updated: {format(new Date(dispute.updated_at), "MMM d, yyyy • h:mm a")}
                    </div>
                  </div>

                  {/* Customer, Vendor, and Reason Breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-border/60 text-sm">
                    <div>
                      <div className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1 mb-1">
                        <User className="h-3.5 w-3.5" /> Customer Details
                      </div>
                      <div className="font-semibold text-foreground">{dispute.user?.name || "Guest"}</div>
                      <div className="text-xs text-muted-foreground">{dispute.user?.phone || dispute.user?.email}</div>
                    </div>

                    <div>
                      <div className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1 mb-1">
                        <Store className="h-3.5 w-3.5" /> Vendor Store
                      </div>
                      <div className="font-semibold text-foreground">{dispute.vendor?.business_name || "Vendor"}</div>
                      <div className="text-xs text-muted-foreground">{dispute.vendor?.phone}</div>
                    </div>

                    <div>
                      <div className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1 mb-1">
                        <AlertCircle className="h-3.5 w-3.5 text-rose-500" /> Dispute Reason / Note
                      </div>
                      <div className="text-xs text-rose-700 dark:text-rose-300 font-medium">
                        {dispute.refund_reason || "Customer requested refund / order cancelled."}
                      </div>
                    </div>
                  </div>

                  {/* Financial Details and Action Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-border">
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-xs text-muted-foreground">Paid Amount: </span>
                        <span className="font-bold text-foreground">₹{paidAmt.toFixed(2)}</span>
                      </div>
                      {refundedAmt > 0 && (
                        <div>
                          <span className="text-xs text-muted-foreground">Refunded: </span>
                          <span className="font-bold text-emerald-600">₹{refundedAmt.toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isEligibleForRefund ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleOpenRefundModal(dispute, "FULL")}
                            className="rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white text-xs shadow-sm"
                          >
                            <Zap className="h-3.5 w-3.5 mr-1" /> 1-Click Full Refund (₹{(paidAmt - refundedAmt).toFixed(2)})
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenRefundModal(dispute, "PARTIAL")}
                            className="rounded-xl text-xs border-rose-200 text-rose-700 hover:bg-rose-50"
                          >
                            Partial Refund
                          </Button>
                        </>
                      ) : isFullyRefunded ? (
                        <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4" /> Full payment refunded
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          COD Order / Gateway refund not required
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {pagination && (
          <div className="mt-6">
            <AdminPaginationBar pagination={pagination} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* Manual Order Refund Card (for Ad-hoc refunds) */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm max-w-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-muted flex items-center justify-center">
            <Receipt className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground">Manual Order Refund Tool</h3>
            <p className="text-xs text-muted-foreground">
              Directly issue a refund for any Order UUID not listed in the disputes queue.
            </p>
          </div>
        </div>

        <form onSubmit={handleManualRefund} className="space-y-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
              Order UUID
            </label>
            <Input
              placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000"
              value={manualOrderId}
              onChange={(e) => setManualOrderId(e.target.value)}
              required
              className="rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Refund Amount (₹)
              </label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Reason (Optional)
              </label>
              <Input
                placeholder="e.g. Item missing"
                value={manualReason}
                onChange={(e) => setManualReason(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isManualProcessing}
            className="w-full rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm"
          >
            {isManualProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing Refund...
              </>
            ) : (
              "Process Manual Refund"
            )}
          </Button>
        </form>
      </div>

      {/* 1-Click / Partial Refund Modal */}
      <Dialog open={isRefundModalOpen} onOpenChange={setIsRefundModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl font-bold text-rose-600">
              <RotateCcw className="h-6 w-6" />
              {refundType === "FULL" ? "1-Click Full Refund" : "Issue Partial Refund"}
            </DialogTitle>
            <DialogDescription>
              Execute instant Razorpay gateway refund for Order #{selectedDispute?.order_number}.
            </DialogDescription>
          </DialogHeader>

          {selectedDispute && (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-2xl bg-muted/50 border border-border space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-bold text-foreground">{selectedDispute.user?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vendor:</span>
                  <span className="font-semibold text-foreground">{selectedDispute.vendor?.business_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Original Paid:</span>
                  <span className="font-bold text-foreground">
                    ₹{Number(selectedDispute.payment?.amount || selectedDispute.total).toFixed(2)}
                  </span>
                </div>
                {Number(selectedDispute.payment?.refund_amount || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Previously Refunded:</span>
                    <span className="font-bold text-emerald-600">
                      ₹{Number(selectedDispute.payment?.refund_amount).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Refund Amount (₹)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={customRefundAmount}
                  onChange={(e) => setCustomRefundAmount(e.target.value)}
                  required
                  className="rounded-xl font-bold text-base"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Refund Note / Reason
                </label>
                <Input
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="e.g. Customer return approved"
                  className="rounded-xl text-sm"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsRefundModalOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (selectedDispute) {
                  refundMutation.mutate({
                    orderId: selectedDispute.id,
                    amount: parseFloat(customRefundAmount),
                    reason: refundReason,
                  });
                }
              }}
              disabled={!customRefundAmount || refundMutation.isPending}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              {refundMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...
                </>
              ) : (
                `Confirm Refund (₹${parseFloat(customRefundAmount || "0").toFixed(2)})`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
