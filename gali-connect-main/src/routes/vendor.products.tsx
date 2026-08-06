import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Plus,
  Edit2,
  Trash2,
  Package,
  Upload,
  Loader2,
  Search,
  Check,
  X,
  Sparkles,
  Image as ImageIcon,
  Tag,
  AlertCircle
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/vendor/products")({
  component: VendorProductsPage,
});

type Category = { id: string; name: string };
type Product = {
  id: string;
  name: string;
  price: number;
  mrp?: number;
  unit: string;
  stock?: number;
  total_stock?: number;
  description?: string;
  is_active: boolean;
  category_id?: string;
  category?: Category;
  images?: { id: string; url: string }[];
};

function VendorProductsPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [isUploadingBulk, setIsUploadingBulk] = useState(false);

  // Modal States
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  // Form Fields
  const [prodName, setProdName] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodMrp, setProdMrp] = useState("");
  const [prodUnit, setProdUnit] = useState("1 kg");
  const [prodStock, setProdStock] = useState("");
  const [prodTotalStock, setProdTotalStock] = useState("");
  const [prodCategoryId, setProdCategoryId] = useState("");
  const [prodDescription, setProdDescription] = useState("");
  const [prodImageUrl, setProdImageUrl] = useState("");

  const { data: vendorRes } = useQuery({
    queryKey: ["vendorProfile"],
    queryFn: () => api.get<{ data: any }>("/vendors/me"),
  });
  const vendor = vendorRes?.data?.data || vendorRes?.data;

  const { data: productsRes, isLoading: prodsLoading } = useQuery({
    queryKey: ["vendorProducts", vendor?.id],
    queryFn: () => api.get<Product[]>("/products/me?include_inactive=true"),
    enabled: !!vendor?.id,
  });
  const productList: Product[] = productsRes?.data || [];

  const { data: categoriesRes } = useQuery({
    queryKey: ["vendorCategories"],
    queryFn: () => api.get<Category[]>("/categories"),
  });
  const categoriesList: Category[] = categoriesRes?.data || [];

  // Filtered list
  const filteredProducts = productList.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "ALL" || p.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Open Modal helpers
  const handleOpenAdd = () => {
    setEditingProduct(null);
    setProdName("");
    setProdPrice("");
    setProdMrp("");
    setProdUnit("1 kg");
    setProdStock("10");
    setProdTotalStock("10");
    setProdCategoryId(categoriesList[0]?.id || "");
    setProdDescription("");
    setProdImageUrl("");
    setProductModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setProdName(p.name);
    setProdPrice(String(p.price));
    setProdMrp(p.mrp ? String(p.mrp) : "");
    setProdUnit(p.unit || "1 kg");
    setProdStock(String(p.stock ?? 0));
    setProdTotalStock(String(p.total_stock ?? p.stock ?? 0));
    setProdCategoryId(p.category_id || "");
    setProdDescription(p.description || "");
    setProdImageUrl(p.images?.[0]?.url || "");
    setProductModalOpen(true);
  };

  // Toggle Stock Mutation
  const toggleStockMutation = useMutation({
    mutationFn: (p: Product) =>
      api.patch(`/products/${p.id}`, { is_active: !p.is_active }),
    onSuccess: (_, p) => {
      toast.success(p.is_active ? "Product marked out of stock" : "Product marked in stock");
      queryClient.invalidateQueries({ queryKey: ["vendorProducts"] });
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => {
      toast.success("Product deleted successfully");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["vendorProducts"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to delete product");
    },
  });

  // Save Product Mutation
  const saveProductMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: prodName,
        price: Number(prodPrice),
        mrp: prodMrp ? Number(prodMrp) : undefined,
        unit: prodUnit,
        stock: Number(prodStock),
        total_stock: prodTotalStock ? Number(prodTotalStock) : Number(prodStock),
        category_id: prodCategoryId || undefined,
        description: prodDescription || undefined,
        images: prodImageUrl ? [{ url: prodImageUrl }] : [],
      };

      if (editingProduct) {
        return api.patch(`/products/${editingProduct.id}`, payload);
      } else {
        return api.post("/products", payload);
      }
    },
    onSuccess: () => {
      toast.success(editingProduct ? "Product updated!" : "Product created!");
      setProductModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["vendorProducts"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save product");
    },
  });

  // Bulk CSV Upload
  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      toast.error("Please select a valid CSV file");
      return;
    }
    setIsUploadingBulk(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await api.post("/products/bulk-upload", formData);
      if (res.success) {
        toast.success("Bulk products imported successfully!");
        queryClient.invalidateQueries({ queryKey: ["vendorProducts"] });
      } else {
        toast.error(res.error?.message || "Failed to import products");
      }
    } catch {
      toast.error("Bulk upload failed");
    } finally {
      setIsUploadingBulk(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Store Catalog</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your inventory, prices, and product availability.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleBulkUpload}
            accept=".csv"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingBulk}
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 text-xs font-bold shadow-xs hover:bg-muted"
          >
            {isUploadingBulk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Bulk Import CSV
          </button>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 text-black px-5 py-2.5 text-xs font-bold shadow-lg hover:bg-emerald-400"
          >
            <Plus className="h-4 w-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search products by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-border bg-card pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedCategory("ALL")}
            className={`px-4 py-2 text-xs rounded-xl font-bold whitespace-nowrap transition-all ${
              selectedCategory === "ALL"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            All Items ({productList.length})
          </button>
          {categoriesList.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 text-xs rounded-xl font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      {prodsLoading ? (
        <div className="flex justify-center py-16 text-muted-foreground gap-2 text-xs">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
          <span>Loading catalog...</span>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card p-12 text-center space-y-3">
          <Package className="h-12 w-12 mx-auto text-muted-foreground opacity-40" />
          <h3 className="font-bold text-sm">No products found</h3>
          <p className="text-xs text-muted-foreground">
            {searchQuery ? "Try a different search term" : "Click 'Add Product' to list your first item."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map((p) => {
            const hasMrp = p.mrp && p.mrp > p.price;
            const discountPct = hasMrp ? Math.round(((p.mrp! - p.price) / p.mrp!) * 100) : 0;

            return (
              <div
                key={p.id}
                className={`group relative flex flex-col rounded-3xl border border-border bg-card p-4 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${
                  !p.is_active ? "opacity-75 bg-muted/20" : ""
                }`}
              >
                {!p.is_active && (
                  <span className="absolute top-3 right-3 z-10 rounded-full bg-rose-500/90 text-white text-[10px] font-bold px-2.5 py-0.5 shadow-sm backdrop-blur-sm">
                    Out of Stock
                  </span>
                )}

                {hasMrp && (
                  <span className="absolute top-3 left-3 z-10 rounded-full bg-emerald-500 text-black text-[10px] font-black uppercase px-2.5 py-0.5 shadow-sm">
                    {discountPct}% OFF
                  </span>
                )}

                <div className="relative mb-3 h-36 w-full overflow-hidden rounded-2xl bg-muted">
                  <img
                    src={
                      p.images?.[0]?.url ||
                      "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=300"
                    }
                    alt={p.name}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>

                <div className="flex-1 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {p.category?.name || "General"}
                  </div>
                  <h3 className="font-bold text-sm truncate text-foreground">{p.name}</h3>

                  <div className="flex items-baseline gap-2 pt-1">
                    <span className="font-display text-lg font-black text-emerald-600">
                      ₹{p.price}
                    </span>
                    {hasMrp && (
                      <span className="text-xs text-muted-foreground line-through">
                        ₹{p.mrp}
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground">/ {p.unit}</span>
                  </div>

                  <div className="text-[11px] text-muted-foreground pt-1 flex items-center gap-2 font-medium">
                    <span className={`h-2 w-2 rounded-full ${(p.stock ?? 0) > 0 ? "bg-emerald-500" : "bg-rose-500"}`} />
                    <span>{p.stock ?? 0} remaining</span>
                    {typeof p.total_stock === "number" && (
                      <span className="text-muted-foreground/60">• Total: {p.total_stock}</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-4 mt-3 border-t border-border/50">
                  <button
                    onClick={() => handleOpenEdit(p)}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/40 py-2 text-xs font-bold hover:bg-accent"
                  >
                    <Edit2 className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => setDeleteTarget(p)}
                    className="flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50/50 py-2 text-xs font-bold text-rose-600 hover:bg-rose-100 dark:bg-rose-950/20 dark:border-rose-900"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Product Modal */}
      <Dialog open={productModalOpen} onOpenChange={setProductModalOpen}>
        <DialogContent className="rounded-3xl border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingProduct ? "Edit Product Listing" : "Add New Product"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Fill in product information for your store catalog.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveProductMutation.mutate();
            }}
            className="space-y-4 py-2"
          >
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Product Title *
              </label>
              <input
                type="text"
                value={prodName}
                onChange={(e) => setProdName(e.target.value)}
                placeholder="e.g. Fresh Organic Tomatoes"
                required
                className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Selling Price (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={prodPrice}
                  onChange={(e) => setProdPrice(e.target.value)}
                  placeholder="40"
                  required
                  className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Original MRP (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={prodMrp}
                  onChange={(e) => setProdMrp(e.target.value)}
                  placeholder="50"
                  className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Unit *
                </label>
                <input
                  type="text"
                  value={prodUnit}
                  onChange={(e) => setProdUnit(e.target.value)}
                  placeholder="1 kg"
                  required
                  className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Stock *
                </label>
                <input
                  type="number"
                  value={prodStock}
                  onChange={(e) => setProdStock(e.target.value)}
                  placeholder="10"
                  required
                  className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Total Stock
                </label>
                <input
                  type="number"
                  value={prodTotalStock}
                  onChange={(e) => setProdTotalStock(e.target.value)}
                  placeholder="20"
                  className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Category
              </label>
              <select
                value={prodCategoryId}
                onChange={(e) => setProdCategoryId(e.target.value)}
                className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="">Select Category</option>
                {categoriesList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Image URL
              </label>
              <input
                type="text"
                value={prodImageUrl}
                onChange={(e) => setProdImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Description
              </label>
              <textarea
                value={prodDescription}
                onChange={(e) => setProdDescription(e.target.value)}
                rows={2}
                placeholder="Fresh local produce..."
                className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="flex gap-3 pt-3">
              <button
                type="button"
                onClick={() => setProductModalOpen(false)}
                className="flex-1 rounded-2xl border border-border py-3 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saveProductMutation.isPending}
                className="flex-1 rounded-2xl bg-emerald-500 text-black py-3 text-xs font-bold shadow-lg hover:bg-emerald-400 flex items-center justify-center gap-2"
              >
                {saveProductMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save Product"
                )}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="rounded-3xl border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2 text-rose-600">
              <AlertCircle className="h-5 w-5" /> Delete Product
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to delete <span className="font-bold text-foreground">{deleteTarget?.name}</span>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-3 pt-3">
            <button
              onClick={() => setDeleteTarget(null)}
              className="flex-1 rounded-2xl border border-border py-2.5 text-xs font-bold"
            >
              Cancel
            </button>
            <button
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              className="flex-1 rounded-2xl bg-rose-600 text-white py-2.5 text-xs font-bold shadow-lg hover:bg-rose-500 flex items-center justify-center gap-2"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
