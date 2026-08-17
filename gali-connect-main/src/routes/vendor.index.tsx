import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Package,
  ClipboardList,
  Wallet,
  Sparkles,
  MapPin,
  Settings,
  PlusCircle,
  TrendingUp,
  ShoppingBag,
  Eye,
  Users,
  UserCheck,
  Percent,
  IndianRupee,
  Layers,
  ArrowUpRight,
  Calendar,
  BarChart3,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { VendorMembershipCard } from "@/components/vendor/shared";
import { LiveBroadcaster } from "@/components/vendor/LiveBroadcaster";
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

export const Route = createFileRoute("/vendor/")({
  component: VendorOverviewPage,
});

type TimeframeKey = "today" | "week" | "month" | "year" | "all_time";
type ChartPeriodKey = "day" | "week" | "month" | "year";

function VendorOverviewPage() {
  const [activeTimeframe, setActiveTimeframe] = useState<TimeframeKey>("today");
  const [activeChartPeriod, setActiveChartPeriod] = useState<ChartPeriodKey>("month");
  const [chartViewMode, setChartViewMode] = useState<"revenue" | "orders">("revenue");

  const { data: vendorRes } = useQuery({
    queryKey: ["vendorProfile"],
    queryFn: () => api.get<{ data: any }>("/vendors/me"),
  });
  const vendor = vendorRes?.data?.data || vendorRes?.data;

  const queryClient = useQueryClient();

  const toggleAvailabilityMutation = useMutation({
    mutationFn: (isOpen: boolean) => api.put("/vendors/me/availability", { is_open: isOpen }),
    onSuccess: (_, isOpen) => {
      queryClient.invalidateQueries({ queryKey: ["vendorProfile"] });
      toast.success(isOpen ? "Your store is now ONLINE 🟢" : "Your store is now OFFLINE 🔴");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update store status");
    },
  });

  const { data: dashboardRes } = useQuery({
    queryKey: ["vendorDashboard"],
    queryFn: () => api.get<{ data: any }>("/vendors/me/dashboard"),
    enabled: !!vendor?.id && vendor?.status === "approved",
  });

  const dashboard = dashboardRes?.data?.data || dashboardRes?.data;
  const stats = dashboard?.stats || {};
  const membership = dashboard?.membership || {};
  const plan = membership?.plan || {};

  const productLimit = plan.product_limit ?? 10;
  const isUnlimitedProducts = productLimit <= 0;
  const productList = stats.total_products || 0;

  const vendorOrders = dashboard?.recent_orders || [];
  const topProducts = dashboard?.top_products || [];

  const orderLimit = plan.daily_order_limit ?? 5;
  const isUnlimitedOrders = orderLimit <= 0;
  const dailyOrders = stats.daily_order_count || 0;

  const commissionRate = stats.commission_rate ?? vendor?.commission_rate ?? 5;

  const timeframes = dashboard?.timeframes || {};
  const currentTf = timeframes[activeTimeframe] || {
    revenue: activeTimeframe === "today" ? stats.today_revenue || 0 : stats.total_revenue || 0,
    orders: activeTimeframe === "today" ? stats.today_orders || 0 : stats.total_orders || 0,
    items_sold: activeTimeframe === "today" ? stats.today_items_sold || 0 : stats.total_items_sold || 0,
    commission_rate: commissionRate,
    commission_amount: Math.round(((activeTimeframe === "today" ? stats.today_revenue || 0 : stats.total_revenue || 0) * (commissionRate / 100)) * 100) / 100,
    net_earnings: Math.round(((activeTimeframe === "today" ? stats.today_revenue || 0 : stats.total_revenue || 0) * (1 - commissionRate / 100)) * 100) / 100,
    new_customers: stats.new_customers || 0,
    returning_customers: stats.returning_customers || 0,
    store_views: stats.store_views || 0,
  };

  const chartData = dashboard?.charts?.[activeChartPeriod] || [];

  const timeframeLabels: { key: TimeframeKey; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week", label: "This Week" },
    { key: "month", label: "This Month" },
    { key: "year", label: "This Year" },
    { key: "all_time", label: "All Time" },
  ];

  const metricCards = [
    {
      id: "sales",
      label: "Total Sales",
      subLabel: `${timeframeLabels.find((t) => t.key === activeTimeframe)?.label} Gross`,
      value: `₹${Number(currentTf.revenue || 0).toLocaleString("en-IN")}`,
      icon: IndianRupee,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
    {
      id: "orders",
      label: "Total Orders",
      subLabel: `${timeframeLabels.find((t) => t.key === activeTimeframe)?.label} Orders`,
      value: Number(currentTf.orders || 0).toLocaleString("en-IN"),
      icon: ShoppingBag,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
    },
    {
      id: "new_customers",
      label: "New Customers",
      subLabel: "First-time buyers",
      value: Number(currentTf.new_customers || 0).toLocaleString("en-IN"),
      icon: Users,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
    },
    {
      id: "returning_customers",
      label: "Returning Customers",
      subLabel: "Repeat shoppers",
      value: Number(currentTf.returning_customers || 0).toLocaleString("en-IN"),
      icon: UserCheck,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
    },
    {
      id: "store_views",
      label: "Store Visits / Views",
      subLabel: "Store profile traffic",
      value: Number(currentTf.store_views || 0).toLocaleString("en-IN"),
      icon: Eye,
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-500/10",
      border: "border-indigo-500/20",
    },
    {
      id: "items_sold",
      label: "Items Sold",
      subLabel: "Product units ordered",
      value: Number(currentTf.items_sold || 0).toLocaleString("en-IN"),
      icon: Layers,
      color: "text-sky-600 dark:text-sky-400",
      bg: "bg-sky-500/10",
      border: "border-sky-500/20",
    },
    {
      id: "commission",
      label: `VegaMart Commission (${currentTf.commission_rate}%)`,
      subLabel: "Platform fee deducted",
      value: `-₹${Number(currentTf.commission_amount || 0).toLocaleString("en-IN")}`,
      icon: Percent,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-500/10",
      border: "border-rose-500/20",
    },
    {
      id: "net_earnings",
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
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-black flex items-center gap-2">
            Welcome back, {vendor?.business_name} <Sparkles className="h-6 w-6 text-amber-500" />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time sales, customer visits, commission, and earnings overview.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-card border border-border px-4 py-2 rounded-2xl shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Status: {vendor?.is_open ? <span className="text-emerald-500 font-extrabold">Online 🟢</span> : <span className="text-rose-500 font-extrabold">Offline 🔴</span>}
          </span>
          <button
            onClick={() => toggleAvailabilityMutation.mutate(!vendor?.is_open)}
            disabled={toggleAvailabilityMutation.isPending}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
              vendor?.is_open ? "bg-emerald-500" : "bg-muted-foreground/30"
            }`}
            aria-checked={vendor?.is_open}
            role="switch"
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                vendor?.is_open ? "translate-x-6" : "translate-x-1"
              } shadow-sm`}
            />
          </button>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="flex flex-wrap gap-2.5">
        <Link
          to="/vendor/products"
          className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all shadow-xs"
        >
          <PlusCircle className="h-4 w-4 text-emerald-500" /> Add Product
        </Link>
        <Link
          to="/vendor/orders"
          className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground hover:border-amber-500/40 hover:bg-amber-500/5 transition-all shadow-xs"
        >
          <ClipboardList className="h-4 w-4 text-amber-500" /> Manage Orders
        </Link>
        <Link
          to="/vendor/earnings"
          className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all shadow-xs"
        >
          <Wallet className="h-4 w-4 text-emerald-500" /> View Payouts
        </Link>
        <Link
          to="/vendor/location"
          className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground hover:border-blue-500/40 hover:bg-blue-500/5 transition-all shadow-xs"
        >
          <MapPin className="h-4 w-4 text-blue-500" /> Update Location
        </Link>
        <Link
          to="/vendor/settings"
          className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground hover:border-border/80 hover:bg-muted/50 transition-all shadow-xs"
        >
          <Settings className="h-4 w-4 text-muted-foreground" /> Store Settings
        </Link>
      </div>

      <LiveBroadcaster isRoaming={vendor?.roaming === true || vendor?.profile?.roaming === true} defaultIsOpen={vendor?.is_open === true} />

      {/* ⭐ VEGAMART COMMISSION & NET EARNINGS HERO BANNER ⭐ */}
      <section className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-card to-emerald-500/5 p-6 shadow-soft relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 text-xs font-black tracking-wide">
              <Percent className="h-3.5 w-3.5" /> VegaMart Commission System
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-black text-foreground">
              Earnings &amp; Commission Breakdown
            </h2>
            <p className="text-xs text-muted-foreground max-w-xl">
              Admin-assigned commission rate is applied directly to your sales. Your net take-home earnings are calculated in real-time.
            </p>
          </div>

          {/* Key Commission Metrics Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto">
            <div className="rounded-2xl border border-border/80 bg-card/90 backdrop-blur-xs p-4 text-center min-w-[140px]">
              <div className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider">
                Store Commission Rate
              </div>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                {commissionRate}%
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Set by Admin</div>
            </div>

            <div className="rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 backdrop-blur-xs p-4 text-center min-w-[140px]">
              <div className="text-[10.5px] font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider">
                Total Commission ({timeframeLabels.find((t) => t.key === activeTimeframe)?.label})
              </div>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                -₹{Number(currentTf.commission_amount || 0).toLocaleString("en-IN")}
              </div>
              <div className="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-0.5">VegaMart platform fee</div>
            </div>

            <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-500/15 backdrop-blur-xs p-4 text-center min-w-[160px] shadow-sm">
              <div className="text-[10.5px] font-bold text-emerald-800 dark:text-emerald-200 uppercase tracking-wider">
                Vendor Net Earning
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                ₹{Number(currentTf.net_earnings || 0).toLocaleString("en-IN")}
              </div>
              <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">Take-home payout</div>
            </div>
          </div>
        </div>
      </section>

      {/* TIMEFRAME SELECTOR FILTER TABS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-600" /> Store Performance Overview
          </h2>
          <p className="text-xs text-muted-foreground">
            Filter sales, visits, customers, and orders by timeframe
          </p>
        </div>

        {/* Timeframe Pills */}
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

      {/* 8 PERFORMANCE METRIC CARDS GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
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

      {/* INTERACTIVE REVENUE & ORDERS GRAPH SECTION */}
      <section className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
          <div>
            <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-emerald-600" /> Revenue &amp; Orders Trend
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Visual analytics for gross revenue, commission deducted, net earnings, and order volume.
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
                  <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
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
                <Area type="monotone" dataKey="revenue" name="Gross Sales" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorGross)" />
                <Area type="monotone" dataKey="net_earnings" name="Net Take-Home" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorNet)" />
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

      {/* LOWER SECTION: TOP PRODUCTS & RECENT ORDERS */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Top Products */}
          <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-base font-bold flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" /> Top Performing Products
              </h3>
              <Link to="/vendor/products" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                View All <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {topProducts.length > 0 ? (
              <div className="divide-y divide-border/60">
                {topProducts.map((tp: any, i: number) => (
                  <div key={tp.product_id} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary font-bold text-xs grid place-items-center">
                        #{i + 1}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground">{tp.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {tp.total_quantity} units sold · {tp.order_count} orders
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                        ₹{(Number(tp.price || 0) * Number(tp.total_quantity || 0)).toLocaleString("en-IN")}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        ₹{Number(tp.price || 0).toLocaleString("en-IN")} / unit
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-muted-foreground">
                No product sales yet.
              </div>
            )}
          </div>

          {/* Recent Orders */}
          <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-base font-bold flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-amber-500" /> Recent Orders
              </h3>
              <Link to="/vendor/orders" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                Manage Orders <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="space-y-2.5">
              {vendorOrders.length > 0 ? (
                vendorOrders.slice(0, 5).map((order: any) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between rounded-2xl border border-border bg-muted/20 p-3.5 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary font-bold text-xs">
                        #{order.order_number?.slice(-4) || order.id.slice(0, 4)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">
                          {order.customer_name || "Customer"}
                        </p>
                        <p className="text-[10.5px] text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-xs text-foreground">
                        ₹{Number(order.total).toLocaleString("en-IN")}
                      </p>
                      <span className="inline-block mt-0.5 text-[9.5px] uppercase font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-md">
                        {order.status.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No orders yet
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Cards: Membership & Product Limits */}
        <div className="space-y-6">
          <VendorMembershipCard vendor={vendor} />

          {/* Product & Order Quota Status */}
          <div className="rounded-3xl border border-border bg-card p-5 shadow-soft space-y-4">
            <h3 className="font-display text-sm font-bold flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" /> Store Limits &amp; Capacity
            </h3>

            {/* Product Limit */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Product Limit</span>
                <span className="font-bold">
                  {productList} / {isUnlimitedProducts ? "∞ Unlimited" : productLimit}
                </span>
              </div>
              {!isUnlimitedProducts && (
                <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${productList >= productLimit ? "bg-destructive" : "bg-primary"}`}
                    style={{ width: `${Math.min(100, (productList / productLimit) * 100)}%` }}
                  />
                </div>
              )}
            </div>

            {/* Daily Order Limit */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Today's Orders</span>
                <span className="font-bold">
                  {dailyOrders} / {isUnlimitedOrders ? "∞ Unlimited" : orderLimit}
                </span>
              </div>
              {!isUnlimitedOrders && (
                <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${dailyOrders >= orderLimit ? "bg-destructive" : "bg-amber-500"}`}
                    style={{ width: `${Math.min(100, (dailyOrders / orderLimit) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

