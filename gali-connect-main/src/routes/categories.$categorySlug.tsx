import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Star, MapPin, Clock, Search, Store } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { PullToRefresh } from "@/components/system/pull-to-refresh";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getNearbyDailyLocations, type DailyLocationData } from "@/lib/api";
import type { Vendor, Category, VendorProfile, Product } from "@/types";
import { useLocation } from "@/hooks/use-location";
import { useCart } from "@/context/cart-context";

export const Route = createFileRoute("/categories/$categorySlug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.categorySlug.replace(/-/g, " ")} — Vegamart` },
      { name: "description", content: "Browse local vendors selling this category near you." },
    ],
  }),
  component: CategoryPage,
});

type DailyLocationWithDistance = DailyLocationData & { distance_km?: number };

function CategoryPage() {
  const { categorySlug } = Route.useParams();
  const navigate = useNavigate();
  const { activeAddress, displayLocation } = useLocation();
  const queryClient = useQueryClient();
  const { addToCart } = useCart();

  const [viewMode, setViewMode] = useState<"vendors" | "products">("vendors");
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["vendors"] }),
      queryClient.invalidateQueries({ queryKey: ["products"] }),
      queryClient.invalidateQueries({ queryKey: ["categories"] }),
    ]);
  };

  const { data: catsRes, isLoading: loadingCats } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<Category[]>("/categories"),
  });
  const categories = useMemo(() => catsRes?.data || [], [catsRes?.data]);

  const activeCategory = useMemo(
    () => categories.find((c) => c.slug === categorySlug || c.id === categorySlug) || null,
    [categories, categorySlug],
  );

  const sidebarItems = useMemo(() => {
    if (!activeCategory) return [];
    const children = categories.filter((c) => c.parent_id === activeCategory.id);
    if (children.length > 0) return children;
    if (activeCategory.parent_id) {
      return categories.filter((c) => c.parent_id === activeCategory.parent_id);
    }
    // Fallback to all top-level categories if no children exist
    return categories.filter((c) => !c.parent_id);
  }, [categories, activeCategory]);

  const isShowingSubcategories = useMemo(() => {
    if (!activeCategory || sidebarItems.length === 0) return false;
    // If the first item in sidebar has a parent_id, then we are showing subcategories
    return !!sidebarItems[0].parent_id;
  }, [sidebarItems, activeCategory]);

  const handleSidebarClick = (category: Category | null) => {
    if (category === null) {
      setActiveSubcategory(null);
      return;
    }
    
    if (isShowingSubcategories) {
      setActiveSubcategory(category.id);
    } else {
      // Navigating to a different top-level category
      setActiveSubcategory(null);
      navigate({ to: "/categories/$categorySlug", params: { categorySlug: category.slug } });
    }
  };

  const { data: vendorsRes, isLoading: loadingVendors } = useQuery({
    queryKey: ["vendors", activeCategory?.id, activeSubcategory],
    queryFn: () => {
      const params = new URLSearchParams({ per_page: "100" });
      if (activeSubcategory) {
        params.set("subcategory_id", activeSubcategory);
      } else if (activeCategory) {
        params.set("category_id", activeCategory.id);
      }
      return api.get<Vendor[]>(`/vendors?${params.toString()}`);
    },
    enabled: !!activeCategory && viewMode === "vendors",
    staleTime: 5 * 60 * 1000,
  });

  const { data: productsRes, isLoading: loadingProducts } = useQuery({
    queryKey: ["products", activeCategory?.id, activeSubcategory],
    queryFn: () => {
      const params = new URLSearchParams({ per_page: "100" });
      if (activeSubcategory) {
        params.set("subcategory_id", activeSubcategory);
      } else if (activeCategory) {
        params.set("category_id", activeCategory.id);
      }
      return api.get<Product[]>(`/products?${params.toString()}`);
    },
    enabled: !!activeCategory && viewMode === "products",
    staleTime: 5 * 60 * 1000,
  });

  const { data: dailyLocationsRes } = useQuery({
    queryKey: ["nearbyDailyLocations", activeAddress?.latitude, activeAddress?.longitude],
    queryFn: () => getNearbyDailyLocations(activeAddress!.latitude!, activeAddress!.longitude!, 10),
    enabled: !!activeAddress?.latitude && !!activeAddress?.longitude,
  });

  const dailyLocations: DailyLocationWithDistance[] =
    (dailyLocationsRes?.data as DailyLocationWithDistance[]) || [];

  const vendors = vendorsRes?.data || [];
  const products = productsRes?.data || [];

  if (loadingCats) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader title="Categories" back={false} />
        <main className="mx-auto max-w-6xl px-4 md:px-6 lg:px-8 pt-4 pb-28 md:pb-16">
          <div className="mt-10 text-center text-sm text-muted-foreground">
            Loading categories...
          </div>
        </main>
      </div>
    );
  }

  if (!activeCategory) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader title="Category not found" />
        <main className="mx-auto max-w-6xl px-4 md:px-6 lg:px-8 pt-4 pb-28 md:pb-16">
          <div className="mt-10 text-center text-sm text-muted-foreground">
            This category does not exist.
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-background overflow-hidden">
      <AppHeader
        title={activeCategory.name}
        subtitle={
          viewMode === "vendors" 
            ? `${vendors.length} shops near ${displayLocation}`
            : `${products.length} products near ${displayLocation}`
        }
        back={false}
      />

      
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-[85px] lg:w-[100px] shrink-0 bg-white border-r overflow-y-auto no-scrollbar shadow-sm z-10">
          <div className="flex flex-col py-2">
            <button
              onClick={() => handleSidebarClick(null)}
              className={`relative flex flex-col items-center gap-1.5 p-3 text-center transition-colors ${
                activeSubcategory === null
                  ? "text-foreground font-bold"
                  : "text-muted-foreground font-medium hover:bg-muted/30"
              }`}
            >
              <div className="h-[48px] w-[48px] shrink-0 rounded-2xl overflow-hidden bg-muted/30 flex items-center justify-center p-1">
                 <img src="https://images.unsplash.com/photo-1542838132-92c53300491e?w=100&h=100&fit=crop" alt="All" className="h-full w-full object-cover rounded-xl" />
              </div>
              <span className="text-[11px] leading-tight break-words hyphens-auto w-full">All</span>
              {activeSubcategory === null && (
                <div className="absolute right-0 top-1/4 bottom-1/4 w-1.5 bg-emerald-700 rounded-l-full" />
              )}
            </button>

            {sidebarItems.map((c) => {
              const isActive = isShowingSubcategories ? activeSubcategory === c.id : c.id === activeCategory.id;
              
              return (
                <button
                  key={c.id}
                  onClick={() => handleSidebarClick(c)}
                  className={`relative flex flex-col items-center gap-1.5 p-3 text-center transition-colors ${
                    isActive
                      ? "text-foreground font-bold"
                      : "text-muted-foreground font-medium hover:bg-muted/30"
                  }`}
                >
                  <div className="h-[48px] w-[48px] shrink-0 rounded-2xl overflow-hidden bg-muted/30 p-1 flex items-center justify-center text-xl">
                    {c.image_url ? (
                      <img src={c.image_url} alt={c.name} className="h-full w-full object-cover rounded-xl" />
                    ) : c.icon ? (
                      c.icon
                    ) : (
                      <Store className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <span className="text-[11px] leading-tight break-words hyphens-auto w-full">{c.name}</span>
                  {isActive && (
                    <div className="absolute right-0 top-1/4 bottom-1/4 w-1.5 bg-emerald-700 rounded-l-full" />
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right Content Area */}
        <main className="flex-1 overflow-y-auto pb-28 md:pb-16 bg-muted/10 relative">
          {/* Toggle Header */}
          <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b px-4 py-3 flex items-center justify-between">
            <div className="flex bg-muted rounded-full p-1 w-full max-w-xs mx-auto">
              <button
                onClick={() => setViewMode("vendors")}
                className={`flex-1 rounded-full text-xs font-bold py-1.5 transition-all ${
                  viewMode === "vendors" 
                    ? "bg-background text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Vendors
              </button>
              <button
                onClick={() => setViewMode("products")}
                className={`flex-1 rounded-full text-xs font-bold py-1.5 transition-all ${
                  viewMode === "products" 
                    ? "bg-background text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Products
              </button>
            </div>
          </div>

          <div className="p-3 lg:p-4">
            {viewMode === "vendors" ? (
              loadingVendors ? (
                <div className="mt-10 text-center text-sm text-muted-foreground">Loading vendors...</div>
              ) : vendors.length === 0 ? (
                <div className="mt-10 text-center">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground">
                    <Search className="h-6 w-6" />
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">No vendors found.</p>

                </div>
              ) : (
                <ul className="grid grid-cols-1 gap-3">
                  {vendors.map((v) => {
                    const profile: VendorProfile | undefined = v.profile;
                    const imageUrl = profile?.logo_url || v.logo_url || "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=600&fit=crop";
                    const isOpen = profile?.is_open || v.is_open || false;
                    return (
                      <li key={v.id}>
                        <Link to="/vendors/$vendorId" params={{ vendorId: v.id }} className="flex gap-3 p-3 rounded-2xl bg-card border shadow-sm hover:border-primary/40 transition-colors">
                          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                            <img src={imageUrl} alt={v.business_name} loading="lazy" className="h-full w-full object-cover" />
                            {isOpen && (
                              <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-md bg-emerald-700 px-1.5 py-0.5 text-[9px] font-bold text-white">
                                <span className="h-1 w-1 rounded-full bg-red-300 animate-pulse" /> LIVE
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-sm truncate">{v.business_name}</h3>
                            <p className="text-[11px] text-muted-foreground truncate">{activeCategory.name}</p>
                            <div className="mt-2 flex items-center gap-3 text-[10px]">
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100/80 px-1.5 py-0.5 font-black text-amber-700">
                                <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                                {typeof profile?.rating === "number" && profile.rating > 0 ? profile.rating.toFixed(1) : "New"}
                              </span>
                            </div>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : (
              loadingProducts ? (
                <div className="mt-10 text-center text-sm text-muted-foreground">Loading products...</div>
              ) : products.length === 0 ? (
                <div className="mt-10 text-center">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground">
                    <Search className="h-6 w-6" />
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">No products found.</p>
                </div>
              ) : (
                <ul className="grid grid-cols-2 gap-3">
                  {products.map((p) => {
                    const discountPercent = p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;
                    const imageUrl = p.images?.[0]?.url || "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=600&fit=crop";
                    return (
                      <li key={p.id} className="bg-card border rounded-[20px] overflow-hidden flex flex-col shadow-sm relative">
                        {discountPercent > 0 && (
                          <div className="absolute top-0 left-0 z-10 bg-blue-600 text-white text-[11px] font-bold px-2 py-1 rounded-br-lg shadow-sm">
                            {discountPercent}% OFF
                          </div>
                        )}
                        <div className="relative h-[110px] sm:h-[130px] w-full bg-muted/40 p-4 flex items-center justify-center">
                          <img src={imageUrl} alt={p.name} loading="lazy" className="max-h-full max-w-full object-contain mix-blend-multiply drop-shadow-sm" />
                        </div>
                        <div className="p-3 pt-0 flex flex-col flex-1">
                          <div className="text-[10px] text-amber-600 flex items-center gap-1 mb-1 font-bold tracking-tight">
                            <Clock className="h-3 w-3" /> 27 MINS
                          </div>
                          <h3 className="font-semibold text-[13px] leading-tight line-clamp-2 mb-1 text-foreground/90">{p.name}</h3>
                          <p className="text-[11px] text-muted-foreground mb-3">{p.unit}</p>
                          <div className="mt-auto flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex flex-col">
                                <span className="font-bold text-sm leading-none">₹{p.price}</span>
                                {p.mrp > p.price && (
                                  <span className="text-[10px] text-muted-foreground line-through decoration-muted-foreground/50 leading-none mt-1">₹{p.mrp}</span>
                                )}
                              </div>
                              <button 
                                onClick={() => addToCart(p, 1)}
                                className="bg-white text-emerald-700 border border-emerald-700/30 hover:bg-emerald-50 text-[12px] font-bold px-4 py-1.5 rounded-lg uppercase shadow-sm transition-colors shrink-0"
                              >
                                ADD
                              </button>
                            </div>
                            <div className="text-[9px] text-muted-foreground text-right mt-1 w-full flex justify-end pr-3">
                              2 options
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
