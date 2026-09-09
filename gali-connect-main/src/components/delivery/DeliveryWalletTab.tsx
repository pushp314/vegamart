import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Wallet,
  Landmark,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  Download,
  Loader2,
  Smartphone,
  CreditCard,
  Building,
  ShieldCheck,
  Bike,
  Receipt,
  FileText,
  AlertTriangle,
  Banknote,
  QrCode,
  Copy,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { api, authStorage, API_BASE_URL, ACCESS_TOKEN_KEY } from "@/lib/api";
import { toast } from "sonner";

export function DeliveryWalletTab() {
  const queryClient = useQueryClient();
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);

  // Withdrawal form states
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMode, setWithdrawMode] = useState<"BANK_TRANSFER" | "UPI">("UPI");
  const [withdrawNotes, setWithdrawNotes] = useState("");

  // Bank/UPI configuration form states
  const [bankAccount, setBankAccount] = useState("");
  const [confirmBankAccount, setConfirmBankAccount] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [bankName, setBankName] = useState("");
  const [upiId, setUpiId] = useState("");
  const [ifscBranch, setIfscBranch] = useState<string | null>(null);

  // Live Verification states
  const [isValidatingIfsc, setIsValidatingIfsc] = useState(false);
  const [isVerifyingBank, setIsVerifyingBank] = useState(false);
  const [verifiedBankInfo, setVerifiedBankInfo] = useState<any>(null);
  const [isVerifyingUpi, setIsVerifyingUpi] = useState(false);
  const [verifiedUpiInfo, setVerifiedUpiInfo] = useState<any>(null);

  // Cash-in-hand deposit states
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositMode, setDepositMode] = useState<"UPI" | "BANK_TRANSFER" | "HUB_CASH_DROP">("UPI");
  const [depositRefId, setDepositRefId] = useState("");
  const [depositNotes, setDepositNotes] = useState("");

  // 1. Fetch Rider Wallet Overview
  const { data: walletRes, isLoading, refetch } = useQuery({
    queryKey: ["deliveryWallet"],
    queryFn: () => api.get<any>("/delivery/me/wallet"),
    refetchInterval: 30000,
  });

  const wallet = walletRes?.data;
  const availableBalance = wallet?.available_balance ?? 0;
  const pendingEscrow = wallet?.pending_escrow ?? 0;
  const totalWithdrawn = wallet?.total_withdrawn ?? 0;
  const lifetimeSettled = wallet?.lifetime_settled ?? 0;
  const deficitBalance = wallet?.deficit_balance ?? 0;
  const bankConfigured = wallet?.bank_configured ?? false;

  // Cash-in-hand metrics
  const cashInHand = wallet?.cash_in_hand;
  const currentCash = Number(cashInHand?.current_cash_in_hand ?? 0);
  const maxCashLimit = Number(cashInHand?.max_cash_in_hand ?? 3000);
  const remainingCashLimit = Number(cashInHand?.remaining_limit ?? Math.max(0, maxCashLimit - currentCash));
  const isBlockedForCod = Boolean(cashInHand?.is_blocked_for_cod ?? (currentCash >= maxCashLimit));
  const pendingDepositAmount = Number(cashInHand?.total_pending_settlement ?? 0);
  const totalCodCollected = Number(cashInHand?.total_cod_collected ?? 0);
  const totalCashSettled = Number(cashInHand?.total_cash_settled ?? 0);
  const codDeliveredCount = Number(cashInHand?.cod_orders_delivered_count ?? 0);
  const cashPercent = Math.min(100, Math.max(0, Math.round((currentCash / (maxCashLimit || 1)) * 100)));

  // Cash Settlements Query
  const { data: settlementsRes } = useQuery({
    queryKey: ["deliveryCashSettlements"],
    queryFn: () => api.get<any>("/delivery/me/cash-settlements"),
    refetchInterval: 30000,
  });
  const settlements = Array.isArray(settlementsRes?.data) ? settlementsRes.data : [];

  // Cash Deposit Mutation
  const depositMutation = useMutation({
    mutationFn: (data: {
      amount: number;
      mode: "UPI" | "BANK_TRANSFER" | "HUB_CASH_DROP";
      reference_id?: string;
      notes?: string;
    }) => api.post("/delivery/me/cash-settlements", data),
    onSuccess: () => {
      toast.success("Cash deposit submitted! Vegamart admin will review and approve it shortly.");
      setIsDepositModalOpen(false);
      setDepositAmount("");
      setDepositRefId("");
      setDepositNotes("");
      queryClient.invalidateQueries({ queryKey: ["deliveryWallet"] });
      queryClient.invalidateQueries({ queryKey: ["deliveryCashSettlements"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed to submit cash settlement.");
    },
  });

  // Initialize Bank form when modal opens
  const handleOpenBankModal = () => {
    if (wallet?.bank_details) {
      setBankAccount(wallet.bank_details.bank_account_number || "");
      setConfirmBankAccount(wallet.bank_details.bank_account_number || "");
      setIfsc(wallet.bank_details.bank_ifsc || "");
      setAccountHolder(wallet.bank_details.bank_account_holder_name || "");
      setBankName(wallet.bank_details.bank_name || "");
      setUpiId(wallet.bank_details.upi_id || "");
    }
    setVerifiedBankInfo(null);
    setVerifiedUpiInfo(null);
    setIsBankModalOpen(true);
  };

  // Live IFSC lookup
  const handleIfscChange = async (val: string) => {
    const cleanIfsc = val.toUpperCase().trim();
    setIfsc(cleanIfsc);
    setIfscBranch(null);
    setVerifiedBankInfo(null);

    if (cleanIfsc.length === 11) {
      setIsValidatingIfsc(true);
      try {
        const res = await fetch(`https://ifsc.razorpay.com/${cleanIfsc}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.BANK) {
            setBankName(data.BANK);
            setIfscBranch(`${data.BANK} — ${data.BRANCH || ""}, ${data.CITY || ""}`);
          }
        } else {
          setIfscBranch("Invalid IFSC code");
        }
      } catch {
        // Fallback
      } finally {
        setIsValidatingIfsc(false);
      }
    }
  };

  // Live Bank Account verification
  const handleVerifyBank = async () => {
    if (!bankAccount || bankAccount.length < 8) {
      toast.error("Please enter a valid account number.");
      return;
    }
    if (bankAccount !== confirmBankAccount) {
      toast.error("Account numbers do not match.");
      return;
    }
    if (!ifsc || ifsc.length !== 11) {
      toast.error("Please enter an 11-character IFSC code.");
      return;
    }

    setIsVerifyingBank(true);
    try {
      const res = await api.post<any>("/delivery/me/verify-bank", {
        account_number: bankAccount,
        ifsc,
        name: accountHolder || undefined,
      });

      if (res.success && res.data?.valid) {
        setVerifiedBankInfo(res.data);
        if (res.data.bank_name) setBankName(res.data.bank_name);
        if (res.data.registered_name && !accountHolder) {
          setAccountHolder(res.data.registered_name);
        }
        toast.success(`Bank Verified! ${res.data.registered_name ? `Registered: ${res.data.registered_name}` : "Account active."}`);
      } else {
        toast.error("Bank account verification failed. Please check details.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to verify bank account.");
    } finally {
      setIsVerifyingBank(false);
    }
  };

  // Live UPI verification
  const handleVerifyUpi = async () => {
    if (!upiId || !upiId.includes("@")) {
      toast.error("Please enter a valid UPI ID (e.g. 9876543210@paytm).");
      return;
    }

    setIsVerifyingUpi(true);
    try {
      const res = await api.post<any>("/delivery/me/verify-upi", { upi_id: upiId });
      if (res.success && res.data?.valid) {
        setVerifiedUpiInfo(res.data);
        if (res.data.customer_name && !accountHolder) {
          setAccountHolder(res.data.customer_name);
        }
        toast.success(`UPI Verified via NPCI! Name: ${res.data.customer_name || "Valid handle"} ✅`);
      } else {
        toast.error("Invalid UPI ID.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to verify UPI.");
    } finally {
      setIsVerifyingUpi(false);
    }
  };

  // Save Bank Details Mutation
  const saveBankMutation = useMutation({
    mutationFn: async () => {
      if (bankAccount && bankAccount !== confirmBankAccount) {
        throw new Error("Bank account numbers do not match.");
      }
      const res = await api.put<any>("/delivery/me/bank-details", {
        bank_account_number: bankAccount || null,
        bank_ifsc: ifsc || null,
        bank_account_holder_name: accountHolder || null,
        bank_name: bankName || null,
        upi_id: upiId || null,
      });
      if (!res.success) throw new Error(res.error?.message || "Failed to save bank details");
      return res.data;
    },
    onSuccess: () => {
      toast.success("Bank & UPI details saved successfully! 🎉");
      queryClient.invalidateQueries({ queryKey: ["deliveryWallet"] });
      setIsBankModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save bank details");
    },
  });

  // Request Withdrawal Mutation
  const withdrawalMutation = useMutation({
    mutationFn: async () => {
      const amt = Number(withdrawAmount);
      if (isNaN(amt) || amt < 50) {
        throw new Error("Minimum withdrawal amount is ₹50.");
      }
      if (amt > availableBalance) {
        throw new Error(`Insufficient balance. Max withdrawable: ₹${availableBalance.toFixed(2)}`);
      }
      const res = await api.post<any>("/delivery/me/withdrawals/request", {
        amount: amt,
        payout_mode: withdrawMode,
        notes: withdrawNotes || undefined,
      });
      if (!res.success) throw new Error(res.error?.message || "Withdrawal request failed");
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Payout withdrawal submitted successfully! 💸");
      queryClient.invalidateQueries({ queryKey: ["deliveryWallet"] });
      setIsWithdrawModalOpen(false);
      setWithdrawAmount("");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Withdrawal request failed");
    },
  });

  const [isExportingCsv, setIsExportingCsv] = useState(false);

  const handleExportCsv = async () => {
    setIsExportingCsv(true);
    try {
      const token = authStorage.getAccessToken() || localStorage.getItem(ACCESS_TOKEN_KEY) || localStorage.getItem("token") || "";
      const url = `${API_BASE_URL}/delivery/me/wallet/statement/export`;
      const res = await fetch(url, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        throw new Error("Failed to export statement. Server responded with error.");
      }
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `vegamart-delivery-statement-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success("Wallet statement downloaded successfully! 📄");
    } catch (err: any) {
      toast.error(err?.message || "Failed to download wallet statement.");
    } finally {
      setIsExportingCsv(false);
    }
  };

  const setPresetAmount = (percent: number) => {
    const calculated = Math.floor((availableBalance * percent) / 100);
    setWithdrawAmount(String(calculated));
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        <p className="text-xs font-medium">Loading Rider Wallet...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Deficit Alert Banner if negative balance exists */}
      {deficitBalance > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-200 flex items-start gap-3 animate-in fade-in">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <span className="font-bold">Wallet Deficit Balance: -₹{deficitBalance.toFixed(2)}</span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              A refund or adjustment was reversed after a payout disbursement. Incoming delivery fees will automatically
              replenish this deficit until your balance returns to positive.
            </p>
          </div>
        </div>
      )}

      {/* ──────────────── CASH IN HAND & COD SETTLEMENT CARD ──────────────── */}
      <div className={`rounded-3xl p-6 border shadow-soft relative overflow-hidden transition-all duration-300 ${
        isBlockedForCod
          ? "bg-rose-500/10 border-rose-500/30 text-foreground"
          : cashPercent > 75
          ? "bg-amber-500/10 border-amber-500/30 text-foreground"
          : "bg-card border-border"
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-xl grid place-items-center ${
                isBlockedForCod
                  ? "bg-rose-500/20 text-rose-600 dark:text-rose-400"
                  : cashPercent > 75
                  ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                  : "bg-emerald-500/10 text-emerald-600"
              }`}>
                <Banknote className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Cash-in-Hand (COD Collected)
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isBlockedForCod
                  ? "bg-rose-500 text-white"
                  : cashPercent > 75
                  ? "bg-amber-500 text-black"
                  : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
              }`}>
                {isBlockedForCod ? "COD Blocked" : cashPercent > 75 ? "Near Limit" : "COD Active"}
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="font-display font-black text-3xl font-mono text-foreground">
                ₹{currentCash.toFixed(2)}
              </span>
              <span className="text-xs text-muted-foreground">
                / ₹{maxCashLimit.toFixed(2)} max allowed
              </span>
            </div>

            <p className="text-[11px] text-muted-foreground">
              {isBlockedForCod ? (
                <span className="text-rose-600 dark:text-rose-400 font-semibold">
                  ⚠️ Limit exceeded! Deposit collected cash to unlock new COD delivery orders. (Online orders remain unaffected).
                </span>
              ) : (
                <span>
                  Remaining limit: <strong className="text-foreground">₹{remainingCashLimit.toFixed(2)}</strong> before COD pauses.
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {pendingDepositAmount > 0 && (
              <div className="px-3 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                <div>
                  <div className="font-bold font-mono">₹{pendingDepositAmount.toFixed(2)}</div>
                  <div className="text-[10px] text-muted-foreground">Deposit awaiting review</div>
                </div>
              </div>
            )}

            <Button
              onClick={() => {
                setDepositAmount(String(currentCash > 0 ? currentCash : ""));
                setIsDepositModalOpen(true);
              }}
              disabled={currentCash <= 0 && pendingDepositAmount <= 0}
              className={`rounded-2xl h-11 px-5 text-xs font-bold shadow-md transition-all active:scale-95 ${
                isBlockedForCod
                  ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
              }`}
            >
              <ArrowDownLeft className="h-4 w-4 mr-1.5" />
              Deposit Cash / Settle
            </Button>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="mt-4 pt-4 border-t border-border/60">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
            <span>Limit Utilization</span>
            <span className="font-mono font-bold text-foreground">{cashPercent}% Used</span>
          </div>
          <div className="h-2.5 w-full bg-secondary/80 rounded-full overflow-hidden p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isBlockedForCod
                  ? "bg-rose-500"
                  : cashPercent > 75
                  ? "bg-amber-500"
                  : "bg-emerald-500"
              }`}
              style={{ width: `${cashPercent}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 text-[11px]">
            <div>
              <span className="text-muted-foreground block text-[10px]">Lifetime COD Collected</span>
              <span className="font-bold font-mono text-foreground">₹{totalCodCollected.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Lifetime Cash Settled</span>
              <span className="font-bold font-mono text-foreground">₹{totalCashSettled.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">COD Orders Delivered</span>
              <span className="font-bold font-mono text-foreground">{codDeliveredCount} trips</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Available Balance */}
        <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent rounded-3xl p-5 border border-emerald-500/20 shadow-soft relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              Available for Payout
            </span>
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 grid place-items-center">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="font-display font-black text-3xl text-foreground mt-2 font-mono">
            ₹{availableBalance.toFixed(2)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Ready for 1-click bank/UPI withdrawal</p>

          <div className="mt-4 pt-3 border-t border-border/60 flex items-center gap-2">
            <Button
              onClick={() => {
                if (!wallet?.bank_details?.upi_id && !wallet?.bank_details?.bank_account_number) {
                  toast.info("Please configure your UPI or Bank details first.");
                  handleOpenBankModal();
                  return;
                }
                setIsWithdrawModalOpen(true);
              }}
              disabled={availableBalance < 50}
              className="rounded-xl h-9 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-black flex-1 shadow-sm"
            >
              <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
              Withdraw Funds
            </Button>
          </div>
        </div>

        {/* Card 2: In-Escrow & In-Transit */}
        <div className="bg-card rounded-3xl p-5 border border-border shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              In-Escrow (24h Hold)
            </span>
            <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 grid place-items-center">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="font-display font-black text-3xl text-foreground mt-2 font-mono">
            ₹{pendingEscrow.toFixed(2)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Released to available balance after 24h</p>
        </div>

        {/* Card 3: Total Withdrawn */}
        <div className="bg-card rounded-3xl p-5 border border-border shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Lifetime Withdrawn
            </span>
            <div className="h-8 w-8 rounded-xl bg-sky-500/10 text-sky-600 grid place-items-center">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="font-display font-black text-3xl text-foreground mt-2 font-mono">
            ₹{totalWithdrawn.toFixed(2)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Total lifetime payouts transferred to bank/UPI
          </p>
        </div>
      </div>

      {/* Bank & UPI Configuration Card */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-600 grid place-items-center shrink-0">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">Direct Bank &amp; UPI Account</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {wallet?.bank_details?.upi_id
                  ? `Configured UPI: ${wallet.bank_details.upi_id}`
                  : wallet?.bank_details?.bank_account_number
                  ? `Bank Account: XXXX${wallet.bank_details.bank_account_number.slice(-4)} (${wallet.bank_details.bank_name || "Verified"})`
                  : "No payout account configured yet."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleOpenBankModal}
              variant="outline"
              size="sm"
              className="rounded-xl text-xs font-bold border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
            >
              <Smartphone className="h-3.5 w-3.5 mr-1" />
              {bankConfigured || wallet?.bank_details?.upi_id ? "Edit Bank / UPI" : "Configure Bank / UPI"}
            </Button>
            <Button
              onClick={handleExportCsv}
              disabled={isExportingCsv}
              variant="outline"
              size="sm"
              className="rounded-xl text-xs font-bold gap-1"
            >
              {isExportingCsv ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {isExportingCsv ? "Exporting..." : "Statement CSV"}
            </Button>
          </div>
        </div>
      </div>

      {/* Recent Withdrawals Queue */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft space-y-4">
        <h3 className="font-bold text-sm text-foreground">Recent Withdrawal Requests</h3>
        {wallet?.recent_withdrawals?.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-4 text-center">No withdrawal requests yet.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {wallet?.recent_withdrawals?.map((w: any) => (
              <div key={w.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-foreground font-mono">₹{w.amount.toFixed(2)}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    via {w.payout_mode} • {new Date(w.created_at).toLocaleDateString("en-IN")}
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      w.status === "COMPLETED"
                        ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                        : w.status === "REJECTED"
                        ? "bg-rose-500/10 text-rose-700 border border-rose-500/20"
                        : "bg-amber-500/10 text-amber-700 border border-amber-500/20"
                    }`}
                  >
                    {w.status}
                  </span>
                  {w.utr_reference && (
                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                      UTR: {w.utr_reference}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cash Deposit & Remittance History */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-foreground">Cash Settlement &amp; Deposit History</h3>
            <p className="text-[11px] text-muted-foreground">Proof of remittances submitted to Vegamart</p>
          </div>
          <span className="text-xs text-muted-foreground">{settlements.length} records</span>
        </div>

        {settlements.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-4 text-center">No cash deposits submitted yet.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {settlements.map((s: any) => (
              <div key={s.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground font-mono">₹{Number(s.amount).toFixed(2)}</span>
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                      {s.mode.replace("_", " ")}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        s.status === "APPROVED"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                          : s.status === "REJECTED"
                          ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Submitted on {new Date(s.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                    {s.reference_id && <span className="font-mono ml-1">• Ref/UTR: {s.reference_id}</span>}
                  </div>
                  {s.notes && (
                    <div className="text-[11px] text-muted-foreground italic">
                      Note: &quot;{s.notes}&quot;
                    </div>
                  )}
                  {s.admin_notes && (
                    <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      Admin: &quot;{s.admin_notes}&quot;
                    </div>
                  )}
                </div>

                <div className="text-right sm:text-right text-[11px] text-muted-foreground">
                  {s.status === "APPROVED" && s.reviewed_at && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      Approved on {new Date(s.reviewed_at).toLocaleDateString("en-IN")}
                    </span>
                  )}
                  {s.status === "REJECTED" && (
                    <span className="text-rose-600 dark:text-rose-400 font-medium">
                      Rejected
                    </span>
                  )}
                  {s.status === "PENDING" && (
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      Awaiting verification
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Line by Line Delivery Fee Ledger */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-foreground">Delivery Trip Ledger Statement</h3>
          <span className="text-xs text-muted-foreground">Total Trips: {wallet?.completed_trips_count ?? 0}</span>
        </div>

        {wallet?.wallet_ledger?.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-4 text-center">No trip earnings recorded yet.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {wallet?.wallet_ledger?.map((e: any) => (
              <div key={e.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-foreground">
                    {e.order_number ? `Trip for Order #${e.order_number}` : "Delivery Fee Earning"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(e.created_at).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </div>
                </div>

                <div className="text-right font-mono font-bold text-emerald-600">
                  +₹{e.amount.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ──────────────── MODAL 1: WITHDRAW FUNDS ──────────────── */}
      <Dialog open={isWithdrawModalOpen} onOpenChange={setIsWithdrawModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl border-border bg-card p-6">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-600 grid place-items-center">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="font-bold text-base">Withdraw Delivery Earnings</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Available Balance: <strong className="text-foreground">₹{availableBalance.toFixed(2)}</strong>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Quick preset chips */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPresetAmount(25)}
                className="text-xs font-bold rounded-xl flex-1"
              >
                25%
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPresetAmount(50)}
                className="text-xs font-bold rounded-xl flex-1"
              >
                50%
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPresetAmount(100)}
                className="text-xs font-bold rounded-xl flex-1 bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
              >
                100% (All)
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Withdrawal Amount (₹)</Label>
              <Input
                type="number"
                placeholder="Min ₹50"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="rounded-xl h-10 font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Payout Method</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setWithdrawMode("UPI")}
                  className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                    withdrawMode === "UPI"
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Smartphone className="h-4 w-4" />
                  Instant UPI
                </button>
                <button
                  type="button"
                  onClick={() => setWithdrawMode("BANK_TRANSFER")}
                  className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                    withdrawMode === "BANK_TRANSFER"
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Building className="h-4 w-4" />
                  Bank Transfer
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsWithdrawModalOpen(false)}
                className="rounded-xl h-10 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={withdrawalMutation.isPending || !withdrawAmount}
                onClick={() => withdrawalMutation.mutate()}
                className="rounded-xl h-10 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-black px-4"
              >
                {withdrawalMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Confirm Withdrawal
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ──────────────── MODAL 2: CONFIGURE BANK & UPI ──────────────── */}
      <Dialog open={isBankModalOpen} onOpenChange={setIsBankModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-3xl border-border bg-card p-6 max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-600 grid place-items-center">
                <Landmark className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="font-bold text-base">Configure Rider Bank &amp; UPI</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Withdrawals will be transferred directly to these accounts.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* UPI Section */}
            <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Smartphone className="h-4 w-4 text-emerald-600" />
                  Instant UPI ID
                </span>
                {upiId && (
                  <button
                    type="button"
                    onClick={handleVerifyUpi}
                    disabled={isVerifyingUpi}
                    className="text-[11px] font-bold text-emerald-600 hover:underline flex items-center gap-1"
                  >
                    {isVerifyingUpi && <Loader2 className="h-3 w-3 animate-spin" />}
                    ⚡ Verify UPI
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="e.g. 9876543210@paytm or name@okaxis"
                  value={upiId}
                  onChange={(e) => {
                    setUpiId(e.target.value.toLowerCase().trim());
                    setVerifiedUpiInfo(null);
                  }}
                  className="rounded-xl h-10 text-xs font-mono flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleVerifyUpi}
                  disabled={isVerifyingUpi || !upiId}
                  className="rounded-xl text-xs font-bold border-emerald-500/30"
                >
                  Verify
                </Button>
              </div>

              {verifiedUpiInfo && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>Verified: {verifiedUpiInfo.customer_name || "Valid UPI VPA"}</span>
                </div>
              )}
            </div>

            {/* Direct Bank Details Section */}
            <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <CreditCard className="h-4 w-4 text-emerald-600" />
                Direct Bank Account
              </span>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Account Holder Name</Label>
                <Input
                  placeholder="e.g. Rahul Sahu"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  className="rounded-xl h-10 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Account Number</Label>
                  <Input
                    type="password"
                    placeholder="Enter Account No"
                    value={bankAccount}
                    onChange={(e) => {
                      setBankAccount(e.target.value);
                      setVerifiedBankInfo(null);
                    }}
                    className="rounded-xl h-10 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Confirm Account</Label>
                  <Input
                    placeholder="Re-enter Account No"
                    value={confirmBankAccount}
                    onChange={(e) => {
                      setConfirmBankAccount(e.target.value);
                      setVerifiedBankInfo(null);
                    }}
                    className="rounded-xl h-10 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">IFSC Code</Label>
                    {isValidatingIfsc && <Loader2 className="h-3 w-3 animate-spin text-emerald-600" />}
                  </div>
                  <Input
                    placeholder="e.g. SBIN0000474"
                    value={ifsc}
                    maxLength={11}
                    onChange={(e) => handleIfscChange(e.target.value)}
                    className="rounded-xl h-10 text-xs font-mono uppercase"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Bank Name</Label>
                  <Input
                    placeholder="e.g. State Bank of India"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="rounded-xl h-10 text-xs"
                  />
                </div>
              </div>

              {ifscBranch && (
                <div className="text-[11px] font-medium text-emerald-600 bg-emerald-500/10 px-3 py-1 rounded-xl flex items-center gap-1.5 border border-emerald-500/20">
                  <Building className="h-3.5 w-3.5 shrink-0" />
                  <span>{ifscBranch}</span>
                </div>
              )}

              {bankAccount && confirmBankAccount && ifsc && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isVerifyingBank}
                  onClick={handleVerifyBank}
                  className="w-full rounded-xl text-xs font-bold border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-2 h-9"
                >
                  {isVerifyingBank ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                  ) : (
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  )}
                  <span>⚡ Live Verify Bank Account</span>
                </Button>
              )}

              {verifiedBankInfo && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>
                    Verified Bank Account at {verifiedBankInfo.bank_name || bankName} (Registered:{" "}
                    {verifiedBankInfo.registered_name || accountHolder})
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsBankModalOpen(false)}
                className="rounded-xl h-10 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={saveBankMutation.isPending}
                onClick={() => saveBankMutation.mutate()}
                className="rounded-xl h-10 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-black px-4"
              >
                {saveBankMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Save Bank &amp; UPI
              </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ──────────────── MODAL 3: DEPOSIT CASH / SETTLE ──────────────── */}
        <Dialog open={isDepositModalOpen} onOpenChange={setIsDepositModalOpen}>
          <DialogContent className="sm:max-w-lg rounded-3xl border-border bg-card p-6 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-600 grid place-items-center">
                  <Banknote className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="font-bold text-base">Deposit Cash to Vegamart</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Remit collected COD money to maintain your cash limit and keep taking COD orders.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 mt-3">
              {/* Cash in Hand Banner */}
              <div className="p-3.5 rounded-2xl bg-secondary/60 border border-border flex items-center justify-between text-xs">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Unremitted Cash</span>
                  <span className="font-display font-black text-xl font-mono text-foreground">
                    ₹{currentCash.toFixed(2)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Limit</span>
                  <span className="font-semibold text-muted-foreground">₹{maxCashLimit.toFixed(2)}</span>
                </div>
              </div>

              {/* Deposit Mode Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Payment Mode</Label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDepositMode("UPI")}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                      depositMode === "UPI"
                        ? "bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300"
                        : "border-border hover:bg-secondary/40 text-muted-foreground"
                    }`}
                  >
                    UPI QR / VPA
                  </button>
                  <button
                    type="button"
                    onClick={() => setDepositMode("BANK_TRANSFER")}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                      depositMode === "BANK_TRANSFER"
                        ? "bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300"
                        : "border-border hover:bg-secondary/40 text-muted-foreground"
                    }`}
                  >
                    Bank IMPS / NEFT
                  </button>
                  <button
                    type="button"
                    onClick={() => setDepositMode("HUB_CASH_DROP")}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                      depositMode === "HUB_CASH_DROP"
                        ? "bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300"
                        : "border-border hover:bg-secondary/40 text-muted-foreground"
                    }`}
                  >
                    Hub Cash Drop
                  </button>
                </div>
              </div>

              {/* Company Beneficiary Details Card */}
              <div className="p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-xs space-y-2">
                <div className="font-bold text-emerald-800 dark:text-emerald-300 text-[11px] flex items-center justify-between">
                  <span>Vegamart Official Deposit Account</span>
                  <span className="text-[10px] font-normal text-muted-foreground">Instant Verification</span>
                </div>

                {depositMode === "UPI" && (
                  <div className="flex items-center justify-between bg-card p-2 rounded-xl border border-border/80">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Vegamart Settlement UPI ID</span>
                      <span className="font-mono font-bold text-xs text-foreground">vegamart.settle@okhdfcbank</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText("vegamart.settle@okhdfcbank");
                        toast.success("UPI ID copied to clipboard!");
                      }}
                      className="h-7 px-2 text-xs"
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                    </Button>
                  </div>
                )}

                {depositMode === "BANK_TRANSFER" && (
                  <div className="space-y-1 bg-card p-2.5 rounded-xl border border-border/80 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Beneficiary Name:</span>
                      <strong className="text-foreground">Vegamart Logistics Private Limited</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Account Number:</span>
                      <strong className="font-mono text-foreground">50200098765432</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">IFSC Code:</span>
                      <strong className="font-mono text-foreground">HDFC0001234</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Bank &amp; Branch:</span>
                      <span className="text-foreground">HDFC Bank, Indiranagar Branch</span>
                    </div>
                  </div>
                )}

                {depositMode === "HUB_CASH_DROP" && (
                  <div className="bg-card p-2.5 rounded-xl border border-border/80 text-[11px] text-muted-foreground leading-relaxed">
                    Hand over physical cash to your nearest Vegamart Hub Supervisor. Request the printed cash receipt number and enter it below.
                  </div>
                )}
              </div>

              {/* Amount Input & Preset Chips */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Deposit Amount (₹)</Label>
                  <span className="text-[10px] text-muted-foreground">
                    Max: ₹{currentCash.toFixed(2)}
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">₹</span>
                  <Input
                    type="number"
                    min="1"
                    max={currentCash || 100000}
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="Enter deposit amount"
                    className="pl-7 rounded-xl font-mono text-base font-bold"
                  />
                </div>

                {currentCash > 0 && (
                  <div className="flex items-center gap-1.5 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDepositAmount(String(currentCash))}
                      className="text-[10px] font-bold h-7 rounded-lg px-2"
                    >
                      Full Cash (₹{currentCash})
                    </Button>
                    {currentCash >= 1000 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setDepositAmount(String(Math.min(currentCash, 1000)))}
                        className="text-[10px] font-bold h-7 rounded-lg px-2"
                      >
                        ₹1,000
                      </Button>
                    )}
                    {currentCash >= 2000 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setDepositAmount(String(Math.min(currentCash, 2000)))}
                        className="text-[10px] font-bold h-7 rounded-lg px-2"
                      >
                        ₹2,000
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* UTR / Reference ID */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  {depositMode === "HUB_CASH_DROP" ? "Hub Receipt Number / Manager Name" : "12-digit UTR / Bank Reference No"}
                </Label>
                <Input
                  type="text"
                  value={depositRefId}
                  onChange={(e) => setDepositRefId(e.target.value)}
                  placeholder={
                    depositMode === "HUB_CASH_DROP"
                      ? "e.g. HUB-BLR-04 / Manoj"
                      : "e.g. 423589123456"
                  }
                  className="rounded-xl font-mono text-xs"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Notes / Remarks (Optional)</Label>
                <Input
                  type="text"
                  value={depositNotes}
                  onChange={(e) => setDepositNotes(e.target.value)}
                  placeholder="e.g. Paid via Google Pay / Evening batch"
                  className="rounded-xl text-xs"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDepositModalOpen(false)}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={
                    depositMutation.isPending ||
                    !depositAmount ||
                    Number(depositAmount) <= 0 ||
                    Number(depositAmount) > currentCash
                  }
                  onClick={() => {
                    const parsedAmount = Number(depositAmount);
                    if (!parsedAmount || parsedAmount <= 0) {
                      toast.error("Please enter a valid amount.");
                      return;
                    }
                    if (parsedAmount > currentCash) {
                      toast.error(`Deposit cannot exceed current cash-in-hand (₹${currentCash.toFixed(2)}).`);
                      return;
                    }
                    depositMutation.mutate({
                      amount: parsedAmount,
                      mode: depositMode,
                      reference_id: depositRefId.trim() || undefined,
                      notes: depositNotes.trim() || undefined,
                    });
                  }}
                  className="rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-black px-4"
                >
                  {depositMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                  Submit Deposit for Approval
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
