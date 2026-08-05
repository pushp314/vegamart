import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  Bike,
  MapPin,
  ArrowLeft,
  CheckCircle2,
  ShoppingBag,
  RefreshCw,
  PackageX,
  Loader2,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { GoogleDeliveryTracker } from "@/components/marketplace/google-delivery-tracker";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/orders/track")({
  head: () => ({ meta: [{ title: "Live Order Tracking — Vegamart" }] }),
  validateSearch: (search: Record<string, unknown>): { orderId?: string } => ({
    orderId: typeof search.orderId === "string" ? search.orderId : undefined,
  }),
  component: OrderTrackingPage,
});

function OrderTrackingPage() {
  const navigate = useNavigate();
  const { orderId } = useSearch({ from: "/orders/track" });

  // Fetch active customer orders
  const {
    data: res,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["activeOrders"],
    queryFn: () => api.get<any[]>("/orders"),
  });

  const orders = res?.data || [];

  const rawActive = orders.find(
    (o) =>
      (orderId && String(o.id) === String(orderId)) ||
      (orderId && String(o.order_number) === String(orderId)),
  ) || orders[0];

  const activeOrder = rawActive
    ? {
        id: rawActive.id,
        order_number: rawActive.order_number || rawActive.invoice_number || rawActive.id,
        status: String(rawActive.status || "pending").toLowerCase(),
        total_amount: Number(rawActive.total ?? rawActive.total_amount ?? 0),
        items: rawActive.items || [],
        address: rawActive.address || {},
        vendor_name: rawActive.vendor?.business_name || "",
        payment_method: rawActive.payment_method || rawActive.payment?.method || "cod",
        items_subtotal: Number(rawActive.items_subtotal ?? 0),
        delivery_fee: Number(rawActive.delivery_fee ?? 0),
        tax: Number(rawActive.tax ?? 0),
        discount: Number(rawActive.discount ?? 0),
        created_at: rawActive.created_at,
      }
    : null;

  const isDelivered = activeOrder?.status === "delivered";
  const isOutForDelivery = activeOrder?.status === "out_for_delivery";
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
    }[activeOrder?.status || ""] || activeOrder?.status || "Placed");

  const steps = [
    { label: "Order Placed", desc: "Sent to vendor", done: !!activeOrder },
    { label: "Confirmed", desc: "Packed & ready", done: isDelivered || isOutForDelivery },
    {
      label: "Out for Delivery",
      desc: "Partner on the way",
      done: isDelivered || isOutForDelivery,
    },
    { label: "Delivered", desc: "Enjoy your fresh produce!", done: isDelivered },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground pb-24">
        <AppHeader title="Live Order Tracking" subtitle="Tracking" />
        <main className="mx-auto max-w-4xl px-4 md:px-6 py-6">
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </main>
      </div>
    );
  }

  if (!activeOrder) {
    return (
      <div className="min-h-screen bg-background text-foreground pb-24">
        <AppHeader title="Live Order Tracking" subtitle="Tracking" />
        <main className="mx-auto max-w-4xl px-4 md:px-6 py-6 space-y-6">
          <div className="rounded-3xl border bg-card p-10 text-center space-y-4">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-muted text-muted-foreground">
              <PackageX className="h-8 w-8" />
            </div>
            <div>
              <h2 className="font-display font-black text-lg">No order to track</h2>
              <p className="text-xs text-muted-foreground mt-1">
                We couldn't find an active order for this tracking link. Place an order to see live
                delivery updates here.
              </p>
            </div>
            <button
              onClick={() => navigate({ to: "/vendors" })}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary text-primary-foreground font-bold text-xs px-5 py-3 shadow-xs hover:bg-primary/90 transition-colors"
            >
              <ShoppingBag className="h-4 w-4" /> Browse Vendors
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <AppHeader
        title="Live Order Tracking"
        subtitle={`Order #${activeOrder.order_number || activeOrder.id}`}
      />

      <main className="mx-auto max-w-4xl px-4 md:px-6 py-6 space-y-6">
          <> 
            {/* Live Delivery Status Banner */}
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
                      ? "Your order has been handed over safely."
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

            {/* Live Map Tracker */}
            <GoogleDeliveryTracker
              orderId={activeOrder.order_number || activeOrder.id}
              vendorName={activeOrder.vendor_name}
              status={activeOrder.status}
            />

            {/* Order Status Stepper Timeline */}
            <div className="rounded-3xl border bg-card p-6 shadow-soft space-y-4">
              <h3 className="font-display font-black text-base text-foreground">
                Order Status Timeline
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 relative">
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
                    Order #{activeOrder.order_number || activeOrder.id}
                  </p>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
                  {activeOrder.payment_method === "cod"
                    ? "Cash on Delivery"
                    : `Paid via ${activeOrder.payment_method === "upi" ? "UPI" : "Card / UPI"}`}
                </span>
              </div>

              {/* Delivery Address */}
              <div className="flex items-start gap-3 bg-muted/50 p-3.5 rounded-2xl text-xs">
                <MapPin className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <div className="font-bold text-foreground">
                    Delivery Address {activeOrder.address?.label ? `(${activeOrder.address.label})` : ""}
                  </div>
                  <div className="text-muted-foreground mt-0.5">
                    {activeOrder.address?.full_address ||
                      [activeOrder.address?.address_line1, activeOrder.address?.landmark]
                        .filter(Boolean)
                        .join(", ")}
                    {activeOrder.address?.city ? `, ${activeOrder.address.city}` : ""}
                    {activeOrder.address?.pincode ? ` — ${activeOrder.address.pincode}` : ""}
                  </div>
                </div>
              </div>

              {/* Products List */}
              <div className="space-y-2 pt-2">
                <div className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                  Items Ordered
                </div>
                <div className="divide-y border rounded-2xl overflow-hidden bg-background">
                  {(activeOrder.items || []).map((item: any, idx: number) => (
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
                  ))}
                </div>
              </div>

              {/* Bill Summary */}
              <div className="pt-2 space-y-1.5 text-xs text-muted-foreground border-t">
                <div className="flex justify-between">
                  <span>Item Subtotal</span>
                  <span className="tabular-nums font-semibold">
                    ₹{(activeOrder.items_subtotal || 0).toFixed(2)}
                  </span>
                </div>
                {activeOrder.discount > 0 && (
                  <div className="flex justify-between">
                    <span>Discount</span>
                    <span className="text-emerald-600 font-bold">
                      −₹{activeOrder.discount.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Delivery Fee</span>
                  <span className="text-emerald-600 font-bold">
                    {activeOrder.delivery_fee > 0
                      ? `₹${activeOrder.delivery_fee.toFixed(2)}`
                      : "FREE"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Taxes & Platform Fee</span>
                  <span className="tabular-nums font-semibold">
                    ₹{(activeOrder.tax || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t text-sm font-extrabold text-foreground">
                  <span>Total Paid</span>
                  <span className="text-emerald-600 tabular-nums">
                    ₹{(activeOrder.total_amount || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </>

        <div className="flex justify-center">
          <Link
            to="/orders"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to My Orders
          </Link>
        </div>
      </main>
    </div>
  );
}
