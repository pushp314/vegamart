import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bike, MapPin, RefreshCw, CheckCircle2, Loader2, PackageX } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { GoogleDeliveryTracker } from "@/components/marketplace/google-delivery-tracker";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/orders/$orderId/track")({
  component: OrderIdTrackingPage,
});

function OrderIdTrackingPage() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();

  const {
    data: orderRes,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["orderDetail", orderId],
    queryFn: () => api.get<{ data: any }>(`/orders/${orderId}`),
    retry: 1,
  });

  const order = orderRes?.data?.data || orderRes?.data || null;

  const status = String(order?.status || "pending").toLowerCase();
  const isDelivered = status === "delivered";
  const isOutForDelivery = status === "out_for_delivery";
  const statusLabel =
    ({
      pending: "Placed",
      confirmed: "Confirmed",
      processing: "Processing",
      prepared: "Prepared",
      packed: "Packed",
      out_for_delivery: "Out for Delivery",
      delivered: "Delivered",
      cancelled: "Cancelled",
    }[status] || status);

  const steps = [
    { label: "Order Placed", desc: "Sent to vendor", done: !!order },
    { label: "Confirmed", desc: "Packed & ready", done: isDelivered || isOutForDelivery },
    {
      label: "Out for Delivery",
      desc: "Partner on the way",
      done: isDelivered || isOutForDelivery,
    },
    { label: "Delivered", desc: "Enjoy your fresh produce!", done: isDelivered },
  ];

  const items = order?.items || [];
  const itemsSubtotal = Number(order?.items_subtotal ?? 0);
  const deliveryFee = Number(order?.delivery_fee ?? 0);
  const tax = Number(order?.tax ?? order?.platform_fee ?? 0);
  const totalAmount = Number(order?.total_amount ?? order?.total ?? 0);

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <AppHeader title="Live Order Tracking" subtitle={`Order #${order?.order_number || orderId}`} />

      <main className="mx-auto max-w-4xl px-4 md:px-6 py-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !order ? (
          <div className="rounded-3xl border bg-card p-10 text-center space-y-4">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-muted text-muted-foreground">
              <PackageX className="h-8 w-8" />
            </div>
            <div>
              <h2 className="font-display font-black text-lg">
                {isError ? "Couldn't load this order" : "Order not found"}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                {isError
                  ? "Something went wrong while fetching your order. Please try again."
                  : "This order may have been removed or the link is incorrect."}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => refetch()}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary text-primary-foreground font-bold text-xs px-5 py-3 shadow-xs hover:bg-primary/90 transition-colors"
              >
                <RefreshCw className="h-4 w-4" /> Try Again
              </button>
              <button
                onClick={() => navigate({ to: "/orders" })}
                className="inline-flex items-center gap-2 rounded-2xl border bg-card font-bold text-xs px-5 py-3 hover:bg-muted transition-colors"
              >
                My Orders
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Status Banner */}
            <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/5 p-5 shadow-soft flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-500 text-white font-bold shadow-md">
                  <Bike className="h-6 w-6" />
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                </div>
                <div>
                  <h2 className="font-display font-black text-lg md:text-xl text-foreground">
                    {isDelivered
                      ? "Order Delivered! 🎉"
                      : isOutForDelivery
                        ? "Delivery Partner is on the way!"
                        : `Order ${statusLabel}`}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isDelivered
                      ? "Order handed over safely."
                      : isOutForDelivery
                        ? "Live tracking will appear once the rider connects."
                        : "We'll notify you as soon as your order is on its way."}
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  refetch();
                  toast.info("Refreshing tracking data…");
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-2xl border bg-card hover:bg-muted font-bold text-xs px-4 py-2.5 shadow-xs transition-colors shrink-0"
              >
                <RefreshCw className="h-3.5 w-3.5 text-emerald-600" /> Refresh
              </button>
            </div>

            {/* Delivery OTP Banner */}
            {!isDelivered && order.otp_code && (
              <div className="rounded-3xl border border-rose-500/30 bg-gradient-to-r from-rose-500/10 via-orange-500/10 to-rose-500/5 p-5 shadow-soft flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-display font-black text-sm text-rose-600">Secure Delivery OTP</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    Please share this 6-digit code with the delivery partner to receive your order.
                  </p>
                </div>
                <div className="bg-rose-500 text-white font-black text-3xl tracking-[0.25em] px-6 py-3 rounded-2xl shadow-inner border border-rose-600">
                  {order.otp_code}
                </div>
              </div>
            )}

            {/* Live Map Tracker */}
            <GoogleDeliveryTracker
              orderId={order.order_number || orderId}
              vendorName={order.vendor_name}
              status={status}
            />

            {/* Status Timeline */}
            <div className="rounded-3xl border bg-card p-6 shadow-soft space-y-4">
              <h3 className="font-display font-black text-base text-foreground">
                Order Status Timeline
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {steps.map((step, idx) => (
                  <div
                    key={step.label}
                    className={`rounded-2xl border p-3 text-center space-y-1 transition-all ${
                      step.done
                        ? "bg-emerald-50/80 border-emerald-300 text-emerald-950"
                        : "bg-muted/40 border-border text-muted-foreground"
                    }`}
                  >
                    <div
                      className={`mx-auto grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
                        step.done ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {step.done ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                    </div>
                    <div className="font-bold text-xs truncate">{step.label}</div>
                    <div className="text-[10px] opacity-80 truncate">{step.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Itemized Order Details & Receipt */}
            <div className="rounded-3xl border bg-card p-6 shadow-soft space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="font-display font-black text-base text-foreground">Order Details</h3>
                  <p className="text-xs text-muted-foreground">
                    Order #{order.order_number || orderId}
                  </p>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
                  {String(order.payment_method || "cod").toLowerCase() === "cod"
                    ? "Cash on Delivery"
                    : "Paid online"}
                </span>
              </div>

              {/* Delivery Address */}
              <div className="flex items-start gap-3 bg-muted/50 p-3.5 rounded-2xl text-xs">
                <MapPin className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <div className="font-bold text-foreground">Delivery Address</div>
                  <div className="text-muted-foreground mt-0.5">
                    {order.address?.full_address ||
                      [order.address?.address_line1, order.address?.landmark]
                        .filter(Boolean)
                        .join(", ")}
                    {order.address?.city ? `, ${order.address.city}` : ""}
                    {order.address?.pincode ? ` — ${order.address.pincode}` : ""}
                  </div>
                </div>
              </div>

              {/* Products List */}
              <div className="space-y-2 pt-2">
                <div className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                  Items Ordered
                </div>
                <div className="divide-y border rounded-2xl overflow-hidden bg-background">
                  {items.length > 0 ? (
                    items.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="grid h-6 w-6 place-items-center rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            {item.quantity}x
                          </span>
                          <span className="font-bold text-foreground">
                            {item.product_name || item.name}
                          </span>
                          <span className="text-muted-foreground text-[11px]">
                            ({item.unit || "unit"})
                          </span>
                        </div>
                        <span className="font-bold text-foreground tabular-nums">
                          ₹{((item.unit_price || item.price || 0) * (item.quantity || 1)).toFixed(2)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-center text-xs text-muted-foreground">
                      No item details available.
                    </div>
                  )}
                </div>
              </div>

              {/* Bill Summary */}
              <div className="pt-2 space-y-1.5 text-xs text-muted-foreground border-t">
                <div className="flex justify-between">
                  <span>Item Subtotal</span>
                  <span className="tabular-nums font-semibold">
                    ₹{(itemsSubtotal || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Fee</span>
                  <span className="text-emerald-600 font-bold">
                    {deliveryFee > 0 ? `₹${deliveryFee.toFixed(2)}` : "FREE"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Taxes & Platform Fee</span>
                  <span className="tabular-nums font-semibold">₹{(tax || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t text-sm font-extrabold text-foreground">
                  <span>Total Paid</span>
                  <span className="text-emerald-600 tabular-nums">
                    ₹{(totalAmount || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="flex justify-center">
          <Link
            to="/orders"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
          >
            ← Back to My Orders
          </Link>
        </div>
      </main>
    </div>
  );
}
