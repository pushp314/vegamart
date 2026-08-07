import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Loader2, TrendingUp, IndianRupee, ShoppingBag, Eye, Users } from "lucide-react";

export const Route = createFileRoute("/vendor/analytics")({
  component: VendorAnalytics,
});

function VendorAnalytics() {
  const { data: analyticsRes, isLoading } = useQuery({
    queryKey: ["vendorAnalytics"],
    queryFn: () => api.get<any>("/vendors/me/analytics"),
  });

  const data = analyticsRes?.data?.data || analyticsRes?.data;
  const dailyData = data?.dailyData || [];

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!data) {
    return <div className="p-6 text-center text-muted-foreground">No analytics data available. (Requires Premium Plan)</div>;
  }

  const statCards = [
    { label: "Total Revenue", value: `₹${(data.customerStats?.new_customers ? 0 : 0).toLocaleString("en-IN")}`, icon: IndianRupee, color: "text-emerald-500", bg: "bg-emerald-50" }, // Mocked aggregate, need actual total from data if exists
    { label: "Total Orders", value: data.storeViews?.total_orders || 0, icon: ShoppingBag, color: "text-blue-500", bg: "bg-blue-50" },
    { label: "Store Views", value: data.storeViews?.store_views || 0, icon: Eye, color: "text-purple-500", bg: "bg-purple-50" },
    { label: "New Customers", value: data.customerStats?.new_customers || 0, icon: Users, color: "text-amber-500", bg: "bg-amber-50" },
  ];
  
  // Calculate real total revenue from dailyData if not provided at top level
  const totalRev = dailyData.reduce((acc: number, cur: any) => acc + cur.revenue, 0);
  statCards[0].value = `₹${totalRev.toLocaleString("en-IN")}`;

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 py-8">
      <div>
        <h1 className="text-2xl font-black font-display text-foreground flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-emerald-500" /> Store Analytics
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Track your performance over the last 30 days.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat, idx) => (
          <div key={idx} className="rounded-3xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <p className="text-xl font-black font-display text-foreground mt-0.5">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-6">Revenue Trend (30 Days)</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="date" tickFormatter={(str) => { const d = new Date(str); return `${d.getDate()}/${d.getMonth()+1}`; }} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#6b7280" }} dy={10} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#6b7280" }} tickFormatter={(val) => `₹${val}`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, "Revenue"]}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-6">Order Volume (30 Days)</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="date" tickFormatter={(str) => { const d = new Date(str); return `${d.getDate()}/${d.getMonth()+1}`; }} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#6b7280" }} dy={10} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#6b7280" }} />
                <Tooltip 
                  cursor={{ fill: '#f3f4f6' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="orders" name="Orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {data.topProducts?.length > 0 && (
        <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="bg-muted/30 p-4 border-b border-border">
            <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Top Performing Products</h3>
          </div>
          <div className="divide-y divide-border/50">
            {data.topProducts.map((p: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center p-4 hover:bg-muted/10 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                    #{idx + 1}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-foreground">Product ID: {p.product_id?.slice(0,8)}...</p>
                    <p className="text-xs text-muted-foreground">{p.sales} sales • {p.views} views</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-emerald-600">₹{p.revenue.toLocaleString("en-IN")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
