import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Bike,
  MapPin,
  RefreshCw,
  CheckCircle2,
  Loader2,
  PackageX,
  User,
  ArrowRight,
  ShoppingBag,
  AlertCircle,
  Phone,
  Store,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";

export const Route = createFileRoute("/orders/$orderId/track")({
  component: OrderIdTrackingPage,
});

function OrderIdTrackingPage() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/orders/${orderId}/cancel`, { reason: cancelReason }),
    onSuccess: () => {
      toast.success("Order cancelled successfully");
      setCancelModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to cancel order");
    },
  });
  const { user, isAuthenticated, isGuest, role, isLoading: authLoading } = useAuth();

  const {
    data: orderRes,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["orderDetail", orderId],
    queryFn: () => api.get<{ data: any }>(`/orders/${orderId}`),
    retry: 1,
    enabled: !!user && !isGuest && role === "customer",
  });

  const order = orderRes?.data?.data || orderRes?.data || null;

  const status = String(order?.status || "pending").toLowerCase();
  const isDelivered = status === "delivered";
  const isOutForDelivery = status === "out_for_delivery";
  const statusLabel =
    {
      pending: "Placed",
      confirmed: "Confirmed",
      processing: "Processing",
      prepared: "Prepared",
      packed: "Packed",
      out_for_delivery: "Out for Delivery",
      delivered: "Delivered",
      cancelled: "Cancelled",
    }[status] || status;

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
  const discount = Number(order?.discount ?? 0);
  const totalAmount = Number(order?.total_amount ?? order?.total ?? 0);

  if (!authLoading && (!isAuthenticated || isGuest || role !== "customer")) {
    return (
      <div className="min-h-screen bg-background text-foreground pb-24">
        <AppHeader title="Live Order Tracking" subtitle="Login Required" />
        <main className="flex-1 max-w-md w-full mx-auto px-6 py-16 text-center flex flex-col justify-center items-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-soft">
            <User className="h-10 w-10" />
          </div>
          <h2 className="mt-6 font-display text-2xl font-bold">Login Required</h2>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed max-w-xs">
            Please log in to your customer account to track this order.
          </p>
          <div className="mt-6 w-full space-y-3">
            <Link
              to="/login"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground font-bold text-sm h-12 shadow-md hover:bg-primary/90"
            >
              Log In to Continue <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <AppHeader
        title="Live Order Tracking"
        subtitle={`Order #${order?.order_number || orderId}`}
      />

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
              <div className="rounded-3xl border border-rose-500/30 bg-gradient-to-r from-rose-500/10 via-orange-500/10 to-rose-500/5 p-5 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-display font-black text-sm text-rose-600">
                    Secure Delivery OTP
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed">
                    This is your delivery OTP. Show it to the delivery partner when they arrive —
                    they need this 6-digit code to complete the delivery, so don't share it before
                    you receive your order.
                  </p>
                </div>
                <div className="bg-rose-500 text-white font-black text-3xl tracking-[0.25em] px-6 py-3 rounded-2xl shadow-inner border border-rose-600">
                  {order.otp_code}
                </div>
              </div>
            )}

            {/* Live Tracking Map Placeholder */}
            {isOutForDelivery && (
              <div className="rounded-3xl border bg-card overflow-hidden shadow-soft">
                <div className="p-4 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <span className="text-sm font-bold text-emerald-900">
                      Live GPS Tracking Active
                    </span>
                  </div>
                  <span className="text-xs font-bold text-emerald-700">~ 5 mins away</span>
                </div>
                <div className="relative h-64 bg-muted w-full flex items-center justify-center overflow-hidden">
                  <div
                    className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage: "radial-gradient(#94a3b8 1px, transparent 1px)",
                      backgroundSize: "20px 20px",
                    }}
                  ></div>

                  <div className="relative z-10 flex flex-col items-center gap-4">
                    <div className="flex items-center justify-between w-48 relative">
                      <div className="flex flex-col items-center z-10">
                        <div className="h-10 w-10 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg shadow-emerald-500/40 animate-bounce">
                          🛒
                        </div>
                      </div>

                      <div className="absolute top-5 left-8 right-8 h-1 bg-emerald-500/30 overflow-hidden rounded-full">
                        <div className="h-full bg-emerald-500 w-1/2 rounded-full animate-pulse" />
                      </div>

                      <div className="flex flex-col items-center z-10">
                        <div className="h-10 w-10 bg-card border-2 border-primary rounded-full flex items-center justify-center text-primary shadow-lg">
                          <MapPin className="h-5 w-5" />
                        </div>
                      </div>
                    </div>
                    <div className="bg-card/90 backdrop-blur-sm border px-4 py-2 rounded-full text-xs font-bold shadow-sm">
                      Connecting to vendor's live radar...
                    </div>
                  </div>
                </div>
              </div>
            )}

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
                  <h3 className="font-display font-black text-base text-foreground">
                    Order Details
                  </h3>
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

              {/* Customer & Contact Details */}
              {order.customer && (
                <div className="flex items-center justify-between bg-muted/50 p-3.5 rounded-2xl text-xs">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-blue-100 text-blue-800 grid place-items-center shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-bold text-foreground">
                        {order.customer.name || "Customer"}
                      </div>
                      {order.customer.phone ? (
                        <p className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3" />
                          {order.customer.phone}
                        </p>
                      ) : order.customer.email ? (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{order.customer.email}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}

              {/* Vendor & Store Details */}
              {order.vendor && (
                <div className="flex items-center justify-between bg-muted/50 p-3.5 rounded-2xl text-xs">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-800 grid place-items-center shrink-0">
                      <Store className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-bold text-foreground">
                        {order.vendor.business_name || "Merchant Store"}
                      </div>
                      {order.vendor.phone && (
                        <a
                          href={`tel:${order.vendor.phone}`}
                          className="text-[11px] font-semibold text-emerald-700 hover:underline flex items-center gap-1 mt-0.5"
                        >
                          <Phone className="h-3 w-3" />
                          {order.vendor.phone}
                        </a>
                      )}
                    </div>
                  </div>
                  {order.vendor.phone && (
                    <a
                      href={`tel:${order.vendor.phone}`}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-sm hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
                    >
                      <Phone className="h-3.5 w-3.5" /> Call Store
                    </a>
                  )}
                </div>
              )}

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
                  </div>
                </div>
              </div>

              {/* Products List */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                    Items Ordered ({items.length})
                  </span>
                  {items.some((i: any) => i.status === "rejected") && (
                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                      Contains Rejected Items
                    </span>
                  )}
                </div>

                {items.some((i: any) => i.status === "rejected") && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-3.5 space-y-1">
                    <div className="flex items-center gap-2 font-bold text-rose-800 text-xs">
                      <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                      <span>
                        Order Updated: {items.filter((i: any) => i.status === "rejected").length}{" "}
                        {items.filter((i: any) => i.status === "rejected").length === 1
                          ? "item was"
                          : "items were"}{" "}
                        unavailable & rejected by vendor
                      </span>
                    </div>
                    <p className="text-[11px] text-rose-700 leading-snug pl-6">
                      The vendor could not fulfill the highlighted items. Your bill has been updated
                      automatically.
                      {Number(order.payment?.refund_amount ?? 0) > 0 ||
                      order.payment_status === "PARTIALLY_REFUNDED"
                        ? ` A refund of ₹${Number(order.payment?.refund_amount ?? 0).toFixed(2)} has been initiated.`
                        : String(order.payment_method || "cod").toLowerCase() === "cod"
                          ? ` Please pay the updated total of ₹${(totalAmount || 0).toFixed(2)} on delivery.`
                          : ""}
                    </p>
                  </div>
                )}

                <div className="divide-y border rounded-2xl overflow-hidden bg-background">
                  {items.length > 0 ? (
                    items.map((item: any, idx: number) => {
                      const isRejected = item.status === "rejected";
                      const itemImg = item.image_url || item.product?.images?.[0]?.url;
                      return (
                        <div
                          key={idx}
                          className={`flex items-center justify-between p-3 text-xs gap-3 ${
                            isRejected ? "bg-rose-50/30 opacity-75" : ""
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-11 w-11 rounded-xl bg-muted border border-border overflow-hidden shrink-0 grid place-items-center">
                              {itemImg ? (
                                <img
                                  src={itemImg}
                                  alt={item.product_name || item.name}
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLElement).style.display = "none";
                                  }}
                                />
                              ) : (
                                <ShoppingBag className="h-5 w-5 text-muted-foreground/50" />
                              )}
                            </div>

                            <div className="min-w-0 flex flex-col">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`font-bold ${
                                    isRejected
                                      ? "line-through text-muted-foreground"
                                      : "text-foreground"
                                  }`}
                                >
                                  {item.quantity}x {item.product_name || item.name}
                                </span>
                                {item.unit && (
                                  <span className="text-muted-foreground text-[11px]">
                                    ({item.unit})
                                  </span>
                                )}
                              </div>
                              {isRejected ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 mt-0.5">
                                  <AlertCircle className="h-3 w-3" /> Rejected & removed from bill
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">
                                  ₹{Number(item.unit_price || item.price || 0).toFixed(2)} each
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span
                              className={`font-bold tabular-nums text-sm ${
                                isRejected
                                  ? "line-through text-muted-foreground"
                                  : "text-foreground"
                              }`}
                            >
                              ₹
                              {(
                                (item.unit_price || item.price || 0) *
                                (item.quantity || 1)
                              ).toFixed(2)}
                            </span>
                            {isRejected && (
                              <div className="text-[10px] font-bold text-rose-600 uppercase">
                                Rejected
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
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
                  <span>Accepted Items Subtotal</span>
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
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Discount</span>
                    <span className="tabular-nums">- ₹{discount.toFixed(2)}</span>
                  </div>
                )}
                {Number(order.payment?.refund_amount ?? 0) > 0 && (
                  <div className="flex justify-between text-rose-600 font-medium bg-rose-50/60 px-2 py-1 rounded-lg">
                    <span>Refunded for Rejected Item(s)</span>
                    <span className="tabular-nums font-bold">
                      - ₹{Number(order.payment?.refund_amount ?? 0).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t text-sm font-extrabold text-foreground">
                  <span>
                    {String(order.payment_method || "cod").toLowerCase() === "cod"
                      ? "Amount to Pay on Delivery"
                      : "Total Paid"}
                  </span>
                  <span className="text-emerald-600 tabular-nums">
                    ₹{(totalAmount || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Cancel Order Section */}
        {order && !isDelivered && (statusLabel === "PENDING" || statusLabel === "CONFIRMED") && (
          <div className="rounded-3xl border bg-card p-6 shadow-soft text-center space-y-3 max-w-6xl mx-auto mt-6">
            <h3 className="font-display font-black text-sm text-foreground">
              Need to cancel your order?
            </h3>
            <p className="text-xs text-muted-foreground mx-auto max-w-sm">
              Orders can only be cancelled before they are prepared. If you've already paid online,
              a refund will be initiated automatically.
            </p>
            <button
              onClick={() => setCancelModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-rose-200 bg-rose-50 text-rose-600 font-bold text-xs px-5 py-2 hover:bg-rose-100 transition-colors dark:bg-rose-950/20 dark:border-rose-900"
            >
              <PackageX className="h-4 w-4" /> Cancel Order
            </button>
          </div>
        )}

        <div className="flex justify-center mt-6">
          <Link
            to="/orders"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
          >
            ← Back to My Orders
          </Link>
        </div>
      </main>

      {/* Cancel Confirmation Modal */}
      {order && (
        <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
          <DialogContent className="rounded-3xl max-w-md border-border">
            <DialogHeader>
              <DialogTitle className="font-display flex items-center gap-2 text-rose-600">
                <PackageX className="h-5 w-5" /> Cancel Order
              </DialogTitle>
              <DialogDescription className="text-xs">
                Are you sure you want to cancel this order? This action cannot be undone.
                {String(order?.payment_status).toUpperCase() === "PAID" && (
                  <span className="block mt-3 font-bold text-emerald-700 bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-left">
                    ✓ Your payment of ₹{order?.total} will be automatically refunded to your
                    original payment method.
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Reason (Optional)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Why are you cancelling?"
                rows={3}
                className="w-full rounded-2xl border border-border bg-card p-3 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border mt-4">
              <button
                onClick={() => setCancelModalOpen(false)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted"
              >
                Keep Order
              </button>
              <button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-5 py-2 text-xs font-bold text-white hover:bg-rose-600 shadow-sm disabled:opacity-50"
              >
                {cancelMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                Confirm Cancellation
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
