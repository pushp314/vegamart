import { Link } from "@tanstack/react-router";
import { Plus, Star, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Product } from "@/types";
import { useCart } from "@/context/cart-context";
import { useWishlist } from "@/context/wishlist-context";
import { toast } from "sonner";

export function ProductCard({ product }: { product: Product }) {
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
  const outOfStock =
    !product.is_available ||
    (typeof product.stock === "number" && product.stock <= 0) ||
    vendorOffline;
  const lowStock =
    !outOfStock && typeof product.stock === "number" && product.stock > 0 && product.stock <= 5;

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border bg-card p-3 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-glow ${
        outOfStock ? "opacity-80" : ""
      }`}
    >
      <Link
        to="/products/$productId"
        params={{ productId: product.id }}
        className="absolute inset-0 z-[1] rounded-2xl"
        aria-label={product.name}
        onClick={(e) => {
          console.log('Product clicked:', product.id, product.name);
          console.log('Navigating to:', `/products/${product.id}`);
        }}
      />

      <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
        <img
          src={image}
          alt={product.name}
          loading="lazy"
          className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-110 ${
            outOfStock ? "grayscale-[35%]" : ""
          }`}
        />
        {product.vendor?.is_sponsored && (
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
          <div className="absolute inset-x-0 bottom-0 z-[3] bg-black/60 px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-xs">
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
        <h4 className="text-sm font-semibold truncate">{product.name}</h4>
        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100/80 px-1.5 py-0.5 text-[10px] font-black text-amber-700">
            <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
            {typeof product.rating === "number" && product.rating > 0 ? product.rating.toFixed(1) : "New"}
            {typeof product.review_count === "number" && product.review_count > 0 && (
              <span className="font-semibold text-amber-600 ml-0.5">({product.review_count})</span>
            )}
          </span>
          <span>•</span> <span>{product.unit}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div>
            <span className="text-sm font-bold">₹{product.price}</span>
            {product.mrp > product.price && (
              <span className="ml-1.5 text-[11px] text-muted-foreground line-through">
                ₹{product.mrp}
              </span>
            )}
          </div>
          <Button
            size="sm"
            disabled={outOfStock}
            className="relative z-[5] h-8 rounded-lg bg-brand hover:bg-brand/90 text-primary-foreground px-3 disabled:opacity-50 disabled:hover:bg-brand"
            onClick={(e) => {
              e.stopPropagation();
              addToCart(product, 1);
              toast.success(`Added ${product.name} to cart`);
            }}
          >
            <Plus className="h-3.5 w-3.5" /> {outOfStock ? "Unavailable" : "Add"}
          </Button>
        </div>
      </div>
    </div>
  );
}
