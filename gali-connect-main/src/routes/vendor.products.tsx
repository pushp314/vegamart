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
  CheckSquare,
  Square,
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
  variants?: { unit: string; price: number; mrp?: number }[];
  stock?: number;
  description?: string;
  is_active: boolean;
  is_vegetarian?: boolean | null;
  category_id?: string;
  category?: Category;
  images?: { id: string; url: string }[];
};

type VariantRow = { unit: string; price: string; mrp: string };

function VendorProductsPage() {
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [isBulkActing, setIsBulkActing] = useState(false);
  const [isUploadingBulk, setIsUploadingBulk] = useState(false);

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingBulk(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/v1/vendors/products/bulk-upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to upload CSV");
      const data = await res.json();
      toast.success(`Successfully imported ${data.data.count} products!`);
      queryClient.invalidateQueries({ queryKey: ["vendorProducts"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to import products");
    } finally {
      setIsUploadingBulk(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const imageUploadRef = useRef<HTMLInputElement>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Modal States
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [galleryModalOpen, setGalleryModalOpen] = useState(false);

  // Form Fields
  const [prodName, setProdName] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodMrp, setProdMrp] = useState("");
  const [prodUnit, setProdUnit] = useState("1 kg");
  const [prodVariants, setProdVariants] = useState<{ unit: string; price: string; mrp: string }[]>([]);
  const [prodStock, setProdStock] = useState("");
  const [prodCategoryId, setProdCategoryId] = useState("");
  const [prodIsVegetarian, setProdIsVegetarian] = useState<boolean | null>(null);
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

  const { data: galleryRes, isLoading: galleryLoading } = useQuery({
    queryKey: ["productGallery"],
    queryFn: () => api.get<string[]>("/products/gallery"),
    enabled: galleryModalOpen,
  });
  const galleryImages: string[] = galleryRes?.data || [];

  // Filtered list
  const filteredProducts = productList.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "ALL" || p.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Bulk Selection Helpers
  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedProductIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedProductIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedProductIds.size === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const handleBulkAction = async (action: 'delete' | 'active' | 'inactive') => {
    if (selectedProductIds.size === 0) return;
    setIsBulkActing(true);
    try {
      const promises = Array.from(selectedProductIds).map(async (id) => {
        if (action === 'delete') {
          return api.delete(`/products/${id}`);
        } else {
          return api.patch(`/products/${id}`, { is_active: action === 'active' });
        }
      });
      await Promise.allSettled(promises);
      toast.success(`Successfully updated ${selectedProductIds.size} products!`);
      setSelectedProductIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["vendorProducts"] });
    } catch (e) {
      toast.error("Bulk action encountered some errors.");
    } finally {
      setIsBulkActing(false);
    }
  };

  // Open Modal helpers
  const handleOpenAdd = () => {
    setEditingProduct(null);
    setProdName("");
    setProdPrice("");
    setProdMrp("");
    setProdUnit("1 kg");
    setProdVariants([]);
    setProdStock("10");
    setProdCategoryId(categoriesList[0]?.id || "");
    setProdIsVegetarian(null);
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
    setProdVariants(
      Array.isArray(p.variants)
        ? p.variants.map((v) => ({
            unit: v.unit || "",
            price: v.price != null ? String(v.price) : "",
            mrp: v.mrp != null ? String(v.mrp) : "",
          }))
        : []
    );
    setProdStock(String(p.stock ?? 0));
    setProdCategoryId(p.category_id || "");
    setProdIsVegetarian(p.is_vegetarian ?? null);
    setProdDescription(p.description || "");
    setProdImageUrl(p.images?.[0]?.url || "");
    setProductModalOpen(true);
  };

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
      if (prodMrp && Number(prodMrp) < Number(prodPrice)) {
        throw new Error("Original MRP cannot be less than the Selling Price");
      }

      const payload: any = {
        name: prodName,
        price: Number(prodPrice),
        mrp: prodMrp ? Number(prodMrp) : undefined,
        unit: prodUnit,
        variants:
          prodVariants.length > 0
            ? prodVariants
                .filter((v) => v.unit.trim() && v.price !== "" && Number(v.price) >= 0)
                .map((v) => ({
                  unit: v.unit.trim(),
                  price: Number(v.price),
                  mrp: v.mrp !== "" && Number(v.mrp) > 0 ? Number(v.mrp) : undefined,
                }))
            : undefined,
        stock: Number(prodStock),
        category_id: prodCategoryId || undefined,
        is_vegetarian: prodIsVegetarian,
        description: prodDescription || undefined,
      };

      let res: any;
      if (editingProduct) {
        res = await api.patch(`/products/${editingProduct.id}`, payload);
      } else {
        res = await api.post("/products", payload);
      }

      if (!res.success) {
        throw new Error(res.error?.message || "Failed to save product details");
      }

      const productId = editingProduct?.id || res?.data?.id;

      if (productId) {
        // Sync Inventory
        try {
          await api.put(`/inventory/${productId}`, { quantity: Number(prodStock) });
        } catch (e) {
          console.warn("Inventory sync failed:", e);
        }

        // Add Image
        if (prodImageUrl) {
          try {
            await api.post(`/products/${productId}/images`, { images: [{ url: prodImageUrl, is_primary: true }] });
          } catch (e) {
            console.warn("Image linking failed:", e);
          }
        }
      }

      return res;
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "products");

    try {
      const res: any = await api.post("/uploads", formData);
      
      if (!res.success) {
        if (res.error?.message?.includes("8192px") || res.error?.code === "IMAGE_TOO_LARGE" || res.error?.code === "FILE_TOO_LARGE") {
          throw new Error("Image file exceeds the 10 MB limit. Please upload a smaller image.");
        }
        throw new Error(res.error?.message || "Failed to upload image");
      }

      const uploadedUrl = res?.data?.data?.url || res?.data?.url || res?.url || res?.data?.fileUrl;
      if (uploadedUrl) {
        setProdImageUrl(uploadedUrl);
        toast.success("Image uploaded successfully!");
      } else {
        toast.error("Failed to parse image URL from response.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload image");
    } finally {
      setIsUploadingImage(false);
      if (imageUploadRef.current) imageUploadRef.current.value = "";
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
            onChange={handleBulkImport}
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
            onClick={toggleSelectAll}
            className={`px-3 py-2 text-xs rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              selectedProductIds.size === filteredProducts.length && filteredProducts.length > 0
                ? "bg-emerald-500 text-black shadow-sm"
                : "bg-muted border border-border text-foreground hover:bg-accent"
            }`}
          >
            {selectedProductIds.size === filteredProducts.length && filteredProducts.length > 0 ? (
              <CheckSquare className="h-3.5 w-3.5" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}
            {selectedProductIds.size > 0 ? `Selected (${selectedProductIds.size})` : "Select All"}
          </button>
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
                } ${selectedProductIds.has(p.id) ? "ring-2 ring-emerald-500 bg-emerald-500/5" : ""}`}
              >
                <div 
                  className="absolute top-3 left-3 z-20 cursor-pointer p-1 hover:scale-110 transition-transform"
                  onClick={(e) => { e.stopPropagation(); toggleSelect(p.id); }}
                >
                  {selectedProductIds.has(p.id) ? (
                    <CheckSquare className="h-6 w-6 text-emerald-500 bg-white rounded-md shadow-sm" />
                  ) : (
                    <Square className="h-6 w-6 text-muted-foreground bg-white/50 backdrop-blur-sm rounded-md shadow-sm" />
                  )}
                </div>

                {!p.is_active && (
                  <span className="absolute top-3 right-3 z-10 rounded-full bg-rose-500/90 text-white text-[10px] font-bold px-2.5 py-0.5 shadow-sm backdrop-blur-sm">
                    Out of Stock
                  </span>
                )}

                {hasMrp && (
                  <span className="absolute top-12 left-3 z-10 rounded-full bg-emerald-500 text-black text-[10px] font-black uppercase px-2.5 py-0.5 shadow-sm">
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

      {/* Bulk Action Sticky Footer */}
      {selectedProductIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="bg-slate-900 text-white rounded-full shadow-2xl px-6 py-3 flex items-center gap-4 border border-slate-700/50">
            <span className="text-xs font-bold whitespace-nowrap">
              {selectedProductIds.size} selected
            </span>
            <div className="h-4 w-px bg-slate-700"></div>
            <button
              onClick={() => handleBulkAction('active')}
              disabled={isBulkActing}
              className="text-xs font-bold hover:text-emerald-400 transition-colors whitespace-nowrap flex items-center gap-1.5"
            >
              <Check className="h-3.5 w-3.5" /> In Stock
            </button>
            <button
              onClick={() => handleBulkAction('inactive')}
              disabled={isBulkActing}
              className="text-xs font-bold hover:text-amber-400 transition-colors whitespace-nowrap flex items-center gap-1.5"
            >
              <X className="h-3.5 w-3.5" /> Out of Stock
            </button>
            <div className="h-4 w-px bg-slate-700"></div>
            <button
              onClick={() => handleBulkAction('delete')}
              disabled={isBulkActing}
              className="text-xs font-bold text-rose-400 hover:text-rose-300 transition-colors whitespace-nowrap flex items-center gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
            {isBulkActing && <Loader2 className="h-4 w-4 animate-spin ml-2 text-muted-foreground" />}
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      <Dialog open={productModalOpen} onOpenChange={setProductModalOpen}>
        <DialogContent className="rounded-3xl border-border max-w-xl">
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

            <div className="grid grid-cols-2 gap-3">
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
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Additional Pack Sizes (Optional)
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setProdVariants((prev) => [...prev, { unit: "", price: "", mrp: "" }])
                  }
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 text-[10.5px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition-colors"
                >
                  <Plus className="h-3 w-3" /> Add Pack Size
                </button>
              </div>
              <p className="text-[10.5px] text-muted-foreground">
                Sell the same product in multiple sizes, e.g. 250g, 500g, 1kg. Base pack size is the
                Unit above.
              </p>
              {prodVariants.length > 0 && (
                <div className="space-y-2">
                  {prodVariants.map((v, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-[1fr_0.9fr_0.9fr_auto] gap-2 items-end rounded-2xl border border-border bg-muted/40 p-2.5"
                    >
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Pack Size
                        </label>
                        <input
                          type="text"
                          value={v.unit}
                          onChange={(e) =>
                            setProdVariants((prev) =>
                              prev.map((row, i) =>
                                i === idx ? { ...row, unit: e.target.value } : row
                              )
                            )
                          }
                          placeholder="e.g. 250g"
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Price (₹)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={v.price}
                          onChange={(e) =>
                            setProdVariants((prev) =>
                              prev.map((row, i) =>
                                i === idx ? { ...row, price: e.target.value } : row
                              )
                            )
                          }
                          placeholder="25"
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          MRP (₹)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={v.mrp}
                          onChange={(e) =>
                            setProdVariants((prev) =>
                              prev.map((row, i) =>
                                i === idx ? { ...row, mrp: e.target.value } : row
                              )
                            )
                          }
                          placeholder="30"
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setProdVariants((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="grid h-8 w-8 place-items-center rounded-xl border border-border bg-background text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        aria-label="Remove pack size"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Category *
              </label>
              <select
                value={prodCategoryId}
                onChange={(e) => setProdCategoryId(e.target.value)}
                required
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
                Dietary Preference
              </label>
              <select
                value={prodIsVegetarian === null ? "" : prodIsVegetarian ? "true" : "false"}
                onChange={(e) => {
                  const val = e.target.value;
                  setProdIsVegetarian(val === "" ? null : val === "true");
                }}
                className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="">Not Applicable / Unknown</option>
                <option value="true">Vegetarian (Veg)</option>
                <option value="false">Non-Vegetarian</option>
              </select>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Image URL
                </label>
                <span className="text-[10px] text-muted-foreground font-medium">Max size: 10 MB</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={prodImageUrl}
                  onChange={(e) => setProdImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="flex-1 rounded-2xl border border-border bg-muted/50 px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <input
                  type="file"
                  ref={imageUploadRef}
                  onChange={handleImageUpload}
                  accept="image/jpeg, image/png, image/webp, image/avif, image/gif"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => imageUploadRef.current?.click()}
                  disabled={isUploadingImage}
                  className="rounded-2xl border border-border bg-card px-4 py-2.5 text-xs font-bold hover:bg-muted whitespace-nowrap inline-flex items-center justify-center gap-1.5"
                >
                  {isUploadingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Upload
                </button>
                <button
                  type="button"
                  onClick={() => setGalleryModalOpen(true)}
                  className="rounded-2xl border border-border bg-card px-4 py-2.5 text-xs font-bold hover:bg-muted whitespace-nowrap inline-flex items-center justify-center gap-1.5"
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  Gallery
                </button>
              </div>
              {prodImageUrl && (
                <div className="mt-3 relative h-32 w-32 rounded-xl overflow-hidden border border-border bg-muted/30">
                  <img src={prodImageUrl} alt="Preview" className="h-full w-full object-cover" />
                  <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase backdrop-blur-sm tracking-wider">Preview</div>
                </div>
              )}
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

      {/* Delete Confirmation Modal */}
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

      {/* Image Gallery Modal */}
      <Dialog open={galleryModalOpen} onOpenChange={setGalleryModalOpen}>
        <DialogContent className="rounded-3xl border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-emerald-600" /> Image Gallery
            </DialogTitle>
            <DialogDescription className="text-xs">
              Select a previously uploaded image for your product.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {galleryLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
              </div>
            ) : galleryImages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                No images found in your gallery.
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[60vh] overflow-y-auto pr-2">
                {galleryImages.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setProdImageUrl(url);
                      setGalleryModalOpen(false);
                    }}
                    className="relative aspect-square rounded-xl overflow-hidden border border-border hover:border-emerald-500 group focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    <img src={url} alt={`Gallery image ${i}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Check className="h-6 w-6 text-white" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
