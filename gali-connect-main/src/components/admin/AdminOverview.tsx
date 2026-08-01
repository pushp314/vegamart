import { Users, Store, IndianRupee, ShoppingBag, ArrowUpRight } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface AdminOverviewProps {
  stats: any;
}



export function AdminOverview({ stats }: AdminOverviewProps) {
  const cards = [
    {
      title: "Total Revenue",
      value: `₹${stats.total_revenue?.toLocaleString() || "0"}`,
      icon: IndianRupee,
      trend: "+12.5%",
      color: "emerald"
    },
    {
      title: "Active Users",
      value: stats.total_users?.toLocaleString() || "0",
      icon: Users,
      trend: "+5.2%",
      color: "blue"
    },
    {
      title: "Registered Vendors",
      value: stats.total_vendors?.toLocaleString() || "0",
      icon: Store,
      trend: "+2.1%",
      color: "amber"
    },
    {
      title: "Total Orders",
      value: stats.total_orders?.toLocaleString() || "0",
      icon: ShoppingBag,
      trend: "+18.3%",
      color: "purple"
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 text-white">
      <div>
        <h2 className="font-display text-3xl font-bold tracking-tight">Dashboard Overview</h2>
        <p className="text-zinc-400 text-sm mt-1">Monitor your marketplace performance and growth in real-time.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="group relative rounded-3xl bg-zinc-900/50 p-6 shadow-2xl border border-zinc-800 hover:border-zinc-700 transition-colors overflow-hidden">
              <div className={`absolute top-0 right-0 w-32 h-32 bg-${c.color}-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:scale-150 duration-500`} />
              
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <p className="text-sm font-bold text-zinc-500 uppercase tracking-wider">{c.title}</p>
                  <h3 className="font-display text-4xl font-black mt-2 text-zinc-100">{c.value}</h3>
                </div>
                <div className={`p-3 rounded-2xl bg-zinc-950 border border-zinc-800 text-${c.color}-500 shadow-inner`}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-6 flex items-center gap-2 relative z-10">
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                  <ArrowUpRight className="h-3 w-3" /> {c.trend}
                </span>
                <span className="text-xs text-zinc-500 font-medium">vs last week</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Revenue Chart */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-2xl">
          <h3 className="font-display text-lg font-bold mb-6 text-zinc-100">Revenue Trend</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.revenue_chart || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a1a1aa' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a1a1aa' }} dx={-10} tickFormatter={(val) => `₹${val/1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', borderRadius: '16px', border: '1px solid #27272a', color: '#fff', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)' }}
                  itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                  formatter={(value: number) => [`₹${value}`, 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* User Growth Chart */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-2xl">
          <h3 className="font-display text-lg font-bold mb-6 text-zinc-100">User Acquisition</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.user_chart || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a1a1aa' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a1a1aa' }} dx={-10} />
                <Tooltip 
                  cursor={{ fill: '#27272a' }}
                  contentStyle={{ backgroundColor: '#18181b', borderRadius: '16px', border: '1px solid #27272a', color: '#fff', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)' }}
                  itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
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
