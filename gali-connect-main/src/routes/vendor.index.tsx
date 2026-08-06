import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Package, ClipboardList, Wallet, Sparkles } from "lucide-react";
import { VendorMembershipCard } from "@/components/vendor/shared";

export const Route = createFileRoute("/vendor/")({
  component: VendorOverviewPage,
});

function VendorOverviewPage() {
  const { data: vendorRes } = useQuery({
    queryKey: ["vendorProfile"],
    queryFn: () => api.get<{ data: any }>("/vendors/me"),
  });
  const vendor = vendorRes?.data?.data || vendorRes?.data;

  const { data: dashboardRes } = useQuery({
    queryKey: ["vendorDashboard"],
    queryFn: () => api.get<{ data: any }>("/vendors/me/dashboard"),
    enabled: !!vendor?.id && vendor?.status === "approved",
  });
  
  const dashboard = dashboardRes?.data?.data || dashboardRes?.data;
  const stats = dashboard?.stats || {};
  const membership = dashboard?.membership || {};
  const plan = membership?.plan || {};
  const currentTier = membership?.tier || "basic";
  
  const productLimit = plan.product_limit ?? 10;
  const isUnlimitedProducts = productLimit <= 0;
  
  const productList = stats.total_products || 0;

  const vendorOrders = dashboard?.recent_orders || [];
  const activeOrders = stats.active_orders || 0;
  const thisMonthEarnings = stats.monthly_revenue || 0;
  
  const orderLimit = plan.daily_order_limit ?? 5;
  const isUnlimitedOrders = orderLimit <= 0;
  
  const dailyOrders = stats.daily_order_count || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            Welcome back, {vendor?.business_name} <Sparkles className="h-5 w-5 text-amber-500" />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here's what's happening with your store today.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 group-hover:rotate-12 transition-transform">
            <Package className="h-16 w-16" />
          </div>
          <div className="flex items-center justify-between mb-3 relative z-10">
            <div className="flex items-center gap-3 text-muted-foreground">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
                <Package className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider">Product Limit</span>
            </div>
          </div>
          <p className="font-display text-3xl font-black relative z-10">
            {productList} <span className="text-lg text-muted-foreground font-medium">/ {isUnlimitedProducts ? "∞" : productLimit}</span>
          </p>
          {!isUnlimitedProducts && (
            <div className="w-full bg-secondary h-1.5 rounded-full mt-3 overflow-hidden">
              <div 
                className={`h-full ${productList >= productLimit ? 'bg-destructive' : 'bg-primary'}`} 
                style={{ width: `${Math.min(100, (productList / productLimit) * 100)}%` }} 
              />
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 group-hover:rotate-12 transition-transform">
            <ClipboardList className="h-16 w-16" />
          </div>
          <div className="flex items-center justify-between mb-3 relative z-10">
            <div className="flex items-center gap-3 text-muted-foreground">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/10 text-amber-500">
                <ClipboardList className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider">Today's Orders</span>
            </div>
          </div>
          <p className="font-display text-3xl font-black relative z-10">
            {dailyOrders} <span className="text-lg text-muted-foreground font-medium">/ {isUnlimitedOrders ? "∞" : orderLimit}</span>
          </p>
          {!isUnlimitedOrders && (
            <div className="w-full bg-secondary h-1.5 rounded-full mt-3 overflow-hidden">
              <div 
                className={`h-full ${dailyOrders >= orderLimit ? 'bg-destructive' : 'bg-amber-500'}`} 
                style={{ width: `${Math.min(100, (dailyOrders / orderLimit) * 100)}%` }} 
              />
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 group-hover:rotate-12 transition-transform">
            <Wallet className="h-16 w-16" />
          </div>
          <div className="flex items-center gap-3 text-muted-foreground mb-3 relative z-10">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <Wallet className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider">Total Earnings</span>
          </div>
          <p className="font-display text-3xl font-black relative z-10">
            ₹{Number(thisMonthEarnings).toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" /> Recent Orders
            </h3>
            <div className="space-y-3">
              {vendorOrders.slice(0, 5).length > 0 ? (
                vendorOrders.slice(0, 5).map((order: any) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between rounded-2xl border border-border/50 bg-muted/30 p-3 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary font-bold text-xs">
                        #{order.id.slice(0, 4)}
                      </div>
                      <div>
                        <p className="text-sm font-bold">
                          {order.items?.length || 0} items
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(order.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">
                        ₹{Number(order.total).toLocaleString("en-IN")}
                      </p>
                      <span className="text-[10px] uppercase font-bold text-primary tracking-wider">
                        {order.status.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No orders yet
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <VendorMembershipCard vendor={vendor} />
        </div>
      </div>
    </div>
  );
}
