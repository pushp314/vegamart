import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, formatErrorMessage } from "@/lib/api";
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
  AlertCircle,
  Star,
  ImagePlus,
  MoveLeft,
  MoveRight,
  Maximize2,
  CheckCircle2,
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
type ProductImageItem = {
  id?: string;
  url: string;
  is_primary?: boolean;
  alt_text?: string;
};

type Product = {
  id: string;
  name: string;
  price: number;
  mrp?: number;
  tax_rate?: number;
  unit: string;
  variants?: { unit: string; price: number; mrp?: number }[];
  stock?: number;
  description?: string;
  category_id?: string;
  is_active: boolean;
  is_available: boolean;
  is_vegetarian?: boolean | null;
  image_url?: string;
  images?: { id: string; url: string; is_primary?: boolean }[];
};

export default function VendorProductsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [galleryModalOpen, setGalleryModalOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingBulk, setIsUploadingBulk] = useState(false);
  const [isBulkActing, setIsBulkActing] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [previewZoomUrl, setPreviewZoomUrl] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([]);
  const [replacingImageIndex, setReplacingImageIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageUploadRef = useRef<HTMLInputElement>(null);
  const replaceUploadRef = useRef<HTMLInputElement>(null);

  // Form Fields
  const [prodName, setProdName] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodMrp, setProdMrp] = useState("");
  const [prodTaxRate, setProdTaxRate] = useState("0");
  const [prodUnit, setProdUnit] = useState("1 kg");
  const [prodVariants, setProdVariants] = useState<{ unit: string; price: string; mrp: string }[]>([]);
  const [prodStock, setProdStock] = useState("");
  const [prodCategoryId, setProdCategoryId] = useState("");
  const [prodIsVegetarian, setProdIsVegetarian] = useState<boolean | null>(null);
  const [prodDescription, setProdDescription] = useState("");
  const [prodImages, setProdImages] = useState<ProductImageItem[]>([]);
  const [urlInput, setUrlInput] = useState("");

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

  const selectAll = () => {
    if (selectedProductIds.size === filteredProducts.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  // Bulk Status / Delete Actions
  const handleBulkAction = async (action: "active" | "inactive" | "delete") => {
    if (selectedProductIds.size === 0) return;
    setIsBulkActing(true);
    try {
      if (action === "delete") {
        await Promise.all(
          Array.from(selectedProductIds).map((id) => api.delete(`/products/${id}`))
        );
        toast.success(`Deleted ${selectedProductIds.size} products.`);
      } else {
        const is_active = action === "active";
        await Promise.all(
          Array.from(selectedProductIds).map((id) =>
            api.patch(`/products/${id}`, { is_active, is_available: is_active })
          )
        );
        toast.success(
          `Marked ${selectedProductIds.size} products as ${is_active ? "In Stock" : "Out of Stock"}.`
        );
      }
      setSelectedProductIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["vendorProducts"] });
    } catch (e: any) {
      toast.error(e?.message || "Failed to perform bulk action");
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
    setProdTaxRate("0");
    setProdUnit("1 kg");
    setProdVariants([]);
    setProdStock("10");
    setProdCategoryId(categoriesList[0]?.id || "");
    setProdIsVegetarian(null);
    setProdDescription("");
    setProdImages([]);
    setUrlInput("");
    setDeletedImageIds([]);
    setFieldErrors({});
    setProductModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setProdName(p.name);
    setProdPrice(String(p.price));
    setProdMrp(p.mrp ? String(p.mrp) : "");
    setProdTaxRate(p.tax_rate != null ? String(p.tax_rate) : "0");
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

    const existingImages: ProductImageItem[] =
      p.images && p.images.length > 0
        ? p.images.map((img, i) => ({
            id: img.id,
            url: img.url,
            is_primary: img.is_primary ?? i === 0,
          }))
        : p.image_url
        ? [{ url: p.image_url, is_primary: true }]
        : [];

    setProdImages(existingImages);
    setUrlInput("");
    setDeletedImageIds([]);
    setFieldErrors({});
    setProductModalOpen(true);
  };

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => {
      toast.success("Product removed from catalog");
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
      const errors: Record<string, string> = {};

      if (!prodName.trim()) {
        errors.name = "Product Title is required";
      } else if (prodName.trim().length < 2) {
        errors.name = "Product Title must be at least 2 characters";
      }

      if (!prodPrice || Number(prodPrice) <= 0) {
        errors.price = "Selling price must be greater than ₹0";
      }

      if (prodMrp && Number(prodMrp) < Number(prodPrice)) {
        errors.mrp = "Original MRP cannot be less than Selling Price";
      }

      if (!prodCategoryId) {
        errors.category_id = "Please select a Category";
      }

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        const firstErrMsg = Object.values(errors)[0];
        throw new Error(firstErrMsg);
      }

      setFieldErrors({});

      const payload: any = {
        name: prodName.trim(),
        price: Number(prodPrice),
        mrp: prodMrp && Number(prodMrp) > 0 ? Number(prodMrp) : undefined,
        tax_rate: prodTaxRate ? Number(prodTaxRate) : 0,
        unit: prodUnit.trim() || "1 kg",
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
        stock: Number(prodStock) || 0,
        category_id: prodCategoryId,
        is_vegetarian: prodIsVegetarian,
        description: prodDescription.trim() || undefined,
      };

      let res: any;
      if (editingProduct) {
        res = await api.patch(`/products/${editingProduct.id}`, payload);
      } else {
        res = await api.post("/products", payload);
      }

      if (!res.success) {
        const errorMsg = formatErrorMessage(res.error, "Failed to save product details");
        throw new Error(errorMsg);
      }

      const productId = editingProduct?.id || res?.data?.id;

      if (productId) {
        // Sync Inventory
        try {
          await api.put(`/inventory/${productId}`, { quantity: Number(prodStock) || 0 });
        } catch (e) {
          console.warn("Inventory sync failed:", e);
        }

        // 1. Delete removed images on server if editing
        if (editingProduct && deletedImageIds.length > 0) {
          for (const imgId of deletedImageIds) {
            try {
              await api.delete(`/products/${productId}/images/${imgId}`);
            } catch (e) {
              console.warn("Failed to delete image on server:", e);
            }
          }
        }

        // 2. Upload any new images (those without an id)
        const newImagesToUpload = prodImages.filter((img) => !img.id);
        if (newImagesToUpload.length > 0) {
          try {
            await api.post(`/products/${productId}/images`, {
              images: newImagesToUpload.map((img, idx) => ({
                url: img.url,
                is_primary: img.is_primary ?? (!editingProduct && idx === 0),
              })),
            });
          } catch (e) {
            console.warn("Image linking failed:", e);
          }
        }

        // 3. Sync primary image if set on an existing image
        const primaryImg = prodImages.find((img) => img.is_primary);
        if (editingProduct && primaryImg?.id) {
          try {
            await api.put(`/products/${productId}/images/primary`, { image_id: primaryImg.id });
          } catch (e) {
            console.warn("Failed to update primary image:", e);
          }
        }
      }

      return res;
    },
    onSuccess: () => {
      toast.success(editingProduct ? "Product updated successfully!" : "Product created successfully!");
      setProductModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["vendorProducts"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save product", { duration: 6000 });
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
      const res: any = await api.post("/products/bulk-upload", formData);
      if (res.success) {
        toast.success("Bulk products imported successfully!");
        queryClient.invalidateQueries({ queryKey: ["vendorProducts"] });
      } else {
        toast.error(formatErrorMessage(res.error, "Failed to import products"));
      }
    } catch (err: any) {
      toast.error(err?.message || "Bulk upload failed");
    } finally {
      setIsUploadingBulk(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Multi-Image Upload Handler
  const handleMultipleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingImage(true);
    const uploadedUrls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "products");

      try {
        const res: any = await api.post("/uploads", formData);
        if (res.success) {
          const uploadedUrl =
            res?.data?.data?.url || res?.data?.url || res?.url || res?.data?.fileUrl;
          if (uploadedUrl) {
            uploadedUrls.push(uploadedUrl);
          }
        } else {
          toast.error(`Failed to upload ${file.name}: ${formatErrorMessage(res.error)}`);
        }
      } catch (err: any) {
        toast.error(`Error uploading ${file.name}: ${err?.message}`);
      }
    }

    if (uploadedUrls.length > 0) {
      setProdImages((prev) => {
        const hasPrimary = prev.some((img) => img.is_primary);
        const newItems: ProductImageItem[] = uploadedUrls.map((url, idx) => ({
          url,
          is_primary: !hasPrimary && idx === 0,
        }));
        return [...prev, ...newItems].slice(0, 10);
      });
      toast.success(`${uploadedUrls.length} product image(s) uploaded!`);
    }

    setIsUploadingImage(false);
    if (imageUploadRef.current) imageUploadRef.current.value = "";
  };

  // Add Image via Direct URL
  const handleAddImageUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      toast.error("Please enter a valid image URL starting with http:// or https://");
      return;
    }
    setProdImages((prev) => {
      const hasPrimary = prev.some((img) => img.is_primary);
      return [
        ...prev,
        { url: trimmed, is_primary: !hasPrimary && prev.length === 0 },
      ].slice(0, 10);
    });
    setUrlInput("");
    toast.success("Image URL added to product gallery!");
  };

  // Pick Image from Gallery
  const handlePickFromGallery = (url: string) => {
    setProdImages((prev) => {
      const hasPrimary = prev.some((img) => img.is_primary);
      return [
        ...prev,
        { url, is_primary: !hasPrimary && prev.length === 0 },
      ].slice(0, 10);
    });
    setGalleryModalOpen(false);
    toast.success("Gallery image added!");
  };

  // Image manipulation helpers
  const handleSetPrimaryImage = (index: number) => {
    setProdImages((prev) =>
      prev.map((img, i) => ({
        ...img,
        is_primary: i === index,
      }))
    );
    toast.success("Primary cover image updated!");
  };

  const handleRemoveImage = (index: number) => {
    setProdImages((prev) => {
      const removed = prev[index];
      if (removed?.id) {
        setDeletedImageIds((d) => [...d, removed.id!]);
      }
      const updated = prev.filter((_, i) => i !== index);
      if (updated.length > 0 && !updated.some((img) => img.is_primary)) {
        updated[0].is_primary = true;
      }
      return updated;
    });
    toast.success("Photo removed from product");
  };

  const handleStartReplaceImage = (index: number) => {
    setReplacingImageIndex(index);
    replaceUploadRef.current?.click();
  };

  const handleFileReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || replacingImageIndex === null) return;

    setIsUploadingImage(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "products");

    try {
      const res: any = await api.post("/uploads", formData);
      if (res.success) {
        const uploadedUrl =
          res?.data?.data?.url || res?.data?.url || res?.url || res?.data?.fileUrl;
        if (uploadedUrl) {
          setProdImages((prev) => {
            const copy = [...prev];
            const old = copy[replacingImageIndex];
            if (old?.id) {
              setDeletedImageIds((d) => [...d, old.id!]);
            }
            copy[replacingImageIndex] = {
              url: uploadedUrl,
              is_primary: old?.is_primary ?? replacingImageIndex === 0,
            };
            return copy;
          });
          toast.success("Product photo replaced successfully!");
        }
      } else {
        toast.error(formatErrorMessage(res.error, "Failed to upload replacement image"));
      }
    } catch (err: any) {
      toast.error(err?.message || "Error replacing image");
    } finally {
      setIsUploadingImage(false);
      setReplacingImageIndex(null);
      if (replaceUploadRef.current) replaceUploadRef.current.value = "";
    }
  };

  const handleMoveImage = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= prodImages.length) return;
    setProdImages((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
  };

  return (
    <div className="w-full overflow-x-auto pb-4">
      <div className="min-w-[1024px] space-y-6 px-1">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight">Store Catalog</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage your inventory, prices, product photos, and availability.
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
              className="rounded-2xl border border-border bg-card px-4 py-2.5 text-xs font-bold hover:bg-muted whitespace-nowrap inline-flex items-center justify-center gap-1.5"
            >
              {isUploadingBulk ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              Bulk CSV
            </button>

            <button
              onClick={handleOpenAdd}
              className="rounded-2xl bg-emerald-500 text-black px-4 py-2.5 text-xs font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 whitespace-nowrap inline-flex items-center justify-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Add Product
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products by title..."
              className="w-full rounded-2xl border border-border bg-card pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedCategory("ALL")}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap ${
                selectedCategory === "ALL"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              All Items ({productList.length})
            </button>
            {categoriesList.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap ${
                  selectedCategory === cat.id
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        {prodsLoading ? (
          <div className="py-20 flex justify-center items-center">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-16 bg-muted/20 border border-dashed border-border rounded-3xl p-6">
            <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-50" />
            <h3 className="font-bold text-sm">No products found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Get started by adding your first fresh produce or grocery item to your store catalog.
            </p>
            <button
              onClick={handleOpenAdd}
              className="mt-4 inline-flex items-center gap-1.5 rounded-2xl bg-emerald-500 text-black px-4 py-2 text-xs font-bold shadow-md hover:bg-emerald-400"
            >
              <Plus className="h-3.5 w-3.5" /> Add Product Now
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {filteredProducts.map((p) => {
              const isSelected = selectedProductIds.has(p.id);
              const primaryImg = p.images?.find((img) => img.is_primary)?.url || p.images?.[0]?.url || p.image_url;
              return (
                <div
                  key={p.id}
                  className={`group relative flex flex-col justify-between rounded-2xl border bg-card p-3 shadow-sm hover:shadow-md transition-all ${
                    isSelected ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-border"
                  }`}
                >
                  <div>
                    {/* Selection Checkbox */}
                    <button
                      onClick={() => toggleSelect(p.id)}
                      className="absolute top-2 left-2 z-10 p-1 rounded-lg bg-black/40 text-white backdrop-blur-md opacity-80 hover:opacity-100 transition-opacity"
                    >
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>

                    {/* Image Thumbnail */}
                    <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-muted/40 mb-2.5">
                      {primaryImg ? (
                        <img
                          src={primaryImg}
                          alt={p.name}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                          <Package className="h-8 w-8 opacity-30" />
                        </div>
                      )}

                      {/* Photo Count Badge */}
                      {p.images && p.images.length > 1 && (
                        <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm">
                          📷 {p.images.length} photos
                        </span>
                      )}

                      {/* Stock Status Badge */}
                      <span
                        className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.is_active && (p.stock ?? 0) > 0
                            ? "bg-emerald-500/90 text-black"
                            : "bg-rose-500/90 text-white"
                        }`}
                      >
                        {p.is_active && (p.stock ?? 0) > 0 ? "In Stock" : "Out of Stock"}
                      </span>
                    </div>

                    {/* Details */}
                    <h4 className="font-bold text-xs line-clamp-1 group-hover:text-emerald-500 transition-colors">
                      {p.name}
                    </h4>

                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="font-black text-sm text-foreground">₹{p.price}</span>
                      {p.mrp && p.mrp > p.price && (
                        <span className="text-[10px] text-muted-foreground line-through">
                          ₹{p.mrp}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">/{p.unit}</span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border/50">
                      <span>Stock: {p.stock ?? 0}</span>
                      {p.is_vegetarian !== null && (
                        <span className={p.is_vegetarian ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>
                          {p.is_vegetarian ? "Veg" : "Non-Veg"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-1.5 mt-3 pt-2 border-t border-border">
                    <button
                      onClick={() => handleOpenEdit(p)}
                      className="flex items-center justify-center gap-1 rounded-lg border border-border bg-muted/30 py-1.5 text-[10px] sm:text-xs font-bold hover:bg-muted transition-colors"
                    >
                      <Edit2 className="h-3 w-3" /> Edit
                    </button>
                    <button
                      onClick={() => setDeleteTarget(p)}
                      className="flex items-center justify-center gap-1 rounded-lg border border-rose-200 bg-rose-50/50 py-1.5 text-[10px] sm:text-xs font-bold text-rose-600 hover:bg-rose-100 dark:bg-rose-950/20 dark:border-rose-900 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
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
                onClick={() => handleBulkAction("active")}
                disabled={isBulkActing}
                className="text-xs font-bold hover:text-emerald-400 transition-colors whitespace-nowrap flex items-center gap-1.5"
              >
                <Check className="h-3.5 w-3.5" /> In Stock
              </button>
              <button
                onClick={() => handleBulkAction("inactive")}
                disabled={isBulkActing}
                className="text-xs font-bold hover:text-amber-400 transition-colors whitespace-nowrap flex items-center gap-1.5"
              >
                <X className="h-3.5 w-3.5" /> Out of Stock
              </button>
              <div className="h-4 w-px bg-slate-700"></div>
              <button
                onClick={() => handleBulkAction("delete")}
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
          <DialogContent className="rounded-3xl border-border max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">
                {editingProduct ? "Edit Product Listing" : "Add New Product"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Fill in product details and upload multiple photos for your storefront.
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveProductMutation.mutate();
              }}
              className="space-y-4 py-2"
            >
              {/* Product Title */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Product Title *</span>
                  {fieldErrors.name && (
                    <span className="text-rose-500 text-[10px] font-semibold">{fieldErrors.name}</span>
                  )}
                </label>
                <input
                  type="text"
                  value={prodName}
                  onChange={(e) => {
                    setProdName(e.target.value);
                    if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: "" }));
                  }}
                  placeholder="e.g. Fresh Organic Tomatoes"
                  required
                  className={`w-full rounded-2xl border px-4 py-2.5 text-xs focus:outline-none focus:ring-2 ${
                    fieldErrors.name
                      ? "border-rose-500 bg-rose-500/5 focus:ring-rose-500/20"
                      : "border-border bg-muted/50 focus:ring-emerald-500/20"
                  }`}
                />
              </div>

              {/* Price & MRP */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Selling Price (₹) *</span>
                    {fieldErrors.price && (
                      <span className="text-rose-500 text-[10px] font-semibold">{fieldErrors.price}</span>
                    )}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={prodPrice}
                    onChange={(e) => {
                      setProdPrice(e.target.value);
                      if (fieldErrors.price) setFieldErrors((prev) => ({ ...prev, price: "" }));
                    }}
                    placeholder="40"
                    required
                    className={`w-full rounded-2xl border px-4 py-2.5 text-xs focus:outline-none focus:ring-2 ${
                      fieldErrors.price
                        ? "border-rose-500 bg-rose-500/5 focus:ring-rose-500/20"
                        : "border-border bg-muted/50 focus:ring-emerald-500/20"
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Original MRP (₹)</span>
                    {fieldErrors.mrp && (
                      <span className="text-rose-500 text-[10px] font-semibold">{fieldErrors.mrp}</span>
                    )}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={prodMrp}
                    onChange={(e) => {
                      setProdMrp(e.target.value);
                      if (fieldErrors.mrp) setFieldErrors((prev) => ({ ...prev, mrp: "" }));
                    }}
                    placeholder="50"
                    className={`w-full rounded-2xl border px-4 py-2.5 text-xs focus:outline-none focus:ring-2 ${
                      fieldErrors.mrp
                        ? "border-rose-500 bg-rose-500/5 focus:ring-rose-500/20"
                        : "border-border bg-muted/50 focus:ring-emerald-500/20"
                    }`}
                  />
                </div>
              </div>

              {/* Unit & Stock */}
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

              {/* Additional Pack Sizes */}
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
                  Sell the same product in multiple sizes, e.g. 250g, 500g, 1kg.
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
                          className="h-8 w-8 inline-flex items-center justify-center rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tax Rate */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Tax Rate (GST %)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={prodTaxRate}
                  onChange={(e) => setProdTaxRate(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {/* Category */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Category *</span>
                  {fieldErrors.category_id && (
                    <span className="text-rose-500 text-[10px] font-semibold">{fieldErrors.category_id}</span>
                  )}
                </label>
                <select
                  value={prodCategoryId}
                  onChange={(e) => {
                    setProdCategoryId(e.target.value);
                    if (fieldErrors.category_id) setFieldErrors((prev) => ({ ...prev, category_id: "" }));
                  }}
                  required
                  className={`w-full rounded-2xl border px-4 py-2.5 text-xs focus:outline-none focus:ring-2 ${
                    fieldErrors.category_id
                      ? "border-rose-500 bg-rose-500/5 focus:ring-rose-500/20"
                      : "border-border bg-muted/50 focus:ring-emerald-500/20"
                  }`}
                >
                  <option value="">Select Category</option>
                  {categoriesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dietary Preference */}
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

              {/* 📷 Multiple Product Images Studio */}
              <div className="space-y-2 rounded-2xl border border-border bg-muted/20 p-3.5">
                <div className="flex justify-between items-center">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <ImagePlus className="h-3.5 w-3.5 text-emerald-500" />
                      Product Photos ({prodImages.length}/10)
                    </label>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Upload multiple images or paste URLs. Select <Star className="inline h-2.5 w-2.5 text-amber-500 fill-amber-500" /> to set the Cover Photo.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">Max: 10 MB/image</span>
                </div>

                {/* Upload Action Toolbar */}
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <div className="flex-1 flex gap-1.5">
                    <input
                      type="text"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddImageUrl();
                        }
                      }}
                      placeholder="Paste image URL (https://...)"
                      className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <button
                      type="button"
                      onClick={handleAddImageUrl}
                      disabled={!urlInput.trim()}
                      className="rounded-xl border border-border bg-muted px-3 py-2 text-xs font-bold hover:bg-muted/80 disabled:opacity-50"
                    >
                      Add URL
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="file"
                      ref={imageUploadRef}
                      onChange={handleMultipleImageUpload}
                      accept="image/jpeg, image/png, image/webp, image/avif, image/gif"
                      multiple
                      className="hidden"
                    />
                    <input
                      type="file"
                      ref={replaceUploadRef}
                      onChange={handleFileReplace}
                      accept="image/jpeg, image/png, image/webp, image/avif, image/gif"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => imageUploadRef.current?.click()}
                      disabled={isUploadingImage || prodImages.length >= 10}
                      className="flex-1 sm:flex-none rounded-xl bg-emerald-500 text-black px-3.5 py-2 text-xs font-bold hover:bg-emerald-400 disabled:opacity-50 inline-flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      {isUploadingImage ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                      Upload Photos
                    </button>

                    <button
                      type="button"
                      onClick={() => setGalleryModalOpen(true)}
                      className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold hover:bg-muted inline-flex items-center justify-center gap-1.5"
                    >
                      <ImageIcon className="h-3.5 w-3.5" /> Gallery
                    </button>
                  </div>
                </div>

                {/* Multi-Image Thumbnails Grid */}
                {prodImages.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-2">
                    {prodImages.map((img, idx) => (
                      <div
                        key={idx}
                        className={`group relative rounded-xl overflow-hidden border bg-background transition-all aspect-square ${
                          img.is_primary
                            ? "border-emerald-500 ring-2 ring-emerald-500/30"
                            : "border-border hover:border-muted-foreground/50"
                        }`}
                      >
                        <img
                          src={img.url}
                          alt={`Product photo ${idx + 1}`}
                          className="h-full w-full object-cover"
                        />

                        {/* Top Cover / Slide Badge */}
                        <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                          {img.is_primary ? (
                            <span className="inline-flex items-center gap-0.5 bg-emerald-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm">
                              <Star className="h-2.5 w-2.5 fill-black" /> COVER
                            </span>
                          ) : (
                            <span className="bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm">
                              #{idx + 1}
                            </span>
                          )}
                        </div>

                        {/* Actions Overlay */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1.5">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setPreviewZoomUrl(img.url)}
                              className="h-6 w-6 rounded-md bg-white/20 hover:bg-white/40 text-white flex items-center justify-center backdrop-blur-sm"
                              title="Zoom Preview"
                            >
                              <Maximize2 className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartReplaceImage(idx)}
                              className="h-6 w-6 rounded-md bg-amber-500/80 hover:bg-amber-500 text-slate-950 flex items-center justify-center"
                              title="Replace Photo"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(idx)}
                              className="h-6 w-6 rounded-md bg-rose-500/80 hover:bg-rose-500 text-white flex items-center justify-center"
                              title="Delete Photo"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between gap-1 pt-2">
                            <div className="flex gap-0.5">
                              <button
                                type="button"
                                onClick={() => handleMoveImage(idx, idx - 1)}
                                disabled={idx === 0}
                                className="h-6 w-6 rounded-md bg-white/20 hover:bg-white/40 text-white flex items-center justify-center disabled:opacity-30"
                                title="Move Left"
                              >
                                <MoveLeft className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveImage(idx, idx + 1)}
                                disabled={idx === prodImages.length - 1}
                                className="h-6 w-6 rounded-md bg-white/20 hover:bg-white/40 text-white flex items-center justify-center disabled:opacity-30"
                                title="Move Right"
                              >
                                <MoveRight className="h-3 w-3" />
                              </button>
                            </div>

                            {!img.is_primary && (
                              <button
                                type="button"
                                onClick={() => handleSetPrimaryImage(idx)}
                                className="text-[9.5px] font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 px-2 py-0.5 rounded shadow-sm flex items-center gap-1"
                              >
                                <Star className="h-2.5 w-2.5 fill-slate-950" /> Set Cover
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center border border-dashed border-border rounded-xl bg-background/50">
                    <ImageIcon className="h-6 w-6 mx-auto text-muted-foreground/60 mb-1" />
                    <p className="text-[11px] font-bold text-muted-foreground">No photos added yet</p>
                    <p className="text-[10px] text-muted-foreground/80">
                      Upload high quality photos of your product to attract more customers.
                    </p>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Description
                </label>
                <textarea
                  value={prodDescription}
                  onChange={(e) => setProdDescription(e.target.value)}
                  rows={2}
                  placeholder="Fresh local produce, crisp quality..."
                  className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  className="flex-1 rounded-2xl border border-border py-3 text-xs font-bold hover:bg-muted"
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
                  ) : editingProduct ? (
                    "Update Product"
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
          <DialogContent className="rounded-3xl border-border max-w-sm max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display flex items-center gap-2 text-rose-600">
                <AlertCircle className="h-5 w-5" /> Delete Product
              </DialogTitle>
              <DialogDescription className="text-xs">
                Are you sure you want to remove <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2 justify-end pt-4">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-border text-xs font-bold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-500 flex items-center gap-1.5"
              >
                {deleteMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm Delete
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Media Gallery Picker Modal */}
        <Dialog open={galleryModalOpen} onOpenChange={setGalleryModalOpen}>
          <DialogContent className="rounded-3xl border-border max-w-xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-emerald-500" /> Media Gallery
              </DialogTitle>
              <DialogDescription className="text-xs">
                Select from previously uploaded photos to add to this product.
              </DialogDescription>
            </DialogHeader>

            {galleryLoading ? (
              <div className="py-12 flex justify-center items-center">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
              </div>
            ) : galleryImages.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No images available in media gallery. Upload one from your device.
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 pt-2">
                {galleryImages.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handlePickFromGallery(url)}
                    className="group relative aspect-square rounded-xl overflow-hidden border border-border bg-muted/30 hover:border-emerald-500 hover:ring-2 hover:ring-emerald-500/20 transition-all cursor-pointer"
                  >
                    <img src={url} alt={`Gallery ${i}`} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-bold">
                      Select
                    </div>
                  </button>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Lightbox Zoom Preview Modal */}
        <Dialog open={!!previewZoomUrl} onOpenChange={(open) => !open && setPreviewZoomUrl(null)}>
          <DialogContent className="rounded-3xl border-border max-w-lg p-3 bg-black/95 text-white">
            {previewZoomUrl && (
              <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-black flex items-center justify-center">
                <img
                  src={previewZoomUrl}
                  alt="High-res preview"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
