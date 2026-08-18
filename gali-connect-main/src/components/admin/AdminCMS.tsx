import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { api, formatErrorMessage } from "@/lib/api";
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
  AlertCircle,
  Info,
  LayoutGrid,
  ArrowUp,
  ArrowDown,
  ArrowUpToLine,
  ArrowDownToLine,
  Eye,
  EyeOff,
  RotateCcw,
  Save,
  GripVertical,
  SlidersHorizontal,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminPaginationBar, type PaginationMeta } from "./AdminPaginationBar";

export interface HomePageSectionItem {
  id: string;
  label: string;
  description?: string;
  enabled: boolean;
}

export const DEFAULT_HOMEPAGE_SECTIONS: HomePageSectionItem[] = [
  { id: "hero", label: "Hero Banner & Promotions", description: "Top carousel banners and video spotlight", enabled: true },
  { id: "categories", label: "Categories Grid", description: "Fresh produce and department shortcuts", enabled: true },
  { id: "sponsored_vendors", label: "Sponsored Vendors & Premium Stores", description: "Featured local merchants with badges", enabled: true },
  { id: "live_banner", label: "Live Network Alert Banner", description: "Real-time moving street vendor count banner", enabled: true },
  { id: "live_vendors", label: "Nearby Live Street Vendors", description: "Live moving carts with GPS distance and speed", enabled: true },
  { id: "shops_near_you", label: "Fixed Shops & Kirana Stores", description: "Nearby trusted brick-and-mortar grocery shops", enabled: true },
  { id: "offers", label: "Discounts & Bank Offers", description: "Active promo coupons, wallet offers and discounts", enabled: true },
  { id: "shopwise_products", label: "Shop-wise Fresh Produce", description: "Curated product shelves organized by merchant", enabled: true },
  { id: "trending", label: "Trending & Best Sellers", description: "High-demand fresh products ordered nearby", enabled: true },
  { id: "featured_products", label: "Featured Deals & Essentials", description: "Daily essentials and handpicked product deals", enabled: true },
  { id: "recommended", label: "Recommended For You", description: "Smart product recommendations based on preferences", enabled: true },
  { id: "recently_viewed", label: "Recently Viewed Items", description: "Quick access to products the customer viewed", enabled: true },
  { id: "brand_footer", label: "Why VegaMart & Trust Badges", description: "Safety guarantees, quality promise, and brand footer", enabled: true },
];

export function AdminCMS() {
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState<"banners" | "video_ads" | "announcements" | "sections">(
    "banners",
  );
  const [slidesPage, setSlidesPage] = useState(1);
  const [videoAdsPage, setVideoAdsPage] = useState(1);
  const [announcementsPage, setAnnouncementsPage] = useState(1);
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<any | null>(null);
  const [isVideoAdModalOpen, setIsVideoAdModalOpen] = useState(false);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);

  const imageUploadRef = useRef<HTMLInputElement>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [cmsImageUrl, setCmsImageUrl] = useState("");
  const [bannerUploadError, setBannerUploadError] = useState("");

  // Video Upload state
  const videoUploadRef = useRef<HTMLInputElement>(null);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoAdUrl, setVideoAdUrl] = useState("");
  const [videoUploadError, setVideoUploadError] = useState("");
  const [videoUploadProgress, setVideoUploadProgress] = useState<{ loaded: number; total: number; speed: number } | null>(null);

  const thumbnailUploadRef = useRef<HTMLInputElement>(null);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState("");

  // Queries
  const { data: slidesRes, isLoading: slidesLoading } = useQuery({
    queryKey: ["adminHeroSlides", slidesPage],
    queryFn: () => api.get<any>(`/admin/hero-slides?page=${slidesPage}&per_page=20`),
  });

  const { data: videoAdsRes, isLoading: videoAdsLoading } = useQuery({
    queryKey: ["adminVideoAds", videoAdsPage],
    queryFn: () => api.get<any>(`/admin/video-ads?page=${videoAdsPage}&per_page=20`),
  });

  const { data: announcementsRes, isLoading: announcementsLoading } = useQuery({
    queryKey: ["adminAnnouncements", announcementsPage],
    queryFn: () => api.get<any>(`/admin/announcements?page=${announcementsPage}&per_page=20`),
  });

  const { data: settingsRes, isLoading: settingsLoading } = useQuery({
    queryKey: ["adminSettings"],
    queryFn: () => api.get<any>("/admin/settings"),
  });

  const [sections, setSections] = useState<HomePageSectionItem[]>(DEFAULT_HOMEPAGE_SECTIONS);
  const [hasSectionsChanges, setHasSectionsChanges] = useState(false);

  useEffect(() => {
    if (settingsRes?.data) {
      const settingsData = settingsRes.data?.data ?? settingsRes.data;
      const raw = settingsData?.["platform.homepage_sections"];
      if (raw) {
        try {
          const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
          if (Array.isArray(parsed) && parsed.length > 0) {
            const existingIds = new Set(parsed.map((p: any) => p.id));
            const merged = [
              ...parsed.map((p: any) => {
                const def = DEFAULT_HOMEPAGE_SECTIONS.find((d) => d.id === p.id);
                return {
                  id: p.id,
                  label: def?.label || p.label || p.id,
                  description: def?.description || p.description || "",
                  enabled: p.enabled !== false,
                };
              }),
              ...DEFAULT_HOMEPAGE_SECTIONS.filter((d) => !existingIds.has(d.id)),
            ];
            setSections(merged);
          }
        } catch (err) {
          console.error("Failed to parse platform.homepage_sections", err);
        }
      }
    }
  }, [settingsRes]);

  const saveSectionsMutation = useMutation({
    mutationFn: (newSections: HomePageSectionItem[]) =>
      api.patch("/admin/settings", {
        "platform.homepage_sections": JSON.stringify(newSections),
      }),
    onSuccess: () => {
      toast.success("Home page section arrangement saved successfully!");
      setHasSectionsChanges(false);
      queryClient.invalidateQueries({ queryKey: ["adminSettings"] });
      queryClient.invalidateQueries({ queryKey: ["publicSettings"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save section arrangement");
    },
  });

  const handleMoveSection = (index: number, direction: "up" | "down" | "top" | "bottom") => {
    const next = [...sections];
    if (direction === "up" && index > 0) {
      const temp = next[index];
      next[index] = next[index - 1];
      next[index - 1] = temp;
    } else if (direction === "down" && index < next.length - 1) {
      const temp = next[index];
      next[index] = next[index + 1];
      next[index + 1] = temp;
    } else if (direction === "top" && index > 0) {
      const [item] = next.splice(index, 1);
      next.unshift(item);
    } else if (direction === "bottom" && index < next.length - 1) {
      const [item] = next.splice(index, 1);
      next.push(item);
    }
    setSections(next);
    setHasSectionsChanges(true);
  };

  const handleToggleSection = (id: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
    setHasSectionsChanges(true);
  };

  const handleResetSections = () => {
    setSections(DEFAULT_HOMEPAGE_SECTIONS);
    setHasSectionsChanges(true);
    toast.info("Reset to default order. Click 'Save Arrangement' to apply.");
  };

  const handleToggleAllSections = (enable: boolean) => {
    setSections((prev) => prev.map((s) => ({ ...s, enabled: enable })));
    setHasSectionsChanges(true);
  };

  const slides = slidesRes?.data || [];
  const videoAds = videoAdsRes?.data || [];
  const announcements = announcementsRes?.data || [];

  const slidesPagination = slidesRes?.pagination as PaginationMeta | undefined;
  const videoAdsPagination = videoAdsRes?.pagination as PaginationMeta | undefined;
  const announcementsPagination = announcementsRes?.pagination as PaginationMeta | undefined;

  // Banner Mutations
  const createSlideMutation = useMutation({
    mutationFn: (data: any) => api.post("/admin/hero-slides", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminHeroSlides"] });
      queryClient.invalidateQueries({ queryKey: ["hero-slides"] });
      queryClient.invalidateQueries({ queryKey: ["publicHeroSlides"] });
      toast.success("Banner created successfully");
      setIsBannerModalOpen(false);
      setEditingSlide(null);
      setCmsImageUrl("");
      setBannerUploadError("");
    },
    onError: (err: any) => {
      const msg = formatErrorMessage(err?.error || err, "Failed to create banner slide");
      setBannerUploadError(msg);
      toast.error(msg);
    },
  });

  const updateSlideMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.patch(`/admin/hero-slides/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminHeroSlides"] });
      queryClient.invalidateQueries({ queryKey: ["hero-slides"] });
      queryClient.invalidateQueries({ queryKey: ["publicHeroSlides"] });
      toast.success("Banner updated successfully");
      setIsBannerModalOpen(false);
      setEditingSlide(null);
      setCmsImageUrl("");
      setBannerUploadError("");
    },
    onError: (err: any) => {
      const msg = formatErrorMessage(err?.error || err, "Failed to update banner");
      setBannerUploadError(msg);
      toast.error(msg);
    },
  });

  const handleOpenCreateBanner = () => {
    setEditingSlide(null);
    setCmsImageUrl("");
    setBannerUploadError("");
    setIsBannerModalOpen(true);
  };

  const handleEditBanner = (slide: any) => {
    setEditingSlide(slide);
    setCmsImageUrl(slide.image_url || "");
    setBannerUploadError("");
    setIsBannerModalOpen(true);
  };

  const deleteSlideMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/hero-slides/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminHeroSlides"] });
      queryClient.invalidateQueries({ queryKey: ["hero-slides"] });
      queryClient.invalidateQueries({ queryKey: ["publicHeroSlides"] });
      toast.success("Banner deleted");
    },
    onError: (err: any) =>
      toast.error(formatErrorMessage(err?.error || err, "Failed to delete banner")),
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
      setVideoUploadError("");
    },
    onError: (err: any) => {
      const msg = formatErrorMessage(err?.error || err, "Failed to create video ad");
      setVideoUploadError(msg);
      toast.error(msg);
    },
  });

  const updateVideoAdMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.patch(`/admin/video-ads/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminVideoAds"] });
      queryClient.invalidateQueries({ queryKey: ["publicVideoAds"] });
      toast.success("Video ad updated");
    },
    onError: (err: any) =>
      toast.error(formatErrorMessage(err?.error || err, "Failed to update video ad")),
  });

  const deleteVideoAdMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/video-ads/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminVideoAds"] });
      queryClient.invalidateQueries({ queryKey: ["publicVideoAds"] });
      toast.success("Video ad deleted");
    },
    onError: (err: any) =>
      toast.error(formatErrorMessage(err?.error || err, "Failed to delete video ad")),
  });

  // Upload Handlers
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBannerUploadError("");
    setIsUploadingImage(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "cms");

    try {
      const res: any = await api.post("/uploads", formData);
      if (!res.success) {
        const msg = formatErrorMessage(res.error, "Failed to upload banner image");
        setBannerUploadError(msg);
        toast.error(msg);
        return;
      }
      const uploadedUrl = res?.data?.data?.url || res?.data?.url || res?.url || res?.data?.fileUrl;
      if (uploadedUrl) {
        setCmsImageUrl(uploadedUrl);
        setBannerUploadError("");
        toast.success("Image uploaded successfully!");
      } else {
        setBannerUploadError("Failed to parse image URL from response.");
        toast.error("Failed to parse image URL from response.");
      }
    } catch (err: any) {
      const msg = formatErrorMessage(err?.error || err, "Failed to upload image");
      setBannerUploadError(msg);
      toast.error(msg);
    } finally {
      setIsUploadingImage(false);
      if (imageUploadRef.current) imageUploadRef.current.value = "";
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVideoUploadError("");
    setIsUploadingVideo(true);
    setVideoUploadProgress(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "videos");

    try {
      const res: any = await api.uploadWithProgress("/upload/video", formData, (progress) => {
        setVideoUploadProgress(progress);
      });
      if (!res.success) {
        const msg = formatErrorMessage(res.error, "Failed to upload video to Cloudflare R2");
        setVideoUploadError(msg);
        toast.error(msg);
        return;
      }
      const uploadedUrl = res?.data?.data?.url || res?.data?.url || res?.url;
      if (uploadedUrl) {
        setVideoAdUrl(uploadedUrl);
        setVideoUploadError("");
        toast.success("Video uploaded to Cloudflare R2 successfully!");
      } else {
        setVideoUploadError("Failed to parse video URL from response.");
        toast.error("Failed to parse video URL.");
      }
    } catch (err: any) {
      const msg = formatErrorMessage(err?.error || err, "Failed to upload video to Cloudflare R2");
      setVideoUploadError(msg);
      toast.error(msg);
    } finally {
      setIsUploadingVideo(false);
      setVideoUploadProgress(null);
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
    <div className="w-full overflow-x-auto pb-4">
      <div className="min-w-[1024px] space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 px-1">
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
            onClick={handleOpenCreateBanner}
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
      <div className="flex flex-wrap gap-2 p-1 bg-muted border border-border rounded-2xl w-fit">
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
        <button
          onClick={() => setActiveSubTab("sections")}
          className={`px-5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeSubTab === "sections"
              ? "bg-card text-emerald-600 shadow-sm border border-emerald-500/20"
              : "text-muted-foreground"
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-500" />
          Section Arrangement Maker
          {hasSectionsChanges && (
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
          )}
        </button>
      </div>

      {/* HERO BANNERS TAB */}
      {activeSubTab === "banners" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {slides.map((slide: any) => {
            const hasText = Boolean(
              (slide.title && slide.title.trim().length > 0) ||
              (slide.subtitle && slide.subtitle.trim().length > 0)
            );
            return (
              <div
                key={slide.id}
                className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm flex flex-col hover:border-emerald-500/30 transition-colors"
              >
                <div className="h-36 bg-muted/50 relative overflow-hidden">
                  {slide.image_url ? (
                    <img
                      src={slide.image_url}
                      alt={slide.title || "Banner image"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                      No Image Provided
                    </div>
                  )}
                  {slide.is_active && (
                    <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
                      <CheckCircle2 className="h-3 w-3" /> Active
                    </div>
                  )}
                  {!hasText && (
                    <div className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] font-bold px-2.5 py-1 rounded-full backdrop-blur-sm flex items-center gap-1">
                      <Image className="h-3 w-3 text-emerald-400" /> Image Only (No Text)
                    </div>
                  )}
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    {hasText ? (
                      <>
                        <h3 className="font-bold text-base text-foreground leading-snug">
                          {slide.title || <span className="text-muted-foreground italic">No Title</span>}
                        </h3>
                        {slide.subtitle && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{slide.subtitle}</p>
                        )}
                      </>
                    ) : (
                      <div className="text-xs text-muted-foreground font-medium py-1">
                        <span className="font-semibold text-foreground">Clean Banner:</span> Displaying full image only without overlay text on homepage.
                      </div>
                    )}
                    {slide.link_url && (
                      <p className="text-xs text-emerald-600 truncate flex items-center gap-1 pt-1">
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="truncate">{slide.link_url}</span>
                      </p>
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t border-border flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs font-semibold hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
                      onClick={() => handleEditBanner(slide)}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Edit Banner
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-rose-600 hover:bg-rose-50 hover:border-rose-300"
                      onClick={() => {
                        if (confirm("Delete this banner slide?")) deleteSlideMutation.mutate(slide.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
          {slides.length === 0 && !slidesLoading && (
            <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-3xl">
              No hero banners active.
            </div>
          )}
        </div>
      )}
      {activeSubTab === "banners" && (
        <AdminPaginationBar pagination={slidesPagination} onPageChange={setSlidesPage} />
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
                        : ad.display_mode === "fixed_video"
                          ? "bg-amber-600 text-white"
                          : "bg-blue-600 text-white"
                    }`}
                  >
                    {ad.display_mode === "behind_hero"
                      ? "Behind Hero Banner"
                      : ad.display_mode === "fixed_video"
                        ? "Fixed Size Video"
                        : "Watch CTA Modal"}
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
                  <h3 className="font-bold text-lg text-foreground">
                    {ad.title || "Video Advertisement"}
                  </h3>
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
                              ad.display_mode === "watch_cta"
                                ? "behind_hero"
                                : ad.display_mode === "behind_hero"
                                  ? "fixed_video"
                                  : "watch_cta",
                          },
                        })
                      }
                      title="Toggle Display Mode"
                    >
                      Mode:{" "}
                      {ad.display_mode === "behind_hero"
                        ? "Behind"
                        : ad.display_mode === "fixed_video"
                          ? "Fixed"
                          : "Modal"}
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
      {activeSubTab === "video_ads" && (
        <AdminPaginationBar pagination={videoAdsPagination} onPageChange={setVideoAdsPage} />
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
      {activeSubTab === "announcements" && (
        <AdminPaginationBar
          pagination={announcementsPagination}
          onPageChange={setAnnouncementsPage}
        />
      )}

      {/* SECTION ARRANGEMENT MAKER TAB */}
      {activeSubTab === "sections" && (
        <div className="space-y-6">
          {/* Header Controls Banner */}
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5 text-emerald-600" />
                <h3 className="text-lg font-bold text-foreground">
                  Home Page Section Arrangement Maker
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Alter the exact positioning and visibility of each section on the customer homepage. Use Up/Down buttons to reorder and toggle switches to show/hide.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetSections}
                className="text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Reset to Default
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleToggleAllSections(true)}
                className="text-xs"
              >
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                Enable All
              </Button>
              <Button
                onClick={() => saveSectionsMutation.mutate(sections)}
                disabled={saveSectionsMutation.isPending}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md"
              >
                {saveSectionsMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                )}
                Save Arrangement {hasSectionsChanges && "*"}
              </Button>
            </div>
          </div>

          {/* Quick Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-border bg-card p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Total Sections
              </span>
              <p className="text-xl font-black text-foreground mt-1">{sections.length}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Active on Home
              </span>
              <p className="text-xl font-black text-emerald-600 mt-1">
                {sections.filter((s) => s.enabled).length}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Hidden Sections
              </span>
              <p className="text-xl font-black text-amber-600 mt-1">
                {sections.filter((s) => !s.enabled).length}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Top Priority Section
              </span>
              <p className="text-sm font-bold text-foreground mt-1 truncate">
                {sections[0]?.label || "None"}
              </p>
            </div>
          </div>

          {/* Reorderable Section List */}
          <div className="space-y-3">
            {sections.map((section, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === sections.length - 1;
              return (
                <div
                  key={section.id}
                  className={`rounded-2xl border p-4 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    section.enabled
                      ? "bg-card border-border shadow-sm hover:border-emerald-300"
                      : "bg-muted/40 border-dashed border-border/70 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-xl bg-muted border border-border text-xs font-black grid place-items-center shrink-0 text-muted-foreground">
                      #{idx + 1}
                    </div>

                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">
                          {section.label}
                        </span>
                        <span
                          className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                            section.enabled
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {section.enabled ? "Visible" : "Hidden"}
                        </span>
                      </div>
                      {section.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-xl">
                          {section.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions & Position Controls */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    {/* Visibility Toggle */}
                    <Button
                      variant={section.enabled ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleToggleSection(section.id)}
                      className={`h-8 px-3 text-xs ${
                        section.enabled
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      title={section.enabled ? "Hide Section" : "Show Section"}
                    >
                      {section.enabled ? (
                        <>
                          <Eye className="h-3.5 w-3.5 mr-1" /> Visible
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3.5 w-3.5 mr-1" /> Hidden
                        </>
                      )}
                    </Button>

                    {/* Move to Top */}
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={isFirst}
                      onClick={() => handleMoveSection(idx, "top")}
                      className="h-8 w-8"
                      title="Move to Top"
                    >
                      <ArrowUpToLine className="h-3.5 w-3.5" />
                    </Button>

                    {/* Move Up */}
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={isFirst}
                      onClick={() => handleMoveSection(idx, "up")}
                      className="h-8 w-8"
                      title="Move Up"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>

                    {/* Move Down */}
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={isLast}
                      onClick={() => handleMoveSection(idx, "down")}
                      className="h-8 w-8"
                      title="Move Down"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>

                    {/* Move to Bottom */}
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={isLast}
                      onClick={() => handleMoveSection(idx, "bottom")}
                      className="h-8 w-8"
                      title="Move to Bottom"
                    >
                      <ArrowDownToLine className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sticky Save Bar if changes are pending */}
          {hasSectionsChanges && (
            <div className="sticky bottom-4 rounded-2xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 p-4 shadow-lg flex items-center justify-between gap-4 animate-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 text-sm font-medium">
                <SlidersHorizontal className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>You have unsaved changes in home page section order.</span>
              </div>
              <Button
                onClick={() => saveSectionsMutation.mutate(sections)}
                disabled={saveSectionsMutation.isPending}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shrink-0"
              >
                {saveSectionsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Arrangement Now
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Banner Create & Edit Modal */}
      <Dialog
        open={isBannerModalOpen}
        onOpenChange={(open) => {
          setIsBannerModalOpen(open);
          if (!open) {
            setEditingSlide(null);
            setCmsImageUrl("");
            setBannerUploadError("");
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingSlide ? (
                <>
                  <Pencil className="h-5 w-5 text-emerald-500" /> Edit Hero Banner Slide
                </>
              ) : (
                <>
                  <Image className="h-5 w-5 text-emerald-500" /> Create Hero Banner Slide
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* Validation & Requirements Guidance Box */}
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11.5px] text-muted-foreground space-y-1">
            <div className="font-bold text-foreground flex items-center gap-1.5 text-xs">
              <Info className="h-4 w-4 text-emerald-500 shrink-0" /> Hero Banner Information & Clean Image Option
            </div>
            <ul className="list-disc list-inside space-y-0.5 pl-1">
              <li>
                <strong>Image-Only Banner:</strong> Leave <em>Title</em> and <em>Subtitle</em> blank to display the pure full image without any text overlays or dark gradients.
              </li>
              <li>
                <strong>Max File Size:</strong> 10 MB per image (JPEG, PNG, WebP, GIF, AVIF)
              </li>
              <li>
                <strong>Link Navigation:</strong> If a Link URL is provided on a clean banner, clicking anywhere on the banner will open the destination.
              </li>
            </ul>
          </div>

          {/* Error Banner */}
          {bannerUploadError && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold uppercase tracking-wider text-[10px] text-rose-500">
                  Validation / Upload Error
                </div>
                <div className="mt-0.5 leading-relaxed font-bold">{bannerUploadError}</div>
              </div>
            </div>
          )}

          <form
            key={editingSlide ? editingSlide.id : "new-banner-form"}
            onSubmit={(e) => {
              e.preventDefault();
              setBannerUploadError("");
              const fd = new FormData(e.target as HTMLFormElement);
              const titleVal = (fd.get("title") as string)?.trim() || null;
              const subtitleVal = (fd.get("subtitle") as string)?.trim() || null;
              const linkVal = (fd.get("link_url") as string)?.trim() || null;
              const sortOrderVal = Number(fd.get("sort_order")) || 0;
              const imageVal = cmsImageUrl?.trim() || (fd.get("image_url") as string)?.trim() || null;

              const payload = {
                title: titleVal,
                subtitle: subtitleVal,
                image_url: imageVal,
                link_url: linkVal,
                sort_order: sortOrderVal,
                is_active: true,
              };

              if (editingSlide) {
                updateSlideMutation.mutate({ id: editingSlide.id, data: payload });
              } else {
                createSlideMutation.mutate(payload);
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-muted-foreground">
                Title (Optional)
              </label>
              <Input
                name="title"
                defaultValue={editingSlide?.title || ""}
                placeholder="Leave blank for clean image-only banner"
              />
              <p className="text-[11px] text-muted-foreground">
                If left empty, no title or badge will be written over the image.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-muted-foreground">
                Subtitle (Optional)
              </label>
              <Input
                name="subtitle"
                defaultValue={editingSlide?.subtitle || ""}
                placeholder="Leave blank for clean image-only banner"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  Banner Image
                </label>
                <span className="text-[10px] text-muted-foreground font-medium">
                  Max size: 10 MB
                </span>
              </div>
              <div className="flex gap-2">
                <Input
                  name="image_url"
                  type="url"
                  placeholder="https://..."
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
                <div className="mt-3 relative h-28 w-full rounded-xl overflow-hidden border border-border bg-muted/30">
                  <img src={cmsImageUrl} alt="Preview" className="h-full w-full object-cover" />
                  <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase backdrop-blur-sm tracking-wider">
                    Banner Preview
                  </div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  Link URL (Optional)
                </label>
                <Input
                  name="link_url"
                  defaultValue={editingSlide?.link_url || ""}
                  placeholder="e.g. /categories/fruits"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  Sort Order
                </label>
                <Input
                  name="sort_order"
                  type="number"
                  defaultValue={editingSlide?.sort_order ?? 0}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsBannerModalOpen(false);
                  setEditingSlide(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createSlideMutation.isPending || updateSlideMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                {(createSlideMutation.isPending || updateSlideMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editingSlide ? "Save Banner Changes" : "Create Banner"}
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
            setVideoUploadError("");
          }
        }}
      >
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-500" /> Upload 30-Second Video Ad to
              Cloudflare R2
            </DialogTitle>
          </DialogHeader>

          {/* Validation & Requirements Guidance Box */}
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11.5px] text-muted-foreground space-y-1">
            <div className="font-bold text-foreground flex items-center gap-1.5 text-xs">
              <Info className="h-4 w-4 text-emerald-500 shrink-0" /> Video Ad Requirements & Size
              Limits
            </div>
            <ul className="list-disc list-inside space-y-0.5 pl-1">
              <li>
                <strong>Max File Size:</strong> 200 MB per video (Cloudflare R2 Storage)
              </li>
              <li>
                <strong>Formats Accepted:</strong> MP4, WebM, OGG, MOV, MKV
              </li>
              <li>
                <strong>Filename Requirement:</strong> Standard ASCII characters (e.g.{" "}
                <code>ad_video1.mp4</code>)
              </li>
              <li>
                <strong>Required Inputs:</strong> Video File (or R2 URL). Ad Title & Subtitle are
                optional.
              </li>
            </ul>
          </div>

          {/* Error Banner */}
          {videoUploadError && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold uppercase tracking-wider text-[10px] text-rose-500">
                  Validation / Upload Error
                </div>
                <div className="mt-0.5 leading-relaxed font-bold">{videoUploadError}</div>
              </div>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setVideoUploadError("");
              const fd = new FormData(e.target as HTMLFormElement);
              const url = (fd.get("video_url") as string) || videoAdUrl;
              if (!url) {
                const msg = "Please upload a video file or enter a valid R2 video URL.";
                setVideoUploadError(msg);
                toast.error(msg);
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
              <label className="text-xs font-bold uppercase text-muted-foreground">
                Ad Title (Optional)
              </label>
              <Input
                name="title"
                placeholder="e.g. Summer Mega Offer — 50% Off!"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">
                Subtitle (Optional)
              </label>
              <Input
                name="subtitle"
                placeholder="e.g. Watch this short 30s video ad to get exclusive coupons"
              />
            </div>

            {/* Video File Upload */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  Video File (Cloudflare R2 Direct Upload)
                </label>
                <span className="text-[10px] text-emerald-600 font-bold uppercase">
                  Max: 200 MB (R2 Storage)
                </span>
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
              {isUploadingVideo && videoUploadProgress && (
                <div className="mt-3 space-y-1.5 animate-in fade-in">
                  <div className="flex items-center justify-between text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                    <span>
                      {(videoUploadProgress.loaded / (1024 * 1024)).toFixed(2)} MB /{" "}
                      {(videoUploadProgress.total / (1024 * 1024)).toFixed(2)} MB
                    </span>
                    <span>
                      {(videoUploadProgress.speed / (1024 * 1024)).toFixed(2)} MB/s
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950/40">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                      style={{
                        width: `${Math.min(100, Math.round((videoUploadProgress.loaded / videoUploadProgress.total) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              )}
              {videoAdUrl && !isUploadingVideo && (
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
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  Display Placement Mode
                </label>
                <select
                  name="display_mode"
                  defaultValue="watch_cta"
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="watch_cta">Watch CTA Modal (Hero Button → Modal Popup)</option>
                  <option value="behind_hero">Behind Hero Banner (Background Video Stream)</option>
                  <option value="fixed_video">Fixed Size Video (Inline Autoplay, No Modal)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  CTA Button Text
                </label>
                <Input
                  name="cta_text"
                  defaultValue="Watch 30s Ad"
                  placeholder="e.g. Watch 30s Ad"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  CTA Target Link (Optional)
                </label>
                <Input name="cta_link" placeholder="e.g. /products or https://..." />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  Duration (Seconds)
                </label>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto">
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
    </div>
  );
}
