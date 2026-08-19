import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RotateCw, ShoppingBag, User, ArrowRight, Eye } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { PullToRefresh } from "@/components/system/pull-to-refresh";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useCart } from "@/context/cart-context";
import { useAuth } from "@/context/auth-context";
import { getDeliveryOptionInfo, getPaymentMethodInfo } from "@/lib/order-helpers";

export const Route = createFileRoute("/orders/history")({
  head: () => ({ meta: [{ title: "Order history — Vegamart" }] }),
  component: OrderHistoryPage,
});

const PAST_STATUSES = ["delivered", "cancelled", "refunded", "returned", "failed"];

function statusLabel(status: string): string {
  return (
    {
      delivered: "Delivered",
      cancelled: "Cancelled",
      refunded: "Refunded",
      returned: "Returned",
      failed: "Failed",
    }[String(status).toLowerCase()] || status
  );
}

function statusBadgeClass(status: string): string {
  const s = String(status).toLowerCase();
  if (s === "delivered") return "text-emerald-800 bg-emerald-100";
  if (s === "refunded") return "text-blue-800 bg-blue-100";
  if (s === "returned") return "text-violet-800 bg-violet-100";
  return "text-rose-700 bg-rose-100";
}

function OrderHistoryPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isGuest, isLoading: authLoading } = useAuth();
  const { addToCart, clearCart } = useCart();

  const { data: res, isLoading, refetch } = useQuery({
    queryKey: ["orderHistory"],
    queryFn: () => api.get<any[]>("/orders"),
    enabled: !!user && !isGuest,
  });

  const refresh = () => refetch();

  const orders = (res?.data || []).filter((o: any) =>
    PAST_STATUSES.includes(String(o.status || "").toLowerCase()),
  );

  const handleReorder = (o: any) => {
    const products: any[] = (o.items || []).map((item: any) => ({
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

  if (!authLoading && (!isAuthenticated || isGuest)) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <AppHeader title="Order history" subtitle="Login Required" />
        <main className="flex-1 max-w-md w-full mx-auto px-6 py-16 text-center flex flex-col justify-center items-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-soft">
            <User className="h-10 w-10" />
          </div>
          <h2 className="mt-6 font-display text-2xl font-bold">Login Required</h2>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed max-w-xs">
            Please log in to your customer account to view your order history.
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
        title="Order History"
        subtitle={
          isLoading ? "Loading..." : `${orders.length} past order${orders.length === 1 ? "" : "s"}`
        }
      />
      <PullToRefresh onRefresh={refresh}>
        <main className="mx-auto max-w-4xl px-4 md:px-6 pt-4 md:pt-8 pb-28 md:pb-16">
          {isLoading ? (
            <div className="mt-10 text-center text-sm text-muted-foreground">
              Loading your order history...
            </div>
          ) : orders.length === 0 ? (
            <div className="mt-16 text-center">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-50 text-primary">
                <ShoppingBag className="h-8 w-8" />
              </div>
              <h1 className="mt-6 font-display text-2xl font-bold">No order history</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Delivered and cancelled orders will appear here.
              </p>
              <Link
                to="/orders"
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
              >
                ← View active orders
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((o: any) => {
                const dInfo = getDeliveryOptionInfo(o.delivery_note || o.delivery_option);
                const pInfo = getPaymentMethodInfo(
                  o.payment_method,
                  o.payment_status,
                  Number(o.total_amount || o.total || 0),
                  dInfo.id === "self_pickup",
                  o.payment?.amount != null ? Number(o.payment.amount) : null
                );
                const DIcon = dInfo.icon;
                const PIcon = pInfo.icon;

                return (
                  <div key={o.id} className="rounded-3xl bg-card border p-5 shadow-soft space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-base">
                            Order #{o.order_number || o.id.slice(0, 8)}
                          </h3>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${statusBadgeClass(o.status)}`}
                          >
                            {statusLabel(o.status)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {o.delivered_at
                            ? `Delivered on ${new Date(o.delivered_at).toLocaleDateString()}`
                            : `Placed on ${new Date(o.created_at).toLocaleDateString()}`}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${dInfo.colorClass}`}>
                            <DIcon className="h-3 w-3" />
                            {dInfo.shortLabel}
                          </span>
                          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${pInfo.colorClass}`}>
                            <PIcon className="h-3 w-3" />
                            {pInfo.shortLabel}
                          </span>
                          {pInfo.isPartialAdvance && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border bg-teal-50 text-teal-800 border-teal-200">
                              Advance Paid: ₹{pInfo.advancePaid.toFixed(2)} · Bal: ₹{pInfo.balanceAmount.toFixed(2)}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground ml-1 font-semibold">
                            Total: <strong className="text-foreground">₹{o.total_amount || o.total}</strong>
                          </span>
                        </div>
                      </div>

                      <Link
                        to="/orders/$orderId/track"
                        params={{ orderId: o.id }}
                        className="flex items-center gap-1 text-xs font-bold text-primary hover:underline bg-muted/60 px-3 py-1.5 rounded-2xl border shrink-0"
                      >
                        <Eye className="h-4 w-4" />
                        Details
                      </Link>
                    </div>

                  {Array.isArray(o.items) && o.items.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto py-1">
                      {o.items.map((it: any, iIdx: number) => {
                        const itImg = it.image_url || it.product?.images?.[0]?.url;
                        const isRej = it.status === "rejected";
                        return (
                          <div
                            key={iIdx}
                            className={`h-9 w-9 rounded-lg border overflow-hidden shrink-0 grid place-items-center bg-muted relative ${
                              isRej ? "opacity-40 border-rose-300" : "border-border"
                            }`}
                            title={`${it.quantity}x ${it.product_name || it.name}${
                              isRej ? " (Rejected)" : ""
                            }`}
                          >
                            {itImg ? (
                              <img
                                src={itImg}
                                alt=""
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.display = "none";
                                }}
                              />
                            ) : (
                              <ShoppingBag className="h-4 w-4 text-muted-foreground/50" />
                            )}
                          </div>
                        );
                      })}
                      <span className="text-[11px] text-muted-foreground pl-1">
                        {o.items.length} {o.items.length === 1 ? "item" : "items"}
                      </span>
                    </div>
                  )}

                  <div className="pt-3 border-t flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleReorder(o)}
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
