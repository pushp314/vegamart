import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import {
  Loader2,
  TrendingUp,
  IndianRupee,
  ShoppingBag,
  Eye,
  Users,
  UserCheck,
  Percent,
  Layers,
  Wallet,
  BarChart3,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/vendor/analytics")({
  component: VendorAnalytics,
});

type TimeframeKey = "today" | "week" | "month" | "year" | "all_time";
type ChartPeriodKey = "day" | "week" | "month" | "year";

function VendorAnalytics() {
  const [activeTimeframe, setActiveTimeframe] = useState<TimeframeKey>("month");
  const [activeChartPeriod, setActiveChartPeriod] = useState<ChartPeriodKey>("month");
  const [chartViewMode, setChartViewMode] = useState<"revenue" | "orders">("revenue");

  const { data: analyticsRes, isLoading, error } = useQuery({
    queryKey: ["vendorAnalytics"],
    queryFn: () => api.get<any>("/vendors/me/analytics"),
  });

  const data = analyticsRes?.data?.data || analyticsRes?.data;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  // @ts-ignore
  if (error?.response?.status === 403) {
    return (
      <div className="p-12 text-center flex flex-col items-center justify-center min-h-[50vh]">
        <div className="h-16 w-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
          <Sparkles className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Premium Feature</h2>
        <p className="text-muted-foreground max-w-md mx-auto mb-6">
          Advanced analytics are available exclusively to vendors on the Premium plan. Upgrade your plan to get deep insights into your store's performance.
        </p>
      </div>
    );
  }

  if (!data) {
    return <div className="p-6 text-center text-muted-foreground">No analytics data available.</div>;
  }

  const timeframes = data?.timeframes || {};
  const currentTf = timeframes[activeTimeframe] || {
    revenue: data?.overview?.total_revenue || 0,
    orders: data?.overview?.total_orders || 0,
    items_sold: data?.overview?.total_items_sold || 0,
    commission_rate: data?.overview?.commission_rate || 5,
    commission_amount: data?.overview?.total_commission || 0,
    net_earnings: data?.overview?.net_earnings || 0,
    new_customers: data?.overview?.new_customers || 0,
    returning_customers: data?.overview?.repeat_customers || 0,
    store_views: data?.overview?.store_views || 0,
  };

  const chartData = data?.charts?.[activeChartPeriod] || data?.dailyData || [];
  const commissionRate = currentTf.commission_rate || 5;

  const timeframeLabels: { key: TimeframeKey; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week", label: "This Week" },
    { key: "month", label: "This Month" },
    { key: "year", label: "This Year" },
    { key: "all_time", label: "All Time" },
  ];

  const metricCards = [
    {
      label: "Total Sales",
      subLabel: `${timeframeLabels.find((t) => t.key === activeTimeframe)?.label} Gross`,
      value: `₹${Number(currentTf.revenue || 0).toLocaleString("en-IN")}`,
      icon: IndianRupee,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
    {
      label: "Total Orders",
      subLabel: `${timeframeLabels.find((t) => t.key === activeTimeframe)?.label} Orders`,
      value: Number(currentTf.orders || 0).toLocaleString("en-IN"),
      icon: ShoppingBag,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
    },
    {
      label: "New Customers",
      subLabel: "First-time buyers",
      value: Number(currentTf.new_customers || 0).toLocaleString("en-IN"),
      icon: Users,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
    },
    {
      label: "Returning Customers",
      subLabel: "Repeat shoppers",
      value: Number(currentTf.returning_customers || 0).toLocaleString("en-IN"),
      icon: UserCheck,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
    },
    {
      label: "Store Visits / Views",
      subLabel: "Store profile traffic",
      value: Number(currentTf.store_views || 0).toLocaleString("en-IN"),
      icon: Eye,
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-500/10",
      border: "border-indigo-500/20",
    },
    {
      label: "Items Sold",
      subLabel: "Product units ordered",
      value: Number(currentTf.items_sold || 0).toLocaleString("en-IN"),
      icon: Layers,
      color: "text-sky-600 dark:text-sky-400",
      bg: "bg-sky-500/10",
      border: "border-sky-500/20",
    },
    {
      label: `VegaMart Commission (${commissionRate}%)`,
      subLabel: "Platform fee deducted",
      value: `-₹${Number(currentTf.commission_amount || 0).toLocaleString("en-IN")}`,
      icon: Percent,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-500/10",
      border: "border-rose-500/20",
    },
    {
      label: "Vendor Net Earning",
      subLabel: "Your take-home payout",
      value: `₹${Number(currentTf.net_earnings || 0).toLocaleString("en-IN")}`,
      icon: Wallet,
      color: "text-emerald-700 dark:text-emerald-300 font-black",
      bg: "bg-emerald-600/15",
      border: "border-emerald-600/30",
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 py-8">
      {/* Header & Timeframe Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black font-display text-foreground flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-emerald-600" /> Store Analytics &amp; Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Deep dive into customer traffic, item sales, and net revenue.
          </p>
        </div>

        {/* Timeframe Filter Pills */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-2xl border border-border overflow-x-auto hide-scrollbar">
          {timeframeLabels.map((tf) => (
            <button
              key={tf.key}
              onClick={() => setActiveTimeframe(tf.key)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeTimeframe === tf.key
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/60"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* 8 Performance Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
        {metricCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className={`rounded-3xl border ${card.border} bg-card p-4 sm:p-5 shadow-xs transition-all hover:shadow-md relative overflow-hidden`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className={`p-2.5 rounded-2xl ${card.bg} ${card.color} shrink-0`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {timeframeLabels.find((t) => t.key === activeTimeframe)?.label}
                </span>
              </div>
              <div className="mt-3">
                <p className="text-xs font-bold text-muted-foreground leading-tight">
                  {card.label}
                </p>
                <p className="text-xl sm:text-2xl font-black font-display text-foreground mt-1 leading-tight tabular-nums">
                  {card.value}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {card.subLabel}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Charts Section */}
      <section className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
          <div>
            <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-emerald-600" /> Revenue &amp; Orders Trend
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Visual performance curve across gross revenue, commission, net earnings, and volume.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border text-xs font-bold">
              <button
                onClick={() => setChartViewMode("revenue")}
                className={`px-3 py-1 rounded-lg transition-all ${
                  chartViewMode === "revenue" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Revenue (₹)
              </button>
              <button
                onClick={() => setChartViewMode("orders")}
                className={`px-3 py-1 rounded-lg transition-all ${
                  chartViewMode === "orders" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Orders &amp; Items
              </button>
            </div>

            {/* Period Switcher */}
            <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border text-xs font-bold">
              {(
                [
                  { key: "day", label: "Day (7D)" },
                  { key: "week", label: "Week (4W)" },
                  { key: "month", label: "Month (30D)" },
                  { key: "year", label: "Year (12M)" },
                ] as { key: ChartPeriodKey; label: string }[]
              ).map((p) => (
                <button
                  key={p.key}
                  onClick={() => setActiveChartPeriod(p.key)}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    activeChartPeriod === p.key ? "bg-card text-foreground shadow-xs border border-border" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chart Render Area */}
        <div className="h-72 sm:h-80 w-full pt-2">
          {chartViewMode === "revenue" ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorNetAnalytics" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorGrossAnalytics" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border/40" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "currentColor" }} className="text-muted-foreground" dy={10} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "currentColor" }} className="text-muted-foreground" tickFormatter={(val) => `₹${val}`} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "16px",
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--card))",
                    color: "hsl(var(--foreground))",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
                  }}
                  formatter={(value: any, name: string) => {
                    const num = Number(value || 0);
                    if (name === "revenue") return [`₹${num.toLocaleString("en-IN")}`, "Gross Sales"];
                    if (name === "net_earnings") return [`₹${num.toLocaleString("en-IN")}`, "Vendor Net Earning"];
                    if (name === "commission") return [`-₹${num.toLocaleString("en-IN")}`, `VegaMart Commission (${commissionRate}%)`];
                    return [value, name];
                  }}
                />
                <Legend />
                <Area type="monotone" dataKey="revenue" name="Gross Sales" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorGrossAnalytics)" />
                <Area type="monotone" dataKey="net_earnings" name="Net Take-Home" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorNetAnalytics)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border/40" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "currentColor" }} className="text-muted-foreground" dy={10} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "currentColor" }} className="text-muted-foreground" />
                <Tooltip
                  cursor={{ fill: "currentColor", opacity: 0.05 }}
                  contentStyle={{
                    borderRadius: "16px",
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--card))",
                    color: "hsl(var(--foreground))",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
                  }}
                />
                <Legend />
                <Bar dataKey="orders" name="Total Orders" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                <Bar dataKey="items_sold" name="Items Sold" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Top Products Table */}
      {data.top_selling_products?.length > 0 && (
        <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-soft">
          <div className="bg-muted/30 p-5 border-b border-border">
            <h3 className="font-bold text-sm text-foreground uppercase tracking-wider">Top Performing Products</h3>
          </div>
          <div className="divide-y divide-border/50">
            {data.top_selling_products.map((p: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center p-4 hover:bg-muted/10 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                    #{idx + 1}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-foreground">{p.name || `Product ID: ${p.product_id?.slice(0, 8)}...`}</p>
                    <p className="text-xs text-muted-foreground">{p.sales} units sold • {p.views} views</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-emerald-600 dark:text-emerald-400">₹{Number(p.revenue || 0).toLocaleString("en-IN")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

