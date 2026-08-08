import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef } from "react";
import { Search, X, Clock, TrendingUp, Store, ShoppingBasket, ChevronLeft, Loader2, Sparkles, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api, getFeaturedProducts } from "@/lib/api";
import type { Product, Vendor, Category } from "@/types";
import { AppHeader } from "@/components/layout/app-header";
import { ProductCard } from "@/components/marketplace/product-card";

const TRENDING = [
  "Fresh Tomatoes",
  "Baby Spinach", 
  "Masala Chai",
  "Fresh Vegetables",
  "Juice & Tea",
  "Fresh Fruits",
];

const RECENT_KEY = "lgv:recent-searches";

function useRecent() {
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(RECENT_KEY) : null;
      if (raw) setRecent(JSON.parse(raw));
    } catch (err) {
      void err;
    }
  }, []);
  const push = (q: string) => {
    const term = q.trim();
    if (!term) return;
    setRecent((prev) => {
      const next = [term, ...prev.filter((p) => p.toLowerCase() !== term.toLowerCase())].slice(0, 8);
      try {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch (err) {
        void err;
      }
      return next;
    });
  };
  const clear = () => {
    setRecent([]);
    try {
      window.localStorage.removeItem(RECENT_KEY);
    } catch (err) {
      void err;
    }
  };
  const remove = (q: string) => {
    setRecent((prev) => {
      const next = prev.filter((p) => p !== q);
      try {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch (err) {
        void err;
      }
      return next;
    });
  };
  return { recent, push, clear, remove };
}

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search — Vegamart" },
      {
        name: "description",
        content: "Search chai, sabzi, samosa, vendors and more across your neighbourhood.",
      },
      { property: "og:title", content: "Search — Vegamart" },
      { property: "og:description", content: "Find products, vendors and categories on Vegamart." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: SearchPage,
});

function SearchPage() {
  const navigate = useNavigate();
  const { q: initialQ } = useSearch({ from: "/search" });
  const [q, setQ] = useState(initialQ || "");
  const [debounced, setDebounced] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { recent, push, clear, remove } = useRecent();

  const { data: pRes } = useQuery({
    queryKey: ["products", "search", debounced],
    queryFn: () => {
      if (!debounced) return Promise.resolve([]);
      return api.get<Product[]>(`/products?q=${encodeURIComponent(debounced)}&per_page=12`).then(r => r.data || []);
    },
  });
  const { data: vRes } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => api.get<Vendor[]>("/vendors"),
  });
  const { data: cRes } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<Category[]>("/categories"),
  });

  const products = Array.isArray(pRes) ? pRes : [];
  const vendors = vRes?.data || [];
  const categories = cRes?.data || [];

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim().toLowerCase()), 180);
    return () => clearTimeout(t);
  }, [q]);

  const productResults = useMemo(() => {
    if (!debounced) return [];
    return products.slice(0, 12);
  }, [debounced, products]);

  const vendorResults = useMemo(() => {
    if (!debounced) return [];
    return vendors
      .filter((v) => {
        const nameMatch = v.business_name?.toLowerCase().includes(debounced) || false;
        return nameMatch;
      })
      .sort((a, b) => Number(Boolean(b.is_sponsored)) - Number(Boolean(a.is_sponsored)))
      .slice(0, 6);
  }, [debounced, vendors]);

  const categoryResults = useMemo(() => {
    if (!debounced) return [];
    return categories.filter((c) => c.name.toLowerCase().includes(debounced)).slice(0, 6);
  }, [debounced, categories]);

  const hasQuery = debounced.length > 0;
  const hasResults = productResults.length + vendorResults.length + categoryResults.length > 0;

  const submit = (term: string) => {
    const t = term.trim();
    if (!t) return;
    push(t);
    setQ(t);
  };

  const handleProductClick = (productId: string) => {
    navigate({ to: "/products/$productId", params: { productId } });
  };

  const handleVendorClick = (vendorId: string) => {
    navigate({ to: "/vendors/$vendorId", params: { vendorId } });
  };

  const handleCategoryClick = (categoryName: string) => {
    navigate({ to: "/products", search: { category: categoryName } });
  };

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-16">
      <AppHeader title="Search" subtitle="Find products, vendors & categories" />
      
      <main className="mx-auto max-w-6xl px-4 md:px-6 lg:px-8 pt-4 md:pt-8">
        {/* Search Input */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search chai, sabzi, samosa, vendors…"
            className="h-14 w-full rounded-2xl bg-card border pl-12 pr-24 text-base font-medium outline-none focus:ring-2 focus:ring-primary/40 shadow-sm"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {q && (
              <button
                onClick={() => setQ("")}
                aria-label="Clear"
                className="grid h-10 w-10 place-items-center rounded-full hover:bg-muted"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Search Results */}
        {hasQuery && (
          <div className="mt-6 space-y-6">
            {hasResults ? (
              <>
                {/* Product Results */}
                {productResults.length > 0 && (
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-foreground">Products</h3>
                      <span className="text-xs text-muted-foreground">{productResults.length} found</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                      {productResults.map((product: any) => (
                        <div 
                          key={product.id}
                          onClick={() => handleProductClick(product.id)}
                          className="cursor-pointer"
                        >
                          <ProductCard product={product as Product} />
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                {productResults.length === 0 && products.length === 0 && (
                  <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-center">
                    <p className="text-sm font-semibold text-emerald-900">No products available yet</p>
                    <p className="text-xs text-emerald-700 mt-1">Products will appear here once vendors add them</p>
                  </div>
                )}

                {/* Vendor Results */}
                {vendorResults.length > 0 && (
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-foreground">Vendors</h3>
                      <span className="text-xs text-muted-foreground">{vendorResults.length} found</span>
                    </div>
                    <div className="space-y-3">
                      {vendorResults.map((vendor) => (
                        <div
                          key={vendor.id}
                          onClick={() => handleVendorClick(vendor.id)}
                          className="flex items-center gap-4 p-4 rounded-2xl bg-card border hover:border-primary/40 transition-colors cursor-pointer"
                        >
                          <div className="h-12 w-12 rounded-full bg-muted overflow-hidden shrink-0 border border-border">
                            {vendor.logo_url || vendor.profile?.logo_url ? (
                              <img src={vendor.logo_url || vendor.profile?.logo_url} alt={vendor.business_name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-muted p-1.5">
                                <img src="/favicon.ico" alt="Vegamart logo" className="w-full h-full object-contain" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-sm truncate">{vendor.business_name}</h4>
                              {vendor.is_sponsored && (
                                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-600 border border-amber-500/30 rounded-full flex items-center gap-1">
                                  <Sparkles className="h-2.5 w-2.5" /> Promoted
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{vendor.profile?.description || "Local vendor"}</p>
                          </div>
                          <ArrowRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Category Results */}
                {categoryResults.length > 0 && (
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-foreground">Categories</h3>
                      <span className="text-xs text-muted-foreground">{categoryResults.length} found</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {categoryResults.map((category) => (
                        <button
                          key={category.id}
                          onClick={() => handleCategoryClick(category.name)}
                          className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border hover:border-primary/40 transition-colors"
                        >
                          {category.image_url ? (
                            <img src={category.image_url} alt={category.name} className="h-6 w-6 rounded-full object-cover" />
                          ) : (
                            <ShoppingBasket className="h-5 w-5 text-muted-foreground" />
                          )}
                          <span className="text-sm font-medium">{category.name}</span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </>
            ) : (
              <div className="mt-10 flex flex-col items-center justify-center rounded-3xl border border-dashed bg-card/50 p-12 text-center">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-muted text-muted-foreground">
                  <Search className="h-8 w-8" />
                </div>
                <p className="mt-4 text-base font-semibold">No results found</p>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  Try different keywords or browse our categories below
                </p>
              </div>
            )}
          </div>
        )}

        {/* Default State - No Query */}
        {!hasQuery && (
          <div className="mt-6 space-y-8">
            {/* Recent Searches */}
            {recent.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Recent searches
                  </h3>
                  <button
                    onClick={clear}
                    className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Clear all
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recent.map((term) => (
                    <div
                      key={term}
                      className="group flex items-center gap-2 px-4 py-2 rounded-full bg-card border hover:border-primary/40 transition-colors"
                    >
                      <button
                        onClick={() => submit(term)}
                        className="text-sm text-left flex-1"
                      >
                        {term}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(term);
                        }}
                        className="opacity-0 group-hover:opacity-100 h-5 w-5 grid place-items-center rounded-full hover:bg-muted"
                        aria-label={`Remove ${term} from recent searches`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Trending Searches */}
            <section>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4" />
                Trending now
              </h3>
              <div className="flex flex-wrap gap-2">
                {TRENDING.map((term) => (
                  <button
                    key={term}
                    onClick={() => submit(term)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span className="text-sm font-medium">{term}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Browse Categories */}
            <section>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
                <ShoppingBasket className="h-4 w-4" />
                Browse categories
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {categories.slice(0, 8).map((category) => (
                  <button
                    key={category.id}
                    onClick={() => handleCategoryClick(category.name)}
                    className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-card border hover:border-primary/40 transition-colors"
                  >
                    <div className="h-12 w-12 rounded-full bg-muted overflow-hidden">
                      {category.image_url ? (
                        <img src={category.image_url} alt={category.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingBasket className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-medium text-center">{category.name}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}