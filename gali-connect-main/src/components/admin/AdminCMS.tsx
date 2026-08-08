import { useState, useRef } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Image,
  Megaphone,
  Trash2,
  CheckCircle2,
  UploadCloud,
  Loader2,
  Video,
  Play,
  Film,
  Sparkles,
  ExternalLink,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function AdminCMS() {
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState<"banners" | "video_ads" | "announcements">("banners");
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [isVideoAdModalOpen, setIsVideoAdModalOpen] = useState(false);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);

  const imageUploadRef = useRef<HTMLInputElement>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [cmsImageUrl, setCmsImageUrl] = useState("");

  // Video Upload state
  const videoUploadRef = useRef<HTMLInputElement>(null);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoAdUrl, setVideoAdUrl] = useState("");

  const thumbnailUploadRef = useRef<HTMLInputElement>(null);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState("");

  // Queries
  const { data: slidesRes, isLoading: slidesLoading } = useQuery({
    queryKey: ["adminHeroSlides"],
    queryFn: () => api.get<any>("/admin/hero-slides"),
  });

  const { data: videoAdsRes, isLoading: videoAdsLoading } = useQuery({
    queryKey: ["adminVideoAds"],
    queryFn: () => api.get<any>("/admin/video-ads"),
  });

  const { data: announcementsRes, isLoading: announcementsLoading } = useQuery({
    queryKey: ["adminAnnouncements"],
    queryFn: () => api.get<any>("/admin/announcements"),
  });

  const slides = slidesRes?.data || [];
  const videoAds = videoAdsRes?.data || [];
  const announcements = announcementsRes?.data || [];

  // Banner Mutations
  const createSlideMutation = useMutation({
    mutationFn: (data: any) => api.post("/admin/hero-slides", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminHeroSlides"] });
      queryClient.invalidateQueries({ queryKey: ["hero-slides"] });
      toast.success("Banner created successfully");
      setIsBannerModalOpen(false);
    },
    onError: (err: any) => toast.error(err?.message || "Failed to create banner"),
  });

  const deleteSlideMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/hero-slides/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminHeroSlides"] });
      queryClient.invalidateQueries({ queryKey: ["hero-slides"] });
      toast.success("Banner deleted");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to delete banner"),
  });

  // Video Ad Mutations
  const createVideoAdMutation = useMutation({
    mutationFn: (data: any) => api.post("/admin/video-ads", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminVideoAds"] });
      queryClient.invalidateQueries({ queryKey: ["publicVideoAds"] });
      toast.success("30s Video Ad created successfully!");
      setIsVideoAdModalOpen(false);
      setVideoAdUrl("");
      setThumbnailUrl("");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to create video ad"),
  });

  const updateVideoAdMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/admin/video-ads/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminVideoAds"] });
      queryClient.invalidateQueries({ queryKey: ["publicVideoAds"] });
      toast.success("Video ad updated");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to update video ad"),
  });

  const deleteVideoAdMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/video-ads/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminVideoAds"] });
      queryClient.invalidateQueries({ queryKey: ["publicVideoAds"] });
      toast.success("Video ad deleted");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to delete video ad"),
  });

  // Upload Handlers
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

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingVideo(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "videos");

    try {
      const res: any = await api.post("/upload/video", formData);
      if (!res.success) {
        throw new Error(res.error?.message || "Failed to upload video");
      }
      const uploadedUrl = res?.data?.data?.url || res?.data?.url || res?.url;
      if (uploadedUrl) {
        setVideoAdUrl(uploadedUrl);
        toast.success("Video uploaded to Cloudflare R2 successfully!");
      } else {
        toast.error("Failed to parse video URL.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload video to R2");
    } finally {
      setIsUploadingVideo(false);
      if (videoUploadRef.current) videoUploadRef.current.value = "";
    }
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingThumbnail(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "ads");

    try {
      const res: any = await api.post("/uploads", formData);
      if (!res.success) {
        throw new Error(res.error?.message || "Failed to upload thumbnail");
      }
      const uploadedUrl = res?.data?.data?.url || res?.data?.url || res?.url;
      if (uploadedUrl) {
        setThumbnailUrl(uploadedUrl);
        toast.success("Thumbnail uploaded successfully!");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload thumbnail");
    } finally {
      setIsUploadingThumbnail(false);
      if (thumbnailUploadRef.current) thumbnailUploadRef.current.value = "";
    }
  };

  // Announcement Mutations
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Advertisement & CMS
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Manage homepage banners, 30s video ads, and platform announcements.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => setIsBannerModalOpen(true)}
            variant={activeSubTab === "banners" ? "default" : "outline"}
            size="sm"
          >
            <Image className="h-4 w-4 mr-2" />
            Add Banner
          </Button>
          <Button
            onClick={() => setIsVideoAdModalOpen(true)}
            variant={activeSubTab === "video_ads" ? "default" : "outline"}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white border-0"
          >
            <Film className="h-4 w-4 mr-2" />
            Add 30s Video Ad
          </Button>
          <Button
            onClick={() => setIsAnnouncementModalOpen(true)}
            variant={activeSubTab === "announcements" ? "default" : "outline"}
            size="sm"
          >
            <Megaphone className="h-4 w-4 mr-2" />
            Add Announcement
          </Button>
        </div>
      </div>

      {/* Sub Tabs Header */}
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
          onClick={() => setActiveSubTab("video_ads")}
          className={`px-5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeSubTab === "video_ads"
              ? "bg-card text-emerald-600 shadow-sm"
              : "text-muted-foreground"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
          30s Video Ads
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

      {/* HERO BANNERS TAB */}
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

      {/* 30s VIDEO ADS TAB */}
      {activeSubTab === "video_ads" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videoAds.map((ad: any) => (
            <div
              key={ad.id}
              className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm flex flex-col group hover:border-emerald-500/40 transition-colors"
            >
              <div className="relative aspect-video bg-black">
                <video
                  src={ad.video_url}
                  poster={ad.thumbnail_url || undefined}
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10">
                  <span className="bg-black/60 backdrop-blur-sm text-emerald-400 border border-emerald-500/30 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Film className="h-3 w-3" /> {ad.duration || 30}s
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      ad.display_mode === "behind_hero"
                        ? "bg-purple-600 text-white"
                        : "bg-blue-600 text-white"
                    }`}
                  >
                    {ad.display_mode === "behind_hero" ? "Behind Hero Banner" : "Watch CTA Modal"}
                  </span>
                </div>

                <div className="absolute top-2 right-2 z-10">
                  {ad.is_active ? (
                    <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Active
                    </span>
                  ) : (
                    <span className="bg-zinc-700 text-zinc-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Inactive
                    </span>
                  )}
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-lg text-foreground">{ad.title}</h3>
                  {ad.subtitle && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ad.subtitle}</p>
                  )}
                  {ad.cta_text && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                        CTA: {ad.cta_text}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-border flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      updateVideoAdMutation.mutate({
                        id: ad.id,
                        data: { is_active: !ad.is_active },
                      })
                    }
                  >
                    {ad.is_active ? "Deactivate" : "Activate"}
                  </Button>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateVideoAdMutation.mutate({
                          id: ad.id,
                          data: {
                            display_mode:
                              ad.display_mode === "behind_hero" ? "watch_cta" : "behind_hero",
                          },
                        })
                      }
                      title="Toggle Display Mode"
                    >
                      Mode: {ad.display_mode === "behind_hero" ? "Behind" : "Modal"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-rose-600"
                      onClick={() => {
                        if (confirm("Delete this 30s Video Ad?"))
                          deleteVideoAdMutation.mutate(ad.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {videoAds.length === 0 && !videoAdsLoading && (
            <div className="col-span-full py-16 text-center text-muted-foreground border-2 border-dashed rounded-3xl flex flex-col items-center justify-center">
              <Film className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="font-semibold">No 30-second Video Ads uploaded yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Upload MP4/WebM videos stored directly in Cloudflare R2 storage!
              </p>
              <Button
                onClick={() => setIsVideoAdModalOpen(true)}
                className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" /> Upload First Video Ad
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ANNOUNCEMENTS TAB */}
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
      <Dialog
        open={isBannerModalOpen}
        onOpenChange={(open) => {
          setIsBannerModalOpen(open);
          if (!open) setCmsImageUrl("");
        }}
      >
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
                  <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase backdrop-blur-sm tracking-wider">
                    Preview
                  </div>
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

      {/* 30s Video Ad Create Modal */}
      <Dialog
        open={isVideoAdModalOpen}
        onOpenChange={(open) => {
          setIsVideoAdModalOpen(open);
          if (!open) {
            setVideoAdUrl("");
            setThumbnailUrl("");
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-500" /> Upload 30-Second Video Ad to Cloudflare R2
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.target as HTMLFormElement);
              const url = (fd.get("video_url") as string) || videoAdUrl;
              if (!url) {
                toast.error("Please upload a video file or enter a valid video URL.");
                return;
              }
              createVideoAdMutation.mutate({
                title: fd.get("title"),
                subtitle: fd.get("subtitle") || undefined,
                video_url: url,
                thumbnail_url: (fd.get("thumbnail_url") as string) || thumbnailUrl || undefined,
                cta_text: fd.get("cta_text") || "Watch 30s Ad",
                cta_link: fd.get("cta_link") || undefined,
                display_mode: fd.get("display_mode") || "watch_cta",
                duration: Number(fd.get("duration")) || 30,
                sort_order: Number(fd.get("sort_order")) || 0,
                is_active: true,
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">Ad Title</label>
              <Input name="title" placeholder="e.g. Summer Mega Offer — 50% Off!" required />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">Subtitle (Optional)</label>
              <Input name="subtitle" placeholder="e.g. Watch this short 30s video ad to get exclusive coupons" />
            </div>

            {/* Video File Upload */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  Video File (Cloudflare R2 Direct Upload)
                </label>
                <span className="text-[10px] text-emerald-600 font-bold uppercase">No Limit (R2 Storage)</span>
              </div>
              <div className="flex gap-2">
                <Input
                  name="video_url"
                  type="url"
                  placeholder="https://..."
                  value={videoAdUrl}
                  onChange={(e) => setVideoAdUrl(e.target.value)}
                  required
                />
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/ogg,video/quicktime"
                  className="hidden"
                  ref={videoUploadRef}
                  onChange={handleVideoUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => videoUploadRef.current?.click()}
                  disabled={isUploadingVideo}
                  className="shrink-0 bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800"
                >
                  {isUploadingVideo ? (
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                  ) : (
                    <Film className="h-4 w-4 text-emerald-600" />
                  )}
                  <span className="ml-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    {isUploadingVideo ? "Uploading to R2…" : "Upload Video"}
                  </span>
                </Button>
              </div>
              {videoAdUrl && (
                <div className="mt-2 relative rounded-xl overflow-hidden border border-emerald-500/30 bg-black aspect-video">
                  <video src={videoAdUrl} controls className="w-full h-full object-contain" />
                  <div className="absolute top-1.5 left-1.5 bg-emerald-500 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                    R2 Video Uploaded
                  </div>
                </div>
              )}
            </div>

            {/* Display Mode Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Display Placement Mode</label>
                <select
                  name="display_mode"
                  defaultValue="watch_cta"
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="watch_cta">Watch CTA Modal (Hero Button → Modal Popup)</option>
                  <option value="behind_hero">Behind Hero Banner (Background Video Stream)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">CTA Button Text</label>
                <Input name="cta_text" defaultValue="Watch 30s Ad" placeholder="e.g. Watch 30s Ad" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">CTA Target Link (Optional)</label>
                <Input name="cta_link" placeholder="e.g. /products or https://..." />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Duration (Seconds)</label>
                <Input name="duration" type="number" defaultValue="30" />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button type="button" variant="outline" onClick={() => setIsVideoAdModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createVideoAdMutation.isPending || isUploadingVideo}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                {createVideoAdMutation.isPending ? "Creating Ad…" : "Save & Publish Video Ad"}
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
