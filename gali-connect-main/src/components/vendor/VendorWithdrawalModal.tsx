import { useState } from "react";
import {
  Wallet,
  Landmark,
  Smartphone,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface VendorWithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableBalance: number;
  bankDetails?: {
    bank_account_number?: string | null;
    bank_ifsc?: string | null;
    bank_account_holder_name?: string | null;
    bank_name?: string | null;
    upi_id?: string | null;
  };
  onOpenBankModal: () => void;
}

export function VendorWithdrawalModal({
  isOpen,
  onClose,
  availableBalance,
  bankDetails,
  onOpenBankModal,
}: VendorWithdrawalModalProps) {
  const queryClient = useQueryClient();
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [payoutMode, setPayoutMode] = useState<"BANK_TRANSFER" | "UPI">(
    bankDetails?.bank_account_number ? "BANK_TRANSFER" : bankDetails?.upi_id ? "UPI" : "BANK_TRANSFER"
  );
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const numericAmount = Number(withdrawAmount) || 0;
  const isBankConfigured = Boolean(bankDetails?.bank_account_number && bankDetails?.bank_ifsc);
  const isUpiConfigured = Boolean(bankDetails?.upi_id);
  const hasValidDestination = payoutMode === "BANK_TRANSFER" ? isBankConfigured : isUpiConfigured;

  const setPresetPercentage = (pct: number) => {
    const val = Math.floor((availableBalance * (pct / 100)) * 100) / 100;
    setWithdrawAmount(val > 0 ? String(val) : "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasValidDestination) {
      toast.error(`Please configure your ${payoutMode === "BANK_TRANSFER" ? "Bank Account" : "UPI ID"} before requesting a withdrawal.`);
      onOpenBankModal();
      return;
    }

    if (numericAmount < 100) {
      toast.error("Minimum withdrawal amount is ₹100.");
      return;
    }

    if (numericAmount > availableBalance) {
      toast.error(`Requested amount exceeds available balance (₹${availableBalance.toFixed(2)}).`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post<any>("/vendors/me/withdrawals/request", {
        amount: numericAmount,
        payout_mode: payoutMode,
        notes: notes || undefined,
      });

      if (res.success) {
        toast.success(res.message || "Withdrawal request submitted successfully! 🎉");
        queryClient.invalidateQueries({ queryKey: ["vendorWallet"] });
        queryClient.invalidateQueries({ queryKey: ["vendorEarnings"] });
        onClose();
      } else {
        toast.error(res.error?.message || "Failed to submit withdrawal request.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit withdrawal request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-3xl border-emerald-500/20 bg-card p-6 max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg font-bold text-foreground">
                Request Payout / Withdraw Funds
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Transfer your settled store earnings to your bank account or UPI.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Available Balance Banner */}
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Available to Withdraw
              </span>
              <div className="font-display text-2xl font-black text-emerald-600 dark:text-emerald-400">
                ₹{availableBalance.toFixed(2)}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-muted-foreground block">
                Min. ₹100 req.
              </span>
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                Instant / Fast IMPS
              </span>
            </div>
          </div>

          {/* Amount input & Presets */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Withdrawal Amount (₹)</Label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                ₹
              </span>
              <Input
                type="number"
                min={100}
                max={availableBalance}
                step="any"
                placeholder="Enter amount (min ₹100)"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="pl-8 text-base font-bold rounded-xl h-11 font-mono"
              />
            </div>

            {/* Quick Percentage Chips */}
            <div className="grid grid-cols-4 gap-2 pt-1">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setPresetPercentage(pct)}
                  className="py-1.5 px-2 text-xs font-bold rounded-xl border border-border bg-muted/40 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-600 transition-colors"
                >
                  {pct === 100 ? "All (100%)" : `${pct}%`}
                </button>
              ))}
            </div>
          </div>

          {/* Destination Selection */}
          <div className="space-y-2 pt-1">
            <Label className="text-xs font-medium">Payout Destination</Label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setPayoutMode("BANK_TRANSFER")}
                className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                  payoutMode === "BANK_TRANSFER"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 ring-2 ring-emerald-500/20"
                    : "border-border bg-card hover:bg-muted/40 text-muted-foreground"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <Landmark className="h-4 w-4 text-emerald-600" />
                  {isBankConfigured && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                </div>
                <div className="mt-2">
                  <div className="text-xs font-bold text-foreground">Bank IMPS</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {bankDetails?.bank_account_number
                      ? `...${bankDetails.bank_account_number.slice(-4)} (${bankDetails.bank_name || "Bank"})`
                      : "Not configured"}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPayoutMode("UPI")}
                className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                  payoutMode === "UPI"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 ring-2 ring-emerald-500/20"
                    : "border-border bg-card hover:bg-muted/40 text-muted-foreground"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <Smartphone className="h-4 w-4 text-emerald-600" />
                  {isUpiConfigured && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                </div>
                <div className="mt-2">
                  <div className="text-xs font-bold text-foreground">Instant UPI</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {bankDetails?.upi_id || "Not configured"}
                  </div>
                </div>
              </button>
            </div>

            {!hasValidDestination && (
              <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2 mt-2">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>{payoutMode === "BANK_TRANSFER" ? "Bank account not configured" : "UPI ID not configured"}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenBankModal();
                  }}
                  className="font-bold underline text-amber-700 dark:text-amber-300 shrink-0"
                >
                  Configure Now
                </button>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Notes / Remarks (Optional)</Label>
            <Input
              placeholder="e.g. Weekly inventory payout"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-xl h-10 text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl h-11 px-4 text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || numericAmount < 100 || numericAmount > availableBalance || !hasValidDestination}
              className="rounded-xl h-11 px-5 bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs flex items-center gap-2 shadow-md disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin text-black" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              Confirm Withdrawal
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
