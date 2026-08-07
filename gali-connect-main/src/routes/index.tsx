import React, { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  MapPin,
  ChevronDown,
  Search,
  ShoppingCart,
  ArrowRight,
  Star,
  Clock,
  Plus,
  Radio,
  Carrot,
  Apple,
  Milk,
  ShoppingBasket,
  Drumstick,
  Fish,
  Egg,
  Croissant,
  Wrench,
  Plug,
  Coffee,
  Heart,
} from "lucide-react";
import { PullToRefresh } from "@/components/system/pull-to-refresh";
import { Logo } from "@/components/system/logo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getFeaturedProducts } from "@/lib/api";
import { homePathForRole } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { useCart } from "@/context/cart-context";
import { useWishlist } from "@/context/wishlist-context";
import { useLocation } from "@/hooks/use-location";
import { toast } from "sonner";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vegamart — India's First Live Vendor Network" },
      {
        name: "description",
        content:
          "Har Gali Banegi Live Market. See moving vendors on the map and order from the nearest one — fresh vegetables, fruits, dairy, bakery and more.",
      },
      { property: "og:title", content: "Vegamart — Har Gali Banegi Live Market" },
      {
        property: "og:description",
        content:
          "India's first live local vendor network. Order groceries, fruits, dairy, chai and more from vendors moving near you.",
      },
    ],
  }),
  component: Home,
});

type Cat = { id: string; name: string; Icon: LucideIcon; bg: string; fg: string; to: string };

const CATS: Cat[] = [
  {
    id: "live",
    name: "Live Vendor",
    Icon: MapPin,
    bg: "bg-emerald-700",
    fg: "text-white",
    to: "/street-vendors",
  },
  {
    id: "veg",
    name: "Vegetables",
    Icon: Carrot,
    bg: "bg-emerald-100",
    fg: "text-emerald-700",
    to: "/products?category=Fruits%20%26%20Vegetables",
  },
  {
    id: "fruits",
    name: "Fruits",
    Icon: Apple,
    bg: "bg-rose-100",
    fg: "text-rose-700",
    to: "/products?category=Fruits%20%26%20Vegetables",
  },
  {
    id: "dairy",
    name: "Dairy",
    Icon: Milk,
    bg: "bg-sky-100",
    fg: "text-sky-700",
    to: "/products?category=Dairy%20%26%20Eggs",
  },
  {
    id: "grocery",
    name: "Grocery",
    Icon: ShoppingBasket,
    bg: "bg-amber-100",
    fg: "text-amber-700",
    to: "/products",
  },
  {
    id: "meat",
    name: "Meat",
    Icon: Drumstick,
    bg: "bg-orange-100",
    fg: "text-orange-700",
    to: "/products",
  },
  {
    id: "fish",
    name: "Fish",
    Icon: Fish,
    bg: "bg-cyan-100",
    fg: "text-cyan-700",
    to: "/products",
  },
  {
    id: "eggs",
    name: "Eggs",
    Icon: Egg,
    bg: "bg-yellow-100",
    fg: "text-yellow-700",
    to: "/products?category=Dairy%20%26%20Eggs",
  },
  {
    id: "bakery",
    name: "Bakery",
    Icon: Croissant,
    bg: "bg-amber-100",
    fg: "text-amber-700",
    to: "/products?category=Bakery%20%26%20Snacks",
  },
  {
    id: "chai",
    name: "Chai & Snacks",
    Icon: Coffee,
    bg: "bg-orange-100",
    fg: "text-orange-700",
    to: "/products",
  },
  {
    id: "hardware",
    name: "Hardware",
    Icon: Wrench,
    bg: "bg-slate-200",
    fg: "text-slate-700",
    to: "/products",
  },
  {
    id: "electronics",
    name: "Electronics",
    Icon: Plug,
    bg: "bg-violet-100",
    fg: "text-violet-700",
    to: "/products",
  },
];

function Home() {
  const { activeAddress, displayLocation } = useLocation();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Non-customer roles must never see the marketplace — send them to their portal.
  useEffect(() => {
    if (!authLoading && user && user.role !== "customer") {
      navigate({ to: homePathForRole(user.role) });
    }
  }, [user, authLoading, navigate]);

  const refresh = async () => {
    await queryClient.invalidateQueries();
  };
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PullToRefresh onRefresh={refresh}>
        <main className="px-4 pb-28 md:pb-16 md:mx-auto md:max-w-7xl md:px-6 lg:px-8">
          <div className="md:hidden">
            <Header displayLocation={displayLocation} />
            <SearchBar />
          </div>
          <Hero />
          <FeaturedProducts />
          <Categories />
          <LiveBanner />
          <LiveVendors defaultAddress={activeAddress} />
          <ShopsNearYou defaultAddress={activeAddress} />
          <Offers />
          <Recommended />
          <RecentlyViewed />
          <Trending />
          <BrandFooter />
        </main>
      </PullToRefresh>
    </div>
  );
}

function Header({ displayLocation }: { displayLocation: string }) {
  const { itemCount } = useCart();
  return (
    <div className="pt-4 pb-3 flex items-center gap-3">
      <Link to="/" aria-label="Vegamart home" className="shrink-0">
        <Logo className="h-11 w-11" />
      </Link>
      <Link to="/addresses" className="flex-1 min-w-0 text-left tap-highlight-none">
        <div className="flex items-center gap-1 text-[11px] font-semibold text-primary">
          <MapPin className="h-3 w-3" /> Deliver to <ChevronDown className="h-3 w-3" />
        </div>
        <div className="mt-0.5 text-[15px] font-bold truncate">{displayLocation}</div>
      </Link>
      <Link
        to="/cart"
        aria-label="Cart"
        className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-50 text-primary tap-highlight-none"
      >
        <ShoppingCart className="h-5 w-5" />
        {itemCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] px-1 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground ring-2 ring-background">
            {itemCount > 99 ? "99+" : itemCount}
          </span>
        )}
      </Link>
    </div>
  );
}

function SearchBar() {
  return (
    <div>
      <Link
        to="/search"
        className="flex items-center gap-3 rounded-full bg-card border h-12 px-4 shadow-sm hover:border-primary/40 transition-colors"
      >
        <Search className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 truncate text-sm text-muted-foreground">
          Search for tomatoes, vendors, shops…
        </span>
      </Link>
    </div>
  );
}

import { type CarouselApi } from "@/components/ui/carousel";

function Hero() {
  const { data: slidesResponse, isLoading } = useQuery({
    queryKey: ["hero-slides"],
    queryFn: () =>
      api
        .get<
          Array<{
            id: string;
            title: string;
            subtitle: string | null;
            body: string | null;
            image_url: string | null;
            link_url: string | null;
            link_text: string | null;
            is_active: boolean;
          }>
        >("/hero-slides/public")
        .then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const slides = slidesResponse?.filter((s) => s.is_active !== false) ?? [];

  const [apiCarousel, setApiCarousel] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!apiCarousel) {
      return;
    }

    setCurrent(apiCarousel.selectedScrollSnap());

    apiCarousel.on("select", () => {
      setCurrent(apiCarousel.selectedScrollSnap());
    });

    const intervalId = setInterval(() => {
      if (apiCarousel.canScrollNext()) {
        apiCarousel.scrollNext();
      } else {
        apiCarousel.scrollTo(0);
      }
    }, 4000);

    return () => clearInterval(intervalId);
  }, [apiCarousel]);

  if (isLoading || slides.length === 0) {
    return (
      <section className="pt-4 md:pt-8">
        <div className="relative overflow-hidden rounded-3xl md:rounded-[32px] bg-emerald-800 text-white h-[260px] md:h-[320px] p-6 md:p-10 shadow-lg flex flex-col justify-center">
          <div
            className="absolute inset-0 opacity-30 mix-blend-overlay"
            style={{
              backgroundImage:
                "radial-gradient(ellipse at 100% 0%, rgba(255,255,255,0.25), transparent 55%), radial-gradient(ellipse at 0% 100%, rgba(0,0,0,0.35), transparent 60%)",
            }}
          />
          <div className="relative md:max-w-2xl z-10">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-[10.5px] md:text-xs font-semibold uppercase tracking-wide">
              <Radio className="h-3 w-3" /> India's First Live Vendor Network
            </span>
            <h1 className="mt-3 md:mt-4 font-display text-3xl md:text-4xl lg:text-5xl leading-[1.1] font-bold tracking-tight">
              Har Gali Banegi
              <br />
              Live Market.
            </h1>
            <p className="mt-2 md:mt-3 text-[13.5px] md:text-base leading-snug text-white/85 max-w-[22ch] md:max-w-[42ch]">
              See moving vendors on the map. Buy from the nearest one, right now.
            </p>
            <Link
              to="/street-vendors"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-white text-emerald-900 font-semibold text-sm px-5 py-2.5 shadow-sm hover:bg-emerald-50 transition-colors"
            >
              <MapPin className="h-4 w-4" /> Open Live Map <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="pt-4 md:pt-8">
      <Carousel className="relative group" setApi={setApiCarousel}>
        <CarouselContent>
          {slides.map((slide) => (
            <CarouselItem key={slide.id}>
              <div className="relative overflow-hidden rounded-3xl md:rounded-[32px] bg-emerald-800 text-white h-[260px] md:h-[320px] p-6 md:p-10 shadow-lg flex flex-col justify-center">
                <div
                  className="absolute inset-0 opacity-30 mix-blend-overlay"
                  style={{
                    backgroundImage:
                      "radial-gradient(ellipse at 100% 0%, rgba(255,255,255,0.25), transparent 55%), radial-gradient(ellipse at 0% 100%, rgba(0,0,0,0.35), transparent 60%)",
                  }}
                />
                {slide.image_url && (
                  <img
                    src={slide.image_url}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover opacity-20"
                  />
                )}
                <div className="relative md:max-w-2xl z-10">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-[10.5px] md:text-xs font-semibold uppercase tracking-wide">
                    <Radio className="h-3 w-3" /> {slide.title}
                  </span>
                  {slide.subtitle && (
                    <h1 className="mt-3 md:mt-4 font-display text-3xl md:text-4xl lg:text-5xl leading-[1.1] font-bold tracking-tight">
                      {slide.subtitle}
                    </h1>
                  )}
                  {slide.body && (
                    <p className="mt-2 md:mt-3 text-[13.5px] md:text-base leading-snug text-white/85 max-w-[22ch] md:max-w-[42ch]">
                      {slide.body}
                    </p>
                  )}
                  {slide.link_url && (
                    <Link
                      to={slide.link_url}
                      className="mt-4 inline-flex items-center gap-2 rounded-full bg-white text-emerald-900 font-semibold text-sm px-5 py-2.5 shadow-sm hover:bg-emerald-50 transition-colors"
                    >
                      {slide.link_text || "Explore"} <ArrowRight className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {slides.length > 1 && (
          <div className="absolute bottom-4 md:bottom-6 left-0 right-0 flex justify-center gap-2 z-20">
            {slides.map((_, index) => (
              <button
                key={index}
                className={`h-2 transition-all duration-300 rounded-full ${
                  current === index ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/75"
                }`}
                onClick={() => apiCarousel?.scrollTo(index)}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        )}
      </Carousel>
    </section>
  );
}

function FeaturedProducts() {
  const { data: featuredResponse, isLoading } = useQuery({
    queryKey: ["featured-products"],
    queryFn: () => getFeaturedProducts().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const products = featuredResponse?.rows ?? [];

  if (isLoading || products.length === 0) return null;

  return (
    <section className="pt-6 md:pt-10">
      <h2 className="font-display text-[22px] md:text-3xl font-bold tracking-tight">
        Featured Products
      </h2>
      <p className="text-[13px] md:text-sm text-muted-foreground">
        Hand-picked picks from our vendors
      </p>
      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {products.map((product) => {
          const image = product.images?.[0]?.url;
          return (
            <Link
              key={product.id}
              to="/products/$productId"
              params={{ productId: product.id }}
              className="group rounded-2xl bg-card border hover:border-primary/40 transition-colors overflow-hidden"
            >
              <div className="aspect-square bg-muted relative">
                {image ? (
                  <img src={image} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <Heart className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <h3 className="text-[13px] font-medium truncate group-hover:text-primary transition-colors">
                  {product.name}
                </h3>
                <div className="mt-1 flex items-center gap-1">
                  <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                  <span className="text-[11px] text-muted-foreground">
                    {product.rating.toFixed(1)} ({product.review_count})
                  </span>
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-sm font-bold">₹{product.price}</span>
                  {product.mrp > product.price && (
                    <span className="text-[11px] text-muted-foreground line-through">
                      ₹{product.mrp}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function Categories() {
  const { data: res } = useQuery({
    queryKey: ["publicCategories"],
    queryFn: () => api.get<any[]>("/categories"),
    staleTime: 5 * 60 * 1000,
  });

  const dbCats = res?.data || [];
  // Ensure we only show active categories
  const activeCats = dbCats.filter((c: any) => c.is_active !== false);

  return (
    <section className="px-4 md:px-0 pt-6 md:pt-10">
      <h2 className="font-display text-[22px] md:text-3xl font-bold tracking-tight">
        Shop by category
      </h2>
      <p className="text-[13px] md:text-sm text-muted-foreground">Everything your gali offers</p>
      <div className="mt-4 grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 md:gap-4">
        <Link
          to="/street-vendors"
          className="flex flex-col items-center gap-1.5 md:gap-2 tap-highlight-none"
        >
          <div className="grid aspect-square w-full place-items-center rounded-2xl bg-emerald-700 text-white">
            <MapPin className="h-7 w-7 md:h-8 md:w-8" strokeWidth={1.75} />
          </div>
          <span className="text-[11.5px] md:text-[13px] font-medium text-center leading-tight">
            Live Vendor
          </span>
        </Link>
        {activeCats.map((c: any) => (
          <Link
            key={c.id}
            to="/products"
            search={{ category: c.id }}
            className="flex flex-col items-center gap-1.5 md:gap-2 tap-highlight-none"
          >
            <div className="grid aspect-square w-full place-items-center rounded-2xl bg-muted text-muted-foreground overflow-hidden">
              {c.image_url ? (
                <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
              ) : (
                <ShoppingBasket className="h-7 w-7 md:h-8 md:w-8" strokeWidth={1.75} />
              )}
            </div>
            <span className="text-[11.5px] md:text-[13px] font-medium text-center leading-tight">
              {c.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function LiveBanner() {
  const { data: res, isLoading } = useQuery({
    queryKey: ["banners"],
    queryFn: () => api.get<any[]>("/banners"),
  });
  const banners = res?.data || [];
  const activeBanner = banners.find((b) => b.type === "LiveNow" || b.position === "LiveNow") || {
    title: "🔥 Live vendors near you - Order fresh now!",
  };

  if (isLoading) {
    return (
      <section className="px-4 md:px-0 pt-6 md:pt-10">
        <div className="flex items-center gap-3 md:gap-4 rounded-2xl md:rounded-3xl bg-muted/70 border border-border/60 px-4 md:px-6 py-4 md:py-5 animate-pulse">
          <span className="grid h-10 w-10 md:h-12 md:w-12 shrink-0 place-items-center rounded-full bg-foreground/10">
            <MapPin className="h-5 w-5 text-foreground/30" />
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-2.5 w-16 rounded-full bg-foreground/10" />
            <div className="h-3.5 w-48 max-w-full rounded-full bg-foreground/15" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 md:px-0 pt-6 md:pt-10">
      <Link
        to="/street-vendors"
        className="flex items-center gap-3 md:gap-4 rounded-2xl md:rounded-3xl bg-emerald-700 text-white px-4 md:px-6 py-4 md:py-5 shadow-[0_12px_30px_-16px_rgba(16,80,50,0.6)]"
      >
        <span className="grid h-10 w-10 md:h-12 md:w-12 place-items-center rounded-full bg-white/15">
          <MapPin className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10.5px] md:text-xs font-semibold uppercase tracking-wide text-white/85">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" /> Live now
          </div>
          <div className="mt-0.5 font-semibold text-[15px] md:text-lg">{activeBanner.title}</div>
        </div>
        <ArrowRight className="h-5 w-5" />
      </Link>
    </section>
  );
}

function isRoamingVendor(v: any): boolean {
  return (
    v.roaming === true ||
    v.vendor?.roaming === true ||
    v.profile?.roaming === true ||
    v.vendor_type === "roaming"
  );
}

function LiveVendors({ defaultAddress }: { defaultAddress?: any }) {
  const { data: res, isLoading } = useQuery({
    queryKey: ["vendors", "live", defaultAddress?.latitude, defaultAddress?.longitude],
    queryFn: () => {
      let url = "/vendors";
      if (defaultAddress?.latitude && defaultAddress?.longitude) {
        url = `/vendors/nearby?lat=${defaultAddress.latitude}&lng=${defaultAddress.longitude}`;
      }
      return api.get<any[]>(url);
    },
  });

  const list = (res?.data || []).filter(isRoamingVendor).slice(0, 6);

  return (
    <section className="pt-6 md:pt-10">
      <div className="flex items-end justify-between">
        <h2 className="font-display text-[22px] md:text-3xl font-bold tracking-tight">
          Live street vendors near you
        </h2>
        <Link to="/street-vendors" className="text-sm md:text-base font-semibold text-primary">
          See map →
        </Link>
      </div>

      {isLoading ? (
        <div className="mt-5">Loading live vendors...</div>
      ) : list.length === 0 ? (
        <div className="mt-5 text-muted-foreground text-sm">
          No live street vendors found nearby.
        </div>
      ) : (
        <div className="mt-3 md:mt-5 flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 overflow-x-auto md:overflow-visible no-scrollbar pb-1 md:pb-0 snap-x snap-mandatory">
          {list.map((v) => {
            const imageUrl =
              v.logo_url ||
              v.banner_url ||
              "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=600&fit=crop";
            let tags = ["Local vendor"];
            const rawTags = v.tags;
            if (Array.isArray(rawTags) && rawTags.length > 0) {
              tags = rawTags;
            } else if (typeof rawTags === "string" && rawTags.trim()) {
              try {
                const parsed = JSON.parse(rawTags);
                if (Array.isArray(parsed) && parsed.length > 0) tags = parsed;
                else tags = [];
              } catch (e) {}
              if (tags.length === 0) {
                tags = rawTags
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean);
              }
            }
            const hasDistance = typeof v.distance_km === "number";
            const hasEta = typeof v.eta_min === "number";
            const distance = hasDistance ? v.distance_km.toFixed(1) : null;
            const eta = hasEta ? v.eta_min.toString() : null;

            return (
              <Link
                key={v.id}
                to="/vendors/$vendorId"
                params={{ vendorId: v.id }}
                className="snap-start shrink-0 md:shrink w-[78%] md:w-auto rounded-2xl bg-card border overflow-hidden shadow-sm hover:border-primary/40 transition-colors"
              >
                <div className="flex gap-3 p-3">
                  <div className="relative h-20 w-20 md:h-24 md:w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
                    <img
                      src={imageUrl}
                      alt={v.business_name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-md bg-emerald-700 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      <span className="h-1 w-1 rounded-full bg-red-300 animate-pulse" /> LIVE
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <h3 className="font-semibold text-[15px] truncate">{v.business_name}</h3>
                      {v.is_verified && (
                        <span className="grid h-4 w-4 place-items-center rounded-full bg-primary text-primary-foreground text-[9px]">
                          ✓
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-muted-foreground truncate">{tags[0]}</p>
                    <div className="mt-1.5 flex items-center gap-2 text-[11.5px]">
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100/80 px-1.5 py-0.5 text-[10px] font-black text-amber-700">
                        <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                        {typeof v.rating === "number" && v.rating > 0 ? v.rating.toFixed(1) : "New"}
                        {typeof v.review_count === "number" && v.review_count > 0 && (
                          <span className="font-semibold text-amber-600 ml-0.5">({v.review_count})</span>
                        )}
                      </span>
                      {hasDistance && (
                        <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {distance} km
                        </span>
                      )}
                      {hasEta && (
                        <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                          <Clock className="h-3 w-3" /> {eta} min
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ShopsNearYou({ defaultAddress }: { defaultAddress?: any }) {
  const { data: res, isLoading } = useQuery({
    queryKey: ["vendors", "shops", defaultAddress?.latitude, defaultAddress?.longitude],
    queryFn: () => {
      let url = "/vendors";
      if (defaultAddress?.latitude && defaultAddress?.longitude) {
        url = `/vendors/nearby?lat=${defaultAddress.latitude}&lng=${defaultAddress.longitude}`;
      }
      return api.get<any[]>(url);
    },
  });

  const list = (res?.data || []).filter((v) => !isRoamingVendor(v)).slice(0, 6);

  if (!isLoading && list.length === 0) return null;

  return (
    <section className="pt-6 md:pt-10">
      <div className="flex items-end justify-between">
        <h2 className="font-display text-[22px] md:text-3xl font-bold tracking-tight">
          Local shops near you
        </h2>
        <Link to="/vendors" className="text-sm md:text-base font-semibold text-primary">
          See all →
        </Link>
      </div>

      {isLoading ? (
        <div className="mt-5">Loading shops...</div>
      ) : (
        <div className="mt-3 md:mt-5 flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 overflow-x-auto md:overflow-visible no-scrollbar pb-1 md:pb-0 snap-x snap-mandatory">
          {list.map((v) => {
            const imageUrl =
              v.logo_url ||
              v.banner_url ||
              "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=600&fit=crop";
            let tags = ["Local vendor"];
            const rawTags = v.tags;
            if (Array.isArray(rawTags) && rawTags.length > 0) {
              tags = rawTags;
            } else if (typeof rawTags === "string" && rawTags.trim()) {
              try {
                const parsed = JSON.parse(rawTags);
                if (Array.isArray(parsed) && parsed.length > 0) tags = parsed;
                else tags = [];
              } catch (e) {}
              if (tags.length === 0) {
                tags = rawTags
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean);
              }
            }

            return (
              <Link
                key={v.id}
                to="/vendors/$vendorId"
                params={{ vendorId: v.id }}
                className="snap-start shrink-0 md:shrink w-[78%] md:w-auto rounded-2xl bg-card border overflow-hidden shadow-sm hover:border-primary/40 transition-colors"
              >
                <div className="flex gap-3 p-3">
                  <div className="relative h-20 w-20 md:h-24 md:w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
                    <img
                      src={imageUrl}
                      alt={v.business_name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <h3 className="font-semibold text-[15px] truncate">{v.business_name}</h3>
                      {v.is_verified && (
                        <span className="grid h-4 w-4 place-items-center rounded-full bg-primary text-primary-foreground text-[9px]">
                          ✓
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-muted-foreground truncate">{tags[0]}</p>
                    <div className="mt-1.5 flex items-center gap-2 text-[11.5px]">
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100/80 px-1.5 py-0.5 text-[10px] font-black text-amber-700">
                        <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                        {typeof v.rating === "number" && v.rating > 0 ? v.rating.toFixed(1) : "New"}
                        {typeof v.review_count === "number" && v.review_count > 0 && (
                          <span className="font-semibold text-amber-600 ml-0.5">({v.review_count})</span>
                        )}
                      </span>
                      {typeof v.distance_km === "number" && (
                        <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {v.distance_km.toFixed(1)} km
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function RecentlyViewed() {
  const { user } = useAuth();
  const { addToCart } = useCart();

  const { data: res, isLoading } = useQuery({
    queryKey: ["recently_viewed"],
    queryFn: () => api.get<any[]>("/users/me/recently-viewed"),
    enabled: !!user,
  });

  const list = res?.data || [];

  if (!user || list.length === 0) return null;

  return (
    <section className="pt-6 md:pt-10">
      <h2 className="font-display text-[22px] md:text-3xl font-bold tracking-tight">
        Recently Viewed
      </h2>

      {isLoading ? (
        <div className="mt-5">Loading...</div>
      ) : (
        <div className="mt-3 md:mt-5 flex md:grid md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4 overflow-x-auto md:overflow-visible no-scrollbar pb-1 md:pb-0 snap-x snap-mandatory">
          {list.map((entry) => {
            const p = entry?.product ?? entry;
            const disc = p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;
            const imageUrl =
              p.image ||
              p.images?.[0]?.url ||
              "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop";
            const cartProduct = {
              id: p.id,
              name: p.name,
              slug: p.slug || p.name,
              price: Number(p.price),
              mrp: Number(p.mrp ?? p.price ?? 0),
              unit: p.unit || "",
              vendor_id: p.vendor_id,
              category_id: p.category_id || "",
              rating: p.rating || 0,
              review_count: p.review_count || 0,
              is_active: true,
              is_featured: false,
              images: p.image ? [{ url: p.image }] : [],
            };

            return (
              <Link
                key={p.id}
                to="/products/$productId"
                params={{ productId: p.id }}
                className="snap-start shrink-0 md:shrink w-[46%] md:w-auto rounded-2xl bg-card border overflow-hidden shadow-sm hover:border-primary/40 transition-colors"
              >
                <div className="relative aspect-square bg-muted">
                  <img
                    src={imageUrl}
                    alt={p.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
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
                  <h3 className="mt-0.5 font-semibold text-[14px] truncate">{p.name}</h3>
                  <p className="text-[11.5px] text-muted-foreground">{p.unit}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-[15px]">₹{p.price}</span>
                    </div>
                    <button
                      aria-label={`Add ${p.name}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        addToCart(cartProduct as any, 1);
                        toast.success(`Added ${p.name} to cart`);
                      }}
                      className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Trending() {
  const { addToCart } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { data: res, isLoading } = useQuery({
    queryKey: ["products", "trending"],
    queryFn: () => api.get<any[]>("/products/trending"),
  });
  const list = res?.data?.slice(0, 6) || [];

  return (
    <section className="pt-6 md:pt-10">
      <h2 className="font-display text-[22px] md:text-3xl font-bold tracking-tight">
        Trending in your gali
      </h2>

      {isLoading ? (
        <div className="mt-5">Loading trending products...</div>
      ) : list.length === 0 ? (
        <div className="mt-5 text-muted-foreground text-sm">No trending products found.</div>
      ) : (
        <div className="mt-3 md:mt-5 flex md:grid md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4 overflow-x-auto md:overflow-visible no-scrollbar pb-1 md:pb-0 snap-x snap-mandatory">
          {list.map((p) => {
            const disc = p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;
            const imageUrl =
              p.images?.[0]?.url ||
              "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop";
            const wishlisted = isWishlisted(p.id);

            return (
              <Link
                key={p.id}
                to="/products/$productId"
                params={{ productId: p.id }}
                className="snap-start shrink-0 md:shrink w-[46%] md:w-auto rounded-2xl bg-card border overflow-hidden shadow-sm hover:border-primary/40 transition-colors"
              >
                <div className="relative aspect-square bg-muted">
                  <img
                    src={imageUrl}
                    alt={p.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  {disc > 0 && (
                    <span className="absolute top-2 left-2 rounded-full bg-emerald-700 px-2 py-0.5 text-[10px] font-bold text-white">
                      {disc}% OFF
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleWishlist(p);
                      if (wishlisted) {
                        toast.info(`Removed ${p.name} from wishlist`);
                      } else {
                        toast.success(`Added ${p.name} to wishlist ❤️`);
                      }
                    }}
                    aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
                    className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-background/80 backdrop-blur-xs shadow-sm border border-border/50 hover:bg-background transition-colors z-10"
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
                <div className="p-3">
                  <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                    <Star className="h-3 w-3 fill-primary text-primary" /> {p.rating || "0.0"}
                    <span className="text-muted-foreground font-normal">
                      ({p.review_count || 0})
                    </span>
                  </div>
                  <h3 className="mt-0.5 font-semibold text-[14px] truncate">{p.name}</h3>
                  <p className="text-[11.5px] text-muted-foreground">{p.unit}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-[15px]">₹{p.price}</span>
                      {p.mrp > p.price && (
                        <span className="ml-1 text-[11px] text-muted-foreground line-through">
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
                      className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Offers() {
  const { data: res, isLoading } = useQuery({
    queryKey: ["offers"],
    queryFn: () => api.get<any[]>("/offers"),
  });
  const offersList = res?.data || [];

  if (isLoading) {
    return <div className="px-4 mt-5 text-muted-foreground text-sm">Loading offers...</div>;
  }

  if (offersList.length === 0) {
    return null; // Don't show the section if no active offers
  }

  return (
    <section id="offers-section" className="pt-6 md:pt-10">
      <h2 className="px-4 md:px-0 font-display text-[22px] md:text-3xl font-bold tracking-tight">
        Offers for you
      </h2>
      <div className="mt-3 md:mt-5 flex md:grid md:grid-cols-3 gap-3 md:gap-4 overflow-x-auto md:overflow-visible no-scrollbar px-4 md:px-0 pb-1 md:pb-0 snap-x snap-mandatory">
        {offersList.map((o: any) => {
          const tone =
            o.tone === "green"
              ? "bg-emerald-700 text-white"
              : o.tone === "amber"
                ? "bg-amber-500 text-amber-950"
                : "bg-rose-500 text-white";
          return (
            <Link
              key={o.id}
              to="/vendors"
              className={`snap-start shrink-0 md:shrink w-[72%] md:w-auto rounded-2xl md:rounded-3xl p-4 md:p-6 ${tone} shadow-sm`}
            >
              <div className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider opacity-80">
                {o.tag}
              </div>
              <div className="mt-1.5 md:mt-2 font-display text-[19px] md:text-2xl font-bold leading-tight">
                {o.title}
              </div>
              <div className="mt-1 md:mt-2 text-[12.5px] md:text-sm opacity-90">{o.sub}</div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function BrandFooter() {
  return (
    <section className="px-4 md:px-0 pt-8 md:pt-12">
      <div className="rounded-2xl md:rounded-3xl border bg-card p-5 md:p-8 text-center">
        <div className="font-display text-[22px] md:text-2xl font-bold text-primary">VegaMart</div>
        <p className="mt-1 md:mt-2 text-[13px] md:text-sm text-muted-foreground">
          India's first live local vendor network. Har gali banegi live market.
        </p>
        <p className="mt-3 md:mt-4 text-[11px] md:text-xs text-muted-foreground">
          © 2026 VegaMart. Made with 💚 in Bengaluru.
        </p>
      </div>
    </section>
  );
}

function Recommended() {
  const { user } = useAuth();
  const { addToCart } = useCart();

  const { data: res, isLoading } = useQuery({
    queryKey: ["recommended_products"],
    queryFn: () => api.get<any[]>("/users/me/recommended"),
    enabled: !!user,
  });

  const list = res?.data || [];

  if (!user || list.length === 0) return null;

  return (
    <section className="pt-6 md:pt-10">
      <h2 className="px-4 md:px-0 font-display text-[22px] md:text-3xl font-bold tracking-tight">
        Recommended For You
      </h2>

      {isLoading ? (
        <div className="px-4 mt-5">Loading...</div>
      ) : (
        <div className="mt-3 md:mt-5 flex md:grid md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4 overflow-x-auto md:overflow-visible no-scrollbar px-4 md:px-0 pb-1 md:pb-0 snap-x snap-mandatory">
          {list.map((p) => {
            const disc = p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;
            const imageUrl =
              p.image ||
              p.images?.[0]?.url ||
              "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop";

            return (
              <Link
                key={p.id}
                to="/products/$productId"
                params={{ productId: p.id }}
                className="snap-start shrink-0 md:shrink w-[46%] md:w-auto rounded-2xl bg-card border overflow-hidden shadow-sm hover:border-primary/40 transition-colors"
              >
                <div className="relative aspect-square bg-muted">
                  <img
                    src={imageUrl}
                    alt={p.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
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
                  <h3 className="mt-0.5 font-semibold text-[14px] truncate">{p.name}</h3>
                  <p className="text-[11.5px] text-muted-foreground">{p.unit}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-[15px]">₹{p.price}</span>
                      {p.mrp > p.price && (
                        <span className="ml-1 text-[11px] text-muted-foreground line-through">
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
                      className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
