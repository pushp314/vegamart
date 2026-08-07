import { useState, useRef } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Image, Megaphone, Trash2, CheckCircle2, UploadCloud, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function AdminCMS() {
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState<"banners" | "announcements">("banners");
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);

  const imageUploadRef = useRef<HTMLInputElement>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [cmsImageUrl, setCmsImageUrl] = useState("");

  // Queries
  const { data: slidesRes, isLoading: slidesLoading } = useQuery({
    queryKey: ["adminHeroSlides"],
    queryFn: () => api.get<any>("/admin/hero-slides"),
  });

  const { data: announcementsRes, isLoading: announcementsLoading } = useQuery({
    queryKey: ["adminAnnouncements"],
    queryFn: () => api.get<any>("/admin/announcements"),
  });

  const slides = slidesRes?.data || [];
  const announcements = announcementsRes?.data || [];

  // Mutations
  const createSlideMutation = useMutation({
    mutationFn: (data: any) => api.post("/admin/hero-slides", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminHeroSlides"] });
      toast.success("Banner created successfully");
      setIsBannerModalOpen(false);
    },
    onError: (err: any) => toast.error(err?.message || "Failed to create banner"),
  });

  const deleteSlideMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/hero-slides/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminHeroSlides"] });
      toast.success("Banner deleted");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to delete banner"),
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "cms");

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
        setCmsImageUrl(uploadedUrl);
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

  const createAnnouncementMutation = useMutation({
    mutationFn: (data: any) => api.post("/admin/announcements", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminAnnouncements"] });
      toast.success("Announcement created");
      setIsAnnouncementModalOpen(false);
    },
    onError: (err: any) => toast.error(err?.message || "Failed to create announcement"),
  });

  const deleteAnnouncementMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/announcements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminAnnouncements"] });
      toast.success("Announcement deleted");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to delete announcement"),
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Advertisement & CMS
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Manage homepage banners and platform announcements.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setIsBannerModalOpen(true)}
            variant={activeSubTab === "banners" ? "default" : "outline"}
          >
            <Image className="h-4 w-4 mr-2" />
            Add Banner
          </Button>
          <Button
            onClick={() => setIsAnnouncementModalOpen(true)}
            variant={activeSubTab === "announcements" ? "default" : "outline"}
          >
            <Megaphone className="h-4 w-4 mr-2" />
            Add Announcement
          </Button>
        </div>
      </div>

      <div className="flex gap-2 p-1 bg-muted border border-border rounded-2xl w-fit">
        <button
          onClick={() => setActiveSubTab("banners")}
          className={`px-5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeSubTab === "banners"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground"
          }`}
        >
          Hero Banners
        </button>
        <button
          onClick={() => setActiveSubTab("announcements")}
          className={`px-5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeSubTab === "announcements"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground"
          }`}
        >
          Announcements
        </button>
      </div>

      {activeSubTab === "banners" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {slides.map((slide: any) => (
            <div
              key={slide.id}
              className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm flex flex-col"
            >
              <div className="h-32 bg-muted/50 relative">
                {slide.image_url ? (
                  <img
                    src={slide.image_url}
                    alt={slide.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    No Image
                  </div>
                )}
                {slide.is_active && (
                  <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Active
                  </div>
                )}
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-lg">{slide.title}</h3>
                  {slide.subtitle && (
                    <p className="text-sm text-muted-foreground">{slide.subtitle}</p>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-border flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-rose-600"
                    onClick={() => {
                      if (confirm("Delete this banner?")) deleteSlideMutation.mutate(slide.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {slides.length === 0 && !slidesLoading && (
            <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-3xl">
              No hero banners active.
            </div>
          )}
        </div>
      )}

      {activeSubTab === "announcements" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {announcements.map((ann: any) => (
            <div
              key={ann.id}
              className="rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-primary bg-primary/10 px-2 py-1 rounded-md">
                    Audience: {ann.audience}
                  </span>
                  {ann.is_active && (
                    <span className="text-emerald-500 text-[10px] font-bold">Active</span>
                  )}
                </div>
                <h3 className="font-bold text-lg mb-2">{ann.title}</h3>
                <p className="text-sm text-muted-foreground">{ann.body}</p>
              </div>
              <div className="mt-6 pt-4 border-t border-border flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-rose-600"
                  onClick={() => {
                    if (confirm("Delete this announcement?"))
                      deleteAnnouncementMutation.mutate(ann.id);
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
          {announcements.length === 0 && !announcementsLoading && (
            <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-3xl">
              No announcements active.
            </div>
          )}
        </div>
      )}

      {/* Banner Create Modal */}
      <Dialog open={isBannerModalOpen} onOpenChange={(open) => {
        setIsBannerModalOpen(open);
        if (!open) setCmsImageUrl("");
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Hero Banner</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.target as HTMLFormElement);
              createSlideMutation.mutate({
                title: fd.get("title"),
                subtitle: fd.get("subtitle") || undefined,
                image_url: fd.get("image_url") || undefined,
                link_url: fd.get("link_url") || undefined,
                sort_order: Number(fd.get("sort_order")) || 0,
                is_active: true,
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">Title</label>
              <Input name="title" required />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">
                Subtitle (Optional)
              </label>
              <Input name="subtitle" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  Image URL (Optional)
                </label>
                <span className="text-[10px] text-muted-foreground font-medium">Max size: 10 MB</span>
              </div>
              <div className="flex gap-2">
                <Input 
                  name="image_url" 
                  type="url" 
                  value={cmsImageUrl} 
                  onChange={(e) => setCmsImageUrl(e.target.value)} 
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
              {cmsImageUrl && (
                <div className="mt-3 relative h-24 w-full rounded-xl overflow-hidden border border-border bg-muted/30">
                  <img src={cmsImageUrl} alt="Preview" className="h-full w-full object-cover" />
                  <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase backdrop-blur-sm tracking-wider">Preview</div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  Link URL
                </label>
                <Input name="link_url" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  Sort Order
                </label>
                <Input name="sort_order" type="number" defaultValue="0" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button type="button" variant="outline" onClick={() => setIsBannerModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createSlideMutation.isPending}>
                Create Banner
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Announcement Create Modal */}
      <Dialog open={isAnnouncementModalOpen} onOpenChange={setIsAnnouncementModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Announcement</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.target as HTMLFormElement);
              createAnnouncementMutation.mutate({
                title: fd.get("title"),
                body: fd.get("body"),
                audience: fd.get("audience"),
                is_active: true,
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">Title</label>
              <Input name="title" required />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">Audience</label>
              <select
                name="audience"
                required
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="all">Everyone</option>
                <option value="customer">Customers Only</option>
                <option value="vendor">Vendors Only</option>
                <option value="delivery">Delivery Partners Only</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">
                Message Body
              </label>
              <textarea
                name="body"
                required
                rows={4}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              ></textarea>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAnnouncementModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createAnnouncementMutation.isPending}>
                Publish
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
