import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { CheckCircle2, Package, MapPin, Store, Bike, Calendar, User, Banknote } from "lucide-react";
import { OrderTracker } from "@/components/marketplace/order-tracker";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getDeliveryOptionInfo, getPaymentMethodInfo } from "@/lib/order-helpers";

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
  const deliveryAddress = order?.address?.full_address
    ? `${order.address.full_address}${order.address.landmark ? `, ${order.address.landmark}` : ""}`
    : "Your delivery address";
  const orderStatus = String(order?.status || "pending").toLowerCase();

  const dInfo = getDeliveryOptionInfo(order?.delivery_note || order?.delivery_option || order?.delivery_slot);
  const pInfo = getPaymentMethodInfo(
    order?.payment_method,
    order?.payment_status,
    Number(order?.total_amount || order?.total || 0),
    dInfo.id === "self_pickup",
    order?.payment?.amount != null ? Number(order.payment.amount) : null
  );
  const DIcon = dInfo.icon;
  const PIcon = pInfo.icon;

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
            Order Confirmed Successfully!
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground">
            Thank you! Your order has been placed and sent to the merchant.
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
            <span className="text-muted-foreground font-semibold">Delivery Option</span>
            <span className={`inline-flex items-center gap-1.5 font-bold px-2.5 py-0.5 rounded-full border ${dInfo.colorClass}`}>
              <DIcon className="h-3.5 w-3.5" /> {dInfo.label}
            </span>
          </div>
          <div className="flex items-center justify-between p-3.5">
            <span className="text-muted-foreground font-semibold">Vendor</span>
            <span className="font-bold text-foreground flex items-center gap-1">
              <Store className="h-3.5 w-3.5 text-primary" /> {vendorName}
            </span>
          </div>
          {dInfo.id === "self_pickup" ? (
            <div className="p-3.5 bg-purple-50/60 dark:bg-purple-950/30 space-y-1">
              <div className="flex items-center gap-1.5 text-purple-900 dark:text-purple-300 font-bold">
                <Store className="h-4 w-4 shrink-0 text-purple-700" /> Store Counter Pickup Location
              </div>
              <p className="text-muted-foreground text-[11px]">
                {order?.vendor?.address || "Pick up directly at the merchant's store counter upon ready notification."}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3.5 bg-emerald-50/60 dark:bg-emerald-950/30">
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              <span className="text-foreground font-semibold">{deliveryAddress}</span>
            </div>
          )}

          {/* Payment Breakdown Card */}
          <div className="p-3.5 space-y-2 bg-muted/20">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-semibold">Payment Status</span>
              <span className={`inline-flex items-center gap-1 font-bold px-2.5 py-0.5 rounded-full border ${pInfo.colorClass}`}>
                <PIcon className="h-3.5 w-3.5" /> {pInfo.label}
              </span>
            </div>
            {pInfo.isPartialAdvance ? (
              <div className="space-y-1.5 pt-1 border-t">
                <div className="flex justify-between text-emerald-700 dark:text-emerald-300 font-bold">
                  <span>✓ Advance Paid Online:</span>
                  <span className="tabular-nums font-black">₹{pInfo.advancePaid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-amber-800 dark:text-amber-300 font-black bg-amber-50 dark:bg-amber-950/40 p-2 rounded-xl border border-amber-200 dark:border-amber-900/50">
                  <span className="flex items-center gap-1">
                    <Banknote className="h-3.5 w-3.5 text-amber-700" /> Balance to Pay at Store:
                  </span>
                  <span className="tabular-nums font-black">₹{pInfo.balanceAmount.toFixed(2)}</span>
                </div>
                <div className="text-[11px] text-center font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/60 py-1 px-2 rounded-lg border border-emerald-200">
                  {pInfo.summaryText}
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center pt-1 border-t font-bold">
                <span>{pInfo.method === "COD" ? "Total Payable on Delivery:" : "Total Paid Online:"}</span>
                <span className="tabular-nums text-emerald-600 font-black text-sm">
                  ₹{Number(order?.total_amount || order?.total || 0).toFixed(2)}
                </span>
              </div>
            )}
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
