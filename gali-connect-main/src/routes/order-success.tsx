import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { CheckCircle2, Package, MapPin, Store, Bike } from "lucide-react";
import { OrderTracker } from "@/components/marketplace/order-tracker";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const Route = createFileRoute("/order-success")({
  head: () => ({ meta: [{ title: "Order placed — Vegamart" }] }),
  validateSearch: (search: Record<string, unknown>): { orderId?: string } => ({
    orderId: (search.orderId as string) || undefined,
  }),
  component: OrderSuccess,
});

function OrderSuccess() {
  const { orderId } = useSearch({ from: "/order-success" });

  const { data: orderRes } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => api.get<{ data: any }>(`/orders/${orderId}`),
    enabled: !!orderId,
  });

  const order = orderRes?.data?.data || orderRes?.data;

  const orderNumber = order?.order_number || orderId || "—";
  const vendorName =
    order?.vendor?.business_name || order?.vendor?.profile?.owner_name || "Your Vendor";
  const deliveryAddress = order?.address
    ? `${order.address.line1}${order.address.landmark ? `, ${order.address.landmark}` : ""}, ${order.address.city}`
    : "Your delivery address";
  const orderStatus = String(order?.status || "preparing").toLowerCase();

  return (
    <div className="min-h-screen bg-background grid place-items-center px-4 py-10">
      <div className="w-full max-w-lg text-center space-y-6">
        <div className="relative mx-auto grid h-20 w-20 place-items-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-emerald-200/60" />
          <div className="relative grid h-20 w-20 place-items-center rounded-full bg-primary text-primary-foreground shadow-glow">
            <CheckCircle2 className="h-10 w-10" />
          </div>
        </div>

        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold leading-tight">
            Order Placed Successfully!
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground">
            Thank you! Your vendor has confirmed the order and is packing it fresh.
          </p>
        </div>



        {/* Live Order Tracker */}
        <OrderTracker status={orderStatus} />

        <div className="rounded-3xl bg-card border shadow-soft overflow-hidden text-left divide-y text-xs">
          <div className="flex items-center justify-between p-3.5">
            <span className="text-muted-foreground font-semibold">Order Number</span>
            <span className="font-bold tabular-nums text-foreground">#{orderNumber}</span>
          </div>
          <div className="flex items-center justify-between p-3.5">
            <span className="text-muted-foreground font-semibold">Vendor</span>
            <span className="font-bold text-foreground flex items-center gap-1">
              <Store className="h-3.5 w-3.5 text-primary" /> {vendorName}
            </span>
          </div>
          <div className="flex items-center gap-2 p-3.5 bg-emerald-50/60">
            <MapPin className="h-4 w-4 text-primary shrink-0" />
            <span className="text-foreground font-semibold">{deliveryAddress}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row pt-2">
          <Link
            to="/orders/$orderId/track"
            params={{ orderId: orderId || "" }}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-white font-extrabold text-xs h-12 shadow-md hover:bg-emerald-700 transition-colors"
          >
            <Bike className="h-4 w-4" /> Track Order Live 🛵
          </Link>
          <Link
            to="/orders"
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground font-semibold text-xs h-12 shadow-xs hover:bg-primary/90"
          >
            <Package className="h-4 w-4" /> View All Orders
          </Link>
        </div>
      </div>
    </div>
  );
}
