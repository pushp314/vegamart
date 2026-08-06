import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Star,
  Sparkles,
  Calendar,
  Percent,
  Store,
  Crown,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  XCircle,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/vendor/membership/")({
  component: VendorMembershipIndex,
});

function VendorMembershipIndex() {
  const queryClient = useQueryClient();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const { data: membershipRes } = useQuery({
    queryKey: ["vendorMembership"],
    queryFn: () => api.get<any>("/vendors/me/membership"),
  });
  const membership = membershipRes?.data;
  const subscription = membership?.subscription;
  const subStatus = subscription?.status ?? "active";
  const isPaidPlan = membership?.plan && Number(membership.plan.price) > 0;
  const isPaymentPending = isPaidPlan && subStatus === "pending";
  const canCancel =
    isPaidPlan && (subStatus === "active" || subStatus === "halted") && !membership?.is_expired;

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<Record<string, unknown>>("/vendors/me/membership/cancel");
      if (!res.success) {
        throw new Error(res.error?.message || "Failed to cancel subscription");
      }
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["vendorMembership"], { success: true, data });
      queryClient.invalidateQueries({ queryKey: ["vendorProfile"] });
      queryClient.invalidateQueries({ queryKey: ["vendorMembership"] });
      setConfirmCancel(false);
      toast.success("Subscription canceled. Your store is back on the basic plan.");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to cancel subscription");
    },
  });

  const { data: productsRes } = useQuery({
    queryKey: ["vendorProducts"],
    queryFn: () => api.get<any[]>("/products/me?include_inactive=true"),
  });
  const productCount = productsRes?.data?.length || 0;

  const isFree =
    !membership?.plan ||
    Number(membership.plan.price) === 0 ||
    (membership.tier ?? "").toLowerCase() === "basic";

  const productLimit = membership?.plan?.product_limit || 20;
  const isUnlimited = !productLimit || productLimit <= 0;
  const usagePercentage = isUnlimited
    ? 100
    : Math.min(100, Math.round((productCount / productLimit) * 100));

  const expiryLabel = (() => {
    if (!membership?.expires_at) return "Lifetime Access";
    const exp = new Date(membership.expires_at);
    if (membership.is_expired) return `Expired on ${exp.toLocaleDateString()}`;
    const days = Math.ceil((exp.getTime() - Date.now()) / 86400000);
    return days <= 1 ? "Expires today" : `Expires in ${days} days (${exp.toLocaleDateString()})`;
  })();

  return (
    <div className="space-y-8">
      {/* Pending Payment Banner */}
      {isPaymentPending && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div className="text-xs leading-relaxed">
            <span className="font-bold block">Payment pending</span>
            <span>
              Your <strong>{membership?.plan?.name}</strong> plan will activate once your payment is
              confirmed. Complete the Razorpay checkout to get started.
            </span>
          </div>
          <Link
            to="/vendor/membership/upgrade"
            className="ml-auto shrink-0 rounded-xl bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold shadow-md hover:bg-amber-400"
          >
            Retry Payment
          </Link>
        </div>
      )}

      {/* Active Plan Card */}
      <div
        className={`relative overflow-hidden rounded-3xl border p-8 shadow-2xl transition-all ${
          isFree
            ? "border-emerald-500/30 bg-gradient-to-br from-emerald-50/80 via-card to-emerald-100/30 dark:from-emerald-950/20 dark:to-card"
            : "border-amber-400/40 bg-gradient-to-br from-amber-50/90 via-card to-amber-100/40 dark:from-amber-950/30 dark:to-card"
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div
              className={`grid h-20 w-20 shrink-0 place-items-center rounded-3xl shadow-md ${
                isFree
                  ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white"
                  : "bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-slate-950 shadow-amber-500/20"
              }`}
            >
              {isFree ? <Star className="h-10 w-10" /> : <Crown className="h-10 w-10" />}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                  Active Subscription
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                    isFree
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                      : "bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-500/30"
                  }`}
                >
                  {isFree ? "Basic Plan" : "Premium Tier"}
                </span>
              </div>
              <h2 className="font-display text-3xl md:text-4xl font-black capitalize tracking-tight text-foreground">
                {membership?.plan?.name || "Free Starter"}
              </h2>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 font-medium">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Status:{" "}
                <span className="font-bold text-foreground">
                  {isPaymentPending
                    ? "Awaiting Payment"
                    : membership?.is_expired
                      ? "Expired"
                      : "Active & Verified"}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {canCancel && (
              <button
                onClick={() => setConfirmCancel(true)}
                disabled={cancelMutation.isPending}
                className="inline-flex items-center gap-2 rounded-2xl border border-red-500/40 text-red-600 dark:text-red-400 px-5 py-3 text-xs font-bold shadow-md hover:bg-red-500/10 transition-all"
              >
                {cancelMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                Cancel Subscription
              </button>
            )}
            <Link
              to="/vendor/membership/upgrade"
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 text-white px-5 py-3 text-xs font-bold shadow-lg hover:bg-slate-800 transition-all hover:scale-[1.02]"
            >
              {isFree ? "Upgrade Plan" : "Change Plan"} <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 mt-8 border-t border-border/60">
          <div className="flex items-start gap-4 p-4 rounded-2xl bg-background/50 border border-border/50">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
              <Percent className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">
                Commission
              </span>
              <div className="font-display text-xl font-black text-foreground mt-0.5">
                {Number(membership?.commission_rate ?? 5)}%
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Vegamart platform fee</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-2xl bg-background/50 border border-border/50">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600">
              <Store className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">
                  Product Limit
                </span>
                <span className="text-[10px] font-bold text-muted-foreground">
                  {productCount} / {isUnlimited ? "∞" : productLimit}
                </span>
              </div>
              <div className="font-display text-xl font-black text-foreground mt-0.5">
                {isUnlimited ? "Unlimited" : `${productLimit} Products`}
              </div>
              {!isUnlimited && (
                <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${usagePercentage}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-2xl bg-background/50 border border-border/50">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">
                Validity Period
              </span>
              <div className="font-display text-xl font-black text-foreground mt-0.5">
                {expiryLabel}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Auto-renewal status</p>
            </div>
          </div>
        </div>
      </div>

      {/* Perks & Features Included */}
      <div className="rounded-3xl border border-border bg-card p-6 md:p-8 shadow-xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-xl font-bold flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" /> Plan Features & Perks Included
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Here is what your active membership currently unlocks for your store:
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl border border-border/60 bg-muted/30 space-y-2">
            <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
              <ShieldCheck className="h-4 w-4" /> Reduced Commission
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Keep more of your earnings with standard platform fees.
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-border/60 bg-muted/30 space-y-2">
            <div className="flex items-center gap-2 text-blue-600 font-bold text-sm">
              <Store className="h-4 w-4" /> Product Catalog Slot
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              List up to {isUnlimited ? "unlimited" : productLimit} active products in your digital
              storefront.
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-border/60 bg-muted/30 space-y-2">
            <div className="flex items-center gap-2 text-amber-600 font-bold text-sm">
              <Sparkles className="h-4 w-4" /> Storefront Profile
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Customizable vendor page with map integration and instant customer navigation.
            </p>
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      {confirmCancel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
          onClick={() => !cancelMutation.isPending && setConfirmCancel(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-red-500/10 text-red-600">
                <XCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold">Cancel Subscription?</h3>
                <p className="text-xs text-muted-foreground">
                  You'll lose {membership?.plan?.name} benefits and revert to the Basic plan.
                </p>
              </div>
            </div>
            <div className="rounded-2xl bg-muted/50 p-4 text-xs text-muted-foreground space-y-1.5">
              <p>• No further charges will be made to your payment method.</p>
              <p>• Store access continues on the free Basic plan.</p>
              <p>• You can resubscribe anytime from the Upgrade page.</p>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirmCancel(false)}
                disabled={cancelMutation.isPending}
                className="flex-1 rounded-2xl border border-border py-3 text-xs font-bold"
              >
                Keep Subscription
              </button>
              <button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="flex-1 rounded-2xl bg-red-500 text-white py-3 text-xs font-bold shadow-lg hover:bg-red-400 flex items-center justify-center gap-2"
              >
                {cancelMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Yes, Cancel It"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
