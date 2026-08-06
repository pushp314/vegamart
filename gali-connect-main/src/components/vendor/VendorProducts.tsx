import { useState, useRef } from "react";
import { Plus, Edit2, Trash2, Package, Upload, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

export function VendorProducts({
  productList,
  categoriesList,
  handleOpenEditProduct,
  handleOpenAddProduct,
  setDeleteTarget,
}: any) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingBulk, setIsUploadingBulk] = useState(false);

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a valid CSV file");
      return;
    }

    setIsUploadingBulk(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      // Assuming a backend endpoint for bulk upload exists, e.g., /products/bulk-upload
      // If not, we would need to implement it in the backend.
      // For now, let's simulate or use the real endpoint.
      const res = await api.post("/products/bulk-upload", formData);

      if (res.success) {
        toast.success("Products uploaded successfully");
        queryClient.invalidateQueries({ queryKey: ["vendorProducts"] });
      } else {
        toast.error(res.error?.message || "Failed to upload products");
      }
    } catch (err) {
      toast.error("An error occurred during upload");
    } finally {
      setIsUploadingBulk(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleToggleStock = async (product: any) => {
    try {
      const newStatus = product.is_active ? false : true;
      const res = await api.patch(`/products/${product.id}`, { is_active: newStatus });
      if (res.success) {
        toast.success(newStatus ? "Product marked in stock" : "Product marked out of stock");
        queryClient.invalidateQueries({ queryKey: ["vendorProducts"] });
      }
    } catch (err) {
      toast.error("Failed to update stock status");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Store Catalog</h2>
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
            className="flex items-center gap-1.5 rounded-2xl bg-muted text-foreground border border-border font-semibold text-xs px-3 py-2 shadow-xs hover:bg-muted/80"
          >
            {isUploadingBulk ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Bulk Upload
          </button>
          <button
            onClick={handleOpenAddProduct}
            className="flex items-center gap-1.5 rounded-2xl bg-emerald-500 text-black font-semibold text-xs px-4 py-2 shadow-xs hover:bg-emerald-400"
          >
            <Plus className="h-4 w-4" /> Add Product
          </button>
        </div>
      </div>

      {productList.length === 0 ? (
        <div className="rounded-3xl border border-border bg-muted/50 p-12 text-center space-y-3">
          <Package className="h-10 w-10 mx-auto text-emerald-500" />
          <h3 className="font-bold text-sm">Your store catalog is empty</h3>
          <p className="text-xs text-muted-foreground">
            List your fresh products for nearby customers or upload a CSV file.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {productList.map((p: any) => (
            <div
              key={p.id}
              className={`rounded-3xl border border-border bg-muted/50 p-4 space-y-3 shadow-2xl relative ${!p.is_active ? "opacity-70" : ""}`}
            >
              {!p.is_active && (
                <div className="absolute top-2 right-2 bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full z-10">
                  Out of Stock
                </div>
              )}
              <img
                src={
                  p.images?.[0]?.url ||
                  "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=300"
                }
                alt={p.name}
                className="h-28 w-full rounded-2xl object-cover"
              />
              <div>
                <div className="font-bold text-sm truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  {p.category?.name || "Uncategorized"}
                </div>
                <div className="text-xs font-bold text-emerald-600 mt-0.5">
                  ₹{p.price}{" "}
                  <span className="text-muted-foreground font-normal text-[11px]">/ {p.unit}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t">
                <button
                  onClick={() => handleToggleStock(p)}
                  className="flex-1 rounded-xl border border-border py-1.5 text-[11px] font-semibold hover:bg-accent/50"
                >
                  {p.is_active ? "Mark Out of Stock" : "Mark In Stock"}
                </button>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => handleOpenEditProduct(p)}
                  className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-border py-1.5 text-[11px] font-semibold hover:bg-accent/50"
                >
                  <Edit2 className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  onClick={() => setDeleteTarget(p)}
                  className="p-1.5 rounded-xl border border-border text-destructive hover:bg-rose-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
