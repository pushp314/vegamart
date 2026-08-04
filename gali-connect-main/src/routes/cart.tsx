import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ShoppingBag,
  Minus,
  Plus,
  Trash2,
  Ticket,
  X,
  CheckCircle2,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { useCart } from "@/context/cart-context";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "@/hooks/use-location";

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
  const { displayLocation } = useLocation();

  const [promoCode, setPromoCode] = useState("");
  const [isApplying, setIsApplying] = useState(false);

  const handleApplyPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCode.trim()) return;
    setIsApplying(true);
    const res = await applyCoupon(promoCode);
    setIsApplying(false);
    if (res.success) {
      toast.success(res.message);
      setPromoCode("");
    } else {
      toast.error(res.message);
    }
  };

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
      <main className="mx-auto max-w-6xl px-4 md:px-6 lg:px-8 pt-4 md:pt-8 pb-40 md:pb-16">
        <div className="md:grid md:grid-cols-[1fr_360px] md:gap-6 lg:gap-8">
          <div>
            <ul className="space-y-3">
              {items.map((i) => {
                const image =
                  i.product.images?.[0]?.url ||
                  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop";
                return (
                  <li key={i.id} className="flex gap-3 p-3 rounded-2xl bg-card border shadow-sm">
                    <div className="h-20 w-20 md:h-24 md:w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
                      <img
                        src={image}
                        alt={i.product.name}
                        className="h-full w-full object-cover"
                      />
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
                      <p className="text-[12px] text-muted-foreground">{i.product.unit}</p>
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
            {/* Offers & Benefits */}
            <section className="rounded-2xl bg-card border p-4">
              <div className="flex items-center gap-2 mb-4">
                <Ticket className="h-5 w-5 text-emerald-600" />
                <h2 className="font-display text-[17px] font-bold">Offers & Benefits</h2>
              </div>

              {appliedCoupon ? (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="font-bold text-sm">'{appliedCoupon}' applied</span>
                  </div>
                  <button
                    onClick={removeCoupon}
                    className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyPromo} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter promo code"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    className="flex-1 h-11 px-4 rounded-xl border bg-background text-sm font-medium uppercase placeholder:normal-case placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                  <button
                    type="submit"
                    disabled={!promoCode.trim() || isApplying}
                    className="h-11 px-5 rounded-xl bg-zinc-900 text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-800 transition-colors"
                  >
                    {isApplying ? "..." : "Apply"}
                  </button>
                </form>
              )}
            </section>

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
              <Link
                to="/checkout"
                className="hidden md:inline-flex mt-4 w-full items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground font-semibold text-sm h-12"
              >
                Checkout <ArrowRight className="h-4 w-4" />
              </Link>
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
            <Link
              to="/checkout"
              className="inline-flex items-center gap-2 rounded-full bg-white text-emerald-900 font-semibold text-sm h-11 px-4"
            >
              Checkout <ArrowRight className="h-4 w-4" />
            </Link>
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
