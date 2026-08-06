import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import {
  Heart,
  Share2,
  Star,
  Minus,
  Plus,
  ShieldCheck,
  Truck,
  Clock,
  MapPin,
  ArrowLeft,
  ArrowRight,
  MessageSquare,
  ChevronLeft,
  PlayCircle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { Product, Vendor } from "@/types";
import { useCart } from "@/context/cart-context";
import { useAuth } from "@/context/auth-context";
import { useWishlist } from "@/context/wishlist-context";
import { useLocation } from "@/hooks/use-location";
import { ReviewModal } from "@/components/marketplace/review-modal";

export const Route = createFileRoute("/products/$productId")({
  loader: async ({ params }) => {
    const res = await api.get<Product>(`/products/${params.productId}`);
    if (!res.success || !res.data) throw notFound();
    return { product: res.data };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.product;
    return {
      meta: [
        { title: p ? `${p.name} — Vegamart` : "Product" },
        {
          name: "description",
          content: p ? `${p.name} · ${p.unit} at ₹${p.price}. Fresh from your local vendor.` : "",
        },
        { property: "og:image", content: p?.images?.[0]?.url ?? "" },
      ],
    };
  },
  component: ProductDetail,
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center bg-background">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold">Product not found</h1>
        <Link
          to="/vendors"
          className="mt-4 inline-flex rounded-full bg-primary text-primary-foreground font-semibold text-sm h-11 px-5 items-center"
        >
          Browse vendors
        </Link>
      </div>
    </div>
  ),
});


function ProductDetail() {
  const { product } = Route.useLoaderData();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();
  const { displayLocation } = useLocation();

  useEffect(() => {
    if (isAuthenticated && product?.id) {
      api.post("/users/me/recently-viewed", { product_id: product.id }).catch(() => {});
    }
  }, [isAuthenticated, product?.id]);

  const { data: vendorRes } = useQuery({
    queryKey: ["vendor", product.vendor_id],
    queryFn: () => api.get<Vendor>(`/vendors/${product.vendor_id}`),
    enabled: !!product.vendor_id && !product.vendor,
  });

  const vendor = product.vendor || vendorRes?.data;

  const { data: relatedRes } = useQuery({
    queryKey: ["products", { category_id: product.category_id }],
    queryFn: () => api.get<Product[]>(`/products?category_id=${product.category_id}`),
    enabled: !!product.category_id,
  });

  const { data: settingsRes } = useQuery({
    queryKey: ["publicSettings"],
    queryFn: () => api.get<any>("/settings/public"),
  });
  const settings = settingsRes?.data || {};
  const globalThreshold = settings["platform.free_delivery_threshold"] ?? 199;
  const vendorThreshold = vendor?.free_delivery_min_order;
  const freeDeliveryThreshold = vendorThreshold != null ? Number(vendorThreshold) : globalThreshold;

  const [qty, setQty] = useState(1);
  const [imageIdx, setImageIdx] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);

  const { isWishlisted, toggleWishlist } = useWishlist();
  const wishlisted = isWishlisted(product.id);

  const gallery = useMemo(() => {
    if (product.images && product.images.length > 0) {
      return product.images.sort((a, b) => a.sort_order - b.sort_order).map((img) => img.url);
    }
    return ["https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop"];
  }, [product.images]);

  // Build variant list — base product is always included as the first option
  const allVariants = useMemo(() => {
    const base = { unit: product.unit, price: Number(product.price), mrp: Number(product.mrp || product.price) };
    if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
      return [base, ...product.variants.filter((v: any) => v.unit !== product.unit)];
    }
    return [base];
  }, [product]);

  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const selectedVariant = allVariants[selectedVariantIdx] || allVariants[0];

  const unitPrice = selectedVariant.price;
  const unitMrp = selectedVariant.mrp;
  const total = unitPrice * qty;
  const discount = unitMrp > unitPrice ? Math.round(((unitMrp - unitPrice) / unitMrp) * 100) : 0;

  const related = (relatedRes?.data || []).filter((p) => p.id !== product.id).slice(0, 4);
  const reviewCount = product.review_count || 0;

  const handleAdd = () => {
    addToCart({ ...product, price: unitPrice, mrp: unitMrp }, qty, selectedVariant.unit);
    toast.success(`Added ${qty} × ${product.name} (${selectedVariant.unit}) to cart`);
  };

  const handleBuyNow = () => {
    addToCart({ ...product, price: unitPrice, mrp: unitMrp }, qty, selectedVariant.unit);
    navigate({ to: "/checkout" });
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/products/${product.id}`;
    const data = { title: product.name, text: `Check out ${product.name} on Vegamart`, url };
    try {
      if (navigator.share) {
        await navigator.share(data);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard");
      }
    } catch (err) {
      // User cancelled native share sheet — ignore
      void err;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32 lg:pb-16">
      <div className="lg:mx-auto lg:max-w-6xl lg:px-6 lg:pt-8 lg:grid lg:grid-cols-2 lg:gap-8">
        {/* Gallery */}
        <div className="relative bg-emerald-50 lg:rounded-3xl lg:overflow-hidden lg:sticky lg:top-24 lg:self-start">
          <div className="absolute top-4 left-4 right-4 z-10 flex justify-between lg:hidden">
            <Link
              to="/"
              aria-label="Back"
              className="grid h-10 w-10 place-items-center rounded-full bg-white/95 backdrop-blur shadow"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex gap-2">
              <button
                aria-label="Share"
                onClick={handleShare}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/95 backdrop-blur shadow"
              >
                <Share2 className="h-5 w-5" />
              </button>
              <button
                onClick={() => {
                  toggleWishlist(product);
                  if (wishlisted) {
                    toast.info(`Removed ${product.name} from wishlist`);
                  } else {
                    toast.success(`Added ${product.name} to wishlist ❤️`);
                  }
                }}
                aria-label="Save"
                aria-pressed={wishlisted}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/95 backdrop-blur shadow hover:scale-105 transition-transform"
              >
                <Heart
                  className={`h-5 w-5 transition-colors ${wishlisted ? "fill-rose-500 text-rose-500" : "text-zinc-600"}`}
                />
              </button>
            </div>
          </div>
          <div className="aspect-square w-full overflow-hidden bg-black/5 flex items-center justify-center">
            {gallery[imageIdx]?.match(/\.(mp4|webm|ogg)$/i) ? (
              <video
                src={gallery[imageIdx]}
                autoPlay
                controls
                loop
                muted
                playsInline
                className="h-full w-full object-contain bg-black"
              />
            ) : (
              <img
                src={gallery[imageIdx]}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            )}
          </div>
          {discount > 0 && (
            <span className="absolute left-4 bottom-4 rounded-full bg-emerald-700 px-3 py-1 text-[11px] font-bold text-white">
              {discount}% OFF
            </span>
          )}
        </div>

        {/* Thumbnails */}
        {gallery.length > 1 && (
          <div className="mx-auto max-w-3xl px-4 mt-4 lg:hidden">
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {gallery.map((src, i) => {
                const isVideo = src.match(/\.(mp4|webm|ogg)$/i);
                return (
                  <button
                    key={i}
                    onClick={() => setImageIdx(i)}
                    className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition bg-muted flex items-center justify-center ${
                      imageIdx === i ? "border-primary" : "border-border opacity-70"
                    }`}
                    aria-label={`View media ${i + 1}`}
                  >
                    {isVideo ? (
                      <>
                        <video
                          src={src}
                          className="absolute inset-0 h-full w-full object-cover opacity-50"
                        />
                        <PlayCircle className="h-6 w-6 text-white drop-shadow-md relative z-10" />
                      </>
                    ) : (
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <main className="mx-auto max-w-3xl px-4 mt-5 lg:mx-0 lg:max-w-none lg:px-0 lg:mt-0">
          {/* Info card */}
          <section className="rounded-2xl bg-card border p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-primary text-[10.5px] font-bold px-2 py-0.5">
                <Star className="h-3 w-3 fill-current" /> {product.rating || "0.0"}
                <span className="text-muted-foreground font-normal ml-1">
                  ({reviewCount.toLocaleString("en-IN")})
                </span>
              </span>
              <button
                onClick={() => setReviewOpen(true)}
                className="inline-flex items-center gap-1 rounded-full border bg-card text-[10.5px] font-semibold px-2.5 py-1 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              >
                <MessageSquare className="h-3 w-3" /> Rate this product
              </button>
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold leading-tight">{product.name}</h1>
            {vendor && (
              <p className="mt-1 text-[13px] text-muted-foreground">
                by{" "}
                <Link
                  to="/vendors/$vendorId"
                  params={{ vendorId: vendor.id }}
                  className="text-primary font-semibold"
                >
                  {vendor.business_name}
                </Link>{" "}
                · {selectedVariant.unit}
              </p>
            )}

            {/* Price */}
            <div className="mt-4 flex items-baseline gap-3">
              <span className="font-display text-3xl font-bold tabular-nums">₹{unitPrice}</span>
              {unitMrp > unitPrice && (
                <span className="text-sm text-muted-foreground line-through tabular-nums">
                  ₹{unitMrp}
                </span>
              )}
              {discount > 0 && (
                <span className="text-[12px] font-bold text-primary">
                  You save ₹{unitMrp - unitPrice}
                </span>
              )}
            </div>
            <p className="text-[11.5px] text-muted-foreground">Inclusive of all taxes</p>

            {/* Dynamic Variants / Pack size */}
            {allVariants.length > 0 && (
              <div className="mt-5">
                <div className="text-[12px] font-semibold text-foreground/80">Pack size</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {allVariants.map((v, idx) => (
                    <button
                      key={v.unit}
                      onClick={() => setSelectedVariantIdx(idx)}
                      className={`rounded-xl border p-2.5 text-center transition min-w-[80px] ${
                        selectedVariantIdx === idx
                          ? "border-primary bg-emerald-50 ring-1 ring-primary/30"
                          : "border-border hover:border-emerald-300"
                      }`}
                    >
                      <div className={`text-[13px] font-semibold ${selectedVariantIdx === idx ? "text-primary" : "text-foreground"}`}>
                        {v.unit}
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                        ₹{v.price}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Qty */}
            <div className="mt-5 flex items-center justify-between">
              <span className="text-[13px] font-semibold">Quantity</span>
              <div className="inline-flex items-center rounded-full bg-emerald-50 text-primary">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="grid h-10 w-10 place-items-center"
                  aria-label="Decrease"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center font-semibold tabular-nums">{qty}</span>
                <button
                  onClick={() => setQty((q) => Math.min(20, q + 1))}
                  className="grid h-10 w-10 place-items-center"
                  aria-label="Increase"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Inline desktop action bar — visible above the fold */}
            <div className="hidden lg:flex items-center gap-3 mt-6 pt-5 border-t border-border">
              <div className="mr-auto">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Total
                </div>
                <div className="font-display text-2xl font-bold tabular-nums">₹{total}</div>
              </div>
              <button
                onClick={() => {
                  toggleWishlist(product);
                  if (wishlisted) {
                    toast.info(`Removed ${product.name} from wishlist`);
                  } else {
                    toast.success(`Added ${product.name} to wishlist ❤️`);
                  }
                }}
                className={`inline-flex items-center gap-2 rounded-full border px-5 text-sm font-bold h-12 transition-all ${
                  wishlisted
                    ? "bg-rose-50 border-rose-200 text-rose-600"
                    : "bg-card hover:bg-muted text-foreground"
                }`}
              >
                <Heart className={`h-4 w-4 ${wishlisted ? "fill-rose-500" : ""}`} />
                {wishlisted ? "Saved" : "Save"}
              </button>
              <button
                onClick={handleAdd}
                className="inline-flex items-center gap-2 rounded-full border bg-card hover:bg-muted text-foreground text-sm font-bold h-12 px-6 transition-all"
              >
                <Plus className="h-4 w-4" /> Add to cart
              </button>
              <button
                onClick={handleBuyNow}
                className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground text-sm font-bold h-12 px-7 shadow-md hover:bg-primary/90 transition-all"
              >
                Buy now <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>

          {/* Delivery promises */}
          <section className="mt-4 rounded-2xl bg-card border p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="font-semibold">Delivering to {displayLocation}</span>
              <Link to="/addresses" className="ml-auto text-[12px] font-semibold text-primary">
                Change
              </Link>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Fact icon={<Truck className="h-4 w-4" />} label="Delivery" value={`Free ₹${freeDeliveryThreshold}+`} />
              <Fact
                icon={<ShieldCheck className="h-4 w-4" />}
                label="Promise"
                value="Fresh or refund"
              />
            </div>
          </section>

          {/* About */}
          {product.description && (
            <section className="mt-4 rounded-2xl bg-card border p-5 shadow-sm">
              <h2 className="font-display text-[16px] font-bold">About this product</h2>
              <p className="mt-2 text-[13.5px] text-muted-foreground leading-relaxed">
                {product.description}
              </p>
            </section>
          )}

          {/* Related */}
          {related.length > 0 && (
            <section className="mt-6">
              <h2 className="font-display text-[16px] font-bold mb-3">You may also like</h2>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {related.map((p) => {
                  const disc = p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;
                  const imageUrl =
                    p.images?.[0]?.url ||
                    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop";
                  return (
                    <Link
                      key={p.id}
                      to="/products/$productId"
                      params={{ productId: p.id }}
                      className="rounded-2xl bg-card border overflow-hidden shadow-sm"
                    >
                      <div className="relative aspect-square bg-muted">
                        <img src={imageUrl} alt={p.name} className="h-full w-full object-cover" />
                        {disc > 0 && (
                          <span className="absolute top-2 left-2 rounded-full bg-emerald-700 px-2 py-0.5 text-[10px] font-bold text-white">
                            {disc}% OFF
                          </span>
                        )}
                      </div>
                      <div className="p-3">
                        <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                          <Star className="h-3 w-3 fill-primary text-primary" /> {p.rating || "0.0"}
                        </div>
                        <h3 className="mt-0.5 font-semibold text-[13.5px] truncate">{p.name}</h3>
                        <p className="text-[11.5px] text-muted-foreground">{p.unit}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-sm">₹{p.price}</span>
                            {p.mrp > p.price && (
                              <span className="ml-1 text-[10.5px] text-muted-foreground line-through">
                                ₹{p.mrp}
                              </span>
                            )}
                          </div>
                          <button
                            aria-label={`Add ${p.name}`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              addToCart(p, 1);
                              toast.success(`Added ${p.name} to cart`);
                            }}
                            className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </main>
      </div>


      {/* Sticky action bar (mobile) */}
      <div
        className="lg:hidden fixed inset-x-0 z-40 pointer-events-none"
        style={{ bottom: "calc(88px + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto max-w-md px-4">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/95 backdrop-blur border p-1.5 pl-4 shadow-[0_12px_30px_-10px_rgba(0,0,0,0.15)]">
            <div className="flex-1 min-w-0">
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                Total
              </div>
              <div className="font-display text-lg font-bold leading-none tabular-nums">
                ₹{total}
              </div>
            </div>
            <button
              onClick={handleAdd}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-primary font-semibold text-[13px] h-11 px-4"
            >
              Add
            </button>
            <button
              onClick={handleBuyNow}
              className="inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground font-semibold text-[13px] h-11 px-4"
            >
              Buy now <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <ReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        targetId={product.id}
        targetName={product.name}
        targetType="product"
        onSuccess={() => setReviewOpen(false)}
      />
    </div>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-emerald-50/60 p-2.5 text-center">
      <span className="inline-grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground mx-auto">
        {icon}
      </span>
      <div className="mt-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-[12px] font-semibold">{value}</div>
    </div>
  );
}
