import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Category, Product, ProductImage } from "@/types";
import { ProductCard } from "@/components/marketplace/product-card";

type ProductRow = {
  id: string;
  vendor_id: string;
  category_id: string;
  name: string;
  slug: string;
  price: number;
  mrp: number;
  unit: string;
  rating: number;
  review_count: number;
  is_active: boolean;
  is_featured: boolean;
  images?: ProductImage[];
  vendor?: { id: string; business_name: string; logo_url?: string | null; is_sponsored?: boolean };
};

export const Route = createFileRoute("/products")({
  head: () => ({ meta: [{ title: "Products — Vegamart" }] }),
  validateSearch: (search: Record<string, unknown>): { category?: string; q?: string } => ({
    category: typeof search.category === "string" ? search.category : undefined,
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const navigate = useNavigate();
  const { category, q } = useSearch({ from: "/products" });
  const [input, setInput] = useState(q || "");

  const { data: catsRes } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<Category[]>("/categories"),
  });
  const categories = useMemo(() => catsRes?.data || [], [catsRes?.data]);

  const activeCategory = useMemo(
    () =>
      categories.find((c) => c.name === category || c.slug === category || c.id === category) ||
      null,
    [categories, category],
  );

  const { data: productsRes, isLoading } = useQuery({
    queryKey: ["products", activeCategory?.id || "all"],
    queryFn: () => {
      const params = new URLSearchParams({ per_page: "60" });
      if (activeCategory) params.set("category_id", activeCategory.id);
      return api.get<{ rows: ProductRow[]; total: number }>(`/products?${params.toString()}`);
    },
  });

  const products = useMemo(() => productsRes?.data?.rows || [], [productsRes?.data]);

  const filtered = useMemo(() => {
    const qn = q?.trim().toLowerCase();
    let rows = products;
    if (qn) {
      rows = rows.filter((p) => {
        const vendorName = p.vendor?.business_name || "";
        return p.name.toLowerCase().includes(qn) || vendorName.toLowerCase().includes(qn);
      });
    }
    return [...rows].sort(
      (a, b) => Number(b.vendor?.is_sponsored) - Number(a.vendor?.is_sponsored),
    );
  }, [products, q]);

  const setSearch = (updates: { category?: string; q?: string }) => {
    navigate({
      to: "/products",
      search: (prev) => ({ ...prev, ...updates }),
      replace: true,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title={activeCategory?.name || "All products"}
        subtitle={`${filtered.length} product${filtered.length === 1 ? "" : "s"}`}
      />
      <main className="mx-auto max-w-6xl px-4 md:px-6 lg:px-8 pt-4 md:pt-8 pb-28 md:pb-16">
        {/* Search — filters by product or vendor */}
        <div className="flex items-center gap-3 rounded-full bg-card border h-12 px-4 shadow-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setSearch({ q: e.target.value || undefined });
            }}
            placeholder="Search by product or vendor…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {input && (
            <button
              aria-label="Clear search"
              onClick={() => {
                setInput("");
                setSearch({ q: undefined });
              }}
              className="grid h-7 w-7 place-items-center rounded-full hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category chips */}
        <div className="mt-3 -mx-4 flex gap-2 overflow-x-auto no-scrollbar px-4 pb-1">
          <button
            onClick={() => setSearch({ category: undefined })}
            className={`shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition-colors border ${
              !activeCategory
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-foreground border-border hover:border-primary/40"
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSearch({ category: c.name })}
              className={`shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition-colors border ${
                activeCategory?.id === c.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:border-primary/40"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Product grid */}
        {isLoading ? (
          <div className="mt-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl border bg-card p-3 shadow-soft animate-pulse">
                <div className="aspect-square rounded-xl bg-muted" />
                <div className="mt-3 h-3.5 w-3/4 rounded-full bg-muted" />
                <div className="mt-2 h-3 w-1/2 rounded-full bg-muted" />
                <div className="mt-3 flex items-center justify-between">
                  <div className="h-4 w-12 rounded-full bg-muted" />
                  <div className="h-8 w-16 rounded-lg bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-10 flex flex-col items-center justify-center rounded-3xl border border-dashed bg-card/50 p-12 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground">
              <X className="h-6 w-6" />
            </div>
            <p className="mt-4 text-sm font-semibold">No products match your search</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Try a different keyword or browse another category. Stores that are currently offline
              are hidden from the gallery.
            </p>
            <button
              onClick={() => {
                setInput("");
                setSearch({ q: undefined, category: undefined });
              }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <X className="h-3.5 w-3.5" /> Reset filters
            </button>
          </div>
        ) : (
          <>
            <div className="mt-5 flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground">
                Showing <span className="font-bold text-foreground">{filtered.length}</span> product
                {filtered.length === 1 ? "" : "s"}
              </p>
              <div className="hidden sm:flex items-center gap-1.5 text-[10.5px] font-semibold text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Fresh picks from open
                vendors
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {filtered.map((row) => (
                <ProductCard key={row.id} product={row as unknown as Product} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
