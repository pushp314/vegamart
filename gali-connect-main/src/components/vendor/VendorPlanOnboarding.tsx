import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Crown, Sparkles, Loader2, ArrowRight, Check, Star, Percent } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Plan = {
  id: string;
  name: string;
  slug: string;
  price: number | { toNumber(): number };
  billing_period: string;
  features: string[];
  product_limit: number;
  commission_rate: number;
  includes_sponsorship: boolean;
};

export function VendorPlanOnboarding() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: plansRes, isLoading } = useQuery({
    queryKey: ["membershipPlans"],
    queryFn: () => api.get<Plan[]>("/membership-plans"),
  });
  const plans: Plan[] = plansRes?.data || [];
  const freePlan = plans.find((p) => Number(p.price) === 0);

  const activateFreeMutation = useMutation({
    mutationFn: async () => {
      if (!freePlan) {
        throw new Error("Free plan is currently unavailable. Please try again later.");
      }
      const res = await api.post<{ success: boolean }>("/vendors/me/membership", {
        plan_id: freePlan.id,
      });
      if (!res.success) {
        throw new Error(res.error?.message || "Failed to start with the free plan");
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorMembership"] });
      queryClient.invalidateQueries({ queryKey: ["vendorProfile"] });
      toast.success("You're on the Free Starter plan. Welcome to Vegamart!");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="mx-auto max-w-3xl px-4 pt-14 pb-8 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-slate-950 shadow-xl shadow-amber-500/20">
            <Crown className="h-8 w-8" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-black tracking-tight">
            Your store is live — pick your plan
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            Congratulations on getting approved! Choose how you want to grow with Vegamart. You can
            switch plans anytime from your Membership page.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-16">
        {isLoading ? (
          <div className="grid md:grid-cols-3 gap-5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-72 w-full rounded-3xl" />
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-5 items-stretch">
            {plans.map((plan) => {
              const price = Number(plan.price);
              const isFree = price === 0;
              const highlight = plan.includes_sponsorship && !isFree;
              return (
                <div
                  key={plan.id}
                  className={cn(
                    "relative flex flex-col rounded-3xl border bg-card p-6 transition-all duration-300",
                    highlight
                      ? "border-amber-400/80 shadow-2xl shadow-amber-500/10 bg-gradient-to-b from-amber-500/5 via-card to-card"
                      : "border-border hover:shadow-xl",
                  )}
                >
                  {highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-1 text-[10px] font-black uppercase tracking-wider text-slate-950 shadow-md">
                      Most Popular
                    </span>
                  )}
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "grid h-11 w-11 place-items-center rounded-2xl",
                        isFree
                          ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          : "bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950",
                      )}
                    >
                      {isFree ? <Star className="h-5 w-5" /> : <Crown className="h-5 w-5" />}
                    </span>
                    <div>
                      <h3 className="font-display text-lg font-bold capitalize">{plan.name}</h3>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {plan.billing_period}ly billing
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-baseline gap-1.5 border-b border-border/50 pb-5">
                    <span className="font-display text-3xl font-black">
                      {isFree ? "₹0" : `₹${price.toLocaleString("en-IN")}`}
                    </span>
                    {!isFree && (
                      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        / {plan.billing_period}
                      </span>
                    )}
                  </div>

                  <ul className="mt-5 flex-1 space-y-2.5 text-xs text-muted-foreground">
                    <li className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span className="font-semibold text-foreground">
                        {plan.product_limit > 0
                          ? `Up to ${plan.product_limit} product listings`
                          : "Unlimited product catalog"}
                      </span>
                    </li>
                    {plan.includes_sponsorship && (
                      <li className="flex items-start gap-2.5">
                        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                        <span className="font-bold text-amber-600 dark:text-amber-400">
                          Top placement in search & category pages
                        </span>
                      </li>
                    )}
                  </ul>

                  <Button
                    onClick={() =>
                      isFree
                        ? activateFreeMutation.mutate()
                        : navigate({ to: "/vendor/membership/upgrade" })
                    }
                    disabled={activateFreeMutation.isPending}
                    className={cn(
                      "mt-6 w-full h-11 rounded-2xl text-xs font-bold uppercase tracking-wider",
                      isFree
                        ? "bg-slate-900 text-white hover:bg-slate-800 shadow-md"
                        : "bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 hover:from-amber-400/95 hover:to-amber-600/95 shadow-lg shadow-amber-500/20",
                    )}
                  >
                    {isFree ? (
                      activateFreeMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Start Free"
                      )
                    ) : (
                      <>
                        Choose {plan.name} <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 text-center">
          <Link
            to="/vendor/membership/upgrade"
            className="text-xs font-bold text-primary underline underline-offset-4 hover:text-primary/80"
          >
            Compare all plans in detail →
          </Link>
        </div>
      </div>
    </div>
  );
}
