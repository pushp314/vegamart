import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ShoppingBag, Minus, Plus, Trash2, AlertTriangle, Tag, CheckCircle2 } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { useCart } from "@/context/cart-context";
import { useLocation } from "@/hooks/use-location";
import { checkProductDeliverability } from "@/lib/deliverability";
import { MultiStoreLiveBadge } from "@/components/marketplace/MultiStoreLiveBadge";
import { toast } from "sonner";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Your cart — Vegamart" }] }),
  component: Cart,
});

function Cart() {
  const {
    items,
    updateQuantity,
    removeItem,
    subtotal,
    deliveryFee,
    tax,
    discount,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    total,
    itemCount,
  } = useCart();
  const { displayLocation, activeAddress } = useLocation();
  const [couponInput, setCouponInput] = useState("");

  const undeliverableItems = useMemo(() => {
    return items.filter((i) => {
      const d = checkProductDeliverability(i.product, activeAddress);
      return !d.isDeliverable && (d.reason === "DIFFERENT_CITY" || d.reason === "OUT_OF_RADIUS");
    });
  }, [items, activeAddress]);
  const hasUndeliverableItems = undeliverableItems.length > 0;

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader title="Your cart" subtitle="Empty" />
        <main className="mx-auto max-w-md px-6 py-16 text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-50 text-primary">
            <ShoppingBag className="h-8 w-8" />
          </div>
          <h1 className="mt-6 font-display text-2xl font-bold">Your basket is empty</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Add fresh vegetables, snacks or your favourite chai from vendors nearby.
          </p>
          <Link
            to="/vendors"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground font-semibold text-sm px-5 py-3"
          >
            Browse vendors <ArrowRight className="h-4 w-4" />
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Your cart"
        subtitle={`${itemCount} item${itemCount === 1 ? "" : "s"} · ${displayLocation}`}
      />
      <main className="mx-auto max-w-6xl px-4 md:px-6 lg:px-8 pt-4 md:pt-8 pb-40 md:pb-16 space-y-4">
        <MultiStoreLiveBadge />

        {hasUndeliverableItems && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200 flex items-start gap-3 text-xs font-medium">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-sm block">Items not deliverable to {displayLocation}</span>
              <p className="text-[12px] text-muted-foreground">
                Some items in your basket are outside your delivery zone or in a different city. Please remove them before proceeding to checkout.
              </p>
            </div>
          </div>
        )}

        <div className="md:grid md:grid-cols-[1fr_360px] md:gap-6 lg:gap-8">
          <div>
            <ul className="space-y-3">
              {items.map((i) => {
                const image =
                  i.product.images?.[0]?.url ||
                  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop";
                const itemD = checkProductDeliverability(i.product, activeAddress);
                const isItemUndeliverable =
                  !itemD.isDeliverable &&
                  (itemD.reason === "DIFFERENT_CITY" || itemD.reason === "OUT_OF_RADIUS");

                return (
                  <li key={i.id} className={`flex gap-3 p-3 rounded-2xl bg-card border shadow-sm ${isItemUndeliverable ? "border-amber-500/40 bg-amber-500/5" : ""}`}>
                    <div className="h-20 w-20 md:h-24 md:w-24 shrink-0 overflow-hidden rounded-xl bg-muted relative">
                      <img
                        src={image}
                        alt={i.product.name}
                        className="h-full w-full object-cover"
                      />
                      {isItemUndeliverable && (
                        <div className="absolute inset-x-0 bottom-0 bg-amber-950/90 text-amber-300 text-[9px] font-black uppercase text-center py-0.5">
                          Not Deliverable
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <h3 className="font-semibold text-[15px] truncate flex-1">
                          {i.product.name}
                        </h3>
                        <button
                          aria-label={`Remove ${i.product.name}`}
                          onClick={() => removeItem(i.id)}
                          className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-[12px] text-muted-foreground">
                        {i.selectedVariant || i.product.unit}
                      </p>
                      {isItemUndeliverable && (
                        <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 px-2 py-0.5 rounded-md">
                          <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                          <span>{itemD.message}</span>
                        </div>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-[15px]">
                            ₹{i.product.price * i.quantity}
                          </span>
                          {i.product.mrp > i.product.price && (
                            <span className="ml-1 text-[11px] text-muted-foreground line-through">
                              ₹{i.product.mrp * i.quantity}
                            </span>
                          )}
                        </div>
                        <div className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 overflow-hidden">
                          <button
                            aria-label="Decrease"
                            onClick={() => updateQuantity(i.id, i.quantity - 1)}
                            className="grid h-8 w-8 place-items-center text-primary"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="min-w-[24px] text-center text-sm font-semibold text-primary tabular-nums">
                            {i.quantity}
                          </span>
                          <button
                            aria-label="Increase"
                            onClick={() => updateQuantity(i.id, i.quantity + 1)}
                            className="grid h-8 w-8 place-items-center text-primary"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <aside className="mt-5 md:mt-0 space-y-5">
            {/* Interactive Coupon Code Card */}
            <div className="rounded-2xl bg-card border p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-bold">
                <Tag className="h-4 w-4 text-primary" /> Apply Coupon
              </div>
              {appliedCoupon ? (
                <div className="mt-3 flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-black text-xs uppercase tracking-wider">{appliedCoupon}</span>
                      <span className="text-[11px] block text-emerald-700 dark:text-emerald-400 font-semibold">
                        Discount of ₹{discount} applied!
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      removeCoupon();
                      toast.info("Coupon removed");
                    }}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700 px-2 py-1"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    placeholder="Enter coupon code"
                    className="min-w-0 flex-1 h-10 rounded-xl border px-3 text-xs uppercase font-bold tracking-wider outline-none focus:border-primary bg-background"
                  />
                  <button
                    onClick={async () => {
                      if (!couponInput.trim()) return;
                      const res = await applyCoupon(couponInput.trim());
                      if (res.success) {
                        toast.success(res.message);
                        setCouponInput("");
                      } else {
                        toast.error(res.message);
                      }
                    }}
                    className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shrink-0"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>

            <section className="rounded-2xl bg-card border p-4 md:sticky md:top-24">
              <h2 className="font-display text-[17px] font-bold">Bill summary</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <Row label="Item subtotal" value={`₹${subtotal}`} />
                <Row label="Delivery fee" value={deliveryFee === 0 ? "FREE" : `₹${deliveryFee}`} />
                <Row label="Taxes & charges" value={`₹${tax}`} />
                {discount > 0 && (
                  <div className="flex items-center justify-between text-emerald-600 font-medium">
                    <span>Discount {appliedCoupon && `(${appliedCoupon})`}</span>
                    <span>-₹{discount}</span>
                  </div>
                )}
              </dl>
              <div className="mt-3 pt-3 border-t flex items-center justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-display text-xl font-bold tabular-nums">₹{total}</span>
              </div>
              {hasUndeliverableItems ? (
                <button
                  disabled
                  className="hidden md:inline-flex mt-4 w-full items-center justify-center gap-2 rounded-full bg-muted text-muted-foreground font-semibold text-xs h-12 cursor-not-allowed border border-border"
                >
                  Remove undeliverable items to checkout
                </button>
              ) : (
                <Link
                  to="/checkout"
                  className="hidden md:inline-flex mt-4 w-full items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground font-semibold text-sm h-12"
                >
                  Checkout <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </section>
          </aside>
        </div>
      </main>

      {/* Sticky checkout bar (mobile only) */}
      <div
        className="md:hidden fixed inset-x-0 z-40 pointer-events-none"
        style={{ bottom: "calc(88px + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto max-w-md px-4">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-primary text-primary-foreground p-1.5 pl-5 shadow-[0_12px_30px_-10px_color-mix(in_oklab,var(--primary)_60%,transparent)]">
            <div className="flex-1 min-w-0">
              <div className="text-[10.5px] font-semibold uppercase tracking-wide opacity-80">
                Total
              </div>
              <div className="font-display text-lg font-bold leading-none tabular-nums">
                ₹{total}
              </div>
            </div>
            {hasUndeliverableItems ? (
              <button
                disabled
                className="inline-flex items-center gap-1 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500 font-semibold text-xs h-11 px-3 cursor-not-allowed"
              >
                Undeliverable items
              </button>
            ) : (
              <Link
                to="/checkout"
                className="inline-flex items-center gap-2 rounded-full bg-white text-emerald-900 font-semibold text-sm h-11 px-4"
              >
                Checkout <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
