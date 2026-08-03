import { Users, Store, IndianRupee, ShoppingBag, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface AdminOverviewProps {
  stats: any;
}

const TOOLTIP_STYLE = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  border: '1px solid #e4e4e7',
  color: '#18181b',
  boxShadow: '0 8px 24px -8px rgb(0 0 0 / 0.12)',
  padding: '10px 14px',
};

export function AdminOverview({ stats }: AdminOverviewProps) {
  const cards = [
    {
      title: "Total Revenue",
      value: `₹${stats.total_revenue?.toLocaleString() || "0"}`,
      icon: IndianRupee,
      trend: "+12.5%",
      up: true,
      accent: "bg-emerald-50 text-emerald-600 ring-emerald-100",
      glow: "bg-emerald-400/10",
    },
    {
      title: "Active Users",
      value: stats.total_users?.toLocaleString() || "0",
      icon: Users,
      trend: "+5.2%",
      up: true,
      accent: "bg-blue-50 text-blue-600 ring-blue-100",
      glow: "bg-blue-400/10",
    },
    {
      title: "Registered Vendors",
      value: stats.total_vendors?.toLocaleString() || "0",
      icon: Store,
      trend: "+2.1%",
      up: true,
      accent: "bg-amber-50 text-amber-600 ring-amber-100",
      glow: "bg-amber-400/10",
    },
    {
      title: "Total Orders",
      value: stats.total_orders?.toLocaleString() || "0",
      icon: ShoppingBag,
      trend: "+18.3%",
      up: true,
      accent: "bg-violet-50 text-violet-600 ring-violet-100",
      glow: "bg-violet-400/10",
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">Dashboard Overview</h2>
          <p className="text-muted-foreground text-sm mt-1">Monitor your marketplace performance and growth in real-time.</p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Live
        </span>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="group relative rounded-3xl bg-card p-6 shadow-soft border border-border hover:shadow-glow transition-shadow overflow-hidden">
              <div className={`absolute top-0 right-0 w-32 h-32 ${c.glow} rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:scale-150 duration-500`} />

              <div className="flex items-start justify-between relative z-10">
                <div>
                  <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{c.title}</p>
                  <h3 className="font-display text-4xl font-black mt-2 text-foreground">{c.value}</h3>
                </div>
                <div className={`p-3 rounded-2xl ring-1 ${c.accent} shadow-sm`}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-6 flex items-center gap-2 relative z-10">
                <span className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${c.up ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                  {c.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />} {c.trend}
                </span>
                <span className="text-xs text-muted-foreground font-medium">vs last week</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Revenue Chart */}
        <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
          <h3 className="font-display text-lg font-bold mb-6 text-foreground">Revenue Trend</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.revenue_chart || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} dx={-10} tickFormatter={(val) => `₹${val/1000}k`} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={{ color: '#059669', fontWeight: 'bold' }}
                  labelStyle={{ color: '#18181b', fontWeight: 600 }}
                  formatter={(value: number) => [`₹${value}`, 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* User Growth Chart */}
        <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
          <h3 className="font-display text-lg font-bold mb-6 text-foreground">User Acquisition</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.user_chart || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} dx={-10} />
                <Tooltip
                  cursor={{ fill: '#f4f4f5' }}
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={{ color: '#2563eb', fontWeight: 'bold' }}
                  labelStyle={{ color: '#18181b', fontWeight: 600 }}
                />
                <Bar dataKey="users" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
