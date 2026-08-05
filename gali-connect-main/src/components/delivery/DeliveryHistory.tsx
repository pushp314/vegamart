import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Bike, Clock, Wallet, Star } from "lucide-react";
import { format } from "date-fns";

interface DeliveryHistory {
  id: string;
  order_number: string;
  status: string;
  total: number;
  delivery_fee: number;
  vendor_name: string;
  updated_at: string;
}

export function DeliveryHistory() {
  const { data: statsRes, isLoading } = useQuery({
    queryKey: ["deliveryStats"],
    queryFn: () => api.get<any>("/delivery/me/stats"),
  });

  const stats = statsRes?.data?.data ?? statsRes?.data ?? {};

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const recentDeliveries: DeliveryHistory[] = stats.recent_deliveries ?? [];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Delivery History</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total</CardTitle>
            <Bike className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.stats?.total_deliveries ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Today</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.stats?.today_deliveries ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Earnings
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{stats.stats?.total_earnings ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Rating</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.partner?.rating ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats.partner?.review_count ?? 0} reviews
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {recentDeliveries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bike className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No delivery history yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {recentDeliveries.map((delivery) => (
                <div key={delivery.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Order #{delivery.order_number}</p>
                    <p className="text-xs text-muted-foreground">{delivery.vendor_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-emerald-600">+₹{delivery.delivery_fee}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(delivery.updated_at), "MMM d, HH:mm")}
                    </p>
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
