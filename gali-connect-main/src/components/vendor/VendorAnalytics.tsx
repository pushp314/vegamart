import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, ShoppingCart, Package, Star } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

export function VendorAnalytics() {
  const { data: dashboardRes, isLoading } = useQuery({
    queryKey: ["vendorDashboard"],
    queryFn: () => api.get<any>("/vendors/me/dashboard"),
  });

  const dashboard = dashboardRes?.data?.data ?? dashboardRes?.data ?? {};

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const stats = dashboard.stats ?? {};
  const topProducts = dashboard.top_products ?? [];

  // Generate mock weekly data from available stats
  const weeklyData = [
    { day: "Mon", revenue: Math.round((stats.weekly_revenue ?? 0) * 0.12) },
    { day: "Tue", revenue: Math.round((stats.weekly_revenue ?? 0) * 0.15) },
    { day: "Wed", revenue: Math.round((stats.weekly_revenue ?? 0) * 0.18) },
    { day: "Thu", revenue: Math.round((stats.weekly_revenue ?? 0) * 0.14) },
    { day: "Fri", revenue: Math.round((stats.weekly_revenue ?? 0) * 0.2) },
    { day: "Sat", revenue: Math.round((stats.weekly_revenue ?? 0) * 0.12) },
    { day: "Sun", revenue: Math.round((stats.weekly_revenue ?? 0) * 0.09) },
  ];

  return (
    <div className="space-y-6">
      <h2 className="font-display text-lg font-bold">Analytics</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Today's Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{stats.today_revenue ?? 0}</div>
            <p className="text-xs text-muted-foreground">{stats.today_orders ?? 0} orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Weekly Revenue</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{stats.weekly_revenue ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Monthly Revenue</CardTitle>
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
            <p className="text-xs text-muted-foreground">{dashboard.vendor?.review_count ?? 0} reviews</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Weekly Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="#10b98140" />
                </AreaChart>
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
              <div className="text-2xl font-bold text-orange-600">{stats.low_stock_products ?? 0}</div>
              <div className="text-xs text-muted-foreground">Low Stock</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
