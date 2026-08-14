import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Trash2, Edit2, Layers, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminPaginationBar, type PaginationMeta } from "./AdminPaginationBar";

export function AdminCategories() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [page, setPage] = useState(1);

  const imageUploadRef = useRef<HTMLInputElement>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [categoryImageUrl, setCategoryImageUrl] = useState("");

  useEffect(() => {
    if (editingCategory) {
      setCategoryImageUrl(editingCategory.image_url || "");
    } else {
      setCategoryImageUrl("");
    }
  }, [editingCategory]);

  const { data: categoriesRes, isLoading } = useQuery({
    queryKey: ["adminCategories", page],
    queryFn: () => api.get<any>(`/categories?page=${page}&per_page=20&include_inactive=true`),
  });

  const categories = categoriesRes?.data?.data || categoriesRes?.data || [];
  const pagination = categoriesRes?.pagination as PaginationMeta | undefined;

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/categories", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminCategories"] });
      toast.success("Category created");
      setIsModalOpen(false);
    },
    onError: (err: any) => toast.error(err?.message || "Failed to create category"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/categories/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminCategories"] });
      toast.success("Category updated");
      setIsModalOpen(false);
      setEditingCategory(null);
    },
    onError: (err: any) => toast.error(err?.message || "Failed to update category"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminCategories"] });
      toast.success("Category deleted");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to delete category"),
  });

  const openEditModal = (cat: any) => {
    setEditingCategory(cat);
    setIsModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "categories");

    try {
      const res: any = await api.post("/uploads", formData);

      if (!res.success) {
        if (
          res.error?.message?.includes("8192px") ||
          res.error?.code === "IMAGE_TOO_LARGE" ||
          res.error?.code === "FILE_TOO_LARGE"
        ) {
          throw new Error("Image file exceeds the 10 MB limit. Please upload a smaller image.");
        }
        throw new Error(res.error?.message || "Failed to upload image");
      }

      const uploadedUrl = res?.data?.data?.url || res?.data?.url || res?.url || res?.data?.fileUrl;
      if (uploadedUrl) {
        setCategoryImageUrl(uploadedUrl);
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Category Management
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Organize products with categories and subcategories.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingCategory(null);
            setIsModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12 bg-card rounded-3xl border border-border">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category: any) => (
            <div
              key={category.id}
              className="rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center overflow-hidden">
                    {category.image_url ? (
                      <img
                        src={category.image_url}
                        alt={category.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Layers className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-tight">{category.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Slug: {category.slug}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${category.is_active ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
                  >
                    {category.is_active ? "Active" : "Inactive"}
                  </span>
                  <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary">
                    Order: {category.sort_order ?? 0}
                  </span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-border flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => openEditModal(category)}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 border-rose-200"
                  onClick={() => {
                    if (confirm("Delete this category?")) deleteMutation.mutate(category.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {categories.length === 0 && (
            <div className="col-span-full py-16 text-center text-muted-foreground border-2 border-dashed border-border rounded-3xl">
              No categories found. Create one to get started.
            </div>
          )}
        </div>
      )}

      <AdminPaginationBar pagination={pagination} onPageChange={setPage} />

      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) {
            setEditingCategory(null);
            setCategoryImageUrl("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "Create Category"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.target as HTMLFormElement);
              const data = {
                name: fd.get("name"),
                image_url: fd.get("image_url") || undefined,
                sort_order: Number(fd.get("sort_order")) || 0,
                is_active: fd.get("is_active") === "on",
              };

              if (editingCategory) {
                updateMutation.mutate({ id: editingCategory.id, data });
              } else {
                createMutation.mutate(data);
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">
                Category Name
              </label>
              <Input name="name" defaultValue={editingCategory?.name} required />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Image URL
                </label>
                <span className="text-[10px] text-muted-foreground font-medium">
                  Max size: 10 MB
                </span>
              </div>
              <div className="flex gap-2">
                <Input
                  name="image_url"
                  type="url"
                  value={categoryImageUrl}
                  onChange={(e) => setCategoryImageUrl(e.target.value)}
                />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={imageUploadRef}
                  onChange={handleImageUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => imageUploadRef.current?.click()}
                  disabled={isUploadingImage}
                  className="shrink-0"
                >
                  {isUploadingImage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UploadCloud className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <input
                type="checkbox"
                name="is_active"
                id="is_active"
                defaultChecked={editingCategory ? editingCategory.is_active : true}
                className="rounded border-input"
              />
              <label htmlFor="is_active" className="text-sm font-medium">
                Active Category
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">
                Sort Order (Homepage position)
              </label>
              <Input
                name="sort_order"
                type="number"
                step="1"
                defaultValue={editingCategory?.sort_order ?? 0}
              />
              <p className="text-[11px] text-muted-foreground">
                Lower numbers appear first on the homepage. Set the order in which categories are
                listed.
              </p>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingCategory ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
