import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Crown, Loader2, Check, Sparkles, Star, Zap, ShieldAlert } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

type RazorpayCheckoutResponse = {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
};

type RazorpayConstructor = new (options: Record<string, unknown>) => { open: () => void };

function getRazorpayCtor(): RazorpayConstructor | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { Razorpay?: RazorpayConstructor }).Razorpay ?? null;
}

function VendorMembershipUpgrade() {
  const queryClient = useQueryClient();
  const [confirmPlan, setConfirmPlan] = useState<Plan | null>(null);

  const { data: membershipRes } = useQuery({
    queryKey: ["vendorMembership"],
    queryFn: () => api.get<any>("/vendors/me/membership"),
  });
  const membership = membershipRes?.data;
  const currentPlanId = membership?.plan?.id;

  const { data: plansRes, isLoading: plansLoading } = useQuery({
    queryKey: ["membershipPlans"],
    queryFn: () => api.get<Plan[]>("/membership-plans"),
  });
  const plans: Plan[] = plansRes?.data || [];

  const purchaseMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await api.post<any>("/vendors/me/membership", { plan_id: planId });
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
            toast.success("Membership plan activated successfully! 🎉");
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
      toast.success("Membership plan activated successfully! 🎉");
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
        theme: { color: "#10b981" },
      };
      const paymentObject = new RazorpayCtor(options);
      paymentObject.open();
    });
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
          <Zap className="h-3.5 w-3.5" /> Flexible Growth Tiers
        </span>
        <h2 className="text-3xl font-display font-extrabold text-foreground">
          Select the perfect plan for your business
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Upgrade to unlock lower commissions, higher product limits, and priority sponsored
          placement in customer search results.
        </p>
      </div>

      {plansLoading ? (
        <div className="flex justify-center p-12 text-muted-foreground gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
          <span>Loading membership tiers...</span>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlanId;
            const isFreePlan = Number(plan.price) === 0;

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-3xl border bg-card p-8 transition-all duration-300 ${
                  isCurrent
                    ? "border-emerald-500 shadow-2xl ring-2 ring-emerald-500/20 scale-[1.02]"
                    : plan.includes_sponsorship
                      ? "border-amber-400/80 shadow-2xl shadow-amber-500/10 hover:-translate-y-1 bg-gradient-to-b from-amber-500/5 via-card to-card"
                      : "border-border hover:shadow-xl hover:-translate-y-1"
                }`}
              >
                {isCurrent && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-4 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-md">
                    Current Active Plan
                  </span>
                )}
                {!isCurrent && plan.includes_sponsorship && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-1 text-[10px] font-black uppercase tracking-wider text-slate-950 shadow-md">
                    Most Popular ⭐
                  </span>
                )}

                <div className="flex items-center gap-3.5 mb-6">
                  <span
                    className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl shadow-sm ${
                      isFreePlan
                        ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        : "bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950"
                    }`}
                  >
                    {isFreePlan ? <Star className="h-6 w-6" /> : <Crown className="h-6 w-6" />}
                  </span>
                  <div>
                    <h3 className="font-display text-xl font-bold">{plan.name}</h3>
                    {plan.includes_sponsorship && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-0.5">
                        <Sparkles className="h-3 w-3" /> Includes Sponsorship
                      </span>
                    )}
                  </div>
                </div>

                <div className="mb-6 flex items-baseline gap-1 border-b border-border/50 pb-6">
                  <span className="font-display text-4xl font-black text-foreground">
                    ₹{Number(plan.price) === 0 ? "0" : Number(plan.price).toLocaleString("en-IN")}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    /{plan.billing_period || "month"}
                  </span>
                </div>

                <ul className="mb-8 space-y-3.5 text-xs text-muted-foreground flex-1">
                  <li className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full bg-emerald-500/10 p-1 text-emerald-600">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                    <span className="font-semibold text-foreground">
                      {plan.product_limit > 0
                        ? `Up to ${plan.product_limit} product listings`
                        : "Unlimited product catalog"}
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full bg-emerald-500/10 p-1 text-emerald-600">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                    <span className="font-semibold text-foreground">
                      {plan.commission_rate}% Vegamart commission
                    </span>
                  </li>
                  {plan.includes_sponsorship && (
                    <li className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-full bg-amber-500/10 p-1 text-amber-600">
                        <Sparkles className="h-3.5 w-3.5" />
                      </div>
                      <span className="font-bold text-amber-600 dark:text-amber-400">
                        Top Placement in Search & Category pages
                      </span>
                    </li>
                  )}
                  {Array.isArray(plan.features) &&
                    plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-full bg-muted p-1 text-foreground">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                        <span>{f}</span>
                      </li>
                    ))}
                </ul>

                <button
                  onClick={() => setConfirmPlan(plan)}
                  disabled={isCurrent || purchaseMutation.isPending}
                  className={`mt-auto w-full rounded-2xl py-3.5 text-xs font-bold uppercase tracking-wider transition-all ${
                    isCurrent
                      ? "bg-muted text-muted-foreground cursor-default border border-border"
                      : plan.includes_sponsorship
                        ? "bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 hover:opacity-95 shadow-lg shadow-amber-500/20"
                        : "bg-slate-900 text-white hover:bg-slate-800 shadow-md"
                  } disabled:opacity-60`}
                >
                  {isCurrent
                    ? "Active Plan"
                    : isFreePlan
                      ? "Switch to Basic"
                      : `Upgrade to ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal */}
      <Dialog open={!!confirmPlan} onOpenChange={(open) => !open && setConfirmPlan(null)}>
        <DialogContent className="rounded-3xl border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              Confirm Plan Activation
            </DialogTitle>
            <DialogDescription className="text-xs">
              Review your plan details before proceeding.
            </DialogDescription>
          </DialogHeader>

          {confirmPlan && (
            <div className="space-y-4 py-3">
              <div className="rounded-2xl bg-muted p-4 space-y-2">
                <div className="flex justify-between items-center font-bold">
                  <span>{confirmPlan.name} Plan</span>
                  <span className="text-emerald-600">₹{confirmPlan.price}</span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• Commission Rate: {confirmPlan.commission_rate}%</p>
                  <p>• Product Limit: {confirmPlan.product_limit || "Unlimited"}</p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setConfirmPlan(null)}
                  className="flex-1 rounded-2xl border border-border py-3 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={() => purchaseMutation.mutate(confirmPlan.id)}
                  disabled={purchaseMutation.isPending}
                  className="flex-1 rounded-2xl bg-emerald-500 text-black py-3 text-xs font-bold shadow-lg hover:bg-emerald-400 flex items-center justify-center gap-2"
                >
                  {purchaseMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : Number(confirmPlan.price) === 0 ? (
                    "Activate Plan Now"
                  ) : (
                    "Proceed to Payment"
                  )}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
