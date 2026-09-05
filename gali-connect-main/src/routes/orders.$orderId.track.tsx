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
  CreditCard,
  Banknote,
  Smartphone,
  Wallet,
  ExternalLink,
  Navigation,
  Calendar,
  Hash,
  Clock,
  QrCode,
  Copy,
  Check,
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
import { getDeliveryOptionInfo, getPaymentMethodInfo, getOrderStatusInfo } from "@/lib/order-helpers";

function loadRazorpay(): Promise<any> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && (window as any).Razorpay) {
      resolve((window as any).Razorpay);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve((window as any).Razorpay);
    script.onerror = () => resolve(null);
    document.body.appendChild(script);
  });
}

export const Route = createFileRoute("/orders/$orderId/track")({
  component: OrderIdTrackingPage,
});

function OrderIdTrackingPage() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isRetryingPayment, setIsRetryingPayment] = useState(false);
  const [isSwitchingCod, setIsSwitchingCod] = useState(false);

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/orders/${orderId}/cancel`, { reason: cancelReason }),
    onSuccess: () => {
      toast.success("Order cancelled successfully");
      setCancelModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["orderDetail", orderId] });
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
    enabled: !!user && !isGuest,
  });

  const order = orderRes?.data?.data || orderRes?.data || null;
  const [copiedOtp, setCopiedOtp] = useState(false);

  const isMultiStore = Boolean(
    (order?.sub_orders && order.sub_orders.length > 1) ||
    (order?.vendors && order.vendors.length > 1) ||
    (order?.orders && order.orders.length > 1)
  );

  const isMasterOrder = !!order?.orders;

  let effectiveStatus = order?.status;
  if (isMasterOrder && order?.orders?.length > 0) {
    const subStatuses = order.orders.map((o: any) => String(o.status).toUpperCase());
    
    if (!["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "REFUNDED"].includes(String(effectiveStatus).toUpperCase())) {
       if (subStatuses.every((s: string) => ["DELIVERED", "CANCELLED", "REFUNDED", "FAILED"].includes(s)) && subStatuses.some((s: string) => s === "DELIVERED")) {
         effectiveStatus = "DELIVERED";
       } else if (subStatuses.some((s: string) => ["OUT_FOR_DELIVERY", "DELIVERED"].includes(s))) {
         effectiveStatus = "OUT_FOR_DELIVERY";
       } else if (subStatuses.some((s: string) => ["PREPARING", "PACKED", "READY_FOR_PICKUP", "PICKED_UP"].includes(s))) {
         effectiveStatus = "PREPARING";
       } else if (subStatuses.some((s: string) => s === "CONFIRMED")) {
         effectiveStatus = "CONFIRMED";
       }
    }
  }

  const statusInfo = getOrderStatusInfo(effectiveStatus);
  const status = statusInfo.status;
  const isDelivered = status === "delivered";
  const isOutForDelivery = status === "out_for_delivery";
  const isPreparing = status === "preparing" || status === "packed" || status === "ready_for_pickup";
  const isConfirmed = status === "confirmed" || isPreparing || isOutForDelivery || isDelivered;

  const steps = [
    { label: "Order Booked", desc: "Booking received & sent to merchant", done: !!order },
    { label: "Confirmed", desc: "Accepted by merchant", done: isConfirmed },
    { label: "Preparing", desc: "Packing fresh items", done: isPreparing || isOutForDelivery || isDelivered },
    {
      label: "Out for Delivery",
      desc: "Partner on the way",
      done: isOutForDelivery || isDelivered,
    },
    { label: "Delivered", desc: "Enjoy your fresh produce!", done: isDelivered },
  ];

  const items = order?.items || (isMasterOrder ? order.orders.flatMap((o: any) => o.items || []) : []);
  const itemsSubtotal = Number(order?.items_subtotal ?? (isMasterOrder ? order.orders.reduce((sum: number, o: any) => sum + Number(o.items_subtotal || 0), 0) : 0));
  const deliveryFee = Number(order?.delivery_fee ?? 0);
  const tax = Number(order?.tax ?? order?.platform_fee ?? 0);
  const discount = Number(order?.discount ?? 0);
  const totalAmount = Number(order?.total_amount ?? order?.total ?? 0);
  const isPaymentUnpaid = !!order && ((order?.payment_status === "PENDING" && order?.payment_method !== "COD") || order?.payment_status === "FAILED") && !["cancelled", "refunded"].includes(String(order?.status || "").toLowerCase());
  const isCodUnpaid = !!order && order?.payment_method === "COD" && order?.payment_status !== "PAID" && !["cancelled", "refunded", "failed"].includes(String(order?.status || "").toLowerCase());

  const handleRetryPayment = async () => {
    if (!order?.id) return;
    setIsRetryingPayment(true);
    try {
      const RazorpayCtor = await loadRazorpay();
      if (!RazorpayCtor) {
        throw new Error("Razorpay SDK failed to load. Please check your internet connection.");
      }
      const res = await api.post<any>(`/payments/${order.id}/retry`, {});
      if (!res.success || !res.data) {
        throw new Error(res.error?.message || "Failed to initialize payment retry.");
      }
      const retryData = res.data;

      const options = {
        key: retryData.key || import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_xxxxxxxxxxxx",
        amount: Math.round((retryData.amount || totalAmount) * 100),
        currency: retryData.currency || "INR",
        name: "Vegamart",
        description: `Order ${retryData.order_number}`,
        order_id: retryData.razorpay_order_id,
        handler: async (response: any) => {
          try {
            const verifyRes = await api.post<any>("/payments/verify", {
              razorpay_order_id: retryData.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            if (verifyRes?.success) {
              toast.success("Payment verified and completed successfully! 🎉");
              refetch();
            } else {
              toast.error(verifyRes?.error?.message || "Verification failed. Please contact support.");
            }
          } catch {
            toast.error("Payment verification failed. Please contact support.");
          }
        },
        prefill: {
          name: user?.name || "Customer",
          email: user?.email || "",
          contact: user?.phone || "9999999999",
        },
        theme: {
          color: "#10b981",
        },
      };
      const paymentObject = new RazorpayCtor(options);
      paymentObject.open();
    } catch (err: any) {
      toast.error(err?.message || "Payment retry failed.");
    } finally {
      setIsRetryingPayment(false);
    }
  };

  const handleSwitchToCod = async () => {
    if (!order?.id) return;
    setIsSwitchingCod(true);
    try {
      const res = await api.post<any>(`/payments/${order.id}/switch-to-cod`, {});
      if (res.success) {
        toast.success("Order switched to Cash on Delivery! Pay when delivered. 💵");
        refetch();
      } else {
        toast.error(res.error?.message || "Failed to switch to Cash on Delivery.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to switch payment method.");
    } finally {
      setIsSwitchingCod(false);
    }
  };

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
            {/* Pay Online Option for COD Orders (Pay Now or At Delivery) */}
            {isCodUnpaid && (
              <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-emerald-500/10 p-5 shadow-soft space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-emerald-500 text-black flex items-center justify-center font-bold shadow-md shrink-0 mt-0.5">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-foreground">Pay Online Option (UPI / QR / Card)</h3>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-black">
                          Available Anytime / At Delivery
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-xl">
                        This order is currently <strong>Cash on Delivery (₹{totalAmount.toFixed(2)})</strong>. If you want to pay digitally now or when the delivery partner arrives at your doorstep, you can pay online via Google Pay, PhonePe, Paytm, QR, or Card.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end flex-wrap sm:flex-nowrap">
                    <button
                      onClick={handleRetryPayment}
                      disabled={isRetryingPayment}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs px-5 py-2.5 shadow-xs transition-colors"
                    >
                      {isRetryingPayment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Smartphone className="h-3.5 w-3.5" />}
                      Pay Online (UPI / QR / Card)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Incomplete / Failed Fallback Recovery Banner */}
            {isPaymentUnpaid && (
              <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-5 shadow-soft space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center font-bold shadow-md shrink-0 mt-0.5">
                      <AlertCircle className="h-5 w-5 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-foreground">Online Payment Incomplete</h3>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500 text-white">
                          Action Required
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-xl">
                        Your online payment was not captured. <strong>Did your bank deduct money?</strong> Don't worry — if any amount was debited, your bank will auto-refund it in 3-5 business days. You can retry payment online or switch to Pay on Delivery.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                    <button
                      onClick={handleRetryPayment}
                      disabled={isRetryingPayment || isSwitchingCod}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs px-4 py-2.5 shadow-xs transition-colors"
                    >
                      {isRetryingPayment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      Retry Payment Online
                    </button>
                    <button
                      onClick={handleSwitchToCod}
                      disabled={isRetryingPayment || isSwitchingCod}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground font-bold text-xs px-4 py-2.5 shadow-xs transition-colors"
                    >
                      {isSwitchingCod ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Banknote className="h-3.5 w-3.5 text-emerald-600" />}
                      Switch to COD
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Status Banner */}
            <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/5 p-5 shadow-soft flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${statusInfo.badgeBg} font-bold shadow-md`}>
                  <statusInfo.icon className="h-6 w-6" />
                  {isOutForDelivery && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                  )}
                </div>
                <div>
                  <h2 className="font-display font-black text-lg md:text-xl text-foreground">
                    {isDelivered
                      ? "Order Delivered! 🎉"
                      : isOutForDelivery
                        ? "Delivery Partner is on the way!"
                        : status === "preparing" || status === "packed"
                          ? "Packing & Preparing Fresh Items"
                          : status === "confirmed"
                            ? "Order Confirmed by Merchant"
                            : "Order Booked 🎉"}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isDelivered
                      ? "Order handed over safely."
                      : isOutForDelivery
                        ? "Live tracking will update as the rider moves."
                        : status === "preparing" || status === "packed"
                          ? "Merchant is packing your ordered products."
                          : status === "confirmed"
                            ? "Merchant confirmed and accepted the booking."
                            : "Your booking is confirmed and sent to the merchant."}
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

            {/* Estimated Delivery / Fulfillment Time Banner */}
            {(order.estimated_delivery_time || order.eta || order.vendor?.estimated_delivery_time) && !isDelivered && (
              <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-soft flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-600 text-white font-bold shrink-0">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                      Estimated Delivery / Fulfillment Time
                    </span>
                    <div className="font-bold text-sm text-foreground">
                      ⚡ {order.estimated_delivery_time || order.eta || order.vendor?.estimated_delivery_time}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Delivery OTP Banner */}
            {!isDelivered && (order.otp_code || (order as any).delivery_otp) && (
              <div className="rounded-3xl border border-rose-500/30 bg-gradient-to-r from-rose-500/10 via-orange-500/10 to-rose-500/5 p-5 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-600 font-extrabold text-[10px] uppercase tracking-wider border border-rose-500/25">
                      {isMultiStore ? "Multi-Store Order OTP" : "Delivery Verification"}
                    </span>
                  </div>
                  <h3 className="font-display font-black text-base text-rose-600">
                    Secure Delivery OTP
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                    {isMultiStore
                      ? "Share this single OTP with the delivery partner when they arrive with items from all stores. Only share after receiving your items."
                      : "Share this 6-digit OTP with your delivery partner when they arrive. Do not share before receiving your items."}
                  </p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="bg-rose-500 text-white font-black text-3xl tracking-[0.25em] px-6 py-3 rounded-2xl shadow-inner border border-rose-600 select-all">
                    {order.otp_code || (order as any).delivery_otp}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const code = order.otp_code || (order as any).delivery_otp;
                      if (code) {
                        navigator.clipboard.writeText(code);
                        setCopiedOtp(true);
                        toast.success("OTP copied to clipboard!");
                        setTimeout(() => setCopiedOtp(false), 2500);
                      }
                    }}
                    className="p-3.5 rounded-2xl border border-rose-200 bg-card hover:bg-rose-50 text-rose-600 transition-colors shadow-xs"
                    title="Copy OTP"
                    aria-label="Copy OTP"
                  >
                    {copiedOtp ? <Check className="h-5 w-5 text-emerald-600" /> : <Copy className="h-5 w-5" />}
                  </button>
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
                  <span className="text-xs font-bold text-emerald-700">
                    {order.estimated_delivery_time || order.eta || order.vendor?.estimated_delivery_time ? `~ ${order.estimated_delivery_time || order.eta || order.vendor?.estimated_delivery_time}` : "Arriving soon"}
                  </span>
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
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
                    <div className="font-bold text-xs line-clamp-2 leading-tight">{step.label}</div>
                    <div className="text-[10px] opacity-80 line-clamp-2 leading-tight">{step.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Itemized Order Details & Receipt */}
            <div className="rounded-3xl border bg-card p-6 shadow-soft space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                <div>
                  <h3 className="font-display font-black text-base text-foreground">
                    Order Details
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Order #{order.order_number || orderId}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Delivery Mode Badge */}
                  {(() => {
                    const dInfo = getDeliveryOptionInfo(order.delivery_note || order.delivery_option || order.delivery_slot);
                    const DIcon = dInfo.icon;
                    return (
                      <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${dInfo.colorClass}`}>
                        <DIcon className="h-3.5 w-3.5" />
                        {dInfo.shortLabel}
                      </span>
                    );
                  })()}

                  {/* Payment Method Badge */}
                  <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${getPaymentMethodInfo(order.payment_method, order.payment_status).colorClass}`}>
                    {(() => {
                      const PIcon = getPaymentMethodInfo(order.payment_method, order.payment_status).icon;
                      return <PIcon className="h-3.5 w-3.5" />;
                    })()}
                    {getPaymentMethodInfo(order.payment_method, order.payment_status).shortLabel}
                  </span>
                </div>
              </div>

              {/* Delivery Option & Payment Detail Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Chosen Delivery Option Card */}
                {(() => {
                  const dInfo = getDeliveryOptionInfo(order.delivery_note || order.delivery_option || order.delivery_slot);
                  const DIcon = dInfo.icon;
                  return (
                    <div className="rounded-2xl border border-border bg-muted/30 p-3.5 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Delivery Option Chosen
                        </span>
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${dInfo.colorClass}`}>
                          <DIcon className="h-3 w-3" />
                          {dInfo.shortLabel}
                        </span>
                      </div>
                      <div className="font-bold text-foreground text-sm">{dInfo.label}</div>
                      <p className="text-muted-foreground text-[11px]">{dInfo.desc}</p>
                    </div>
                  );
                })()}

                {/* Chosen Payment Mode Card */}
                {(() => {
                  const dInfo = getDeliveryOptionInfo(order.delivery_note || order.delivery_option || order.delivery_slot);
                  const pInfo = getPaymentMethodInfo(
                    order.payment_method,
                    order.payment_status,
                    totalAmount,
                    dInfo.id === "self_pickup",
                    order.payment?.amount != null ? Number(order.payment.amount) : null
                  );
                  const PIcon = pInfo.icon;
                  return (
                    <div className="rounded-2xl border border-border bg-muted/30 p-3.5 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Payment Mode
                        </span>
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${pInfo.colorClass}`}>
                          <PIcon className="h-3 w-3" />
                          {pInfo.shortLabel}
                        </span>
                      </div>
                      <div className="font-bold text-foreground text-sm flex items-center justify-between">
                        <span>{pInfo.label}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${pInfo.statusColorClass}`}>
                          {pInfo.statusText}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-[11px]">{pInfo.instruction}</p>
                    </div>
                  );
                })()}
              </div>

              {/* Customer, Delivery Address & Store Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Full Delivery Address Card */}
                <div className="rounded-2xl bg-muted/40 border border-border/60 p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      Delivery Destination
                    </span>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200 uppercase">
                      {order.address?.label || "Home"}
                    </span>
                  </div>

                  <div>
                    <div className="font-bold text-foreground text-sm flex items-center justify-between">
                      <span>{order.customer?.name || "Customer"}</span>
                      {order.address?.latitude && order.address?.longitude && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${order.address.latitude},${order.address.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-emerald-700 hover:underline flex items-center gap-1 font-semibold"
                        >
                          <Navigation className="h-3 w-3" /> Map Directions
                        </a>
                      )}
                    </div>
                    {(order.customer?.phone || order.address?.phone) && (
                      <a
                        href={`tel:${order.customer?.phone || order.address?.phone}`}
                        className="inline-flex items-center gap-1 text-emerald-700 font-semibold mt-1 hover:underline text-xs"
                      >
                        <Phone className="h-3 w-3" /> {order.customer?.phone || order.address?.phone}
                      </a>
                    )}
                  </div>

                  <div className="pt-1.5 border-t border-border/50 space-y-1 text-muted-foreground">
                    <p className="font-medium text-foreground leading-relaxed">
                      {order.address?.full_address ||
                        [order.address?.address_line1, order.address?.street_address].filter(Boolean).join(", ") ||
                        "Address on file"}
                    </p>
                    {order.address?.landmark && (
                      <p className="text-[11px]">
                        <strong className="text-foreground">Landmark:</strong> {order.address.landmark}
                      </p>
                    )}
                    <p className="text-[11px]">
                      {[order.address?.city, order.address?.state, order.address?.pincode ? `- ${order.address.pincode}` : "", order.address?.country || "India"]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    {order.address?.phone && (
                      <p className="text-[11px] text-emerald-700 font-semibold pt-0.5">
                        <strong className="text-foreground font-medium">Address Contact:</strong>{" "}
                        <a href={`tel:${order.address.phone}`} className="hover:underline">
                          {order.address.phone}
                        </a>
                      </p>
                    )}
                  </div>
                </div>

                {/* Vendor / Store Details Card */}
                {order.sub_orders && order.sub_orders.length > 1 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <Store className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        Fulfilling Stores ({order.sub_orders.length})
                      </span>
                      <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Multi-Store Delivery
                      </span>
                    </div>
                    <div className="space-y-2.5">
                      {order.sub_orders.map((sub: any, sIdx: number) => {
                        const v = sub.vendor;
                        const subStatus = String(sub.status || "PENDING").toUpperCase();
                        const isSubCancelled = subStatus === "CANCELLED";
                        const isSubConfirmed = ["CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED"].includes(subStatus);
                        return (
                          <div key={sub.id || sIdx} className="rounded-2xl bg-muted/40 border border-border/60 p-3.5 space-y-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-bold text-foreground text-sm flex items-center gap-1.5 min-w-0">
                                <span className="truncate">{v?.business_name || `Store #${sIdx + 1}`}</span>
                                {isSubCancelled ? (
                                  <span className="shrink-0 text-[10px] font-extrabold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                    Cancelled
                                  </span>
                                ) : isSubConfirmed ? (
                                  <span className="shrink-0 text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                    {subStatus === "READY_FOR_PICKUP" ? "Ready" : subStatus === "PREPARING" ? "Preparing" : "Accepted"}
                                  </span>
                                ) : (
                                  <span className="shrink-0 text-[10px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                    Waiting for Acceptance
                                  </span>
                                )}
                              </div>
                              {v?.phone && (
                                <a
                                  href={`tel:${v.phone}`}
                                  className="px-2.5 py-1 rounded-xl bg-emerald-600 text-white font-bold text-[11px] shadow-sm hover:bg-emerald-700 transition-colors flex items-center gap-1 shrink-0"
                                >
                                  <Phone className="h-3 w-3" /> Call
                                </a>
                              )}
                            </div>
                            {v?.address && (
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                {v.address}
                              </p>
                            )}
                            {v?.latitude && v?.longitude && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${v.latitude},${v.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-emerald-700 hover:underline inline-flex items-center gap-1 font-semibold"
                              >
                                <ExternalLink className="h-3 w-3" /> View Store on Map
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-muted/40 border border-border/60 p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <Store className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        Merchant / Store
                      </span>
                      {order.vendor?.phone && (
                        <a
                          href={`tel:${order.vendor.phone}`}
                          className="px-2.5 py-1 rounded-xl bg-emerald-600 text-white font-bold text-[11px] shadow-sm hover:bg-emerald-700 transition-colors flex items-center gap-1"
                        >
                          <Phone className="h-3 w-3" /> Call Store
                        </a>
                      )}
                    </div>

                    <div>
                      <div className="font-bold text-foreground text-sm">
                        {order.vendor?.business_name || "Vegamart Merchant Store"}
                      </div>
                      {order.vendor?.phone && (
                        <p className="text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3" /> {order.vendor.phone}
                        </p>
                      )}
                    </div>

                    <div className="pt-1.5 border-t border-border/50 space-y-1 text-muted-foreground">
                      {order.vendor?.address ? (
                        <>
                          <p className="font-medium text-foreground leading-relaxed">
                            {order.vendor.address}
                          </p>
                          <p className="text-[11px]">
                            {[order.vendor.city, (order.vendor as any).state, (order.vendor as any).pincode ? `- ${(order.vendor as any).pincode}` : ""]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        </>
                      ) : (
                        <p className="italic text-[11px]">Local verified merchant</p>
                      )}
                      {order.vendor?.latitude && order.vendor?.longitude && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${order.vendor.latitude},${order.vendor.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-emerald-700 hover:underline flex items-center gap-1 font-semibold pt-0.5"
                        >
                          <ExternalLink className="h-3 w-3" /> View Store on Map
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Assigned Delivery Partner Card (if any) */}
              {order.delivery_partner && (
                <div className="rounded-2xl bg-emerald-50/60 border border-emerald-200/70 p-4 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-emerald-600 text-white grid place-items-center shrink-0 shadow-sm">
                      <Bike className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                        Assigned Delivery Partner
                      </div>
                      <div className="font-bold text-foreground text-sm">
                        {order.delivery_partner.user?.name || order.delivery_partner.name || "Delivery Partner"}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {order.delivery_partner.vehicle_type ? `${order.delivery_partner.vehicle_type}` : "Delivery Vehicle"}{" "}
                        {order.delivery_partner.vehicle_number ? `(${order.delivery_partner.vehicle_number})` : ""}
                      </div>
                    </div>
                  </div>

                  {(order.delivery_partner.user?.phone || order.delivery_partner.phone) && (
                    <a
                      href={`tel:${order.delivery_partner.user?.phone || order.delivery_partner.phone}`}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-2xl bg-emerald-600 text-white font-bold text-xs shadow-sm hover:bg-emerald-700 transition-colors shrink-0"
                    >
                      <Phone className="h-3.5 w-3.5" /> Call Partner
                    </a>
                  )}
                </div>
              )}

              {/* Products List */}
              <div className="space-y-3 pt-2">
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

                {order.sub_orders && order.sub_orders.length > 1 ? (
                  // Multi-Store Grouped Items List
                  <div className="space-y-4">
                    {order.sub_orders.map((sub: any, sIdx: number) => {
                      const v = sub.vendor;
                      const subStatus = String(sub.status || "PENDING").toUpperCase();
                      const isSubCancelled = subStatus === "CANCELLED";
                      const isSubConfirmed = ["CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED"].includes(subStatus);
                      const subItems = sub.items || [];
                      return (
                        <div key={sub.id || sIdx} className="rounded-2xl border border-border/80 overflow-hidden bg-background shadow-xs">
                          {/* Store Header Banner */}
                          <div className="px-3.5 py-2.5 bg-muted/40 border-b border-border/60 flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 min-w-0">
                              <Store className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span className="font-bold text-xs text-foreground truncate">
                                {v?.business_name || `Store #${sIdx + 1}`}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                ({subItems.length} {subItems.length === 1 ? "item" : "items"})
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {isSubCancelled ? (
                                <span className="text-[10px] font-extrabold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                  Out of Stock / Cancelled
                                </span>
                              ) : isSubConfirmed ? (
                                <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  {subStatus === "READY_FOR_PICKUP" ? "Ready" : subStatus === "PREPARING" ? "Preparing" : "Accepted"}
                                </span>
                              ) : (
                                <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                  Waiting for Acceptance
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Items for this Store */}
                          <div className="divide-y">
                            {subItems.map((item: any, idx: number) => {
                              const isRejected = item.status === "rejected" || isSubCancelled;
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
                                          <AlertCircle className="h-3 w-3" /> Unavailable / Cancelled
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
                                        Cancelled
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {/* Store Subtotal */}
                          <div className="px-3.5 py-2 bg-muted/20 border-t border-border/40 flex items-center justify-between text-xs">
                            <span className="text-muted-foreground font-medium text-[11px]">Store Total:</span>
                            <span className="font-bold text-foreground tabular-nums">
                              ₹{Number(sub.total || 0).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  // Single Store or Flat Items List
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
                )}
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
                  <span>Taxes (GST)</span>
                  <span className="tabular-nums font-semibold">₹{(tax || 0).toFixed(2)}</span>
                </div>
                {order.additional_charges && order.additional_charges.length > 0 && order.additional_charges.map((charge: any, idx: number) => (
                  <div key={idx} className="flex justify-between">
                    <span>{charge.name}</span>
                    <span className="tabular-nums font-semibold">₹{Number(charge.amount).toFixed(2)}</span>
                  </div>
                ))}

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
                {/* Total Order Amount */}
                <div className="flex justify-between pt-2 border-t text-sm font-bold text-foreground">
                  <span>Total Order Amount</span>
                  <span className="tabular-nums font-extrabold">
                    ₹{(totalAmount || 0).toFixed(2)}
                  </span>
                </div>

                {(() => {
                  const dInfo = getDeliveryOptionInfo(order.delivery_note || order.delivery_option || order.delivery_slot);
                  const pInfo = getPaymentMethodInfo(
                    order.payment_method,
                    order.payment_status,
                    totalAmount,
                    dInfo.id === "self_pickup",
                    order.payment?.amount != null ? Number(order.payment.amount) : null
                  );

                  if (pInfo.isPartialAdvance) {
                    return (
                      <div className="space-y-2 pt-1">
                        <div className="flex justify-between items-center text-emerald-700 dark:text-emerald-300 font-bold text-xs bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            Advance Paid Online ({order.payment?.method || "UPI/Card"}):
                          </span>
                          <span className="tabular-nums font-extrabold text-sm">- ₹{pInfo.advancePaid.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm font-black text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-2xl border border-amber-200 dark:border-amber-900/50">
                          <span className="flex items-center gap-1.5">
                            <Banknote className="h-4 w-4 text-amber-700 shrink-0" />
                            Remaining Balance to Pay at Store:
                          </span>
                          <span className="tabular-nums text-amber-700 dark:text-amber-300 font-black text-base">
                            ₹{pInfo.balanceAmount.toFixed(2)}
                          </span>
                        </div>
                        <div className="text-[11px] text-center font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/60 py-1.5 px-3 rounded-xl border border-emerald-200/80 dark:border-emerald-800">
                          {pInfo.summaryText}
                        </div>
                      </div>
                    );
                  }

                  if (!pInfo.isPartialAdvance && pInfo.isPrepaid && (order.payment_status === "PAID" || order.payment_status === "SUCCESS")) {
                    return (
                      <div className="flex justify-between items-center text-emerald-700 dark:text-emerald-300 font-extrabold text-sm bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 mt-1">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" /> Full Online Payment Successful
                        </span>
                        <span className="tabular-nums">₹{(totalAmount || 0).toFixed(2)}</span>
                      </div>
                    );
                  }

                  if (pInfo.method === "COD") {
                    return (
                      <div className="flex justify-between items-center text-foreground font-extrabold text-sm bg-muted/50 p-2.5 rounded-xl border mt-1">
                        <span>Amount to Pay on {dInfo.id === "self_pickup" ? "Pickup" : "Delivery"}</span>
                        <span className="tabular-nums text-primary font-bold text-base">₹{(totalAmount || 0).toFixed(2)}</span>
                      </div>
                    );
                  }

                  return (
                    <div className="flex justify-between items-center text-amber-800 font-bold text-xs bg-amber-50 p-2.5 rounded-xl border border-amber-200 mt-1">
                      <span>Online Payment Pending</span>
                      <span className="tabular-nums">₹{(totalAmount || 0).toFixed(2)}</span>
                    </div>
                  );
                })()}
              </div>
            </div>
          </>
        )}

        {/* Cancel Order Section */}
        {order && !isDelivered && (status === "pending" || status === "confirmed") && (
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
