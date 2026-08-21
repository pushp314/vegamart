import { useState, useEffect } from "react";
import {
  Landmark,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Smartphone,
  CreditCard,
  Building,
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

interface VendorBankDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBankDetails?: {
    bank_account_number?: string | null;
    bank_ifsc?: string | null;
    bank_account_holder_name?: string | null;
    bank_name?: string | null;
    upi_id?: string | null;
  };
}

export function VendorBankDetailsModal({
  isOpen,
  onClose,
  currentBankDetails,
}: VendorBankDetailsModalProps) {
  const queryClient = useQueryClient();
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [bankName, setBankName] = useState("");
  const [upiId, setUpiId] = useState("");

  const [isValidatingIfsc, setIsValidatingIfsc] = useState(false);
  const [ifscBranchInfo, setIfscBranchInfo] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && currentBankDetails) {
      setAccountNumber(currentBankDetails.bank_account_number || "");
      setConfirmAccountNumber(currentBankDetails.bank_account_number || "");
      setIfscCode(currentBankDetails.bank_ifsc || "");
      setAccountHolderName(currentBankDetails.bank_account_holder_name || "");
      setBankName(currentBankDetails.bank_name || "");
      setUpiId(currentBankDetails.upi_id || "");
      setIfscBranchInfo(null);
    }
  }, [isOpen, currentBankDetails]);

  // Live IFSC lookup & bank name auto-fill
  const handleIfscChange = async (val: string) => {
    const cleanIfsc = val.toUpperCase().trim();
    setIfscCode(cleanIfsc);
    setIfscBranchInfo(null);

    if (cleanIfsc.length === 11) {
      setIsValidatingIfsc(true);
      try {
        const res = await fetch(`https://ifsc.razorpay.com/${cleanIfsc}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.BANK) {
            setBankName(data.BANK);
            setIfscBranchInfo(`${data.BANK} — ${data.BRANCH || ""}, ${data.CITY || ""}`);
          }
        } else {
          setIfscBranchInfo("Invalid IFSC code or branch not found");
        }
      } catch {
        // Fallback gracefully if external lookup is unavailable
      } finally {
        setIsValidatingIfsc(false);
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (accountNumber && accountNumber !== confirmAccountNumber) {
      toast.error("Bank Account numbers do not match. Please verify.");
      return;
    }

    if (accountNumber && !ifscCode) {
      toast.error("Please enter a valid IFSC code for your bank account.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await api.put<any>("/vendors/me/bank-details", {
        bank_account_number: accountNumber || null,
        bank_ifsc: ifscCode || null,
        bank_account_holder_name: accountHolderName || null,
        bank_name: bankName || null,
        upi_id: upiId || null,
      });

      if (res.success) {
        toast.success("Bank & Payout credentials updated and synced successfully! 🎉");
        queryClient.invalidateQueries({ queryKey: ["vendorWallet"] });
        queryClient.invalidateQueries({ queryKey: ["vendorEarnings"] });
        queryClient.invalidateQueries({ queryKey: ["vendorProfile"] });
        onClose();
      } else {
        toast.error(res.error?.message || "Failed to update bank details");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to update bank details");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg rounded-3xl border-emerald-500/20 bg-card p-6 max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
              <Landmark className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg font-bold text-foreground">
                Direct Bank & UPI Configuration
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Earnings and withdrawals will be credited directly to these verified accounts.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 mt-3">
          {/* Direct Bank Account Section */}
          <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <CreditCard className="h-4 w-4 text-emerald-600" />
              Direct Bank Account (IMPS / NEFT / RTGS)
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Account Holder / Beneficiary Name</Label>
              <Input
                placeholder="e.g. Ramesh Kumar / Fresh Grocers"
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                className="rounded-xl h-10 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Bank Account Number</Label>
                <Input
                  type="password"
                  placeholder="Enter Account Number"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="rounded-xl h-10 text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Confirm Account Number</Label>
                <Input
                  placeholder="Re-enter Account Number"
                  value={confirmAccountNumber}
                  onChange={(e) => setConfirmAccountNumber(e.target.value)}
                  className="rounded-xl h-10 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">IFSC Code</Label>
                  {isValidatingIfsc && <Loader2 className="h-3 w-3 animate-spin text-emerald-600" />}
                </div>
                <Input
                  placeholder="e.g. HDFC0001234"
                  value={ifscCode}
                  maxLength={11}
                  onChange={(e) => handleIfscChange(e.target.value)}
                  className="rounded-xl h-10 text-xs font-mono uppercase"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Bank Name</Label>
                <Input
                  placeholder="e.g. HDFC Bank"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="rounded-xl h-10 text-xs"
                />
              </div>
            </div>

            {ifscBranchInfo && (
              <div className="text-[11px] font-medium text-emerald-600 bg-emerald-500/10 px-3 py-1.5 rounded-xl flex items-center gap-1.5 border border-emerald-500/20">
                <Building className="h-3.5 w-3.5 shrink-0" />
                <span>{ifscBranchInfo}</span>
              </div>
            )}
          </div>

          {/* Instant UPI ID Section */}
          <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <Smartphone className="h-4 w-4 text-emerald-600" />
              Instant UPI ID (VPA)
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Virtual Payment Address (UPI)</Label>
              <Input
                placeholder="e.g. yourname@okaxis or 9876543210@paytm"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value.toLowerCase().trim())}
                className="rounded-xl h-10 text-xs font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Supported for instant sub-merchant transfers & on-demand UPI withdrawals.
              </p>
            </div>
          </div>

          <div className="p-3 bg-emerald-500/5 rounded-2xl border border-emerald-500/20 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              Banking credentials are encrypted and synchronized with Razorpay Route for automated direct deposits.
            </span>
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
              disabled={isSaving}
              className="rounded-xl h-11 px-5 bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs flex items-center gap-2 shadow-md"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin text-black" /> : <CheckCircle2 className="h-4 w-4" />}
              Save Bank & UPI Details
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
