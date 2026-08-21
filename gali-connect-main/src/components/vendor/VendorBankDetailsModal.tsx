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

  // Live Auto-Verification states
  const [isVerifyingBank, setIsVerifyingBank] = useState(false);
  const [verifiedBankInfo, setVerifiedBankInfo] = useState<{
    valid: boolean;
    registered_name?: string | null;
    bank_name?: string | null;
    branch?: string | null;
    city?: string | null;
  } | null>(null);

  const [isVerifyingUpi, setIsVerifyingUpi] = useState(false);
  const [verifiedUpiInfo, setVerifiedUpiInfo] = useState<{
    valid: boolean;
    customer_name?: string | null;
  } | null>(null);

  useEffect(() => {
    if (isOpen && currentBankDetails) {
      setAccountNumber(currentBankDetails.bank_account_number || "");
      setConfirmAccountNumber(currentBankDetails.bank_account_number || "");
      setIfscCode(currentBankDetails.bank_ifsc || "");
      setAccountHolderName(currentBankDetails.bank_account_holder_name || "");
      setBankName(currentBankDetails.bank_name || "");
      setUpiId(currentBankDetails.upi_id || "");
      setIfscBranchInfo(null);
      setVerifiedBankInfo(null);
      setVerifiedUpiInfo(null);
    }
  }, [isOpen, currentBankDetails]);

  // Live IFSC lookup & bank name auto-fill
  const handleIfscChange = async (val: string) => {
    const cleanIfsc = val.toUpperCase().trim();
    setIfscCode(cleanIfsc);
    setIfscBranchInfo(null);
    setVerifiedBankInfo(null);

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

  // Live Real-Time Bank Account Verification (Penny Drop / Core Banking Check)
  const handleVerifyBankAccount = async () => {
    if (!accountNumber || accountNumber.length < 8) {
      toast.error("Please enter a valid Bank Account Number.");
      return;
    }
    if (accountNumber !== confirmAccountNumber) {
      toast.error("Bank Account numbers do not match. Please re-check.");
      return;
    }
    if (!ifscCode || ifscCode.length !== 11) {
      toast.error("Please enter a valid 11-digit IFSC code.");
      return;
    }

    setIsVerifyingBank(true);
    try {
      const res = await api.post<any>("/vendors/me/verify-bank", {
        account_number: accountNumber,
        ifsc: ifscCode,
        name: accountHolderName || undefined,
      });

      if (res.success && res.data?.valid) {
        setVerifiedBankInfo(res.data);
        if (res.data.bank_name) setBankName(res.data.bank_name);
        if (res.data.registered_name && !accountHolderName) {
          setAccountHolderName(res.data.registered_name);
        }
        toast.success(`Bank Account Verified! ${res.data.registered_name ? `Registered to: ${res.data.registered_name}` : "Account is active."} 🎉`);
      } else {
        toast.error("Bank account verification failed. Please check the Account Number and IFSC.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to verify bank account.");
    } finally {
      setIsVerifyingBank(false);
    }
  };

  // Live Real-Time UPI Verification via Razorpay / NPCI
  const handleVerifyUpi = async () => {
    if (!upiId || !upiId.includes("@")) {
      toast.error("Please enter a valid UPI ID (e.g. name@okhdfcbank or 9876543210@paytm).");
      return;
    }

    setIsVerifyingUpi(true);
    try {
      const res = await api.post<any>("/vendors/me/verify-upi", {
        upi_id: upiId,
      });

      if (res.success && res.data?.valid) {
        setVerifiedUpiInfo(res.data);
        if (res.data.customer_name) {
          if (!accountHolderName) {
            setAccountHolderName(res.data.customer_name);
          }
          toast.success(`UPI ID Verified with NPCI! Registered Name: ${res.data.customer_name} ✅`);
        } else {
          toast.success("UPI ID format verified successfully! ✅");
        }
      } else {
        toast.error("Invalid or unrecognized UPI ID. Please check your UPI handle.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to verify UPI ID.");
    } finally {
      setIsVerifyingUpi(false);
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
                  onChange={(e) => {
                    setAccountNumber(e.target.value);
                    setVerifiedBankInfo(null);
                  }}
                  className="rounded-xl h-10 text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Confirm Account Number</Label>
                <Input
                  placeholder="Re-enter Account Number"
                  value={confirmAccountNumber}
                  onChange={(e) => {
                    setConfirmAccountNumber(e.target.value);
                    setVerifiedBankInfo(null);
                  }}
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

            {/* Live Bank Verification Trigger & Status Badge */}
            {accountNumber && confirmAccountNumber && ifscCode && (
              <div className="pt-1">
                {verifiedBankInfo ? (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-950 dark:text-emerald-200 space-y-1 animate-in fade-in">
                    <div className="flex items-center gap-1.5 font-bold">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Active Bank Account Verified</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {verifiedBankInfo.bank_name || bankName} {verifiedBankInfo.branch ? `— ${verifiedBankInfo.branch}` : ""}
                      {verifiedBankInfo.registered_name ? ` • Registered Beneficiary: ${verifiedBankInfo.registered_name}` : ""}
                    </p>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isVerifyingBank}
                    onClick={handleVerifyBankAccount}
                    className="w-full rounded-xl text-xs font-bold border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-2 h-9"
                  >
                    {isVerifyingBank ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                        <span>Verifying with Core Banking System...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                        <span>⚡ Live Verify Bank Account &amp; Beneficiary Name</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Instant UPI ID Section */}
          <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <Smartphone className="h-4 w-4 text-emerald-600" />
                Instant UPI ID (VPA)
              </div>
              {upiId && !verifiedUpiInfo && (
                <button
                  type="button"
                  onClick={handleVerifyUpi}
                  disabled={isVerifyingUpi}
                  className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1"
                >
                  {isVerifyingUpi && <Loader2 className="h-3 w-3 animate-spin" />}
                  ⚡ Verify UPI
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Virtual Payment Address (UPI)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. yourname@okaxis or 9876543210@paytm"
                  value={upiId}
                  onChange={(e) => {
                    setUpiId(e.target.value.toLowerCase().trim());
                    setVerifiedUpiInfo(null);
                  }}
                  className="rounded-xl h-10 text-xs font-mono flex-1"
                />
                {upiId && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isVerifyingUpi}
                    onClick={handleVerifyUpi}
                    className="rounded-xl px-3 text-xs font-bold shrink-0 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-500/5 hover:bg-emerald-500/15"
                  >
                    {isVerifyingUpi ? <Loader2 className="h-3 w-3 animate-spin" /> : "Verify"}
                  </Button>
                )}
              </div>

              {verifiedUpiInfo && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-950 dark:text-emerald-200 space-y-1 mt-2 animate-in fade-in">
                  <div className="flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>UPI ID Verified via NPCI</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {verifiedUpiInfo.customer_name ? `Registered Name: ${verifiedUpiInfo.customer_name} (Live Bank Record)` : "Virtual Payment Address is active and valid."}
                  </p>
                </div>
              )}

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
