import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Crown,
  Sparkles,
  Calendar,
  Percent,
  Store,
  ShieldCheck,
  Zap,
  ArrowRight,
  Loader2,
  AlertTriangle,
  Check,
  Clock,
  CreditCard,
  BadgeCheck,
  TrendingUp,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/vendor/membership/")({
  component: VendorMembershipIndex,
});

type Plan = {
  id: string;
  name: string;
  slug: string;
  price: number;
  billing_period: string;
  features: string[];
  product_limit: number;
  commission_rate: number;
  includes_sponsorship: boolean;
};

type Membership = {
  tier: string;
  plan: Plan | null;
  subscription?: { status: string } | null;
  expires_at: string | null;
  is_expired: boolean;
  commission_rate: number;
  is_sponsored: boolean;
};

function VendorMembershipIndex() {
  const queryClient = useQueryClient();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const { data: membershipRes, isLoading: membershipLoading } = useQuery({
    queryKey: ["vendorMembership"],
    queryFn: () => api.get<Membership>("/vendors/me/membership"),
  });
  const membership = membershipRes?.data as Membership | undefined;

  const { data: productsRes } = useQuery({
    queryKey: ["vendorProducts"],
    queryFn: () => api.get<{ length: number }[]>("/products/me?include_inactive=true"),
  });
  const productCount = productsRes?.data?.length ?? 0;

  const plan = membership?.plan ?? null;
  const subscription = membership?.subscription ?? null;
  const subStatus = subscription?.status ?? "active";
  const isPaidPlan = Boolean(plan && Number(plan.price) > 0);
  const isPaymentPending = isPaidPlan && subStatus === "pending";
  const isFree =
    !membership?.plan ||
    Number(membership.plan.price) === 0 ||
    (membership.tier ?? "").toLowerCase() === "basic";
  const canCancel =
    isPaidPlan && (subStatus === "active" || subStatus === "halted") && !membership?.is_expired;

  const planPrice = Number(plan?.price ?? 0);
  const billingPeriod = plan?.billing_period || "month";
  const commissionRate = plan?.commission_rate ?? membership?.commission_rate ?? 5;

  const productLimit = plan?.product_limit ?? 20;
  const isUnlimited = !productLimit || productLimit <= 0;
  const usagePercentage = isUnlimited
    ? 0
    : Math.min(100, Math.round((productCount / productLimit) * 100));

  const expiryLabel = (() => {
    if (!membership?.expires_at) return "Lifetime Access";
    const exp = new Date(membership.expires_at);
    if (membership.is_expired) return `Expired on ${exp.toLocaleDateString()}`;
    const days = Math.ceil((exp.getTime() - Date.now()) / 86400000);
    if (days <= 1) return "Expires today";
    return `${exp.toLocaleDateString()} · ${days} days left`;
  })();

  const statusInfo = (() => {
    if (isPaymentPending) return { label: "Awaiting Payment", icon: Clock, tone: "amber" as const };
    if (membership?.is_expired)
      return { label: "Plan Expired", icon: AlertTriangle, tone: "destructive" as const };
    if (isFree) return { label: "Free Tier", icon: Sparkles, tone: "secondary" as const };
    return { label: "Active", icon: BadgeCheck, tone: "default" as const };
  })();

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

  const benefits = Array.isArray(plan?.features) && plan.features.length > 0 ? plan!.features : [];

  return (
    <div className="space-y-6">
      {/* Pending payment banner */}
      {isPaymentPending && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
            <div className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">
              <span className="block font-bold">Payment pending</span>
              <span>
                Your <strong>{plan?.name}</strong> plan will activate once your payment is
                confirmed.
              </span>
            </div>
          </div>
          <Link to="/vendor/membership/upgrade" className="sm:ml-auto shrink-0">
            <Button
              variant="secondary"
              size="sm"
              className="gap-2 rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400"
            >
              Retry Payment <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      )}

      {membershipLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-72 w-full rounded-3xl" />
          <div className="grid md:grid-cols-2 gap-4">
            <Skeleton className="h-48 w-full rounded-3xl" />
            <Skeleton className="h-48 w-full rounded-3xl" />
          </div>
        </div>
      ) : (
        <>
          {/* Current plan card */}
          <Card className="overflow-hidden rounded-3xl border-border/60 shadow-xl">
            <div
              className={cn(
                "relative overflow-hidden p-6 md:p-8",
                isFree
                  ? "bg-gradient-to-br from-emerald-500/10 via-card to-emerald-500/5"
                  : "bg-gradient-to-br from-amber-500/10 via-card to-amber-500/5",
              )}
            >
              <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-amber-400/10 blur-3xl" />
              <div className="pointer-events-none absolute top-0 right-4 hidden opacity-[0.06] sm:block">
                {isFree ? (
                  <Crown className="h-40 w-40 rotate-12" />
                ) : (
                  <Sparkles className="h-40 w-40 rotate-12 text-amber-500" />
                )}
              </div>

              <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "grid h-16 w-16 shrink-0 place-items-center rounded-2xl shadow-md",
                      isFree
                        ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white"
                        : "bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-slate-950",
                    )}
                  >
                    {isFree ? <Crown className="h-8 w-8" /> : <Zap className="h-8 w-8" />}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                        Current Plan
                      </span>
                      <Badge
                        variant={statusInfo.tone === "amber" ? "outline" : statusInfo.tone}
                        className={cn(
                          "gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                          statusInfo.tone === "amber" &&
                            "border-amber-500/40 bg-amber-500/10 text-amber-600",
                        )}
                      >
                        <statusInfo.icon className="h-3 w-3" />
                        {statusInfo.label}
                      </Badge>
                    </div>
                    <h3 className="font-display text-2xl md:text-3xl font-black capitalize tracking-tight">
                      {plan?.name || "Free Starter"}
                    </h3>
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      {isPaidPlan ? (
                        <>
                          <span className="font-display text-lg font-black text-foreground">
                            ₹{planPrice.toLocaleString("en-IN")}
                          </span>
                          <span className="text-xs uppercase tracking-wide">/ {billingPeriod}</span>
                        </>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <ShieldCheck className="h-4 w-4 text-emerald-500" />
                          Free to start selling — no subscription needed.
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="relative flex items-center gap-3 lg:shrink-0">
                  {canCancel && (
                    <Button
                      variant="outline"
                      onClick={() => setConfirmCancel(true)}
                      disabled={cancelMutation.isPending}
                      className="gap-2 rounded-xl border-red-500/40 text-red-600 hover:bg-red-500/10 dark:text-red-400"
                    >
                      {cancelMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <span className="flex items-center gap-2">Cancel Subscription</span>
                      )}
                    </Button>
                  )}
                  <Link to="/vendor/membership/upgrade">
                    <Button
                      size="lg"
                      className={cn(
                        "gap-2 rounded-xl",
                        !isFree &&
                          "bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 hover:from-amber-400/90 hover:to-amber-500/90",
                      )}
                    >
                      {isFree ? "Upgrade Plan" : "Change Plan"}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            {/* Stats band */}
            <CardContent className="p-6 md:p-8 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-6 pt-6">
                <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Percent className="h-4 w-4 text-emerald-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      Platform Commission
                    </span>
                  </div>
                  <p className="mt-2 font-display text-2xl font-black">{commissionRate}%</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Keep {100 - Number(commissionRate)}% of every sale
                  </p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Store className="h-4 w-4 text-blue-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      Product Usage
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <p className="font-display text-2xl font-black">
                      {isUnlimited ? "Unlimited" : `${productCount}`}
                      <span className="ml-1 text-xs font-bold text-muted-foreground">
                        {isUnlimited ? "listings" : `/ ${productLimit}`}
                      </span>
                    </p>
                  </div>
                  {!isUnlimited && (
                    <Progress value={usagePercentage} className="mt-3 h-1.5 bg-blue-500/15" />
                  )}
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {isUnlimited
                      ? "List as many products as you want"
                      : usagePercentage >= 90
                        ? "You're close to your listing limit"
                        : `${productLimit - productCount} listing slots available`}
                  </p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4 text-purple-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      Plan Validity
                    </span>
                  </div>
                  <p className="mt-2 font-display text-2xl font-black">{expiryLabel}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {membership?.is_expired
                      ? "Renew to restore benefits"
                      : isFree
                        ? "Free tier never expires"
                        : "Auto-renews on this date"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Benefits + sponsorship */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="rounded-3xl border-border/60 shadow-lg md:col-span-2">
              <CardContent className="p-6 md:p-7 space-y-5">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-500" />
                  <h4 className="font-display text-base font-bold">What your plan includes</h4>
                </div>

                {benefits.length > 0 ? (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {benefits.map((feature, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 rounded-xl border border-border/50 bg-muted/20 p-3.5"
                      >
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-600">
                          <Check className="h-3 w-3" />
                        </span>
                        <span className="text-xs font-medium leading-relaxed">{feature}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {[
                      "Reduced platform commission",
                      "Higher product listing limits",
                      "Priority placement in search results",
                      "Dedicated seller support",
                    ].map((feature) => (
                      <div
                        key={feature}
                        className="flex items-start gap-3 rounded-xl border border-border/50 bg-muted/20 p-3.5"
                      >
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-600">
                          <Check className="h-3 w-3" />
                        </span>
                        <span className="text-xs font-medium leading-relaxed">{feature}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              {isPaidPlan && (
                <Card className="rounded-3xl border-border/60 shadow-lg">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-blue-500" />
                      <h4 className="font-display text-base font-bold">Subscription</h4>
                    </div>
                    <div className="space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Plan amount</span>
                        <span className="font-bold">
                          ₹{planPrice.toLocaleString("en-IN")} / {billingPeriod}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Billing status</span>
                        <Badge
                          variant={subStatus === "pending" ? "secondary" : "default"}
                          className="rounded-full capitalize"
                        >
                          {subStatus}
                        </Badge>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Sponsorship</span>
                        <span className="font-bold">
                          {plan?.includes_sponsorship || membership?.is_sponsored
                            ? "Included"
                            : "Not included"}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card
                className={cn(
                  "rounded-3xl border-0 shadow-lg overflow-hidden",
                  isFree
                    ? "bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white"
                    : "bg-gradient-to-br from-amber-500/15 via-card to-amber-500/5 border-border/60",
                )}
              >
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-amber-400" />
                    <h4 className="font-display text-base font-bold">
                      {isFree ? "Ready to grow faster?" : "Getting the most from your plan?"}
                    </h4>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {isFree
                      ? "Upgrade to cut your commission, unlock more listings and get featured placement in search results."
                      : "Compare other tiers to find the perfect fit as your orders grow."}
                  </p>
                  <Link to="/vendor/membership/upgrade" className="block">
                    <Button
                      variant={isFree ? "default" : "outline"}
                      className="w-full gap-2 rounded-xl"
                    >
                      {isFree ? "Explore Plans" : "Compare Plans"}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* Cancel confirmation dialog */}
      <Dialog open={confirmCancel} onOpenChange={(open) => !open && setConfirmCancel(false)}>
        <DialogContent className="rounded-3xl max-w-md border-border">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-red-500/10 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </span>
              Cancel Subscription?
            </DialogTitle>
            <DialogDescription className="text-xs">
              You'll lose your <strong>{plan?.name}</strong> benefits and revert to the free Basic
              plan. Your store keeps working either way.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 rounded-2xl bg-muted/50 p-4 text-xs text-muted-foreground">
            <p className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-emerald-500" /> No further charges to your payment
              method
            </p>
            <p className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-emerald-500" /> Store continues on the free Basic
              plan
            </p>
            <p className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-emerald-500" /> You can resubscribe anytime from
              the Plans page
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-3 sm:space-x-0">
            <Button
              variant="outline"
              onClick={() => setConfirmCancel(false)}
              disabled={cancelMutation.isPending}
              className="flex-1 rounded-xl"
            >
              Keep Subscription
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              className="flex-1 rounded-xl gap-2"
            >
              {cancelMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Yes, Cancel It
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
