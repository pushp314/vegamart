import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Bike, Check, Loader2, Search, Filter, ShoppingBag, Clock, CheckCircle2 } from "lucide-react";
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
                ],
                CONFIRMED: [
                  {
                    status: "preparing",
                    label: "Start Preparing",
                    color: "bg-blue-600 text-white hover:bg-blue-500 font-bold",
                  },
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
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 font-black text-sm">
                      #{o.order_number || o.id.slice(0, 5)}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-foreground">
                        Order #{o.order_number || o.id.slice(0, 8)}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Customer: <span className="font-semibold text-foreground">{o.customer_name || "Customer"}</span> • {new Date(o.created_at || Date.now()).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-display text-lg font-black text-emerald-600">
                        ₹{Number(o.total || 0).toLocaleString("en-IN")}
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 border border-amber-500/20">
                        <Clock className="h-3 w-3" /> {o.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Items List */}
                {Array.isArray(o.items) && o.items.length > 0 && (
                  <div className="rounded-2xl bg-muted/40 p-3 text-xs space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Ordered Items ({o.items.length})
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {o.items.map((item: any, idx: number) => (
                        <span key={idx} className="inline-flex items-center gap-1 rounded-xl bg-card border border-border px-2.5 py-1 text-xs font-semibold">
                          {item.quantity}x {item.product_name || item.name || "Item"}
                        </span>
                      ))}
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
                            if (ns.status === "delivered") {
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
