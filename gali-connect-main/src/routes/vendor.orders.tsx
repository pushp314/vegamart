import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Bike, Check, Loader2, Search, Filter, ShoppingBag, Clock, CheckCircle2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/vendor/orders")({
  component: VendorOrdersPage,
});

function VendorOrdersPage() {
  const queryClient = useQueryClient();
  const [otpTarget, setOtpTarget] = useState<any | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

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

  // Filter orders
  const filteredOrders = vendorOrders.filter((o: any) => {
    const matchesSearch =
      (o.order_number || o.id).toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.customer_name || "").toLowerCase().includes(searchQuery.toLowerCase());

    const isLive = ["PENDING", "CONFIRMED", "PREPARING", "PACKED", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"].includes(
      (o.status || "").toUpperCase()
    );

    if (statusFilter === "ALL") return matchesSearch;
    if (statusFilter === "LIVE") return matchesSearch && isLive;
    if (statusFilter === "DELIVERED") return matchesSearch && o.status?.toUpperCase() === "DELIVERED";
    if (statusFilter === "CANCELLED") return matchesSearch && o.status?.toUpperCase() === "CANCELLED";
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
      toast.success("Order status updated successfully! 🚀");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update order status");
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
            { id: "ALL", label: `All Orders (${vendorOrders.length})` },
            {
              id: "LIVE",
              label: `Active (${
                vendorOrders.filter((o: any) =>
                  ["PENDING", "CONFIRMED", "PREPARING", "PACKED", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"].includes(
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
              className={`px-4 py-2 text-xs rounded-xl font-bold whitespace-nowrap transition-all ${
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
            const getNextStatuses = (currentStatus: string) => {
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
                ],
                PACKED: [
                  {
                    status: "ready_for_pickup",
                    label: "Ready for Pickup",
                    color: "bg-cyan-600 text-white hover:bg-cyan-500 font-bold",
                  },
                ],
                READY_FOR_PICKUP: [
                  {
                    status: "out_for_delivery",
                    label: "Out for Delivery",
                    color: "bg-amber-600 text-white hover:bg-amber-500 font-bold",
                  },
                ],
                OUT_FOR_DELIVERY: [
                  {
                    status: "delivered",
                    label: "Verify OTP & Complete",
                    color: "bg-emerald-600 text-white hover:bg-emerald-500 font-bold",
                  },
                ],
              };
              return statusFlow[currentStatus?.toUpperCase()] || [];
            };

            const nextStatuses = getNextStatuses(o.status);

            return (
              <div
                key={o.id}
                className="rounded-3xl border border-border bg-card p-6 shadow-xl space-y-4 hover:shadow-2xl transition-all"
              >
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
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider border ${
                        o.status?.toUpperCase() === 'DELIVERED' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                        o.status?.toUpperCase() === 'CANCELLED' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' :
                        'bg-amber-500/10 text-amber-600 border-amber-500/20'
                      }`}>
                        {o.status?.toUpperCase() === 'DELIVERED' ? <CheckCircle2 className="h-3 w-3" /> : o.status?.toUpperCase() === 'CANCELLED' ? <X className="h-3 w-3" /> : <Clock className="h-3 w-3" />} {o.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Customer Details */}
                {(o.user || o.address) && (
                  <div className="rounded-2xl bg-muted/30 p-3.5 text-xs space-y-2 border border-border/50">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Customer & Delivery Details
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{o.user?.name || o.customer_name || "Customer"}</p>
                        {o.user?.phone && <p className="text-muted-foreground">{o.user.phone}</p>}
                        {o.user?.email && <p className="text-muted-foreground">{o.user.email}</p>}
                      </div>
                      {o.address && (
                        <div>
                          <p className="font-medium text-foreground">{o.address.label || "Delivery Address"}</p>
                          <p className="text-muted-foreground">
                            {o.address.street}, {o.address.city}, {o.address.state} {o.address.pincode}
                          </p>
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
                      {o.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center p-3 text-xs bg-card hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-lg bg-muted border border-border overflow-hidden flex-shrink-0 grid place-items-center">
                              {item.image_url || item.product?.images?.[0]?.url ? (
                                <img src={item.image_url || item.product?.images?.[0]?.url} alt="Item" className="h-full w-full object-cover" />
                              ) : (
                                <ShoppingBag className="h-4 w-4 text-muted-foreground/50" />
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-foreground">
                                {item.quantity}x <span className="text-muted-foreground font-medium ml-1">{item.product_name || item.name || item.product?.name || "Item"}</span>
                              </span>
                              {item.unit && <span className="text-[10px] text-muted-foreground">{item.unit}</span>}
                            </div>
                          </div>
                          <div className="font-semibold text-foreground">₹{(item.total_price || item.unit_price * item.quantity || 0).toLocaleString("en-IN")}</div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="bg-muted/10 p-3 space-y-1.5 border-t border-border/50 text-xs">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Items Subtotal</span>
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
                        <span>Total Paid</span>
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
                    ) : o.status?.toUpperCase() === "CANCELLED" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600">
                        <X className="h-4 w-4" /> Order Cancelled
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
      <Dialog open={!!otpTarget} onOpenChange={(open) => !open && setOtpTarget(null)}>
        <DialogContent className="rounded-3xl border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-center">Verify Delivery OTP</DialogTitle>
            <DialogDescription className="text-xs text-center">
              Ask the customer for their 4-digit verification PIN to complete order #{otpTarget?.order_number || otpTarget?.id?.slice(0, 6)}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <input
              type="text"
              maxLength={4}
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
              placeholder="0000"
              className="w-full text-center text-4xl tracking-widest rounded-2xl border border-border bg-muted/50 px-4 py-5 font-display font-black focus:bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            <button
              onClick={() => {
                if (otpInput.length !== 4) {
                  toast.error("Please enter a valid 4-digit OTP");
                  return;
                }
                updateOrderStatusMutation.mutate({
                  orderId: otpTarget.id,
                  status: "delivered",
                  otpCode: otpInput,
                });
              }}
              disabled={updateOrderStatusMutation.isPending || otpInput.length !== 4}
              className="w-full rounded-2xl bg-emerald-500 text-black px-4 py-3.5 text-xs font-bold shadow-lg disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {updateOrderStatusMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Verify & Complete Delivery
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
