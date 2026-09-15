import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Bike, Clock, Wallet, Star, CheckCircle2, AlertCircle, MapPin, Store } from "lucide-react";
import { format } from "date-fns";

interface DeliveryHistoryItem {
  id: string;
  order_number: string;
  status: string;
  total: number;
  delivery_fee: number;
  vendor_name: string;
  customer_name?: string;
  customer_address?: string;
  updated_at: string;
}

const renderStatusBadge = (status: string) => {
  const s = (status || "").toLowerCase();
  if (s === "delivered" || s === "completed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="h-3 w-3" /> Delivered
      </span>
    );
  }
  if (s === "cancelled" || s === "failed" || s === "returned") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
        <AlertCircle className="h-3 w-3" /> {s}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
      <Clock className="h-3 w-3" /> {s.replace(/_/g, " ")}
    </span>
  );
};

export function DeliveryHistory() {
  const { data: statsRes, isLoading } = useQuery({
    queryKey: ["deliveryStats"],
    queryFn: () => api.get<any>("/delivery/me/stats"),
  });

  const stats = statsRes?.data?.data ?? statsRes?.data ?? {};

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  const recentDeliveries: DeliveryHistoryItem[] = stats.recent_deliveries ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display">Delivery History & Reports</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track all completed, assigned and past order deliveries
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Orders</CardTitle>
            <Bike className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-display">{stats.stats?.total_deliveries ?? 0}</div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Today Delivered</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-display text-blue-600">{stats.stats?.today_deliveries ?? 0}</div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Earnings</CardTitle>
            <Wallet className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-display text-emerald-600">₹{stats.stats?.total_earnings ?? 0}</div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rider Rating</CardTitle>
            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-display text-amber-600">{stats.partner?.rating ?? 5.0}</div>
            <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">
              {stats.partner?.review_count ?? 0} reviews
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border shadow-md rounded-2xl overflow-hidden">
        <CardHeader className="border-b bg-muted/30 px-5 py-4">
          <CardTitle className="text-base font-bold flex items-center justify-between">
            <span>Recent Completed Deliveries</span>
            <span className="text-xs font-semibold text-muted-foreground">Showing last {recentDeliveries.length} orders</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentDeliveries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground space-y-2">
              <Bike className="h-10 w-10 mx-auto opacity-40 text-emerald-600" />
              <p className="text-sm font-semibold">No delivery history yet</p>
              <p className="text-xs">Active and completed delivery orders will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {recentDeliveries.map((delivery) => (
                <div key={delivery.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-foreground">Order #{delivery.order_number}</span>
                      {renderStatusBadge(delivery.status)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1 font-semibold text-foreground">
                        <Store className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        {delivery.vendor_name}
                      </span>
                      {delivery.customer_name && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                          {delivery.customer_name} {delivery.customer_address ? `(${delivery.customer_address})` : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0">
                    <div className="text-sm font-black text-emerald-600 tabular-nums">
                      +₹{Number(delivery.delivery_fee || 0).toFixed(2)}
                      <span className="text-[10px] text-muted-foreground font-normal ml-1">(Earned)</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground font-medium">
                      {format(new Date(delivery.updated_at), "MMM d, yyyy • HH:mm")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
