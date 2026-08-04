import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, Plus, Star, Trash2, ShoppingBag } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { useWishlist } from "@/context/wishlist-context";
import { useCart } from "@/context/cart-context";
import { toast } from "sonner";

export const Route = createFileRoute("/wishlist")({
  head: () => ({ meta: [{ title: "Wishlist — Vegamart" }] }),
  component: WishlistPage,
});

function WishlistPage() {
  const { wishlist, removeWishlist } = useWishlist();
  const { addToCart } = useCart();

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-16">
      <AppHeader title="Wishlist" subtitle={`${wishlist.length} items saved`} />

      <main className="mx-auto max-w-6xl px-4 md:px-6 lg:px-8 pt-4 md:pt-8 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="hidden md:block font-display text-2xl font-bold">My Saved Wishlist</h1>
        </div>

        {wishlist.length === 0 ? (
          <div className="rounded-3xl border bg-card p-12 text-center space-y-3">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-rose-100 text-rose-600">
              <Heart className="h-8 w-8" />
            </div>
            <h3 className="font-display text-base font-bold">Your wishlist is empty</h3>
            <p className="text-xs text-muted-foreground">
              Save items you love by tapping the heart icon while browsing.
            </p>
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 mt-2"
            >
              Explore Products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {wishlist.map((p) => {
              const disc = Math.round(((p.mrp - p.price) / p.mrp) * 100);
              return (
                <div
                  key={p.id}
                  className="group relative rounded-3xl bg-card border overflow-hidden shadow-soft transition-transform hover:-translate-y-1"
                >
                  <Link to="/products/$productId" params={{ productId: p.id }} className="block">
                    <div className="relative aspect-square bg-muted">
                      <img
                        src={
                          p.images?.[0]?.url ||
                          "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500"
                        }
                        alt={p.name}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                      {disc > 0 && (
                        <span className="absolute top-2 left-2 rounded-full bg-emerald-700 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                          {disc}% OFF
                        </span>
                      )}
                    </div>
                  </Link>

                  <button
                    onClick={() => {
                      removeWishlist(p.id);
                      toast.info("Removed from wishlist");
                    }}
                    aria-label="Remove from wishlist"
                    className="absolute top-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-white/95 text-rose-500 shadow-md hover:scale-110 transition-transform"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <div className="p-3.5 space-y-2">
                    <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> {p.rating}
                    </div>

                    <div>
                      <h3 className="font-display text-sm font-bold text-foreground truncate">
                        {p.name}
                      </h3>
                      <p className="text-[11px] text-muted-foreground">{p.unit}</p>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <span className="font-display font-bold text-base text-foreground">
                          ₹{p.price}
                        </span>
                        {p.mrp > p.price && (
                          <span className="ml-1 text-[11px] text-muted-foreground line-through">
                            ₹{p.mrp}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          addToCart(p, 1);
                          toast.success(`Added ${p.name} to cart`);
                        }}
                        className="flex items-center gap-1 rounded-2xl bg-primary text-primary-foreground text-xs font-semibold px-3 py-2 shadow-xs hover:bg-primary/90 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
