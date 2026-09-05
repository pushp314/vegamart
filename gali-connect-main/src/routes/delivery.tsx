import { useState, useEffect, useRef } from "react";
import { createFileRoute, Link, useNavigate, Outlet, useLocation } from "@tanstack/react-router";
import {
  Bike,
  MapPin,
  Power,
  Navigation,
  Package,
  Store,
  ShieldCheck,
  Loader2,
  AlertCircle,
  Hourglass,
  Ban,
  Radio,
  CheckCircle2,
  Wallet,
  Clock,
  User,
  Settings,
  Banknote,
  Smartphone,
  CreditCard,
  Calendar,
  IndianRupee,
  Phone,
  Bell,
  Info,
  Receipt,
  ChevronRight,
  QrCode,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { DeliveryHistory } from "@/components/delivery/DeliveryHistory";
import { DeliveryProfile } from "@/components/delivery/DeliveryProfile";
import { DeliverySettings } from "@/components/delivery/DeliverySettings";
import { DeliveryWalletTab } from "@/components/delivery/DeliveryWalletTab";
import { lazy, Suspense } from "react";
import { ClientOnly } from "@/components/system/client-only";
const DeliveryMapModal =
  typeof window !== "undefined"
    ? lazy(() =>
        import("@/components/delivery/DeliveryMapModal").then((m) => ({
          default: m.DeliveryMapModal,
        })),
      )
    : () => null;
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Payment display helpers: derive a friendly payment method from the order-level
// payment_method (RAZORPAY/COD/WALLET) plus the Razorpay gateway instrument
// (upi / card / netbanking) captured in payments.gateway_response.
function paymentBadge(o: any): { label: string; icon: any; cls: string } {
  const pm = String(o.payment_method || "").toUpperCase();
  if (pm === "COD") {
    return { label: "COD", icon: Banknote, cls: "bg-amber-50 text-amber-700 border-amber-200" };
  }
  if (pm === "WALLET") {
    return { label: "Wallet", icon: Wallet, cls: "bg-purple-50 text-purple-700 border-purple-200" };
  }
  const gw = String(o.gateway_method || "").toLowerCase();
  if (gw === "upi") {
    return { label: "UPI", icon: Smartphone, cls: "bg-sky-50 text-sky-700 border-sky-200" };
  }
  if (gw.includes("card")) {
    return {
      label: "Card",
      icon: CreditCard,
      cls: "bg-indigo-50 text-indigo-700 border-indigo-200",
    };
  }
  return { label: "Online", icon: CreditCard, cls: "bg-sky-50 text-sky-700 border-sky-200" };
}

function paymentStatusBadge(status: string): { label: string; cls: string } {
  const s = String(status || "").toUpperCase();
  switch (s) {
    case "PAID":
      return { label: "Paid", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "PENDING":
    case "INITIATED":
      return { label: "Pending", cls: "bg-amber-50 text-amber-700 border-amber-200" };
    case "FAILED":
      return { label: "Failed", cls: "bg-rose-50 text-rose-700 border-rose-200" };
    case "REFUNDED":
    case "PARTIALLY_REFUNDED":
      return { label: "Refunded", cls: "bg-slate-100 text-slate-600 border-slate-200" };
    default:
      return { label: s || "N/A", cls: "bg-muted text-muted-foreground border-border" };
  }
}

function isVegaMartDelivery(deliveryOption?: string | null): boolean {
  if (!deliveryOption) return true;
  const raw = deliveryOption.trim().toLowerCase();
  return (
    !raw.includes("self") &&
    !raw.includes("pickup") &&
    !raw.includes("takeaway") &&
    !raw.includes("booking") &&
    !raw.includes("shop") &&
    !raw.includes("vendor comes") &&
    !raw.includes("comes to me") &&
    !raw.includes("street cart")
  );
}

function deliveryOptionBadge(o: any): { label: string; icon: any; cls: string } {
  const opt = String(o.delivery_option || o.delivery_note || "Delivery partner").toLowerCase();
  if (opt.includes("booking") || opt.includes("advance")) {
    return {
      label: "Advance Booking",
      icon: Calendar,
      cls: "bg-blue-50 text-blue-700 border-blue-200",
    };
  }
  if (opt.includes("self") || opt.includes("pickup") || opt.includes("takeaway")) {
    return {
      label: "Self Pickup",
      icon: User,
      cls: "bg-purple-50 text-purple-700 border-purple-200",
    };
  }
  if (opt.includes("vendor") || opt.includes("comes")) {
    return {
      label: "Vendor Comes to Me",
      icon: Store,
      cls: "bg-orange-50 text-orange-700 border-orange-200",
    };
  }
  if (opt.includes("shop")) {
    return { label: "Shop Delivery", icon: Store, cls: "bg-teal-50 text-teal-700 border-teal-200" };
  }
  return {
    label: "VegaMart Delivery",
    icon: Bike,
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
}

function OrderThumb({ order }: { order: any }) {
  return order.product_image ? (
    <img
      src={order.product_image}
      alt={order.items?.[0]?.product_name || "Order item"}
      className="h-12 w-12 rounded-xl object-cover border border-border bg-white shrink-0"
    />
  ) : (
    <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center border border-border shrink-0">
      <Package className="h-5 w-5 text-muted-foreground" />
    </div>
  );
}

function OrderItemsLine({ order }: { order: any }) {
  const items = order.items || [];
  return (
    <div className="text-sm font-bold truncate">
      {items[0]?.product_name || "Order items"}
      {items.length > 1 ? (
        <span className="text-muted-foreground"> +{items.length - 1} more</span>
      ) : null}
    </div>
  );
}

export const Route = createFileRoute("/delivery")({
  component: DeliveryDashboard,
});

function DeliveryDashboard() {
  const { user, isAuthenticated, accessToken: token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pathname } = useLocation();

  useEffect(() => {
    if (pathname.startsWith("/delivery/how-to-use")) return;
    if (user && user.role !== "delivery") {
      toast.error("Access restricted: Delivery Partner account required.");
      if (user.role === "vendor") navigate({ to: "/vendor" });
      else if (user.role === "admin" || user.role === "super_admin") navigate({ to: "/admin" });
      else navigate({ to: "/" });
    }
  }, [user, navigate, pathname]);
  const [activeTab, setActiveTab] = useState<
    "requests" | "active" | "earnings" | "history" | "profile" | "settings"
  >("requests");
  const [isOnline, setIsOnline] = useState(false);

  // OTP Modal
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [otpValue, setOtpValue] = useState("");

  // ETA Modal
  const [etaModalOpen, setEtaModalOpen] = useState(false);
  const [etaValue, setEtaValue] = useState("");
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null);

  // Map Modal
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [mapData, setMapData] = useState<any>(null);

  // Full Order Details Modal
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsOrder, setDetailsOrder] = useState<any | null>(null);
  const [upiQrModalOrder, setUpiQrModalOrder] = useState<any | null>(null);

  // Fetch Delivery Profile
  const { data: profileRes, isLoading: partnerLoading } = useQuery({
    queryKey: ["deliveryProfile"],
    queryFn: () => api.get<{ data: any }>("/delivery/me"),
    enabled: isAuthenticated,
    retry: false,
  });

  const partner = profileRes?.data?.data || profileRes?.data;

  // Fetch Delivery Requests
  const { data: requestsRes, refetch: refetchRequests } = useQuery({
    queryKey: ["deliveryRequests"],
    queryFn: () => api.get<any[]>("/delivery/requests"),
    enabled: !!partner && partner.status?.toUpperCase() === "APPROVED" && isOnline,
    refetchInterval: 5000,
  });

  // Fetch My Active Deliveries
  const { data: myDeliveriesRes } = useQuery({
    queryKey: ["myDeliveries"],
    queryFn: () => api.get<any[]>("/delivery/my-deliveries"),
    enabled: !!partner && partner.status?.toUpperCase() === "APPROVED",
  });

  // Fetch Delivery Stats
  const { data: statsRes } = useQuery({
    queryKey: ["deliveryStats"],
    queryFn: () => api.get<any>("/delivery/me/stats"),
    enabled: !!partner && partner.status?.toUpperCase() === "APPROVED",
  });

  const deliveryStats = statsRes?.data?.data ?? statsRes?.data ?? {};

  const rawRequests = requestsRes?.data || [];
  const requests = rawRequests.filter(
    (r: any) =>
      isVegaMartDelivery(r.delivery_option || r.delivery_note) &&
      !["DELIVERED", "CANCELLED", "REFUNDED"].includes(r.status?.toUpperCase())
  );

  const prevRequestsCountRef = useRef(0);
  useEffect(() => {
    if (isOnline && requests.length > prevRequestsCountRef.current && prevRequestsCountRef.current >= 0) {
      toast.info(`⚡ ${requests.length} Delivery Request${requests.length > 1 ? "s" : ""} Available on Radar!`, {
        action: {
          label: "View Radar",
          onClick: () => setActiveTab("requests"),
        },
      });
    }
    prevRequestsCountRef.current = requests.length;
  }, [requests.length, isOnline]);

  const myDeliveries = myDeliveriesRes?.data || [];

  const completedOrders = myDeliveries.filter((o: any) => o.status?.toUpperCase() === "DELIVERED");
  const activeOrders = myDeliveries.filter((o: any) => o.status?.toUpperCase() !== "DELIVERED");

  const totalEarnings = completedOrders.reduce(
    (sum: number, o: any) => sum + (o.delivery_fee || 0),
    0,
  );

  // Accept Delivery Mutation
  const acceptMutation = useMutation({
    mutationFn: ({ id, eta_minutes }: { id: string; eta_minutes: number }) =>
      api.put(`/delivery/orders/${id}/accept`, { eta_minutes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveryRequests"] });
      queryClient.invalidateQueries({ queryKey: ["myDeliveries"] });
      toast.success("Delivery accepted! Head to the vendor.");
      setActiveTab("active");
      setEtaModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to accept delivery request");
    },
  });

  // Update Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
      api.put(`/delivery/orders/${orderId}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myDeliveries"] });
      toast.success("Status updated!");
    },
  });

  const notifyVendorMutation = useMutation({
    mutationFn: ({ orderId, subId }: { orderId: string; subId: string }) =>
      api.post(`/delivery/orders/${orderId}/sub-orders/${subId}/notify-vendor`, {}),
    onSuccess: () => {
      toast.success("Vendor notified successfully!");
    },
  });

  const reportIssueMutation = useMutation({
    mutationFn: ({ orderId, subId }: { orderId: string; subId: string }) =>
      api.post(`/delivery/orders/${orderId}/sub-orders/${subId}/report-issue`, {}),
    onSuccess: (data: any) => {
      toast.success(data.message || "Issue reported successfully!");
    },
  });

  const confirmPickupMutation = useMutation({
    mutationFn: ({ orderId, subId }: { orderId: string; subId: string }) =>
      api.post(`/delivery/orders/${orderId}/sub-orders/${subId}/confirm-pickup`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myDeliveries"] });
      toast.success("Pickup confirmed!");
    },
  });

  // Availability toggle — persisted to backend
  const availabilityMutation = useMutation({
    mutationFn: (available: boolean) =>
      api.put("/delivery/me/availability", { is_available: available }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveryProfile"] });
    },
  });

  // Sync local ONLINE/OFFLINE state with the server value once profile loads
  useEffect(() => {
    if (partner) {
      setIsOnline(Boolean(partner.is_available));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partner?.id]);

  const handleToggleOnline = () => {
    const prev = isOnline;
    const next = !isOnline;
    setIsOnline(next);
    availabilityMutation.mutate(next, {
      onError: () => {
        setIsOnline(prev);
        toast.error("Failed to update availability. Please try again.");
      },
    });
  };

  // Child routes like the "How to Use" guide are rendered full-screen by the parent.
  // Declared after all hooks so hook order stays stable across renders.
  if (pathname.startsWith("/delivery/how-to-use")) {
    return <Outlet />;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-foreground pb-28 flex flex-col items-center justify-center p-6 text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-50 text-emerald-600 mb-6 shadow-soft border border-emerald-200">
          <Bike className="h-10 w-10" />
        </div>
        <h2 className="font-display text-2xl font-bold mb-3">Vegamart Fleet</h2>
        <p className="text-muted-foreground mb-8 max-w-xs">
          Deliver fresh produce locally and earn on your schedule.
        </p>
        <Link
          to="/become-delivery"
          className="w-full max-w-sm rounded-full bg-emerald-600 text-white font-black text-sm px-6 py-4 shadow-soft hover:bg-emerald-500 active:scale-95 transition-all"
        >
          Apply to Ride
        </Link>
      </div>
    );
  }

  if (partnerLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="min-h-screen bg-background text-foreground pb-28 flex flex-col items-center justify-center p-6 text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-50 text-emerald-600 mb-6 border border-emerald-200">
          <Bike className="h-10 w-10" />
        </div>
        <h2 className="font-display text-2xl font-bold mb-3">Join the Fleet</h2>
        <p className="text-muted-foreground mb-8 max-w-xs">
          You don't have an active delivery profile yet.
        </p>
        <Link
          to="/become-delivery"
          className="w-full max-w-sm rounded-full bg-emerald-600 text-white font-black text-sm px-6 py-4 shadow-soft hover:bg-emerald-500 active:scale-95 transition-all"
        >
          Complete your profile
        </Link>
      </div>
    );
  }

  if (partner.status === "pending") {
    if (!partner.kyc || partner.kyc.status === "rejected") {
      return (
        <div className="min-h-screen bg-background text-foreground p-6 pb-28">
          <DeliveryKYCForm
            partner={partner}
            initialData={partner.kyc}
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ["deliveryProfile"] })}
          />
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-amber-50 text-amber-600 mb-6 border border-amber-200">
          <Hourglass className="h-10 w-10 animate-pulse" />
        </div>
        <h2 className="font-display text-2xl font-bold mb-3">Review in Progress</h2>
        <p className="text-muted-foreground max-w-xs mb-8">
          Your documents are being verified. We will notify you once approved.
        </p>
      </div>
    );
  }

  if (partner.status === "rejected" || partner.status === "suspended") {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-rose-50 text-rose-600 mb-6 border border-rose-200">
          <Ban className="h-10 w-10" />
        </div>
        <h2 className="font-display text-2xl font-bold text-rose-600 mb-3">
          Account {partner.status}
        </h2>
        <p className="text-muted-foreground max-w-xs mb-8">
          Your account is currently disabled. Please contact fleet support.
        </p>
      </div>
    );
  }

  // ACTIVE RIDER DASHBOARD
  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-emerald-500/20 pb-24">
      {/* Top Status Bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-card/90 backdrop-blur-md sticky top-0 z-40 border-b border-border">
        <button
          onClick={() => setActiveTab("profile")}
          className="flex items-center gap-3 text-left"
          aria-label="Open rider profile"
        >
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center border border-border">
            <Bike className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <div className="font-bold text-sm leading-tight">{partner.full_name}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
              Rider ID: {partner.id.substring(0, 6)}
            </div>
          </div>
        </button>

        <button
          onClick={handleToggleOnline}
          disabled={availabilityMutation.isPending}
          className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs transition-all ${
            isOnline
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-soft"
              : "bg-muted text-muted-foreground border border-border"
          } disabled:opacity-50`}
        >
          <Power className="h-4 w-4" />
          {isOnline ? "ONLINE" : "OFFLINE"}
        </button>
      </div>

      <main className="p-4 space-y-6">
        {/* RIDER PERFORMANCE STRIP */}
        {partner.status?.toUpperCase() === "APPROVED" && (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Successful
                </div>
              </div>
              <div className="text-2xl font-black font-display text-emerald-600 mt-1">
                {deliveryStats.stats?.total_deliveries ?? completedOrders.length}
              </div>
              <div className="text-[10px] font-semibold text-muted-foreground mt-0.5">
                deliveries completed
              </div>
            </div>
            <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-center gap-2">
                <Navigation className="h-4 w-4 text-sky-600" />
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Active
                </div>
              </div>
              <div className="text-2xl font-black font-display text-sky-600 mt-1">
                {activeOrders.length}
              </div>
              <div className="text-[10px] font-semibold text-muted-foreground mt-0.5">
                on the go
              </div>
            </div>
            <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-amber-600" />
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Today
                </div>
              </div>
              <div className="text-2xl font-black font-display text-amber-600 mt-1">
                ₹{deliveryStats.stats?.today_earnings ?? 0}
              </div>
              <div className="text-[10px] font-semibold text-muted-foreground mt-0.5">
                today's earnings
              </div>
            </div>
          </div>
        )}

        {/* INCOMING ORDERS ALERT BANNER */}
        {isOnline && requests.length > 0 && (
          <div
            onClick={() => setActiveTab("requests")}
            className="rounded-3xl p-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white shadow-lg flex items-center justify-between gap-3 cursor-pointer hover:opacity-95 active:scale-[0.99] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-bold text-white shrink-0">
                <Radio className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <div className="font-black text-sm flex items-center gap-1.5">
                  ⚡ {requests.length} Delivery Request{requests.length > 1 ? "s" : ""} Waiting!
                </div>
                <div className="text-xs text-white/90">
                  Tap to view and claim available orders on the Radar.
                </div>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab("requests");
              }}
              className="px-4 py-2 rounded-xl bg-white text-emerald-800 font-black text-xs shrink-0 shadow-sm hover:bg-white/90"
            >
              View Radar
            </button>
          </div>
        )}

        {/* RADAR TAB */}
        {activeTab === "requests" && (
          <div className="space-y-4">
            {!isOnline ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-32 w-32 rounded-full bg-muted flex items-center justify-center mb-6 border border-border">
                  <Power className="h-12 w-12 text-muted-foreground/50" />
                </div>
                <h3 className="text-xl font-bold mb-2">You are Offline</h3>
                <p className="text-muted-foreground text-sm max-w-xs">
                  Go online to receive delivery requests from nearby vendors.
                </p>
              </div>
            ) : requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-48 w-48 rounded-full border border-emerald-500/30 animate-[ping_3s_linear_infinite]" />
                  <div className="absolute h-32 w-32 rounded-full border border-emerald-500/40 animate-[ping_2s_linear_infinite]" />
                </div>
                <div className="h-20 w-20 rounded-full bg-emerald-50 flex items-center justify-center mb-6 relative z-10 border border-emerald-200">
                  <Radio className="h-8 w-8 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold mb-2 relative z-10">Scanning for Delivery Orders</h3>
                <p className="text-muted-foreground text-sm max-w-xs relative z-10">
                  Waiting for vendors to accept orders. Once a vendor confirms an order for VegaMart Delivery, it will appear here for pickup.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((r: any) => {
                  const pm = paymentBadge(r);
                  const ps = paymentStatusBadge(r.payment_status);
                  const dm = deliveryOptionBadge(r);
                  return (
                    <div
                      key={r.id}
                      className="bg-card rounded-3xl p-5 border border-border shadow-soft relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-4 bg-emerald-50 rounded-bl-3xl border-l border-b border-emerald-100 text-center">
                        <div className="text-xl font-black text-emerald-600">₹{r.delivery_fee}</div>
                        <div className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider">
                          Delivery charge
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-5">
                        <div className={`h-2 w-2 rounded-full animate-pulse ${r.status === "PENDING" ? "bg-amber-400" : "bg-emerald-500"}`} />
                        <span className={`text-xs font-bold uppercase tracking-widest ${r.status === "PENDING" ? "text-amber-600" : "text-emerald-600"}`}>
                          {r.status === "PENDING" ? "Waiting for Vendor" : "New Request"}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mb-5 rounded-2xl bg-muted/40 border border-border p-3 pr-24">
                        <OrderThumb order={r} />
                        <div className="min-w-0 flex-1">
                          <OrderItemsLine order={r} />
                          <div className="text-xs text-muted-foreground">
                            {r.items?.length ?? 1} item{(r.items?.length ?? 1) > 1 ? "s" : ""}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-6">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold ${dm.cls}`}
                        >
                          <dm.icon className="h-3.5 w-3.5" />
                          {dm.label}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold ${pm.cls}`}
                        >
                          <pm.icon className="h-3.5 w-3.5" />
                          {pm.label}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold ${ps.cls}`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {ps.label}
                        </span>
                      </div>

                      <div className="space-y-4 mb-6">
                        <div className="flex gap-4">
                          <div className="mt-1">
                            <Store className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground font-bold uppercase mb-1">
                              Pickup From
                            </div>
                            <div className="font-bold text-lg">
                              {r.vendor?.business_name || "Vendor"}
                            </div>
                            <div className="text-sm text-muted-foreground">{r.vendor?.address}</div>
                          </div>
                        </div>

                        <div className="flex gap-4">
                          <div className="mt-1">
                            <MapPin className="h-5 w-5 text-rose-600" />
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground font-bold uppercase mb-1">
                              Dropoff At
                            </div>
                            <div className="font-bold text-lg">{r.user?.name || "Customer"}</div>
                            <div className="text-sm text-muted-foreground">
                              {r.address?.street_address}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setDetailsOrder(r);
                            setDetailsModalOpen(true);
                          }}
                          className="w-full py-3 rounded-2xl bg-muted/80 hover:bg-muted text-foreground font-bold text-sm flex items-center justify-center gap-2 border border-border transition-colors"
                        >
                          <Info className="h-4 w-4 text-emerald-600" /> View Order Details ({r.items?.length || 1} items)
                        </button>

                        <div className="space-y-3">
                          {(r.status === "PENDING" || r.sub_orders?.some((s: any) => s.status === "PENDING")) && (
                            <div className="bg-amber-50 text-amber-700 text-xs py-2.5 px-3 rounded-xl border border-amber-200 flex items-start gap-2 font-bold shadow-sm">
                              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                              <span>
                                ⚠️ Store is currently accepting/packing items. You can claim this delivery run now and head to the pickup location.
                              </span>
                            </div>
                          )}
                          <button
                            onClick={() => {
                              setAcceptingOrderId(r.id);
                              setEtaValue("15");
                              setEtaModalOpen(true);
                            }}
                            disabled={acceptMutation.isPending}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl text-lg flex justify-center items-center gap-2 shadow-soft active:scale-[0.98] transition-transform disabled:opacity-60"
                          >
                            {acceptMutation.isPending && acceptingOrderId === r.id ? (
                              <Loader2 className="h-6 w-6 animate-spin" />
                            ) : (
                              "Accept Delivery"
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ACTIVE DELIVERIES TAB */}
        {activeTab === "active" && (
          <div className="space-y-4">
            {activeOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4 border border-border">
                  <Package className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-xl font-bold mb-2">No Active Orders</h3>
                <p className="text-muted-foreground text-sm max-w-xs">
                  {requests.length > 0
                    ? `There ${requests.length === 1 ? "is 1 new delivery order" : `are ${requests.length} new delivery orders`} available on the Radar!`
                    : "Accept a request from the Radar to start delivering."}
                </p>
                {requests.length > 0 && (
                  <button
                    onClick={() => setActiveTab("requests")}
                    className="mt-4 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-soft inline-flex items-center gap-2 active:scale-95 transition-transform"
                  >
                    <Radio className="h-4 w-4 animate-pulse" /> View & Accept {requests.length} Available Order{requests.length > 1 ? "s" : ""}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {activeOrders.map((o: any) => {
                  const pm = paymentBadge(o);
                  const ps = paymentStatusBadge(o.payment_status);
                  const dm = deliveryOptionBadge(o);
                  const isCod = String(o.payment_method || "").toUpperCase() === "COD";
                  return (
                    <div
                      key={o.id}
                      className="bg-card rounded-3xl border border-border shadow-soft overflow-hidden"
                    >
                      <div className="p-4 bg-muted/50 flex justify-between items-center border-b border-border">
                        <div className="font-bold text-xs text-muted-foreground">
                          Order #{o.id.substring(0, 8)}
                        </div>
                        <div className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-black uppercase tracking-wider">
                          {o.status.replace(/_/g, " ")}
                        </div>
                      </div>

                      <div className="p-5 space-y-6">
                        <div className="flex items-center gap-3 rounded-2xl bg-muted/40 border border-border p-3">
                          <OrderThumb order={o} />
                          <div className="min-w-0 flex-1">
                            <OrderItemsLine order={o} />
                            <div className="text-xs text-muted-foreground">
                              {o.items?.length ?? 1} item{(o.items?.length ?? 1) > 1 ? "s" : ""} ·{" "}
                              Delivery charge:{" "}
                              <span className="font-bold text-emerald-600">₹{o.delivery_fee}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold ${dm.cls}`}
                          >
                            <dm.icon className="h-3.5 w-3.5" />
                            {dm.label}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold ${pm.cls}`}
                          >
                            <pm.icon className="h-3.5 w-3.5" />
                            {pm.label}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold ${ps.cls}`}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {ps.label}
                          </span>
                        </div>

                        <div className="relative space-y-4">
                          <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-border" />
                          {o.sub_orders && o.sub_orders.length > 0 ? (
                            o.sub_orders.map((sub: any, idx: number) => {
                              const sStatus = String(sub.status || "").toUpperCase();
                              let sIcon = <Hourglass className="h-3 w-3" />;
                              let sColor = "text-amber-600";
                              let sText = "Pending";
                              if (sStatus === "PREPARING") {
                                sIcon = <Hourglass className="h-3 w-3 animate-pulse" />;
                                sColor = "text-indigo-600";
                                sText = "Preparing";
                              } else if (sStatus === "READY_FOR_PICKUP" || sStatus === "PICKED_UP" || sStatus === "OUT_FOR_DELIVERY" || sStatus === "DELIVERED") {
                                sIcon = <CheckCircle2 className="h-3 w-3" />;
                                sColor = "text-emerald-600";
                                sText = "Ready";
                                if (sStatus === "PICKED_UP") sText = "Picked Up";
                              }

                              return (
                                <div key={idx} className="flex items-start gap-4 relative z-10">
                                  <div className="bg-card p-1 mt-1">
                                    <Store className="h-4 w-4 text-emerald-600" />
                                  </div>
                                  <div className="flex-1 bg-muted/30 border border-border rounded-xl p-3">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <div className="text-[10px] text-emerald-600 font-bold uppercase mb-1 flex items-center gap-1">
                                          Pickup {idx + 1} of {o.sub_orders.length}
                                        </div>
                                        <div className="font-bold text-sm">{sub.vendor?.business_name}</div>
                                      </div>
                                      <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-card ${sColor} border-current opacity-80`}>
                                        {sIcon} {sText}
                                      </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1 mb-3">{sub.vendor?.address}</div>
                                    <div className="flex gap-2">
                                      {sub.vendor?.phone && (
                                        <a
                                          href={`tel:${sub.vendor.phone}`}
                                          className="flex-1 text-center py-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-bold text-xs transition-colors flex items-center justify-center gap-1"
                                        >
                                          <Phone className="h-3.5 w-3.5" /> Call Vendor
                                        </a>
                                      )}
                                      <button
                                        onClick={(e) => {
                                           e.stopPropagation();
                                           toast.success(`Vendor confirmed for ${sub.vendor?.business_name}`);
                                        }}
                                        className="flex-1 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 font-bold text-xs transition-colors flex items-center justify-center gap-1 shadow-soft"
                                      >
                                        <CheckCircle2 className="h-3.5 w-3.5" /> Confirm
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="flex items-start gap-4 z-10 relative">
                              <div className="bg-card p-1 mt-1">
                                <Store className="h-4 w-4 text-emerald-600" />
                              </div>
                              <div>
                                <div className="text-[10px] text-emerald-600 font-bold uppercase mb-1">
                                  Pickup
                                </div>
                                <div className="font-bold">{o.vendor?.business_name}</div>
                                <div className="text-xs text-muted-foreground">{o.vendor?.address}</div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-start gap-4">
                          <div className="z-10 bg-card p-1">
                            <MapPin className="h-4 w-4 text-rose-600" />
                          </div>
                          <div>
                            <div className="text-[10px] text-rose-600 font-bold uppercase mb-1">
                              Dropoff
                            </div>
                            <div className="font-bold">{o.user?.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {o.address?.street_address}
                            </div>
                            {(() => {
                              const isPaid = String(o.payment_status || "").toUpperCase() === "PAID";
                              const advAmount = Number(o.advance_paid ?? o.payment?.amount ?? 0);
                              const totAmount = Number(o.total_amount || 0);
                              const isPartialAdvance = !isCod && isPaid && advAmount > 0 && advAmount < totAmount;
                              const balAmount = isPartialAdvance ? Math.max(0, Math.round((totAmount - advAmount) * 100) / 100) : (isCod ? totAmount : 0);

                              if (isCod) {
                                return (
                                  <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                                    <div className="font-black text-sm text-amber-600">
                                      Collect Cash/UPI: ₹{totAmount.toFixed(2)}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setUpiQrModalOrder(o);
                                      }}
                                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 px-2.5 py-1 rounded-lg transition-colors"
                                    >
                                      <QrCode className="h-3 w-3" /> Show UPI QR
                                    </button>
                                  </div>
                                );
                              }
                              if (isPartialAdvance) {
                                return (
                                  <div className="mt-2 space-y-0.5">
                                    <div className="font-black text-sm text-amber-600">
                                      Collect Balance: ₹{balAmount.toFixed(2)}
                                    </div>
                                    <div className="text-[11px] text-teal-700 font-bold">
                                      (Advance ₹{advAmount.toFixed(2)} paid online)
                                    </div>
                                  </div>
                                );
                              }
                              return (
                                <div className="mt-2 font-black text-sm text-emerald-600">
                                  Paid online in full: ₹{totAmount.toFixed(2)}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      <div className="p-3 bg-muted/50 border-t border-border flex flex-col gap-2">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setDetailsOrder(o);
                              setDetailsModalOpen(true);
                            }}
                            className="flex-1 py-3 rounded-xl bg-card border border-border text-foreground hover:bg-muted font-bold text-sm transition-colors flex items-center justify-center gap-2"
                          >
                            <Info className="h-4 w-4 text-emerald-600" /> Order Details
                          </button>
                          <button
                            onClick={() => {
                              // Vendor Location
                              const vLat = o.vendor?.lat || 0;
                              const vLng = o.vendor?.lng || 0;
                              // Customer Location
                              const cLat = o.address?.lat || 0;
                              const cLng = o.address?.lng || 0;

                              // Delivery Partner Location (Using dummy current location for now, or could use navigator.geolocation)
                              // We will just show Vendor to Customer if Out for Delivery, or Rider to Vendor if not picked up.
                              if (o.status === "CONFIRMED" || o.status === "READY_FOR_PICKUP") {
                                setMapData({
                                  title: "Route to Pickup",
                                  startLocation: {
                                    lat: partner.current_lat || vLat - 0.01,
                                    lng: partner.current_lng || vLng - 0.01,
                                    label: "Your Location",
                                  },
                                  endLocation: {
                                    lat: vLat,
                                    lng: vLng,
                                    label: o.vendor?.business_name || "Vendor",
                                  },
                                });
                              } else {
                                setMapData({
                                  title: "Route to Dropoff",
                                  startLocation: {
                                    lat: vLat,
                                    lng: vLng,
                                    label: o.vendor?.business_name || "Vendor",
                                  },
                                  endLocation: {
                                    lat: cLat,
                                    lng: cLng,
                                    label: o.user?.name || "Customer",
                                  },
                                });
                              }
                              setMapModalOpen(true);
                            }}
                            className="flex-1 py-3 rounded-xl bg-slate-200 text-slate-700 hover:bg-slate-300 font-bold text-sm transition-colors flex items-center justify-center gap-2"
                          >
                            <Navigation className="h-4 w-4" /> View Route
                          </button>
                        </div>

                        
                        {/* Sub-orders Sequence UI */}
                        {o.sub_orders && o.sub_orders.length > 0 && o.status !== "OUT_FOR_DELIVERY" && o.status !== "DELIVERED" && (
                          <div className="flex flex-col gap-2 mt-4">
                            {(() => {
                              const pendingCount = o.sub_orders.filter((s: any) => s.status === "PENDING").length;
                              if (pendingCount > 0) {
                                return (
                                  <div className="bg-amber-100 border border-amber-300 text-amber-900 p-3 rounded-xl text-sm font-bold flex gap-2 items-start shadow-sm mb-2">
                                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" />
                                    <span>
                                      Wait! {pendingCount} store(s) have not accepted this order yet. Contact them or pick up from the ready stores first.
                                    </span>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                              Pickup Sequence ({o.sub_orders.length} Stores)
                            </div>
                            {o.sub_orders.map((sub: any, idx: number) => {
                              const isReady = sub.status === "READY_FOR_PICKUP" || sub.status === "PREPARING";
                              const isPickedUp = sub.status === "PICKED_UP" || sub.status === "OUT_FOR_DELIVERY" || sub.status === "DELIVERED";
                              
                              return (
                                <div key={sub.id} className="flex flex-col gap-2 p-3.5 rounded-2xl border border-border bg-card shadow-sm">
                                  <div className="flex justify-between items-center">
                                    <div className="font-bold text-sm">
                                      {idx + 1}. {sub.vendor?.business_name || "Vendor"}
                                    </div>
                                    <div className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${isPickedUp ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                      {isPickedUp ? "Picked Up" : sub.status.replace(/_/g, " ")}
                                    </div>
                                  </div>
                                  <div className="text-xs text-muted-foreground">{sub.vendor?.address}</div>

                                  {/* Store Items List */}
                                  {sub.items && sub.items.length > 0 && (
                                    <div className="space-y-1.5 my-1.5 pt-2 border-t border-border/60">
                                      <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                        Items to collect ({sub.items.length}):
                                      </div>
                                      {sub.items.map((it: any, i: number) => (
                                        <div key={it.id || i} className="flex justify-between items-center text-xs bg-muted/30 px-2.5 py-1.5 rounded-lg">
                                          <span className="font-semibold text-foreground truncate pr-2">
                                            • {it.product_name} <span className="text-muted-foreground font-normal">× {it.quantity} {it.selected_unit || it.unit || ""}</span>
                                          </span>
                                          <span className="font-bold text-muted-foreground shrink-0">₹{it.total_price || (it.unit_price * it.quantity)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  
                                  {!isPickedUp && (
                                    <div className="flex flex-col gap-2 mt-2">
                                      <div className="flex gap-2">
                                        <a
                                          href={`tel:${sub.vendor?.phone}`}
                                          className="flex-1 py-2 text-xs rounded-lg font-bold transition-colors bg-slate-200 text-slate-700 hover:bg-slate-300 flex items-center justify-center gap-1"
                                        >
                                          <Phone className="h-3 w-3" /> Call
                                        </a>
                                        <button
                                          onClick={() => notifyVendorMutation.mutate({ orderId: o.id, subId: sub.id })}
                                          className="flex-1 py-2 text-xs rounded-lg font-bold transition-colors bg-indigo-100 text-indigo-700 hover:bg-indigo-200 flex items-center justify-center gap-1"
                                        >
                                          <Bell className="h-3 w-3" /> Notify
                                        </button>
                                        <button
                                          disabled={!isReady}
                                          onClick={() => confirmPickupMutation.mutate({ orderId: o.id, subId: sub.id })}
                                          className="flex-1 py-2 text-xs rounded-lg font-bold transition-colors bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                                        >
                                          <CheckCircle2 className="h-3 w-3" /> Picked Up
                                        </button>
                                      </div>
                                      <button
                                        onClick={() => {
                                          if (window.confirm("Is the vendor unreachable or closed? Report this to Admin to get help or bypass this pickup.")) {
                                            reportIssueMutation.mutate({ orderId: o.id, subId: sub.id });
                                          }
                                        }}
                                        className="w-full py-2 text-xs rounded-lg font-bold transition-colors border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center gap-1"
                                      >
                                        <AlertCircle className="h-3 w-3" /> Report Issue (Vendor Unreachable)
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className="flex gap-2 mt-4">
                          {o.status === "CONFIRMED" || o.status === "READY_FOR_PICKUP" || o.status === "PREPARING" || o.status === "PICKED_UP" ? (
                            <button
                              onClick={() => {
                                const allPickedUp = o.sub_orders ? o.sub_orders.every((sub: any) => sub.status === "PICKED_UP" || sub.status === "OUT_FOR_DELIVERY" || sub.status === "DELIVERED" || sub.status === "CANCELLED") : true;
                                if (!allPickedUp) {
                                  toast.error("You must confirm pickup from all active stores first.");
                                  return;
                                }
                                updateStatusMutation.mutate({
                                  orderId: o.id,
                                  status: "out_for_delivery",
                                });
                              }}
                              className="flex-1 py-3 rounded-xl font-bold text-sm transition-colors bg-purple-600 text-white hover:bg-purple-500"
                            >
                              Start Customer Delivery
                            </button>
                          ) : o.status === "OUT_FOR_DELIVERY" ? (
                             <button
                               onClick={() => {
                                 setSelectedOrderId(o.id);
                                 setOtpValue("");
                                 setOtpModalOpen(true);
                               }}
                               className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
                             >
                               <CheckCircle2 className="h-4 w-4" /> Mark Delivered
                             </button>
                          ) : (
                             <button
                               disabled
                               className="flex-1 py-3 rounded-xl font-bold text-sm transition-colors bg-muted text-muted-foreground"
                             >
                               Out for Delivery
                             </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* EARNINGS TAB */}
        {activeTab === "earnings" && <DeliveryWalletTab />}

        {/* HISTORY TAB */}
        {activeTab === "history" && <DeliveryHistory />}

        {/* PROFILE TAB */}
        {activeTab === "profile" && <DeliveryProfile partner={partner} />}

        {/* SETTINGS TAB */}
        {activeTab === "settings" && <DeliverySettings />}
      </main>

      {/* BOTTOM NAVIGATION */}
      <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-border pb-safe">
        <div className="flex justify-around items-center h-20 px-4">
          <button
            onClick={() => setActiveTab("requests")}
            className={`flex flex-col items-center gap-1.5 w-20 transition-colors relative ${activeTab === "requests" ? "text-emerald-600" : "text-muted-foreground"}`}
          >
            <div className="relative">
              <Radio className={`h-6 w-6 ${activeTab === "requests" ? "animate-pulse" : ""}`} />
              {requests.length > 0 && (
                <span className="absolute -top-1.5 -right-2.5 bg-emerald-600 text-white text-[10px] font-black h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center border-2 border-background shadow-md animate-bounce">
                  {requests.length}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider">Radar</span>
          </button>

          <button
            onClick={() => setActiveTab("active")}
            className="relative -top-4 bg-emerald-600 text-white h-16 w-16 rounded-full flex flex-col items-center justify-center gap-0.5 shadow-soft border-4 border-background"
            aria-label="Active deliveries"
          >
            <Navigation className="h-5 w-5" />
            <span className="text-[8px] font-black uppercase tracking-wider leading-none">
              Active
            </span>
            {activeOrders.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-600 text-white h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-background shadow-lg">
                {activeOrders.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("earnings")}
            className={`flex flex-col items-center gap-1.5 w-20 transition-colors ${activeTab === "earnings" ? "text-emerald-600" : "text-muted-foreground"}`}
          >
            <Wallet className="h-6 w-6" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Wallet</span>
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`flex flex-col items-center gap-1.5 w-20 transition-colors ${activeTab === "history" ? "text-emerald-600" : "text-muted-foreground"}`}
          >
            <Clock className="h-6 w-6" />
            <span className="text-[10px] font-bold uppercase tracking-wider">History</span>
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`flex flex-col items-center gap-1.5 w-20 transition-colors ${activeTab === "settings" ? "text-emerald-600" : "text-muted-foreground"}`}
          >
            <Settings className="h-6 w-6" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Settings</span>
          </button>
        </div>
      </div>

      {/* OTP MODAL */}
      <Dialog open={otpModalOpen} onOpenChange={setOtpModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enter Delivery OTP</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ask the customer for the 6-digit OTP to confirm delivery.
            </p>
            <Input
              type="text"
              placeholder="Enter 6-digit OTP"
              value={otpValue}
              onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="text-center text-lg tracking-[0.3em]"
              maxLength={6}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setOtpModalOpen(false);
                  setSelectedOrderId(null);
                  setOtpValue("");
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (otpValue.length === 6 && selectedOrderId) {
                    api
                      .put(`/delivery/order/${selectedOrderId}/delivered`, { otp: otpValue })
                      .then(() => {
                        toast.success("Order marked as delivered!");
                        queryClient.invalidateQueries({ queryKey: ["myDeliveries"] });
                        setOtpModalOpen(false);
                        setSelectedOrderId(null);
                        setOtpValue("");
                      })
                      .catch((err) => toast.error(err?.message || "Failed to mark delivered"));
                  } else {
                    toast.error("Please enter a valid 6-digit OTP");
                  }
                }}
                disabled={otpValue.length !== 6}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500"
              >
                Confirm Delivery
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ETA MODAL */}
      <Dialog open={etaModalOpen} onOpenChange={setEtaModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Estimated Time of Arrival</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Provide an ETA in minutes for reaching the vendor and customer.
            </p>
            <Input
              type="number"
              placeholder="e.g. 15"
              value={etaValue}
              onChange={(e) => setEtaValue(e.target.value)}
              className="text-lg"
              min={1}
              max={120}
            />
            {(() => {
              const orderToAccept = requestsRes?.data?.find((r: any) => r.id === acceptingOrderId);
              const pendingCount = orderToAccept?.sub_orders?.filter((s: any) => s.status === "PENDING").length || 0;
              if (pendingCount > 0) {
                return (
                  <div className="bg-rose-50 text-rose-700 p-3 rounded-xl border border-rose-200 text-sm font-medium my-4 flex gap-2 items-start shadow-sm">
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-rose-600" />
                    <span>
                      <strong>Notice:</strong> Some vendors are still reviewing this order. By accepting now, you secure the delivery route, but you may need to wait at their locations before the items are ready.
                    </span>
                  </div>
                );
              }
              return null;
            })()}
            <div className="flex gap-2 mt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEtaModalOpen(false);
                  setAcceptingOrderId(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const minutes = parseInt(etaValue, 10);
                  if (minutes > 0 && acceptingOrderId) {
                    acceptMutation.mutate({ id: acceptingOrderId, eta_minutes: minutes });
                  } else {
                    toast.error("Please enter a valid ETA in minutes");
                  }
                }}
                disabled={!etaValue || acceptMutation.isPending}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500"
              >
                {acceptMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Confirm & Accept"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* FULL ORDER DETAILS MODAL FOR DELIVERY PARTNERS */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl p-0 border border-border bg-card">
          {detailsOrder && (
            <div className="space-y-5 p-6">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-border pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display font-black text-xl">
                      Order #{detailsOrder.order_number || detailsOrder.id.substring(0, 8)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {detailsOrder.created_at
                      ? new Date(detailsOrder.created_at).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "Recent order"}
                  </div>
                </div>
                <div className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-black uppercase tracking-wider">
                  {String(detailsOrder.status || "CONFIRMED").replace(/_/g, " ")}
                </div>
              </div>

              {/* Pickup Details (Multi-Store or Single Store) */}
              {detailsOrder.sub_orders && detailsOrder.sub_orders.length > 1 ? (
                <div className="space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
                    <Store className="h-4 w-4" /> Pickup Locations ({detailsOrder.sub_orders.length} Stores)
                  </div>
                  <div className="space-y-2.5">
                    {detailsOrder.sub_orders.map((sub: any, sIdx: number) => (
                      <div key={sub.id || sIdx} className="rounded-2xl bg-muted/40 border border-border p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                            Pickup {sIdx + 1} of {detailsOrder.sub_orders.length}
                          </span>
                          {sub.vendor?.phone && (
                            <a
                              href={`tel:${sub.vendor.phone}`}
                              className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-600 text-white px-2.5 py-1 rounded-full shadow-sm hover:bg-emerald-500 transition-colors"
                            >
                              <Phone className="h-3 w-3" /> Call Store
                            </a>
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-foreground">
                            {sub.vendor?.business_name || "Merchant Store"}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {sub.vendor?.address || "Store Address"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-muted/40 border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600">
                      <Store className="h-4 w-4" /> 1. Pickup From Store
                    </div>
                    {detailsOrder.vendor?.phone && (
                      <a
                        href={`tel:${detailsOrder.vendor.phone}`}
                        className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-600 text-white px-3 py-1 rounded-full shadow-sm hover:bg-emerald-500 transition-colors"
                      >
                        <Phone className="h-3 w-3" /> Call Store
                      </a>
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-base text-foreground">
                      {detailsOrder.vendor?.business_name || "Merchant Store"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {detailsOrder.vendor?.address || "Store Address"}
                      {detailsOrder.vendor?.city ? `, ${detailsOrder.vendor.city}` : ""}
                    </div>
                  </div>
                </div>
              )}

              {/* Customer Dropoff Details */}
              <div className="rounded-2xl bg-muted/40 border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-600">
                    <MapPin className="h-4 w-4" /> Dropoff To Customer
                  </div>
                  {(detailsOrder.user?.phone || detailsOrder.address?.phone) && (
                    <a
                      href={`tel:${detailsOrder.user?.phone || detailsOrder.address?.phone}`}
                      className="inline-flex items-center gap-1 text-xs font-bold bg-rose-600 text-white px-3 py-1 rounded-full shadow-sm hover:bg-rose-500 transition-colors"
                    >
                      <Phone className="h-3 w-3" /> Call Customer
                    </a>
                  )}
                </div>
                <div>
                  <div className="font-bold text-base text-foreground">
                    {detailsOrder.user?.name || "Customer"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {detailsOrder.address?.street_address || detailsOrder.address?.full_address || "Customer Address"}
                  </div>
                  {(detailsOrder.user?.phone || detailsOrder.address?.phone) && (
                    <div className="text-xs font-medium text-foreground mt-1">
                      📱 Phone: {detailsOrder.user?.phone || detailsOrder.address?.phone}
                    </div>
                  )}
                </div>
              </div>

              {/* Items List (Grouped by store for multivendor or single list) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Package className="h-4 w-4 text-primary" /> Items to Deliver ({detailsOrder.items?.length || 0})
                  </h4>
                </div>

                {detailsOrder.sub_orders && detailsOrder.sub_orders.length > 1 ? (
                  <div className="space-y-3">
                    {detailsOrder.sub_orders.map((sub: any, sIdx: number) => (
                      <div key={sub.id || sIdx} className="rounded-2xl border border-border bg-card p-3.5 space-y-2.5">
                        <div className="flex justify-between items-center pb-2 border-b border-border">
                          <span className="text-xs font-bold text-foreground">
                            {sIdx + 1}. {sub.vendor?.business_name || `Store ${sIdx + 1}`} ({sub.items?.length || 0} items)
                          </span>
                        </div>
                        <div className="divide-y divide-border/60">
                          {(sub.items || []).map((item: any, idx: number) => (
                            <div key={item.id || idx} className="py-2.5 flex items-center gap-3">
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt={item.product_name}
                                  className="h-10 w-10 rounded-xl object-cover border border-border bg-muted shrink-0"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-xl bg-muted border border-border flex items-center justify-center shrink-0">
                                  <Package className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-xs truncate text-foreground">
                                  {item.product_name}
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                  Qty: <span className="font-semibold text-foreground">{item.quantity}</span>
                                  {item.selected_unit || item.unit ? ` (${item.selected_unit || item.unit})` : ""}
                                </div>
                              </div>
                              <div className="text-right font-bold text-xs text-foreground shrink-0">
                                ₹{item.total_price || (item.unit_price ? item.unit_price * item.quantity : 0)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden">
                    {(detailsOrder.items || []).map((item: any, idx: number) => (
                      <div key={item.id || idx} className="p-3.5 flex items-center gap-3">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.product_name}
                            className="h-12 w-12 rounded-xl object-cover border border-border bg-muted shrink-0"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-xl bg-muted border border-border flex items-center justify-center shrink-0">
                            <Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm truncate text-foreground">
                            {item.product_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Qty: <span className="font-semibold text-foreground">{item.quantity}</span>
                            {item.selected_unit || item.unit ? ` (${item.selected_unit || item.unit})` : ""}
                            {item.unit_price ? ` · ₹${item.unit_price} each` : ""}
                          </div>
                        </div>
                        <div className="text-right font-bold text-sm text-foreground shrink-0">
                          ₹{item.total_price || (item.unit_price ? item.unit_price * item.quantity : 0)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Billing Breakdown */}
              <div className="rounded-2xl border border-border bg-card p-4 space-y-2 text-xs">
                <div className="flex justify-between text-muted-foreground font-medium">
                  <span>Items Subtotal</span>
                  <span>₹{detailsOrder.subtotal || Math.max(0, detailsOrder.total_amount - (detailsOrder.delivery_fee || 0))}</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Your Delivery Earning</span>
                  <span>+₹{detailsOrder.delivery_fee}</span>
                </div>
                {detailsOrder.discount > 0 && (
                  <div className="flex justify-between text-primary font-medium">
                    <span>Discount</span>
                    <span>-₹{detailsOrder.discount}</span>
                  </div>
                )}
                {detailsOrder.tax > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Taxes</span>
                    <span>₹{detailsOrder.tax}</span>
                  </div>
                )}
                <div className="border-t border-border pt-2 flex justify-between font-black text-sm text-foreground">
                  <span>Total Order Amount</span>
                  <span>₹{detailsOrder.total_amount}</span>
                </div>
                <div className="pt-2 flex items-center justify-between">
                  <span className="font-bold text-[11px] text-muted-foreground">Payment Mode:</span>
                  {(() => {
                    const isModalCod = String(detailsOrder.payment_method || "").toUpperCase() === "COD";
                    const isModalPaid = String(detailsOrder.payment_status || "").toUpperCase() === "PAID";
                    const modalAdv = Number(detailsOrder.advance_paid ?? detailsOrder.payment?.amount ?? 0);
                    const modalTot = Number(detailsOrder.total_amount || 0);
                    const modalIsPartial = !isModalCod && isModalPaid && modalAdv > 0 && modalAdv < modalTot;
                    const modalBal = modalIsPartial ? Math.max(0, Math.round((modalTot - modalAdv) * 100) / 100) : (isModalCod ? modalTot : 0);

                    if (isModalCod) {
                      return (
                        <span className="inline-flex items-center gap-1 font-extrabold px-2.5 py-1 rounded-full text-xs bg-amber-100 text-amber-800 border border-amber-300">
                          💵 Collect Cash/UPI: ₹{modalTot.toFixed(2)}
                        </span>
                      );
                    }
                    if (modalIsPartial) {
                      return (
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 font-black px-2.5 py-1 rounded-full text-xs bg-amber-100 text-amber-800 border border-amber-300">
                            💵 Collect Balance: ₹{modalBal.toFixed(2)}
                          </span>
                          <p className="text-[10px] font-bold text-teal-700 mt-0.5">Advance Paid: ₹{modalAdv.toFixed(2)}</p>
                        </div>
                      );
                    }
                    return (
                      <span className="inline-flex items-center gap-1 font-extrabold px-2.5 py-1 rounded-full text-xs bg-emerald-100 text-emerald-800 border border-emerald-300">
                        ✅ Fully Paid Online (Do Not Collect Cash)
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Close Button */}
              <Button
                variant="outline"
                className="w-full h-12 rounded-2xl font-bold"
                onClick={() => setDetailsModalOpen(false)}
              >
                Close Order Details
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MAP MODAL */}
      {mapModalOpen && mapData && (
        <ClientOnly>
          <Suspense fallback={null}>
            <DeliveryMapModal
              open={mapModalOpen}
              onOpenChange={setMapModalOpen}
              title={mapData.title}
              startLocation={mapData.startLocation}
              endLocation={mapData.endLocation}
            />
          </Suspense>
        </ClientOnly>
      )}
      {/* DELIVERY UPI QR MODAL */}
      <Dialog open={!!upiQrModalOrder} onOpenChange={(open) => !open && setUpiQrModalOrder(null)}>
        <DialogContent className="max-w-sm rounded-3xl p-6 text-center space-y-4">
          <DialogHeader>
            <DialogTitle className="text-center text-lg font-bold">Customer UPI Scan & Pay</DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground">
              Show this QR code to the customer to collect payment digitally via Google Pay, PhonePe, Paytm, or BHIM.
            </DialogDescription>
          </DialogHeader>

          {upiQrModalOrder && (
            <>
              <div className="p-4 bg-white rounded-2xl border shadow-inner inline-block mx-auto">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                    `upi://pay?pa=vegamart@icici&pn=Vegamart&am=${Number(upiQrModalOrder.total_amount || upiQrModalOrder.total || 0).toFixed(2)}&tn=Order_${upiQrModalOrder.order_number || upiQrModalOrder.id}&cu=INR`
                  )}`}
                  alt="UPI QR Code"
                  className="h-48 w-48 object-contain mx-auto"
                />
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground font-semibold">Amount to Collect</div>
                <div className="text-2xl font-black text-emerald-600 tabular-nums">
                  ₹{Number(upiQrModalOrder.total_amount || upiQrModalOrder.total || 0).toFixed(2)}
                </div>
                <div className="text-[11px] text-muted-foreground font-mono">
                  Order #{upiQrModalOrder.order_number || upiQrModalOrder.id}
                </div>
              </div>

              <div className="pt-2">
                <Button
                  variant="outline"
                  className="w-full h-11 rounded-2xl font-bold"
                  onClick={() => {
                    setUpiQrModalOrder(null);
                    refetchRequests();
                  }}
                >
                  Close / Refresh
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// KYC FORM (Light Mode)
function DeliveryKYCForm({
  partner,
  initialData,
  onSuccess,
}: {
  partner: any;
  initialData: any;
  onSuccess: () => void;
}) {
  const [aadhaar, setAadhaar] = useState(initialData?.aadhaar_number || "");
  const [pan, setPan] = useState(initialData?.pan_number || "");
  const [drivingLicense, setDrivingLicense] = useState(initialData?.driving_license || "");

  const submitKYCMutation = useMutation({
    mutationFn: (data: any) => api.post("/delivery/me/kyc", data),
    onSuccess: () => {
      toast.success("Documents submitted!");
      onSuccess();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to submit KYC");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitKYCMutation.mutate({
      aadhaar_number: aadhaar,
      pan_number: pan,
      driving_license: drivingLicense,
    });
  };

  return (
    <div className="bg-card rounded-3xl p-6 border border-border mt-10 shadow-soft">
      <div className="text-center space-y-2 mb-8">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 mb-4">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h2 className="font-display text-2xl font-bold">Identity Verification</h2>
        <p className="text-sm text-muted-foreground">
          Provide your documents to activate your rider account.
        </p>
      </div>

      {initialData?.status === "rejected" && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 flex gap-3 text-rose-700 text-sm mb-6">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <div className="font-bold">Rejected</div>
            <div className="mt-1">{initialData.rejection_reason || "Invalid documents."}</div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block">
          <div className="mb-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Driving License
          </div>
          <input
            type="text"
            value={drivingLicense}
            onChange={(e) => setDrivingLicense(e.target.value.toUpperCase())}
            placeholder="MH02 20110012345"
            required
            className="w-full rounded-2xl bg-muted border border-border h-14 px-4 text-sm font-bold text-foreground outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
          />
        </label>

        <label className="block">
          <div className="mb-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Aadhaar Number
          </div>
          <input
            type="text"
            value={aadhaar}
            onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, ""))}
            placeholder="1234 5678 9012"
            maxLength={12}
            required
            className="w-full rounded-2xl bg-muted border border-border h-14 px-4 text-sm font-bold text-foreground outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
          />
        </label>

        <label className="block">
          <div className="mb-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
            PAN Number
          </div>
          <input
            type="text"
            value={pan}
            onChange={(e) => setPan(e.target.value.toUpperCase())}
            placeholder="ABCDE1234F"
            maxLength={10}
            required
            className="w-full rounded-2xl bg-muted border border-border h-14 px-4 text-sm font-bold text-foreground outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all uppercase"
          />
        </label>

        <button
          type="submit"
          disabled={submitKYCMutation.isPending}
          className="w-full rounded-2xl bg-emerald-600 text-white font-black text-lg h-14 mt-4 flex items-center justify-center hover:bg-emerald-500 active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          {submitKYCMutation.isPending ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            "Submit Documents"
          )}
        </button>
      </form>
    </div>
  );
}
