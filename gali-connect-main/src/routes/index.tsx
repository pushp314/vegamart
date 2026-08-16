import React, { useState, useEffect, useRef, useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  MapPin,
  ChevronDown,
  ChevronUp,
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
  Download,
  Play,
  Sparkles,
  Volume2,
  VolumeX,
  Store,
  ChevronRight,
} from "lucide-react";
import { ProductCard } from "@/components/marketplace/product-card";
import type { Product } from "@/types";
import { PullToRefresh } from "@/components/system/pull-to-refresh";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/system/logo";
import { VideoAdModal, type VideoAdData } from "@/components/system/VideoAdModal";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getFeaturedProducts } from "@/lib/api";
import { homePathForRole } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { useCart } from "@/context/cart-context";
import { useWishlist } from "@/context/wishlist-context";
import { useLocation } from "@/hooks/use-location";
import { usePwaInstall } from "@/hooks/use-pwa-install";
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

const DEFAULT_HOMEPAGE_SECTIONS = [
  { id: "hero", label: "Hero Banner & Promotions", enabled: true },
  { id: "categories", label: "Categories Grid", enabled: true },
  { id: "sponsored_vendors", label: "Sponsored Vendors & Premium Stores", enabled: true },
  { id: "live_banner", label: "Live Network Alert Banner", enabled: true },
  { id: "live_vendors", label: "Nearby Live Street Vendors", enabled: true },
  { id: "shops_near_you", label: "Fixed Shops & Kirana Stores", enabled: true },
  { id: "offers", label: "Discounts & Bank Offers", enabled: true },
  { id: "shopwise_products", label: "Shop-wise Fresh Produce", enabled: true },
  { id: "trending", label: "Trending & Best Sellers", enabled: true },
  { id: "featured_products", label: "Featured Deals & Essentials", enabled: true },
  { id: "recommended", label: "Recommended For You", enabled: true },
  { id: "recently_viewed", label: "Recently Viewed Items", enabled: true },
  { id: "brand_footer", label: "Why VegaMart & Trust Badges", enabled: true },
];

function renderSectionById(id: string, activeAddress: any) {
  switch (id) {
    case "hero":
    case "banners":
      return <Hero key={id} />;
    case "categories":
      return <Categories key={id} />;
    case "sponsored_vendors":
    case "featured_vendors":
      return <SponsoredVendors key={id} />;
    case "live_banner":
    case "nearby_radar":
      return <LiveBanner key={id} />;
    case "live_vendors":
    case "street_vendors":
      return <LiveVendors key={id} defaultAddress={activeAddress} />;
    case "shops_near_you":
      return <ShopsNearYou key={id} defaultAddress={activeAddress} />;
    case "offers":
    case "offers_coupons":
    case "deals_of_day":
      return <Offers key={id} />;
    case "shopwise_products":
    case "vegetables_fruits":
      return <ShopWiseProducts key={id} />;
    case "trending":
    case "best_sellers":
      return <Trending key={id} />;
    case "featured_products":
      return <FeaturedProducts key={id} />;
    case "recommended":
      return <Recommended key={id} />;
    case "recently_viewed":
      return <RecentlyViewed key={id} />;
    case "brand_footer":
    case "trust_badges":
    case "app_download":
      return <BrandFooter key={id} />;
    default:
      return null;
  }
}

function Home() {
  const { activeAddress, displayLocation } = useLocation();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const { data: publicSettings } = useQuery({
    queryKey: ["publicSettings"],
    queryFn: () => api.get<Record<string, any>>("/settings"),
    staleTime: 60_000,
  });

  const orderedSections = useMemo(() => {
    const raw = publicSettings?.data?.["platform.homepage_sections"];
    if (raw) {
      try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter((s: any) => s && s.enabled !== false);
        }
      } catch {}
    }
    return DEFAULT_HOMEPAGE_SECTIONS.filter((s) => s.enabled);
  }, [publicSettings]);

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
          {orderedSections.map((sec: any) => renderSectionById(sec.id, activeAddress))}
        </main>
      </PullToRefresh>
    </div>
  );
}

function Header({ displayLocation }: { displayLocation: string }) {
  const { itemCount } = useCart();
  const { showInstallOption, isDismissed, install } = usePwaInstall();

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
      {showInstallOption && isDismissed ? (
        <button
          onClick={install}
          aria-label="Install App"
          className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-primary-foreground shadow-glow tap-highlight-none transition active:scale-95"
        >
          <Download className="h-5 w-5" />
        </button>
      ) : (
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
      )}
    </div>
  );
}

function SearchBar() {
  return (
    <div>
      <Link
        to="/products"
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
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isBackgroundMuted, setIsBackgroundMuted] = useState(true);
  const backgroundVideoRef = useRef<HTMLVideoElement>(null);

  const { data: slidesResponse, isLoading: slidesLoading } = useQuery({
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
    staleTime: 10 * 1000,
  });

  const { data: videoAdsResponse } = useQuery({
    queryKey: ["publicVideoAds"],
    queryFn: () => api.get<VideoAdData[]>("/video-ads/public").then((r) => r.data),
    staleTime: 2 * 60 * 1000,
  });

  const activeVideoAd = videoAdsResponse?.[0] || null;
  const slides = slidesResponse?.filter((s) => s.is_active !== false) ?? [];

  const [apiCarousel, setApiCarousel] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  const isFixedVideo = activeVideoAd?.display_mode === "fixed_video";

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

  const toggleBackgroundSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!backgroundVideoRef.current) return;
    backgroundVideoRef.current.muted = !isBackgroundMuted;
    setIsBackgroundMuted(!isBackgroundMuted);
  };

  const isBehindHeroVideo = activeVideoAd?.display_mode === "behind_hero";

  // Fixed-size inline video ad (no modal, no hero background) — "show only video in a fixed size".
  if (isFixedVideo && activeVideoAd) {
    return (
      <section className="pt-4 md:pt-8">
        <div className="relative overflow-hidden rounded-3xl md:rounded-[32px] border border-border bg-black shadow-lg">
          <div className="aspect-video w-full">
            <video
              ref={backgroundVideoRef}
              src={activeVideoAd.video_url}
              poster={activeVideoAd.thumbnail_url || undefined}
              autoPlay
              loop
              muted={isBackgroundMuted}
              playsInline
              className="absolute inset-0 w-full h-full object-contain"
            />
          </div>

          {activeVideoAd.cta_link && (
            <div className="absolute bottom-3 left-3 right-3 z-20">
              <a
                href={activeVideoAd.cta_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-5 py-2.5 shadow-lg transition-all active:scale-95"
              >
                {activeVideoAd.cta_text || "Claim Offer Now"} <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          )}

          <button
            onClick={toggleBackgroundSound}
            className="absolute bottom-3 right-3 z-20 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white text-xs font-semibold shadow-lg transition-all active:scale-95"
            title={isBackgroundMuted ? "Unmute Background Audio" : "Mute Background Audio"}
          >
            {isBackgroundMuted ? (
              <>
                <VolumeX className="h-3.5 w-3.5 text-amber-400" />
                <span>Tap for Sound</span>
              </>
            ) : (
              <>
                <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Mute</span>
              </>
            )}
          </button>
        </div>
      </section>
    );
  }

  if (slidesLoading || slides.length === 0) {
    return (
      <section className="pt-4 md:pt-8">
        <div className="relative overflow-hidden rounded-3xl md:rounded-[32px] bg-emerald-800 text-white h-[260px] md:h-[320px] p-6 md:p-10 shadow-lg flex flex-col justify-center">
          {isBehindHeroVideo && activeVideoAd ? (
            <>
              <video
                ref={backgroundVideoRef}
                src={activeVideoAd.video_url}
                poster={activeVideoAd.thumbnail_url || undefined}
                autoPlay
                loop
                muted={isBackgroundMuted}
                playsInline
                className="absolute inset-0 w-full h-full object-cover opacity-50 z-0 pointer-events-none"
              />
              {/* Dual Linear-Radial Gradient Mask */}
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/90 via-black/60 to-transparent z-0 pointer-events-none" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-black/70 mix-blend-overlay z-0 pointer-events-none" />
            </>
          ) : (
            <div
              className="absolute inset-0 opacity-30 mix-blend-overlay"
              style={{
                backgroundImage:
                  "radial-gradient(ellipse at 100% 0%, rgba(255,255,255,0.25), transparent 55%), radial-gradient(ellipse at 0% 100%, rgba(0,0,0,0.35), transparent 60%)",
              }}
            />
          )}
          <div className="relative md:max-w-2xl z-10">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-[10.5px] md:text-xs font-semibold uppercase tracking-wide">
                <Radio className="h-3 w-3" /> India's First Live Vendor Network
              </span>
              {activeVideoAd && activeVideoAd.display_mode === "watch_cta" && (
                <button
                  onClick={() => setIsVideoModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 text-emerald-950 px-3 py-1 text-[10.5px] md:text-xs font-black uppercase tracking-wide shadow-md hover:bg-amber-300 transition-all animate-pulse"
                >
                  <Play className="h-3 w-3 fill-emerald-950" />{" "}
                  {activeVideoAd.cta_text || "Watch 30s Ad"}
                </button>
              )}
            </div>
            <h1 className="mt-3 md:mt-4 font-display text-3xl md:text-4xl lg:text-5xl leading-[1.1] font-bold tracking-tight drop-shadow-md">
              Har Gali Banegi
              <br />
              Live Market.
            </h1>
            <p className="mt-2 md:mt-3 text-[13.5px] md:text-base leading-snug text-white/90 max-w-[22ch] md:max-w-[42ch] drop-shadow-sm">
              See moving vendors on the map. Buy from the nearest one, right now.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                to="/street-vendors"
                className="inline-flex items-center gap-2 rounded-full bg-white text-emerald-900 font-semibold text-sm px-5 py-2.5 shadow-sm hover:bg-emerald-50 transition-colors"
              >
                <MapPin className="h-4 w-4" /> Open Live Map <ArrowRight className="h-4 w-4" />
              </Link>

              {activeVideoAd && (
                <button
                  onClick={() => setIsVideoModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-700/80 hover:bg-emerald-600/90 text-white font-bold text-sm px-5 py-2.5 backdrop-blur-md border border-white/20 transition-all shadow-md"
                >
                  <Play className="h-4 w-4 fill-white" /> Watch Ad Video
                </button>
              )}
            </div>
          </div>

          {/* Floating Sound Control Glass Pill */}
          {isBehindHeroVideo && activeVideoAd && (
            <button
              onClick={toggleBackgroundSound}
              className="absolute bottom-4 right-4 z-20 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white text-xs font-semibold shadow-lg transition-all active:scale-95"
              title={isBackgroundMuted ? "Unmute Background Audio" : "Mute Background Audio"}
            >
              {isBackgroundMuted ? (
                <>
                  <VolumeX className="h-3.5 w-3.5 text-amber-400" />
                  <span>Tap for Sound</span>
                </>
              ) : (
                <>
                  <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="flex items-end gap-0.5 h-3">
                    <span className="w-0.5 bg-emerald-400 animate-[bounce_0.8s_infinite_100ms] h-full" />
                    <span className="w-0.5 bg-emerald-400 animate-[bounce_0.8s_infinite_200ms] h-2/3" />
                    <span className="w-0.5 bg-emerald-400 animate-[bounce_0.8s_infinite_300ms] h-full" />
                    <span className="w-0.5 bg-emerald-400 animate-[bounce_0.8s_infinite_400ms] h-1/2" />
                  </span>
                </>
              )}
            </button>
          )}
        </div>

        <VideoAdModal
          isOpen={isVideoModalOpen}
          onClose={() => setIsVideoModalOpen(false)}
          videoAd={activeVideoAd}
        />
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
                {isBehindHeroVideo && activeVideoAd ? (
                  <>
                    <video
                      ref={backgroundVideoRef}
                      src={activeVideoAd.video_url}
                      poster={activeVideoAd.thumbnail_url || undefined}
                      autoPlay
                      loop
                      muted={isBackgroundMuted}
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover opacity-50 z-0 pointer-events-none"
                    />
                    {/* Dual Linear-Radial Gradient Mask */}
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/90 via-black/60 to-transparent z-0 pointer-events-none" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-black/70 mix-blend-overlay z-0 pointer-events-none" />
                  </>
                ) : (
                  <>
                    <div
                      className="absolute inset-0 opacity-40 mix-blend-overlay z-0"
                      style={{
                        backgroundImage:
                          "radial-gradient(ellipse at 100% 0%, rgba(255,255,255,0.25), transparent 55%), radial-gradient(ellipse at 0% 100%, rgba(0,0,0,0.35), transparent 60%)",
                      }}
                    />
                    {slide.image_url && (
                      <>
                        <img
                          src={slide.image_url}
                          alt={slide.title || "Vegamart banner"}
                          className="absolute inset-0 w-full h-full object-cover opacity-65 md:opacity-75 z-0"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/85 via-black/40 to-transparent z-0 pointer-events-none" />
                      </>
                    )}
                  </>
                )}
                <div className="relative md:max-w-2xl z-10">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-[10.5px] md:text-xs font-semibold uppercase tracking-wide">
                      <Radio className="h-3 w-3" /> {slide.title || "Vegamart"}
                    </span>
                    {activeVideoAd && activeVideoAd.display_mode === "watch_cta" && (
                      <button
                        onClick={() => setIsVideoModalOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 text-emerald-950 px-3 py-1 text-[10.5px] md:text-xs font-black uppercase tracking-wide shadow-md hover:bg-amber-300 transition-all animate-pulse"
                      >
                        <Play className="h-3 w-3 fill-emerald-950" />{" "}
                        {activeVideoAd.cta_text || "Watch 30s Ad"}
                      </button>
                    )}
                  </div>
                  <h1 className="mt-3 md:mt-4 font-display text-3xl md:text-4xl lg:text-5xl leading-[1.1] font-bold tracking-tight drop-shadow-md">
                    {slide.subtitle || slide.title || "Vegamart"}
                  </h1>
                  {slide.body && (
                    <p className="mt-2 md:mt-3 text-[13.5px] md:text-base leading-snug text-white/90 max-w-[22ch] md:max-w-[42ch] drop-shadow-sm">
                      {slide.body}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {slide.link_url && (
                      <Link
                        to={slide.link_url}
                        className="inline-flex items-center gap-2 rounded-full bg-white text-emerald-900 font-semibold text-sm px-5 py-2.5 shadow-sm hover:bg-emerald-50 transition-colors"
                      >
                        {slide.link_text || "Explore"} <ArrowRight className="h-4 w-4" />
                      </Link>
                    )}
                    {activeVideoAd && (
                      <button
                        onClick={() => setIsVideoModalOpen(true)}
                        className="inline-flex items-center gap-2 rounded-full bg-white/20 hover:bg-white/30 text-white font-bold text-sm px-5 py-2.5 backdrop-blur-md border border-white/30 transition-all shadow-md"
                      >
                        <Play className="h-4 w-4 fill-white" /> Watch 30s Ad
                      </button>
                    )}
                  </div>
                </div>

                {/* Floating Sound Control Glass Pill */}
                {isBehindHeroVideo && activeVideoAd && (
                  <button
                    onClick={toggleBackgroundSound}
                    className="absolute bottom-4 right-4 z-20 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white text-xs font-semibold shadow-lg transition-all active:scale-95"
                    title={isBackgroundMuted ? "Unmute Background Audio" : "Mute Background Audio"}
                  >
                    {isBackgroundMuted ? (
                      <>
                        <VolumeX className="h-3.5 w-3.5 text-amber-400" />
                        <span>Tap for Sound</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="flex items-end gap-0.5 h-3">
                          <span className="w-0.5 bg-emerald-400 animate-[bounce_0.8s_infinite_100ms] h-full" />
                          <span className="w-0.5 bg-emerald-400 animate-[bounce_0.8s_infinite_200ms] h-2/3" />
                          <span className="w-0.5 bg-emerald-400 animate-[bounce_0.8s_infinite_300ms] h-full" />
                          <span className="w-0.5 bg-emerald-400 animate-[bounce_0.8s_infinite_400ms] h-1/2" />
                        </span>
                      </>
                    )}
                  </button>
                )}
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

      <VideoAdModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        videoAd={activeVideoAd}
      />
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
              to="/vendors/$vendorId"
              params={{ vendorId: product.vendor_id }}
              search={{ product: product.id }}
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

function ShopWiseProducts() {
  type StoreVendor = {
    id: string;
    business_name: string;
    logo_url?: string | null;
    is_sponsored?: boolean;
    is_verified?: boolean;
    is_open?: boolean;
    status?: string;
    rating?: number;
    review_count?: number;
    profile?: { logo_url?: string | null };
  };
  type ShopProduct = Product & { vendor?: StoreVendor };
  const { data: res, isLoading } = useQuery({
    queryKey: ["products", "shopwise"],
    queryFn: () => api.get<ShopProduct[]>("/products?per_page=100"),
    staleTime: 5 * 60 * 1000,
  });

  const groups = useMemo(() => {
    const products = res?.data || [];
    const map = new Map<string, { vendor: StoreVendor; products: ShopProduct[] }>();
    for (const p of products) {
      const vid = p.vendor_id || p.vendor?.id;
      if (!vid) continue;
      const v: StoreVendor = p.vendor || { id: vid, business_name: "Store" };
      if (!map.has(vid)) {
        map.set(vid, { vendor: v, products: [] });
      }
      map.get(vid)!.products.push(p);
    }
    return Array.from(map.values()).sort(
      (a, b) =>
        Number(b.vendor?.is_sponsored) - Number(a.vendor?.is_sponsored) ||
        a.vendor?.business_name?.localeCompare(b.vendor?.business_name || ""),
    );
  }, [res?.data]);

  const totalShops = groups.length;

  if (isLoading) {
    return (
      <section className="pt-6 md:pt-10">
        <h2 className="font-display text-[22px] md:text-3xl font-bold tracking-tight">
          All Products by Shop
        </h2>
        <p className="text-[13px] md:text-sm text-muted-foreground">Loading shops & products…</p>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border bg-card p-3 animate-pulse">
              <div className="aspect-square rounded-xl bg-muted" />
              <div className="mt-3 h-3.5 w-3/4 rounded-full bg-muted" />
              <div className="mt-2 h-3 w-1/2 rounded-full bg-muted" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (groups.length === 0) return null;

  return (
    <section className="pt-6 md:pt-10">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-display text-[22px] md:text-3xl font-bold tracking-tight">
            All Products by Shop
          </h2>
          <p className="text-[13px] md:text-sm text-muted-foreground">
            {totalShops} shop{totalShops === 1 ? "" : "s"} · Buy from one store per order
          </p>
        </div>
        <Link to="/vendors" className="text-sm md:text-base font-semibold text-primary">
          All shops →
        </Link>
      </div>

      <div className="mt-4 space-y-8 md:space-y-10">
        {groups.map((group) => {
          const v = group.vendor;
          const logo = v.logo_url || v.profile?.logo_url;
          const hasRating = typeof v.rating === "number" && v.rating > 0;
          const isOpen = v.is_open !== false && v.status !== "rejected" && v.status !== "suspended";

          return (
            <div key={v.id} className="rounded-3xl border bg-card p-4 md:p-6 shadow-sm">
              <div className="flex items-center gap-3 md:gap-4">
                <Link
                  to="/vendors/$vendorId"
                  params={{ vendorId: v.id }}
                  className="relative h-14 w-14 md:h-16 md:w-16 shrink-0 overflow-hidden rounded-2xl bg-muted border"
                >
                  {logo ? (
                    <img src={logo} alt={v.business_name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-muted-foreground">
                      <Store className="h-6 w-6" />
                    </span>
                  )}
                  {v.is_sponsored && (
                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-500 px-2 py-0.5 text-[8.5px] font-black uppercase tracking-wider text-white shadow-sm">
                      Promoted
                    </span>
                  )}
                </Link>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Link
                      to="/vendors/$vendorId"
                      params={{ vendorId: v.id }}
                      className="truncate font-display text-[16px] md:text-lg font-bold hover:text-primary transition-colors"
                    >
                      {v.business_name || "Store"}
                    </Link>
                    {v.is_verified && (
                      <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground text-[9px]">
                        ✓
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] md:text-xs text-muted-foreground">
                    {hasRating && v.rating != null && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100/80 px-1.5 py-0.5 text-[10px] font-black text-amber-700">
                        <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                        {v.rating.toFixed(1)}
                        {typeof v.review_count === "number" && v.review_count > 0 && (
                          <span className="font-semibold text-amber-600 ml-0.5">
                            ({v.review_count})
                          </span>
                        )}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        isOpen ? "text-emerald-600" : "text-muted-foreground"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isOpen ? "bg-emerald-500" : "bg-muted-foreground/50"
                        }`}
                      />
                      {isOpen ? "Open now" : "Closed"}
                    </span>
                    <span>{group.products.length} products</span>
                  </div>
                </div>

                <Link
                  to="/vendors/$vendorId"
                  params={{ vendorId: v.id }}
                  className="hidden sm:inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary/40 hover:text-primary transition-colors"
                >
                  Visit shop <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="mt-4 flex overflow-x-auto gap-3 md:gap-4 pb-4 snap-x hide-scrollbar">
                {group.products.map((p) => (
                  <div key={p.id} className="shrink-0 snap-start w-[140px] md:w-[180px]">
                    <ProductCard
                      product={p}
                      linkTo="/vendors/$vendorId"
                      linkParams={{ vendorId: v.id }}
                      linkSearch={{ product: p.id }}
                    />
                  </div>
                ))}
              </div>

              <Link
                to="/vendors/$vendorId"
                params={{ vendorId: v.id }}
                className="mt-4 inline-flex sm:hidden items-center gap-1 text-[13px] font-semibold text-primary"
              >
                Visit shop <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
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
  const activeCats = dbCats.filter((c: any) => c.is_active !== false);
  const VISIBLE_COUNT = 6;
  const [showAll, setShowAll] = useState(false);
  const hasMore = activeCats.length > VISIBLE_COUNT;
  const visibleCats = !showAll && hasMore ? activeCats.slice(0, VISIBLE_COUNT) : activeCats;

  return (
    <section className="px-4 md:px-0 pt-6 md:pt-10">
      <h2 className="font-display text-[22px] md:text-3xl font-bold tracking-tight">
        Shop by category
      </h2>
      <p className="text-[13px] md:text-sm text-muted-foreground">Everything your gali offers</p>
      <div className="mt-4 grid grid-cols-4 md:grid-cols-8 gap-4 md:gap-6 px-1">
        <Link
          to="/street-vendors"
          className="flex flex-col items-center gap-1.5 md:gap-2 tap-highlight-none"
        >
          <div className="grid aspect-square w-full place-items-center rounded-2xl bg-emerald-700 text-white shadow-sm">
            <MapPin className="h-7 w-7 md:h-8 md:w-8" strokeWidth={1.75} />
          </div>
          <span className="text-[11.5px] md:text-[13px] font-medium text-center leading-tight">
            Live Vendor
          </span>
        </Link>
        {visibleCats.map((c: any) => (
          <Link
            key={c.id}
            to="/categories/$categorySlug"
            params={{ categorySlug: c.slug }}
            className="flex flex-col items-center gap-1.5 md:gap-2 tap-highlight-none"
          >
            <div className="grid aspect-square w-full place-items-center rounded-2xl bg-muted text-muted-foreground overflow-hidden shadow-sm">
              {c.image_url ? (
                <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
              ) : c.icon ? (
                <span className="text-3xl md:text-4xl">{c.icon}</span>
              ) : (
                <ShoppingBasket className="h-7 w-7 md:h-8 md:w-8" strokeWidth={1.75} />
              )}
            </div>
            <span className="text-[11.5px] md:text-[13px] font-medium text-center leading-tight">
              {c.name}
            </span>
          </Link>
        ))}
        {hasMore && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="flex flex-col items-center gap-1.5 md:gap-2 tap-highlight-none"
          >
            <div className="grid aspect-square w-full place-items-center rounded-2xl bg-emerald-50 text-primary shadow-sm">
              {showAll ? (
                <ChevronUp className="h-7 w-7 md:h-8 md:w-8" strokeWidth={2} />
              ) : (
                <Plus className="h-7 w-7 md:h-8 md:w-8" strokeWidth={2} />
              )}
            </div>
            <span className="text-[11.5px] md:text-[13px] font-medium text-center leading-tight">
              {showAll ? "Show less" : "Show more"}
            </span>
          </button>
        )}
      </div>
    </section>
  );
}

function LiveBanner() {
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
          <div className="mt-0.5 font-semibold text-[15px] md:text-lg">
            🔥 Live vendors near you - Order fresh now!
          </div>
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

function SponsoredVendors() {
  const { data: res, isLoading } = useQuery({
    queryKey: ["vendors", "sponsored"],
    queryFn: () => api.get<any[]>("/vendors"),
  });

  const sponsoredList = (res?.data || []).filter((v) => v.is_sponsored === true);

  if (isLoading || sponsoredList.length === 0) return null;

  return (
    <section className="pt-6 md:pt-10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 border border-amber-500/20">
            <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
          </div>
          <div>
            <h2 className="font-display text-lg md:text-2xl font-bold tracking-tight">
              Featured & Promoted Vendors
            </h2>
            <p className="text-xs text-muted-foreground">Top recommended stores & partners</p>
          </div>
        </div>
        <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-700 border border-amber-500/30 rounded-full">
          Sponsored
        </span>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x no-scrollbar">
        {sponsoredList.map((v) => {
          const logo = v.logo_url || v.profile?.logo_url;
          return (
            <Link
              key={v.id}
              to="/vendors/$vendorId"
              params={{ vendorId: v.id }}
              className="snap-start shrink-0 w-[240px] md:w-[280px] rounded-3xl bg-gradient-to-b from-amber-500/5 via-card to-card border border-amber-500/30 p-4 shadow-md hover:shadow-lg hover:border-amber-500/60 transition-all group relative overflow-hidden"
            >
              <div className="absolute top-2.5 right-2.5 z-10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-amber-500 text-white rounded-full shadow-xs">
                Promoted
              </div>

              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-2xl bg-muted overflow-hidden border border-border shrink-0 group-hover:scale-105 transition-transform">
                  {logo ? (
                    <img src={logo} alt={v.business_name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full grid place-items-center bg-muted p-2">
                      <Logo className="h-full w-full object-contain" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-sm truncate text-foreground group-hover:text-amber-600 transition-colors">
                    {v.business_name}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {v.profile?.description || v.category || "Featured Partner"}
                  </p>
                  <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-amber-700">
                    <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                    {typeof v.rating === "number" && v.rating > 0 ? v.rating.toFixed(1) : "4.9"}
                    <span className="text-muted-foreground font-normal ml-1">
                      ({v.review_count || 12}+ reviews)
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
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
                          <span className="font-semibold text-amber-600 ml-0.5">
                            ({v.review_count})
                          </span>
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
                          <span className="font-semibold text-amber-600 ml-0.5">
                            ({v.review_count})
                          </span>
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
                to="/vendors/$vendorId"
                params={{ vendorId: p.vendor_id }}
                search={{ product: p.id }}
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
                to="/vendors/$vendorId"
                params={{ vendorId: p.vendor_id }}
                search={{ product: p.id }}
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
              search={{ q: o.tag }}
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
          © 2026 VegaMart. Made with 💚 in Sakti, Chhattisgarh.
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
                to="/vendors/$vendorId"
                params={{ vendorId: p.vendor_id }}
                search={{ product: p.id }}
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