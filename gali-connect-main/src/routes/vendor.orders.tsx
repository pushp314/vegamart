import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Bike, Check, Loader2, Search, Filter, ShoppingBag, Clock, CheckCircle2, X, Phone, Store, User, CreditCard, Banknote, MapPin, ExternalLink, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getDeliveryOptionInfo, getPaymentMethodInfo, getOrderStatusInfo } from "@/lib/order-helpers";

type VendorOrdersSearch = {
  highlight?: string;
};

export const Route = createFileRoute("/vendor/orders")({
  validateSearch: (search: Record<string, unknown>): VendorOrdersSearch => {
    return {
      highlight: typeof search.highlight === "string" ? search.highlight : undefined,
    };
  },
  component: VendorOrdersPage,
});

function VendorOrdersPage() {
  const { highlight } = useSearch({ from: "/vendor/orders" });
  const queryClient = useQueryClient();
  const [otpTarget, setOtpTarget] = useState<any | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [rejectTarget, setRejectTarget] = useState<{ orderId: string; item: any } | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState(highlight || "");

  useEffect(() => {
    if (highlight) {
      setSearchQuery(highlight);
      setStatusFilter("ALL");
      const timer = setTimeout(() => {
        const el = document.getElementById(`order-card-${highlight}`) || document.querySelector(`[data-order-id="${highlight}"]`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [highlight]);

  const playDing = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
      
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {}
  };

  const prevOrdersRef = useRef<Set<string>>(new Set());

  const { data: vendorRes } = useQuery({
    queryKey: ["vendorProfile"],
    queryFn: () => api.get<{ data: any }>("/vendors/me"),
  });
  const vendor = vendorRes?.data?.data || vendorRes?.data;

  const { data: ordersRes, isLoading: ordersLoading } = useQuery({
    queryKey: ["vendorOrders"],
    queryFn: () => api.get<any[]>("/orders/vendor"),
    enabled: !!vendor?.id,
  });
  const vendorOrders = ordersRes?.data || [];

  useEffect(() => {
    if (vendorOrders.length > 0) {
      const currentPendingIds = vendorOrders.filter((o: any) => o.status?.toUpperCase() === 'PENDING').map((o: any) => o.id);
      const hasNewPending = currentPendingIds.some((id: string) => !prevOrdersRef.current.has(id));
      if (hasNewPending && prevOrdersRef.current.size > 0) {
        playDing();
        toast.success("New order arrived!", { icon: "🔔" });
      }
      prevOrdersRef.current = new Set(currentPendingIds);
    }
  }, [vendorOrders]);

  // Filter orders
  const filteredOrders = vendorOrders.filter((o: any) => {
    const matchesSearch =
      (o.order_number || o.id).toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.customer_name || "").toLowerCase().includes(searchQuery.toLowerCase());

    const isLive = ["CONFIRMED", "PREPARING", "PACKED", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"].includes(
      (o.status || "").toUpperCase()
    );

    if (statusFilter === "ALL") return matchesSearch;
    if (statusFilter === "BOOKED") return matchesSearch && o.status?.toUpperCase() === "PENDING";
    if (statusFilter === "LIVE") return matchesSearch && isLive;
    if (statusFilter === "DELIVERED") return matchesSearch && o.status?.toUpperCase() === "DELIVERED";
    if (statusFilter === "CANCELLED") return matchesSearch && (o.status?.toUpperCase() === "CANCELLED" || o.status?.toUpperCase() === "REFUNDED");
    return matchesSearch;
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: ({
      orderId,
      status,
      otpCode,
    }: {
      orderId: string;
      status: string;
      otpCode?: string;
    }) => {
      const VENDOR_ORDER_STATUS_MAP: Record<string, string> = {
        accepted: "CONFIRMED",
        preparing: "PREPARING",
        packed: "PACKED",
        ready_for_pickup: "READY_FOR_PICKUP",
        out_for_delivery: "OUT_FOR_DELIVERY",
        delivered: "DELIVERED",
      };
      return api.patch(`/vendors/orders/${orderId}/status`, {
        status: VENDOR_ORDER_STATUS_MAP[status] || status,
        otp_code: otpCode,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorOrders"] });
      setOtpTarget(null);
      setOtpInput("");
      toast.success("Order status updated successfully");
      setOtpTarget(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update order status");
    },
  });

  const rejectItemMutation = useMutation({
    mutationFn: async ({ orderId, itemId }: { orderId: string; itemId: string }) => {
      const res = await api.post(`/vendors/orders/${orderId}/items/${itemId}/reject`);
      if (!res.success) {
        throw new Error(res.error?.message || "Failed to reject item");
      }
      return res.data;
    },
    onSuccess: () => {
      setRejectTarget(null);
      toast.success("Item rejected. Order bill updated and customer notified.");
      queryClient.invalidateQueries({ queryKey: ["vendorOrders"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to reject item");
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Order Management</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage incoming live orders, update preparation status, and verify customer OTPs.
          </p>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by Order # or Customer name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-border bg-card pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: "ALL", label: `All (${vendorOrders.length})` },
            {
              id: "BOOKED",
              label: `New Bookings (${vendorOrders.filter((o: any) => (o.status || "").toUpperCase() === "PENDING").length})`,
            },
            {
              id: "LIVE",
              label: `Active (${
                vendorOrders.filter((o: any) =>
                  ["CONFIRMED", "PREPARING", "PACKED", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"].includes(
                    (o.status || "").toUpperCase()
                  )
                ).length
              })`,
            },
            {
              id: "DELIVERED",
              label: `Delivered (${vendorOrders.filter((o: any) => o.status?.toUpperCase() === "DELIVERED").length})`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-2 text-xs rounded-xl font-bold whitespace-nowrap transition-all ${
                statusFilter === tab.id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      {ordersLoading ? (
        <div className="flex justify-center py-16 text-muted-foreground gap-2 text-xs">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
          <span>Fetching orders...</span>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card p-12 text-center space-y-3 shadow-xl">
          <ShoppingBag className="h-12 w-12 mx-auto text-emerald-500 opacity-60" />
          <h3 className="font-bold text-sm">No orders found</h3>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            {searchQuery
              ? "No orders match your search term."
              : "New customer orders will appear here in real-time."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((o: any) => {
            const getNextStatuses = (currentStatus: string, orderData: any) => {
              const statusFlow: Record<
                string,
                { status: string; label: string; color: string }[]
              > = {
                PENDING: [
                  {
                    status: "accepted",
                    label: "Accept Order",
                    color: "bg-emerald-500 text-black hover:bg-emerald-400 font-bold",
                  },
                  {
                    status: "CANCELLED",
                    label: "Cancel Order",
                    color: "bg-rose-100 text-rose-600 hover:bg-rose-200 font-bold border border-rose-200",
                  }
                ],
                CONFIRMED: [
                  {
                    status: "preparing",
                    label: "Start Preparing",
                    color: "bg-blue-600 text-white hover:bg-blue-500 font-bold",
                  },
                  {
                    status: "delivered",
                    label: "🔑 Verify OTP & Deliver",
                    color: "bg-emerald-600 text-white hover:bg-emerald-500 font-bold border border-emerald-500",
                  },
                  {
                    status: "CANCELLED",
                    label: "Cancel Order",
                    color: "bg-rose-100 text-rose-600 hover:bg-rose-200 font-bold border border-rose-200",
                  }
                ],
                PREPARING: [
                  {
                    status: "packed",
                    label: "Mark Packed",
                    color: "bg-indigo-600 text-white hover:bg-indigo-500 font-bold",
                  },
                  {
                    status: "delivered",
                    label: "🔑 Verify OTP & Deliver",
                    color: "bg-emerald-600 text-white hover:bg-emerald-500 font-bold border border-emerald-500",
                  },
                ],
                PACKED: [
                  {
                    status: "ready_for_pickup",
                    label: "Ready for Pickup",
                    color: "bg-cyan-600 text-white hover:bg-cyan-500 font-bold",
                  },
                  {
                    status: "delivered",
                    label: "🔑 Verify OTP & Deliver",
                    color: "bg-emerald-600 text-white hover:bg-emerald-500 font-bold border border-emerald-500",
                  },
                ],
                READY_FOR_PICKUP: [
                  {
                    status: "out_for_delivery",
                    label: "Out for Delivery",
                    color: "bg-amber-600 text-white hover:bg-amber-500 font-bold",
                  },
                  {
                    status: "delivered",
                    label: "🔑 Verify OTP & Deliver",
                    color: "bg-emerald-600 text-white hover:bg-emerald-500 font-bold border border-emerald-500",
                  },
                ],
                OUT_FOR_DELIVERY: [
                  {
                    status: "delivered",
                    label: "🔑 Verify OTP & Complete",
                    color: "bg-emerald-600 text-white hover:bg-emerald-500 font-bold border border-emerald-500",
                  },
                ],
              };
              
              let available = statusFlow[currentStatus?.toUpperCase()] || [];
              if (orderData?.master_order?._count?.orders > 1) {
                // If it's a multi-store route, the vendor cannot handle the final delivery themselves
                available = available.filter(
                  (s) => s.status !== "delivered" && s.status !== "out_for_delivery"
                );
              }
              
              return available;
            };

            const nextStatuses = getNextStatuses(o.status, o);
            const dInfo = getDeliveryOptionInfo(o.delivery_note || o.delivery_option);
            const sInfo = getOrderStatusInfo(o.status);
            const pInfo = getPaymentMethodInfo(
              o.payment_method,
              o.payment_status,
              Number(o.total || 0),
              dInfo.id === "self_pickup",
              o.payment?.amount != null ? Number(o.payment.amount) : null
            );
            const DIcon = dInfo.icon;
            const SIcon = sInfo.icon;
            const PIcon = pInfo.icon;
            const isHighlighted = Boolean(
              highlight &&
                (o.id === highlight ||
                  o.order_number === highlight ||
                  o.id.toLowerCase().includes(highlight.toLowerCase()) ||
                  o.order_number?.toLowerCase().includes(highlight.toLowerCase()))
            );

            return (
              <div
                key={o.id}
                id={`order-card-${o.id}`}
                data-order-id={o.id}
                className={`rounded-3xl border bg-card p-6 space-y-4 transition-all duration-300 ${
                  isHighlighted
                    ? "border-2 border-emerald-500 ring-4 ring-emerald-500/20 shadow-2xl scale-[1.005] bg-emerald-50/10 dark:bg-emerald-950/10"
                    : "border-border shadow-xl hover:shadow-2xl"
                }`}
              >
                {isHighlighted && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-black uppercase tracking-wider w-fit shadow-sm">
                    <Sparkles className="h-3.5 w-3.5" /> Selected Order
                  </div>
                )}
                
                {o.master_order?._count?.orders > 1 && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-600 text-white text-xs font-black uppercase tracking-wider w-fit shadow-sm">
                    <MapPin className="h-3.5 w-3.5" /> Multi-Store Route
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 font-black text-sm uppercase">
                      #{o.order_number?.slice(-4) || o.id.slice(0, 4)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-sm text-foreground truncate uppercase">
                        Order #{o.order_number || `ORD-${o.id.slice(0, 6)}`}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate">
                        {new Date(o.created_at || Date.now()).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-display text-lg font-black text-emerald-600">
                        ₹{Number(o.total || 0).toLocaleString("en-IN")}
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider border ${sInfo.badgeBg}`}>
                        <SIcon className="h-3 w-3" /> {sInfo.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Delivery Option & Payment Instruction Card */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Delivery Option */}
                  <div className="rounded-2xl bg-muted/30 border border-border/50 p-3.5 space-y-1 text-xs">
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

                  {/* Payment Mode */}
                  <div className="rounded-2xl bg-muted/30 border border-border/50 p-3.5 space-y-1 text-xs">
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
                    <p className="text-muted-foreground text-[11px] font-medium leading-snug">{pInfo.instruction}</p>
                    {pInfo.isPartialAdvance && (
                      <div className="mt-1 pt-1 border-t border-border/50 text-[10.5px] font-bold text-teal-800 dark:text-teal-300">
                        {pInfo.summaryText}
                      </div>
                    )}
                  </div>
                </div>

                {/* Customer Details */}
                {(o.user || o.customer || o.address) && (
                  <div className="rounded-2xl bg-muted/30 p-3.5 text-xs space-y-2 border border-border/50">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Customer & Delivery Details
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{o.user?.name || o.customer?.name || o.customer_name || "Customer"}</p>
                        {(o.user?.phone || o.customer?.phone || o.address?.phone) && (
                          <a
                            href={`tel:${o.customer?.phone || o.user?.phone || o.address?.phone}`}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl hover:bg-emerald-100 transition-colors mt-1"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            {o.customer?.phone || o.user?.phone || o.address?.phone}
                          </a>
                        )}
                        {(o.user?.email || o.customer?.email) && (
                          <p className="text-muted-foreground text-[11px] mt-1">{o.user?.email || o.customer?.email}</p>
                        )}
                      </div>
                      {o.address && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-emerald-600" />
                              {o.address.label || "Delivery Destination"}
                            </p>
                            {o.address.latitude && o.address.longitude && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${o.address.latitude},${o.address.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-emerald-700 hover:underline flex items-center gap-0.5 font-bold"
                              >
                                <ExternalLink className="h-2.5 w-2.5" /> Map
                              </a>
                            )}
                          </div>
                          <p className="text-foreground font-medium leading-snug">
                            {o.address.full_address}
                          </p>
                          {o.address.landmark && (
                            <p className="text-[11px] text-muted-foreground">
                              <strong className="text-foreground">Landmark:</strong> {o.address.landmark}
                            </p>
                          )}
                          <p className="text-[11px] text-muted-foreground">
                            {[o.address.city, o.address.state, o.address.pincode ? `- ${o.address.pincode}` : "", o.address.country || "India"]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                          {o.address.phone && (
                            <a
                              href={`tel:${o.address.phone}`}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline pt-0.5"
                            >
                              <Phone className="h-3 w-3 text-emerald-600" />
                              <span>Address Phone: {o.address.phone}</span>
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Items & Summary */}
                {Array.isArray(o.items) && o.items.length > 0 && (
                  <div className="rounded-2xl border border-border overflow-hidden">
                    <div className="bg-muted/40 p-3 border-b border-border">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Order Items ({o.items.length})
                      </span>
                    </div>
                    <div className="divide-y divide-border/50">
                      {o.items.map((item: any, idx: number) => {
                        const itemImg = item.image_url || item.product?.images?.[0]?.url;
                        const isRejected = item.status === "rejected";
                        return (
                          <div
                            key={idx}
                            className={`flex justify-between items-center p-3 text-xs bg-card hover:bg-muted/30 transition-colors ${
                              isRejected ? "bg-rose-50/20 opacity-60" : ""
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-10 w-10 rounded-xl bg-muted border border-border overflow-hidden shrink-0 grid place-items-center">
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
                                  <ShoppingBag className="h-4 w-4 text-muted-foreground/50" />
                                )}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span
                                  className={`font-bold ${
                                    isRejected
                                      ? "line-through text-muted-foreground"
                                      : "text-foreground"
                                  }`}
                                >
                                  {item.quantity}x{" "}
                                  <span className="font-medium ml-1">
                                    {item.product_name || item.name || item.product?.name || "Item"}
                                  </span>
                                </span>
                                {item.unit && (
                                  <span className="text-[10px] text-muted-foreground">
                                    ({item.unit})
                                  </span>
                                )}
                                {isRejected && (
                                  <span className="text-[10px] text-rose-600 font-bold mt-0.5">
                                    Rejected (Item removed & bill updated)
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span
                                className={`font-semibold ${
                                  isRejected
                                    ? "line-through text-muted-foreground"
                                    : "text-foreground"
                                }`}
                              >
                                ₹
                                {Number(
                                  item.total_price || item.unit_price * item.quantity || 0
                                ).toLocaleString("en-IN")}
                              </span>
                              {!isRejected &&
                                (o.status?.toUpperCase() === "PENDING" ||
                                  o.status?.toUpperCase() === "CONFIRMED") && (
                                  <button
                                    onClick={() =>
                                      setRejectTarget({ orderId: o.id, item })
                                    }
                                    className="text-[10px] flex items-center gap-1 text-rose-600 hover:text-rose-700 font-bold px-2 py-0.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 transition-colors"
                                    disabled={rejectItemMutation.isPending}
                                  >
                                    <X className="h-3 w-3" /> Reject Item
                                  </button>
                                )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="bg-muted/10 p-3 space-y-1.5 border-t border-border/50 text-xs">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Accepted Items Subtotal</span>
                        <span>₹{Number(o.items_subtotal || o.total || 0).toLocaleString("en-IN")}</span>
                      </div>
                      {Number(o.delivery_fee) > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Delivery Fee</span>
                          <span>+ ₹{Number(o.delivery_fee).toLocaleString("en-IN")}</span>
                        </div>
                      )}
                      {Number(o.tax) > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Taxes</span>
                          <span>+ ₹{Number(o.tax).toLocaleString("en-IN")}</span>
                        </div>
                      )}
                      {Number(o.discount) > 0 && (
                        <div className="flex justify-between text-emerald-600 font-medium">
                          <span>Discount</span>
                          <span>- ₹{Number(o.discount).toLocaleString("en-IN")}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-foreground pt-1 border-t border-border/50 mt-1">
                        <span>Total Payable / Paid</span>
                        <span className="text-emerald-600">₹{Number(o.total || 0).toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Status Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <span className="text-xs text-muted-foreground font-medium">
                    Next Action:
                  </span>
                  <div className="flex gap-2">
                    {nextStatuses.length > 0 ? (
                      nextStatuses.map((ns) => (
                        <button
                          key={ns.status}
                          onClick={() => {
                            if (ns.status === "CANCELLED") {
                              if (window.confirm("Are you sure you want to cancel this order? This action cannot be undone and will automatically initiate a refund if paid online.")) {
                                updateOrderStatusMutation.mutate({
                                  orderId: o.id,
                                  status: ns.status,
                                });
                              }
                            } else if (ns.status === "delivered") {
                              setOtpTarget(o);
                              setOtpInput("");
                            } else {
                              updateOrderStatusMutation.mutate({
                                orderId: o.id,
                                status: ns.status,
                              });
                            }
                          }}
                          className={`rounded-2xl px-5 py-2.5 text-xs shadow-md transition-all ${ns.color}`}
                        >
                          {ns.label}
                        </button>
                      ))
                    ) : (o.status?.toUpperCase() === "CANCELLED" || o.status?.toUpperCase() === "REFUNDED") ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600">
                        <X className="h-4 w-4" /> Order {o.status?.toUpperCase() === "REFUNDED" ? "Refunded" : "Cancelled"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                        <CheckCircle2 className="h-4 w-4" /> Order Completed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* OTP Dialog */}
      {/* Delivery OTP Dialog */}
      <Dialog open={!!otpTarget} onOpenChange={(open) => !open && setOtpTarget(null)}>
        <DialogContent className="rounded-3xl border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-center text-emerald-600">
              Verify Customer Delivery OTP
            </DialogTitle>
            <DialogDescription className="text-xs text-center">
              Ask the customer for the 6-digit verification PIN displayed on their live order screen to complete order #{otpTarget?.order_number || otpTarget?.id?.slice(0, 6)}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <input
              type="text"
              maxLength={6}
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-full text-center text-4xl tracking-widest rounded-2xl border border-border bg-muted/50 px-4 py-5 font-display font-black focus:bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            <p className="text-[11px] text-muted-foreground text-center">
              💡 If delivery partner is unavailable or customer is collecting directly, you can complete the order immediately with this OTP.
            </p>
            <button
              onClick={() => {
                if (otpInput.length !== 6) {
                  toast.error("Please enter a valid 6-digit OTP");
                  return;
                }
                updateOrderStatusMutation.mutate({
                  orderId: otpTarget.id,
                  status: "delivered",
                  otpCode: otpInput,
                });
              }}
              disabled={updateOrderStatusMutation.isPending || otpInput.length !== 6}
              className="w-full rounded-2xl bg-emerald-500 text-black px-4 py-3.5 text-xs font-bold shadow-lg disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {updateOrderStatusMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Verify OTP & Complete Delivery
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Item Confirmation Dialog */}
      <Dialog
        open={!!rejectTarget}
        onOpenChange={(open) => !open && setRejectTarget(null)}
      >
        <DialogContent className="rounded-3xl border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-center text-rose-600 flex items-center justify-center gap-2">
              <X className="h-5 w-5" /> Reject Item?
            </DialogTitle>
            <DialogDescription className="text-xs text-center leading-relaxed">
              Are you sure you cannot fulfill{" "}
              <strong className="text-foreground">
                {rejectTarget?.item?.product_name || rejectTarget?.item?.name}
              </strong>
              ?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-3 text-rose-800 text-[11px] space-y-1">
              <p className="font-semibold">Automatic updates will occur:</p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-rose-700">
                <li>This item is removed from the order bill.</li>
                <li>The order total is automatically recalculated.</li>
                <li>The customer is notified in real-time.</li>
                <li>Prepaid amounts are refunded automatically.</li>
              </ul>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="flex-1 rounded-2xl border border-border py-2.5 font-bold text-xs hover:bg-muted/50 transition-colors"
                disabled={rejectItemMutation.isPending}
              >
                Keep Item
              </button>
              <button
                type="button"
                onClick={() => {
                  if (rejectTarget) {
                    rejectItemMutation.mutate({
                      orderId: rejectTarget.orderId,
                      itemId: rejectTarget.item.id,
                    });
                  }
                }}
                disabled={rejectItemMutation.isPending}
                className="flex-1 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white py-2.5 font-bold text-xs shadow-md transition-colors inline-flex items-center justify-center gap-1.5"
              >
                {rejectItemMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                Reject & Update Bill
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
