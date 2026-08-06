import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, ShoppingCart, Package, Star } from "lucide-react";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

import { Link } from "@tanstack/react-router";

export function VendorAnalytics() {
  const { data: dashboardRes, isLoading: isDashboardLoading } = useQuery({
    queryKey: ["vendorDashboard"],
    queryFn: () => api.get<any>("/vendors/me/dashboard"),
  });

  const dashboard = dashboardRes?.data?.data ?? dashboardRes?.data ?? {};
  const currentTier = dashboard?.membership?.tier || "basic";
  const hasPremiumAnalytics = currentTier === "premium" || currentTier === "business";

  const { data: analyticsRes, isLoading: isAnalyticsLoading } = useQuery({
    queryKey: ["vendorPremiumAnalytics"],
    queryFn: () => api.get<any>("/vendors/me/analytics"),
    enabled: hasPremiumAnalytics,
  });

  const isLoading = isDashboardLoading || (hasPremiumAnalytics && isAnalyticsLoading);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const stats = dashboard.stats ?? {};
  const topProducts = dashboard.top_products ?? [];

  const revenueComparison = [
    { label: "Today", revenue: stats.today_revenue ?? 0 },
    { label: "Weekly", revenue: stats.weekly_revenue ?? 0 },
    { label: "Monthly", revenue: stats.monthly_revenue ?? 0 },
    { label: "Total", revenue: stats.total_revenue ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <h2 className="font-display text-lg font-bold">Analytics</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Today's Revenue
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{stats.today_revenue ?? 0}</div>
            <p className="text-xs text-muted-foreground">{stats.today_orders ?? 0} orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Weekly Revenue
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{stats.weekly_revenue ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Monthly Revenue
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{stats.monthly_revenue ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Rating</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.vendor?.rating ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {dashboard.vendor?.review_count ?? 0} reviews
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Revenue Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueComparison}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="revenue" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top Products</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProducts}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="order_count" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Order Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{stats.pending_orders ?? 0}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.active_orders ?? 0}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.total_orders ?? 0}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {stats.low_stock_products ?? 0}
              </div>
              <div className="text-xs text-muted-foreground">Low Stock</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!hasPremiumAnalytics ? (
        <Card className="mt-8 overflow-hidden relative border-amber-500/20">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />
          <CardContent className="flex flex-col items-center justify-center py-12 text-center relative z-10">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-amber-500/10 text-amber-500 mb-4">
              <Star className="h-8 w-8" />
            </div>
            <h3 className="font-display text-2xl font-bold mb-2">Unlock Advanced Analytics</h3>
            <p className="text-muted-foreground max-w-md mb-6">
              Get deep insights into your customer behavior, sales trends, and store performance by upgrading to Premium.
            </p>
            <Link
              to="/vendor/membership"
              className="rounded-2xl bg-gradient-to-r from-amber-400 to-amber-600 px-6 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:scale-105 transition-transform"
            >
              Upgrade to Premium
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" /> Premium Customer Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-muted/50 p-4">
                  <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-bold">New Customers</div>
                  <div className="text-2xl font-black">{analyticsRes?.data?.data?.overview?.new_customers || 0}</div>
                </div>
                <div className="rounded-xl bg-emerald-500/10 p-4">
                  <div className="text-xs text-emerald-600 mb-1 uppercase tracking-wider font-bold">Repeat Customers</div>
                  <div className="text-2xl font-black text-emerald-700">{analyticsRes?.data?.data?.overview?.repeat_customers || 0}</div>
                </div>
                <div className="rounded-xl bg-blue-500/10 p-4">
                  <div className="text-xs text-blue-600 mb-1 uppercase tracking-wider font-bold">Store Views</div>
                  <div className="text-2xl font-black text-blue-700">{analyticsRes?.data?.data?.overview?.store_views || 0}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
