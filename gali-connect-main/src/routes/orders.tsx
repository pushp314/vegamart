import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Bike,
  ChevronDown,
  ChevronUp,
  RotateCw,
  ShoppingBag,
  XCircle,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { PullToRefresh } from "@/components/system/pull-to-refresh";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { GoogleDeliveryTracker } from "@/components/marketplace/google-delivery-tracker";
import { useCart } from "@/context/cart-context";

export const Route = createFileRoute("/orders")({
  head: () => ({ meta: [{ title: "Your orders — Vegamart" }] }),
  component: Orders,
});

function statusLabel(status: string): string {
  return (
    {
      pending: "Pending",
      confirmed: "Confirmed",
      processing: "Processing",
      prepared: "Prepared",
      packed: "Packed",
      out_for_delivery: "Out for Delivery",
      delivered: "Delivered",
      cancelled: "Cancelled",
      refunded: "Refunded",
    }[status] || status
  );
}

function Orders() {
  const refresh = () => new Promise<void>((res) => setTimeout(res, 700));
  const [expandedTracking, setExpandedTracking] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToCart, clearCart } = useCart();

  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/orders/${id}/cancel`, { reason: "Customer requested cancellation" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Order cancelled successfully!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to cancel order");
    },
  });

  const { data: res, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: () => api.get<any[]>("/orders"),
  });

  const orders = res?.data || [];

  const toggleTracking = (id: string) => {
    setExpandedTracking((prev) => (prev === id ? null : id));
  };

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
                const canCancel = ["pending", "confirmed", "processing", "prepared"].includes(
                  statusLower,
                );
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

                      <button
                        onClick={() => toggleTracking(o.id)}
                        className="flex items-center gap-1 text-xs font-bold text-primary hover:underline bg-emerald-50 px-3 py-1.5 rounded-2xl border border-emerald-200"
                      >
                        <Bike className="h-4 w-4" />
                        {isExpanded ? "Hide Map" : "Trace Delivery"}
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>

                    {/* Expandable Google Maps Delivery GPS Tracer */}
                    {isExpanded && (
                      <div className="pt-2">
                        <GoogleDeliveryTracker
                          orderId={o.id}
                          status={o.status || "out_for_delivery"}
                          eta="10–12 mins"
                        />
                      </div>
                    )}

                    <div className="pt-3 border-t flex items-center justify-end gap-2">
                      {canCancel && (
                        <button
                          onClick={() => cancelMutation.mutate(o.id)}
                          disabled={cancelMutation.isPending}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-2xl border bg-card hover:bg-muted text-foreground transition-colors disabled:opacity-50"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Cancel Order
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
    </div>
  );
}
