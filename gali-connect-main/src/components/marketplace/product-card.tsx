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

  return (
    <div className="group relative overflow-hidden rounded-2xl border bg-card p-3 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-glow">
      <Link
        to="/products/$productId"
        params={{ productId: product.id }}
        className="absolute inset-0 z-0 rounded-2xl"
        aria-label={product.name}
      />

      <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
        <img
          src={image}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        {discount > 0 && (
          <div className="absolute left-2 top-2 rounded-md bg-saffron px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
            {discount}% OFF
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
          className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-full bg-background/80 backdrop-blur-xs shadow-sm border border-border/50 hover:bg-background transition-colors"
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
          <Star className="h-3 w-3 fill-warning text-warning" /> {product.rating || "0.0"} •{" "}
          {product.unit}
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
            className="relative z-10 h-8 rounded-lg bg-brand hover:bg-brand/90 text-primary-foreground px-3"
            onClick={(e) => {
              e.stopPropagation();
              addToCart(product, 1);
              toast.success(`Added ${product.name} to cart`);
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </div>
    </div>
  );
}
