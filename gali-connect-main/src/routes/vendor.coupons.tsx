import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Ticket, Lock, Plus } from "lucide-react";
import { CreateCouponModal } from "@/components/vendor/CreateCouponModal";

export const Route = createFileRoute("/vendor/coupons")({
  component: VendorCouponsPage,
});

function VendorCouponsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: dashboardRes, isLoading: isDashboardLoading } = useQuery({
    queryKey: ["vendorDashboard"],
    queryFn: () => api.get<any>("/vendors/me/dashboard"),
  });

  const dashboard = dashboardRes?.data?.data ?? dashboardRes?.data ?? {};
  const currentTier = dashboard?.membership?.tier || "basic";
  const hasBusinessPlan = currentTier === "business";

  const { data: couponsRes, isLoading: isCouponsLoading } = useQuery({
    queryKey: ["vendorCoupons"],
    queryFn: () => api.get<any>("/vendors/me/coupons"),
    enabled: hasBusinessPlan,
  });

  const isLoading = isDashboardLoading || (hasBusinessPlan && isCouponsLoading);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!hasBusinessPlan) {
    return (
      <div className="space-y-6">
        <h2 className="font-display text-lg font-bold">Offers & Coupons</h2>
        <Card className="overflow-hidden relative border-amber-500/20 mt-8">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />
          <CardContent className="flex flex-col items-center justify-center py-12 text-center relative z-10">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-slate-900 text-amber-500 mb-4 shadow-lg shadow-amber-500/20">
              <Lock className="h-8 w-8" />
            </div>
            <h3 className="font-display text-2xl font-bold mb-2">Business Tier Exclusive</h3>
            <p className="text-muted-foreground max-w-md mb-6">
              Create custom percentage discounts, fixed coupons, and free shipping offers. Run festival promotions to dramatically boost your sales.
            </p>
            <Link
              to="/vendor/membership"
              className="rounded-2xl bg-gradient-to-r from-amber-400 to-amber-600 px-6 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:scale-105 transition-transform"
            >
              Upgrade to Business
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const coupons = couponsRes?.data?.data ?? couponsRes?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <Ticket className="h-5 w-5 text-amber-500" /> Offers & Coupons
          </h2>
          <p className="text-sm text-muted-foreground">Manage your store's promotional codes.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-amber-500 text-slate-950 px-4 py-2 text-sm font-bold shadow-md hover:bg-amber-400"
        >
          <Plus className="h-4 w-4" /> Create Coupon
        </button>
      </div>

      <CreateCouponModal open={isCreateOpen} onOpenChange={setIsCreateOpen} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {coupons.length > 0 ? (
          coupons.map((coupon: any) => (
            <Card key={coupon.id} className="border-border">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="flex justify-between items-center text-lg">
                  <span className="font-black tracking-widest uppercase">{coupon.code}</span>
                  <span className="text-xs font-bold px-2 py-1 bg-emerald-500/10 text-emerald-600 rounded-md">
                    {coupon.is_active ? "Active" : "Inactive"}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Discount:</span>
                    <span className="font-bold text-foreground">
                      {coupon.type === "PERCENTAGE"
                        ? `${coupon.value}%`
                        : coupon.type === "FREE_DELIVERY"
                          ? "Free Delivery"
                          : `₹${coupon.value}`}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Usage:</span>
                    <span className="font-bold text-foreground">
                      {coupon.used_count || 0} / {coupon.usage_limit ? coupon.usage_limit : "∞"}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Valid:</span>
                    <span className="font-bold text-foreground text-xs">
                      {new Date(coupon.valid_from).toLocaleDateString()} —{" "}
                      {new Date(coupon.valid_until).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center p-12 text-center border rounded-3xl border-dashed">
            <Ticket className="h-10 w-10 text-muted-foreground mb-4 opacity-20" />
            <h3 className="font-bold text-lg mb-1">No coupons yet</h3>
            <p className="text-sm text-muted-foreground">Create your first coupon to boost sales.</p>
          </div>
        )}
      </div>
    </div>
  );
}
