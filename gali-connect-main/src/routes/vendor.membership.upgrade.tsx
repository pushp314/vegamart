import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Crown,
  Loader2,
  Check,
  Sparkles,
  Star,
  Zap,
  ShieldAlert,
  ArrowRight,
  HelpCircle,
  BadgeCheck,
  Store,
  Percent,
  TrendingUp,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/vendor/membership/upgrade")({
  component: VendorMembershipUpgrade,
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

type RazorpayCheckoutResponse = {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
};

type RazorpayConstructor = new (options: Record<string, unknown>) => { open: () => void };

type PurchaseResponse = {
  checkout?: {
    razorpay_subscription_id: string;
    key_id: string;
    amount: number;
    currency: string;
  };
  membership?: Membership;
};

function getRazorpayCtor(): RazorpayConstructor | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { Razorpay?: RazorpayConstructor }).Razorpay ?? null;
}

function VendorMembershipUpgrade() {
  const queryClient = useQueryClient();
  const [confirmPlan, setConfirmPlan] = useState<Plan | null>(null);

  const { data: membershipRes } = useQuery({
    queryKey: ["vendorMembership"],
    queryFn: () => api.get<Membership>("/vendors/me/membership"),
  });
  const membership = membershipRes?.data as Membership | undefined;
  const currentPlanId = membership?.plan?.id;
  const currentPlanName = membership?.plan?.name ?? "Free Starter";

  const { data: plansRes, isLoading: plansLoading } = useQuery({
    queryKey: ["membershipPlans"],
    queryFn: () => api.get<Plan[]>("/membership-plans"),
  });
  const plans: Plan[] = plansRes?.data || [];

  const purchaseMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await api.post<PurchaseResponse>("/vendors/me/membership", { plan_id: planId });
      if (!res.success || !res.data) {
        throw new Error(res.error?.message || "Failed to activate plan");
      }
      return res.data;
    },
    onSuccess: async (data) => {
      const checkout = data?.checkout;
      if (checkout?.razorpay_subscription_id) {
        try {
          const activated = await openRazorpaySubscriptionCheckout(checkout);
          if (activated) {
            toast.success("Membership plan activated successfully!");
            setConfirmPlan(null);
          }
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Payment was not completed. Please try again.",
          );
        }
        return;
      }
      queryClient.setQueryData(["vendorMembership"], { success: true, data: data.membership });
      queryClient.invalidateQueries({ queryKey: ["vendorProfile"] });
      queryClient.invalidateQueries({ queryKey: ["vendorMembership"] });
      toast.success("Membership plan activated successfully!");
      setConfirmPlan(null);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to activate plan");
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (payload: {
      razorpay_subscription_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }) => {
      const res = await api.post<{
        payment: Record<string, unknown>;
        membership: Record<string, unknown>;
      }>("/vendors/me/membership/verify", payload);
      if (!res.success || !res.data) {
        throw new Error(res.error?.message || "Payment verification failed");
      }
      return res.data;
    },
  });

  const loadRazorpayScript = () => {
    return new Promise<boolean>((resolve) => {
      if (getRazorpayCtor()) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const openRazorpaySubscriptionCheckout = async (checkout: {
    razorpay_subscription_id: string;
    key_id: string;
    amount: number;
    currency: string;
  }): Promise<boolean> => {
    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      throw new Error("Razorpay checkout failed to load. Are you online?");
    }
    const RazorpayCtor = getRazorpayCtor();
    if (!RazorpayCtor) {
      throw new Error("Razorpay checkout is unavailable.");
    }
    const confirmPlanRef = confirmPlan;

    return new Promise<boolean>((resolve) => {
      const options: Record<string, unknown> = {
        key: checkout.key_id || import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_xxxxxxxxxxxx",
        amount: Math.round(checkout.amount * 100),
        currency: checkout.currency || "INR",
        name: "Vegamart",
        description: `Vegamart ${confirmPlanRef?.name ?? ""} Membership`,
        subscription_id: checkout.razorpay_subscription_id,
        handler: async (response: RazorpayCheckoutResponse) => {
          try {
            await verifyMutation.mutateAsync({
              razorpay_subscription_id: checkout.razorpay_subscription_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            queryClient.invalidateQueries({ queryKey: ["vendorMembership"] });
            queryClient.invalidateQueries({ queryKey: ["vendorProfile"] });
            resolve(true);
          } catch {
            resolve(false);
          }
        },
        modal: { ondismiss: () => resolve(false) },
        theme: { color: "#f59e0b" },
      };
      const paymentObject = new RazorpayCtor(options);
      paymentObject.open();
    });
  };

  const sponsoredPlan = plans.find((p) => p.includes_sponsorship);
  const hasPlans = plans.length > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
          <Zap className="h-3.5 w-3.5" /> Flexible Growth Tiers
        </span>
        <h2 className="text-2xl md:text-3xl font-display font-extrabold tracking-tight text-foreground">
          Choose the plan that grows with your store
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Unlock higher listing limits, search sponsorship, and priority features for your store.
        </p>
        <Badge
          variant="secondary"
          className="gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold"
        >
          <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />
          You're currently on <strong className="capitalize">{currentPlanName}</strong>
        </Badge>
      </div>

      {/* Plan cards */}
      {plansLoading ? (
        <div className="grid md:grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[480px] w-full rounded-3xl" />
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlanId;
            const isFreePlan = Number(plan.price) === 0;
            const price = Number(plan.price);
            const highlight = !isCurrent && plan.includes_sponsorship;

            return (
              <div
                key={plan.id}
                className={cn(
                  "relative flex flex-col rounded-3xl border bg-card p-7 transition-all duration-300",
                  isCurrent
                    ? "border-emerald-500 shadow-2xl ring-2 ring-emerald-500/20"
                    : highlight
                      ? "border-amber-400/80 shadow-2xl shadow-amber-500/10 hover:-translate-y-1.5 bg-gradient-to-b from-amber-500/5 via-card to-card"
                      : "border-border hover:shadow-xl hover:-translate-y-1",
                )}
              >
                {(isCurrent || highlight) && (
                  <span
                    className={cn(
                      "absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-[10px] font-black uppercase tracking-wider shadow-md",
                      isCurrent
                        ? "bg-emerald-500 text-white"
                        : "bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950",
                    )}
                  >
                    {isCurrent ? "Current Plan" : "Most Popular"}
                  </span>
                )}

                {/* Plan identity */}
                <div className="flex items-center gap-3.5 mb-6">
                  <span
                    className={cn(
                      "grid h-12 w-12 shrink-0 place-items-center rounded-2xl shadow-sm",
                      isFreePlan
                        ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        : "bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950",
                    )}
                  >
                    {isFreePlan ? <Star className="h-6 w-6" /> : <Crown className="h-6 w-6" />}
                  </span>
                  <div>
                    <h3 className="font-display text-xl font-bold capitalize">{plan.name}</h3>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {plan.billing_period}ly billing
                    </p>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-6 flex items-baseline gap-1.5 border-b border-border/50 pb-6">
                  <span className="font-display text-4xl font-black text-foreground">
                    ₹{price === 0 ? "0" : price.toLocaleString("en-IN")}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    / {plan.billing_period}
                  </span>
                </div>

                {/* Features */}
                <ul className="mb-8 space-y-3 text-xs text-muted-foreground flex-1">
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-600">
                      <Store className="h-3 w-3" />
                    </span>
                    <span className="font-semibold text-foreground">
                      {plan.product_limit > 0
                        ? `Up to ${plan.product_limit} product listings`
                        : "Unlimited product catalog"}
                    </span>
                  </li>
                  {plan.includes_sponsorship && (
                    <li className="flex items-start gap-3">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-500/10 text-amber-600">
                        <Sparkles className="h-3 w-3" />
                      </span>
                      <span className="font-bold text-amber-600 dark:text-amber-400">
                        Top placement in search & category pages
                      </span>
                    </li>
                  )}
                  {Array.isArray(plan.features) &&
                    plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-muted text-foreground">
                          <Check className="h-3 w-3" />
                        </span>
                        <span>{f}</span>
                      </li>
                    ))}
                </ul>

                {/* CTA */}
                <Button
                  onClick={() => setConfirmPlan(plan)}
                  disabled={isCurrent || purchaseMutation.isPending}
                  className={cn(
                    "mt-auto w-full h-12 rounded-2xl text-xs font-bold uppercase tracking-wider",
                    isCurrent
                      ? "cursor-default bg-muted text-muted-foreground border border-border hover:bg-muted"
                      : highlight
                        ? "bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 hover:from-amber-400/95 hover:to-amber-600/95 shadow-lg shadow-amber-500/20"
                        : "bg-slate-900 text-white hover:bg-slate-800 shadow-md",
                  )}
                >
                  {isCurrent ? (
                    "Current Plan"
                  ) : isFreePlan ? (
                    "Switch to Basic"
                  ) : (
                    <>
                      Upgrade to {plan.name} <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Compare plans table */}
      {hasPlans && (
        <Card className="rounded-3xl border-border/60 shadow-lg">
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-500" /> Compare all plans
            </CardTitle>
            <CardDescription className="text-xs">
              A quick side-by-side view of every tier available to vendors.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px]">Plan</TableHead>
                    {plans.map((p) => (
                      <TableHead
                        key={p.id}
                        className={cn(
                          "min-w-[120px] text-center",
                          p.id === currentPlanId && "text-emerald-600",
                        )}
                      >
                        <span className="capitalize">{p.name}</span>
                        {p.id === currentPlanId && (
                          <span className="ml-1 text-[9px] uppercase">· yours</span>
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground">Price</TableCell>
                    {plans.map((p) => (
                      <TableCell key={p.id} className="text-center font-bold">
                        ₹{Number(p.price) === 0 ? "Free" : Number(p.price).toLocaleString("en-IN")}
                        {Number(p.price) > 0 && (
                          <span className="text-[10px] font-normal text-muted-foreground">
                            {" "}
                            /{p.billing_period}
                          </span>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground">
                      Product listings
                    </TableCell>
                    {plans.map((p) => (
                      <TableCell key={p.id} className="text-center font-bold">
                        {p.product_limit > 0 ? p.product_limit : "Unlimited"}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground">Sponsorship</TableCell>
                    {plans.map((p) => (
                      <TableCell key={p.id} className="text-center">
                        {p.includes_sponsorship ? (
                          <Badge className="gap-1 rounded-full bg-amber-500/15 text-amber-600 border-amber-500/30">
                            <Sparkles className="h-3 w-3" /> Included
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                  {plans.some((p) => Array.isArray(p.features) && p.features.length > 0) && (
                    <TableRow>
                      <TableCell className="align-top font-medium text-muted-foreground">
                        Highlights
                      </TableCell>
                      {plans.map((p) => (
                        <TableCell key={p.id} className="align-top text-center">
                          <ul className="space-y-1">
                            {(p.features ?? []).slice(0, 2).map((f, i) => (
                              <li key={i} className="text-[11px] text-muted-foreground">
                                {f}
                              </li>
                            ))}
                          </ul>
                        </TableCell>
                      ))}
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Help strip */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-3xl border border-border/60 bg-muted/30 p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-500/10 text-blue-500">
            <HelpCircle className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-bold">Need help picking a plan?</p>
            <p className="text-xs text-muted-foreground">
              Upgrades apply instantly. Switching to a lower tier takes effect at renewal.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1.5">
          <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
          Secure payments via Razorpay
        </Badge>
      </div>

      {/* Confirmation dialog */}
      <Dialog open={!!confirmPlan} onOpenChange={(open) => !open && setConfirmPlan(null)}>
        <DialogContent className="rounded-3xl border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-500/10 text-amber-500">
                <Crown className="h-5 w-5" />
              </span>
              Confirm Plan Activation
            </DialogTitle>
            <DialogDescription className="text-xs">
              Review your plan details before proceeding. You can switch plans anytime.
            </DialogDescription>
          </DialogHeader>

          {confirmPlan && (
            <>
              <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold capitalize">{confirmPlan.name} Plan</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {confirmPlan.billing_period}ly billing
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-xl font-black text-emerald-600">
                      ₹{Number(confirmPlan.price).toLocaleString("en-IN")}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      / {confirmPlan.billing_period}
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-background/60 border border-border/40 p-2.5">
                    <p className="text-muted-foreground">Product Limit</p>
                    <p className="font-bold">
                      {confirmPlan.product_limit > 0 ? confirmPlan.product_limit : "Unlimited"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-background/60 border border-border/40 p-2.5">
                    <p className="text-muted-foreground">Search Boost</p>
                    <p className="font-bold">{confirmPlan.includes_sponsorship ? "Sponsored ✓" : "Standard"}</p>
                  </div>
                </div>
                {confirmPlan.includes_sponsorship && (
                  <p className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                    <Sparkles className="h-3.5 w-3.5" /> Includes sponsored top placement
                  </p>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-3 sm:space-x-0">
                <Button
                  variant="outline"
                  onClick={() => setConfirmPlan(null)}
                  disabled={purchaseMutation.isPending}
                  className="flex-1 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => purchaseMutation.mutate(confirmPlan.id)}
                  disabled={purchaseMutation.isPending}
                  className={cn(
                    "flex-1 rounded-xl gap-2",
                    Number(confirmPlan.price) > 0 &&
                      "bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 hover:from-amber-400/95 hover:to-amber-500/95",
                  )}
                >
                  {purchaseMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : Number(confirmPlan.price) === 0 ? (
                    "Activate Plan Now"
                  ) : (
                    "Proceed to Payment"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
