import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Bike,
  ChevronDown,
  ChevronUp,
  RotateCw,
  ShoppingBag,
  User,
  XCircle,
  Undo2,
  ArrowRight,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { PullToRefresh } from "@/components/system/pull-to-refresh";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

import { useCart } from "@/context/cart-context";
import { useAuth } from "@/context/auth-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/orders")({
  head: () => ({ meta: [{ title: "Your orders — Vegamart" }] }),
  component: Orders,
});

function statusLabel(status: string): string {
  return (
    {
      pending: "Pending",
      confirmed: "Confirmed",
      preparing: "Preparing",
      packed: "Packed",
      ready_for_pickup: "Ready for Pickup",
      picked_up: "Picked Up",
      out_for_delivery: "Out for Delivery",
      delivered: "Delivered",
      cancelled: "Cancelled",
      refunded: "Refunded",
      returned: "Returned",
      failed: "Failed",
    }[status] || status
  );
}

function Orders() {
  const refresh = () => new Promise<void>((res) => setTimeout(res, 700));
  const [expandedTracking, setExpandedTracking] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [refundTarget, setRefundTarget] = useState<any | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isGuest, role, isLoading: authLoading } = useAuth();
  const { addToCart, clearCart } = useCart();

  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/orders/${id}/cancel`, { reason: "Customer requested cancellation" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setCancelTarget(null);
      toast.success("Order cancelled successfully!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to cancel order");
    },
  });

  const handleCancel = () => {
    if (cancelTarget) {
      cancelMutation.mutate(cancelTarget.id);
    }
  };

  const refundMutation = useMutation({
    mutationFn: (data: { id: string; reason: string }) =>
      api.post(`/orders/${data.id}/refund`, { reason: data.reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setRefundTarget(null);
      setRefundReason("");
      toast.success("Refund requested successfully. Our support team will review it.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to request refund");
    },
  });

  const handleRefund = () => {
    if (refundTarget) {
      if (refundReason.trim().length < 5) {
        toast.error("Please provide a more detailed reason (min 5 chars).");
        return;
      }
      refundMutation.mutate({ id: refundTarget.id, reason: refundReason });
    }
  };

  const { data: res, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: () => api.get<any[]>("/orders"),
    enabled: !!user && !isGuest && role === "customer",
  });

  const orders = res?.data || [];

  const toggleTracking = (id: string) => {
    setExpandedTracking((prev) => (prev === id ? null : id));
  };

  if (!authLoading && (!isAuthenticated || isGuest || role !== "customer")) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <AppHeader title="Your orders" subtitle="Login Required" />
        <main className="flex-1 max-w-md w-full mx-auto px-6 py-16 text-center flex flex-col justify-center items-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-soft">
            <User className="h-10 w-10" />
          </div>
          <h2 className="mt-6 font-display text-2xl font-bold">Login Required</h2>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed max-w-xs">
            Please log in to your customer account to view your orders.
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
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Your orders"
        subtitle={isLoading ? "Loading..." : `${orders.length} orders`}
        back={false}
      />
      <PullToRefresh onRefresh={refresh}>
        <main className="mx-auto max-w-4xl px-4 md:px-6 pt-4 md:pt-8 pb-28 md:pb-16">
          {isLoading ? (
            <div className="mt-10 text-center text-sm text-muted-foreground">
              Loading your orders...
            </div>
          ) : orders.length === 0 ? (
            <div className="mt-16 text-center">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-50 text-primary">
                <ShoppingBag className="h-8 w-8" />
              </div>
              <h1 className="mt-6 font-display text-2xl font-bold">No orders yet</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                You haven't placed any orders. Start exploring vendors near you!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((o: any) => {
                const isExpanded = expandedTracking === o.id;
                const statusLower = String(o.status || "pending").toLowerCase();
                const canCancel = ["pending", "confirmed"].includes(statusLower);
                const canRefund = statusLower === "delivered";
                const handleReorder = () => {
                  const products: any[] = (o.items || [])
                    .map((item: any) => ({
                      id: item.product_id,
                      name: item.product_name || item.name || "Item",
                      price: Number(item.unit_price ?? item.price ?? 0),
                      mrp: Number(item.mrp ?? item.unit_price ?? item.price ?? 0),
                      unit: item.unit || "",
                      vendor_id: o.vendor_id,
                      images: item.image_url ? [{ url: item.image_url }] : [],
                    }));
                  if (products.length === 0) {
                    toast.error("This order has no items to reorder");
                    return;
                  }
                  clearCart();
                  products.forEach((p) => addToCart(p, 1));
                  toast.success("Items added to your cart!");
                  navigate({ to: "/cart" });
                };
                return (
                  <div key={o.id} className="rounded-3xl bg-card border p-5 shadow-soft space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base">
                            Order #{o.order_number || o.id.slice(0, 8)}
                          </h3>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                            {statusLabel(statusLower) || o.status || "Pending"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Total Amount:{" "}
                          <strong className="text-foreground">₹{o.total_amount || o.total}</strong>
                        </p>
                      </div>

                      <Link
                        to="/orders/$orderId/track"
                        params={{ orderId: o.id }}
                        className="flex items-center gap-1 text-xs font-bold text-primary hover:underline bg-emerald-50 px-3 py-1.5 rounded-2xl border border-emerald-200"
                      >
                        <Bike className="h-4 w-4" />
                        Trace Delivery
                      </Link>
                    </div>

                    <div className="pt-3 border-t flex items-center justify-end gap-2">
                      {canCancel && (
                        <button
                          onClick={() => setCancelTarget(o)}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-2xl border bg-card hover:bg-muted text-foreground transition-colors"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Cancel Order
                        </button>
                      )}
                      {canRefund && (
                        <button
                          onClick={() => setRefundTarget(o)}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-2xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors"
                        >
                          <Undo2 className="h-3.5 w-3.5" /> Request Refund
                        </button>
                      )}
                      <button
                        onClick={handleReorder}
                        className="flex items-center gap-1.5 text-xs font-semibold px-4 py-1.5 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        <RotateCw className="h-3.5 w-3.5" /> Reorder
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </PullToRefresh>

      {/* Cancel Order Confirmation */}
      <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel this order?</DialogTitle>
            <DialogDescription>
              {cancelTarget ? (
                <>
                  Order #{cancelTarget.order_number || cancelTarget.id} will be cancelled. This
                  action can't be undone. You won't be charged for cancelled orders.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <DialogClose className="rounded-2xl border bg-card px-4 py-2 text-xs font-bold hover:bg-muted transition-colors">
              Keep Order
            </DialogClose>
            <button
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
              className="flex items-center gap-1.5 rounded-2xl bg-destructive text-destructive-foreground px-4 py-2 text-xs font-bold hover:bg-destructive/90 transition-colors disabled:opacity-50"
            >
              {cancelMutation.isPending ? (
                <RotateCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
              {cancelMutation.isPending ? "Cancelling…" : "Yes, Cancel Order"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Refund Modal */}
      <Dialog open={!!refundTarget} onOpenChange={(open) => !open && setRefundTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Refund</DialogTitle>
            <DialogDescription>
              {refundTarget ? (
                <>
                  Order #{refundTarget.order_number || refundTarget.id} has been delivered. 
                  Please let us know why you are requesting a refund.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-2">
            <textarea
              className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary min-h-[100px] resize-none"
              placeholder="E.g., The item was damaged..."
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2">
            <DialogClose className="rounded-2xl border bg-card px-4 py-2 text-xs font-bold hover:bg-muted transition-colors">
              Cancel
            </DialogClose>
            <button
              onClick={handleRefund}
              disabled={refundMutation.isPending || refundReason.trim().length < 5}
              className="flex items-center gap-1.5 rounded-2xl bg-primary text-primary-foreground px-4 py-2 text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {refundMutation.isPending ? (
                <RotateCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Undo2 className="h-3.5 w-3.5" />
              )}
              {refundMutation.isPending ? "Submitting…" : "Submit Request"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
