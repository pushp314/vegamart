import { Link } from "@tanstack/react-router";
import { Plus, Star, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Product } from "@/types";
import { useCart } from "@/context/cart-context";
import { useWishlist } from "@/context/wishlist-context";
import { toast } from "sonner";

export function ProductCard({
  product,
  linkTo,
  linkParams,
  linkSearch,
  hideAddToCart,
}: {
  product: Product;
  linkTo?: string;
  linkParams?: Record<string, string>;
  linkSearch?: Record<string, unknown>;
  hideAddToCart?: boolean;
}) {
  const { addToCart } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const wishlisted = isWishlisted(product.id);

  const discount =
    product.mrp > product.price
      ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
      : 0;
  const image =
    product.images?.[0]?.url ||
    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop";

  const vendorOffline = product.vendor?.is_open === false;
  const isZeroStock = typeof product.stock === "number" && product.stock <= 0;
  const outOfStock =
    product.is_available === false ||
    product.is_active === false ||
    isZeroStock ||
    vendorOffline;
  const lowStock =
    !outOfStock && typeof product.stock === "number" && product.stock > 0 && product.stock <= 5;

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border p-3 shadow-soft transition-all ${
        outOfStock
          ? "bg-muted/40 border-muted-foreground/30 grayscale contrast-90 brightness-95 opacity-85 select-none"
          : "bg-card hover:-translate-y-0.5 hover:shadow-glow"
      }`}
    >
      <Link
        to={linkTo ?? "/products/$productId"}
        params={linkParams ?? { productId: product.id }}
        search={linkSearch}
        className="absolute inset-0 z-[1] rounded-2xl"
        aria-label={product.name}
      />

      <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
        <img
          src={image}
          alt={product.name}
          loading="lazy"
          className={`h-full w-full object-cover transition-transform duration-500 ${
            outOfStock ? "grayscale contrast-75 brightness-90" : "group-hover:scale-110"
          }`}
        />
        {product.vendor?.is_sponsored && !outOfStock && (
          <div className="absolute left-2 top-2 z-[2] rounded-md bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm">
            Sponsored
          </div>
        )}
        {discount > 0 && !outOfStock && (
          <div
            className={`absolute left-2 rounded-md bg-saffron px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground ${
              product.vendor?.is_sponsored ? "top-9" : "top-2"
            }`}
          >
            {discount}% OFF
          </div>
        )}
        {outOfStock && (
          <div className="absolute inset-x-0 bottom-0 z-[3] bg-zinc-950/85 px-2 py-1.5 text-center text-[10px] font-black uppercase tracking-wider text-white backdrop-blur-xs border-t border-white/10">
            {vendorOffline ? "Store Closed" : "Out of Stock"}
          </div>
        )}
        {lowStock && (
          <div className="absolute right-2 bottom-2 z-[3] rounded-md bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm">
            Only {product.stock} left
          </div>
        )}

        {/* Wishlist Button Overlay */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleWishlist(product);
            if (wishlisted) {
              toast.info(`Removed ${product.name} from wishlist`);
            } else {
              toast.success(`Added ${product.name} to wishlist ❤️`);
            }
          }}
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          className="absolute right-2 top-2 z-[5] grid h-7 w-7 place-items-center rounded-full bg-background/80 backdrop-blur-xs shadow-sm border border-border/50 hover:bg-background transition-colors"
        >
          <Heart
            className={`h-4 w-4 transition-colors ${
              wishlisted
                ? "fill-rose-500 text-rose-500"
                : "text-muted-foreground hover:text-rose-500"
            }`}
          />
        </button>
      </div>

      <div className="relative mt-3">
        <h4 className={`text-sm font-semibold truncate ${outOfStock ? "text-muted-foreground" : "text-foreground"}`}>
          {product.name}
        </h4>
        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-black ${
            outOfStock ? "bg-muted text-muted-foreground" : "bg-amber-100/80 text-amber-700"
          }`}>
            <Star className={`h-2.5 w-2.5 ${outOfStock ? "fill-muted-foreground text-muted-foreground" : "fill-amber-400 text-amber-400"}`} />
            {typeof product.rating === "number" && product.rating > 0
              ? product.rating.toFixed(1)
              : "New"}
            {typeof product.review_count === "number" && product.review_count > 0 && (
              <span className="font-semibold ml-0.5">({product.review_count})</span>
            )}
          </span>
          <span>•</span> <span>{product.unit}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex flex-col justify-center">
            <span className={`text-sm font-bold leading-none ${outOfStock ? "text-muted-foreground line-through" : "text-foreground"}`}>
              ₹{product.price}
            </span>
            {product.mrp > product.price && (
              <span className="mt-1 text-[10px] text-muted-foreground line-through leading-none">
                ₹{product.mrp}
              </span>
            )}
          </div>
          {!hideAddToCart && (
            outOfStock ? (
              <span className="relative z-[5] text-[10px] font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-200/80 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 px-2 py-1 rounded-lg shrink-0 cursor-not-allowed">
                {vendorOffline ? "Closed" : "Out of stock"}
              </span>
            ) : (
              <Button
                size="sm"
                className="relative z-[5] h-8 min-w-[70px] rounded-lg bg-brand hover:bg-brand/90 text-primary-foreground px-2.5 font-bold shadow-sm shrink-0 flex items-center justify-center gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  addToCart(product, 1);
                }}
              >
                <Plus className="h-3.5 w-3.5" /> <span className="text-[11px] uppercase tracking-wider">Add</span>
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
