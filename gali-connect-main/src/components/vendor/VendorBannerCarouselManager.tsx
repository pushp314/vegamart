import React, { useState, useRef, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import {
  ImagePlus,
  Upload,
  Trash2,
  Star,
  Eye,
  RefreshCw,
  Link as LinkIcon,
  Maximize2,
  Layers,
  Info,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileImage,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface VendorBannerCarouselManagerProps {
  bannerUrls: string[];
  onChange: (urls: string[]) => void;
  vendorName?: string;
  isOpen?: boolean;
  isRoaming?: boolean;
  onSaveDirect?: (urls: string[]) => Promise<void>;
  isSavingDirect?: boolean;
}

export function VendorBannerCarouselManager({
  bannerUrls,
  onChange,
  vendorName = "Your Store",
  isOpen = true,
  isRoaming = false,
  onSaveDirect,
  isSavingDirect = false,
}: VendorBannerCarouselManagerProps) {
  const [activeView, setActiveView] = useState<"manage" | "preview">("manage");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  
  // Modals state
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  const [deleteTargetIndex, setDeleteTargetIndex] = useState<number | null>(null);
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);

  // File input refs
  const multiFileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  // Embla Carousel for live simulation
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [previewIndex, setPreviewIndex] = useState(0);

  const onSelectPreview = useCallback(() => {
    if (!emblaApi) return;
    setPreviewIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  React.useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelectPreview);
    emblaApi.on("reInit", onSelectPreview);
    return () => {
      emblaApi.off("select", onSelectPreview);
      emblaApi.off("reInit", onSelectPreview);
    };
  }, [emblaApi, onSelectPreview]);

  // Upload single or multiple files
  const handleUploadFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    // Validate size (10MB limit each)
    for (const file of fileArray) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`"${file.name}" exceeds the 10MB limit.`);
        return;
      }
    }

    setIsUploading(true);
    const uploadedUrls: string[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      setUploadProgress(`Uploading image ${i + 1} of ${fileArray.length}...`);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "vendors");

      try {
        const res: any = await api.post("/uploads", formData);
        const url =
          res?.data?.data?.url ||
          res?.data?.url ||
          res?.url ||
          res?.data?.fileUrl;

        if (url) {
          uploadedUrls.push(url);
        } else {
          toast.error(`Failed to parse URL for "${file.name}"`);
        }
      } catch (err: any) {
        toast.error(err?.message || `Failed to upload "${file.name}"`);
      }
    }

    setIsUploading(false);
    setUploadProgress("");

    if (uploadedUrls.length > 0) {
      if (replacingIndex !== null) {
        // In-place replacement
        const updated = [...bannerUrls];
        updated[replacingIndex] = uploadedUrls[0];
        onChange(updated);
        toast.success(`Slide #${replacingIndex + 1} updated with new image!`);
        setReplacingIndex(null);
      } else {
        // Append new images
        const updated = [...bannerUrls, ...uploadedUrls];
        onChange(updated);
        toast.success(`Added ${uploadedUrls.length} banner image${uploadedUrls.length > 1 ? "s" : ""} to carousel!`);
      }
    }

    if (multiFileInputRef.current) multiFileInputRef.current.value = "";
    if (replaceFileInputRef.current) replaceFileInputRef.current.value = "";
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  // Reorder actions
  const moveSlide = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= bannerUrls.length) return;
    const updated = [...bannerUrls];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    onChange(updated);
    toast.success(`Slide moved to position ${toIndex + 1}`);
  };

  const makePrimaryCover = (index: number) => {
    if (index === 0) return;
    const updated = [...bannerUrls];
    const [selected] = updated.splice(index, 1);
    updated.unshift(selected);
    onChange(updated);
    toast.success("Set as Primary Store Cover Banner (Slide #1) 🌟");
  };

  // Delete actions
  const handleDeleteSlide = (index: number) => {
    const updated = bannerUrls.filter((_, i) => i !== index);
    onChange(updated);
    setDeleteTargetIndex(null);
    toast.info(`Slide #${index + 1} removed from carousel.`);
  };

  const handleClearAll = () => {
    onChange([]);
    setIsClearAllModalOpen(false);
    toast.info("All carousel banners cleared.");
  };

  // Add via direct URL
  const handleAddUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      toast.error("Please enter a valid image URL");
      return;
    }
    if (!/^https?:\/\/.+/i.test(trimmed)) {
      toast.error("URL must start with http:// or https://");
      return;
    }

    if (replacingIndex !== null) {
      const updated = [...bannerUrls];
      updated[replacingIndex] = trimmed;
      onChange(updated);
      toast.success(`Slide #${replacingIndex + 1} replaced!`);
      setReplacingIndex(null);
    } else {
      onChange([...bannerUrls, trimmed]);
      toast.success("Banner image added from URL!");
    }

    setUrlInput("");
    setIsUrlModalOpen(false);
  };

  // Quick save action
  const handleDirectSave = async () => {
    if (onSaveDirect) {
      try {
        await onSaveDirect(bannerUrls);
        toast.success("Cover Carousel Banners saved to your store! ✨");
      } catch (e: any) {
        toast.error(e?.message || "Failed to save banner settings");
      }
    }
  };

  return (
    <Card className="rounded-3xl border-border shadow-xl overflow-hidden">
      {/* Header with Title and Mode Switcher */}
      <CardHeader className="bg-muted/30 border-b border-border pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-bold font-display text-foreground">
              <span className="p-2 rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                <ImagePlus className="h-5 w-5" />
              </span>
              Store Cover & Banner Carousel
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              Manage sliding cover images for your public storefront. Slide #1 acts as your primary hero cover.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {/* View Switcher Tabs */}
            <div className="bg-background border border-border p-1 rounded-2xl flex items-center gap-1 shadow-xs">
              <button
                type="button"
                onClick={() => setActiveView("manage")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeView === "manage"
                    ? "bg-violet-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                Manage ({bannerUrls.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveView("preview")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeView === "preview"
                    ? "bg-violet-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                Live Preview
              </button>
            </div>

            {/* Direct Quick Save Button */}
            {onSaveDirect && (
              <Button
                type="button"
                onClick={handleDirectSave}
                disabled={isSavingDirect}
                size="sm"
                className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-3.5 shadow-sm shadow-emerald-600/20"
              >
                {isSavingDirect ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                )}
                Save Banners
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Hidden File Inputs */}
        <input
          type="file"
          ref={multiFileInputRef}
          onChange={(e) => e.target.files && handleUploadFiles(e.target.files)}
          accept="image/jpeg, image/png, image/webp, image/avif, image/gif"
          multiple
          className="hidden"
        />
        <input
          type="file"
          ref={replaceFileInputRef}
          onChange={(e) => e.target.files && handleUploadFiles(e.target.files)}
          accept="image/jpeg, image/png, image/webp, image/avif, image/gif"
          className="hidden"
        />

        {activeView === "manage" ? (
          <>
            {/* Aspect Ratio & Quality Guidelines Banner */}
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-violet-500/5 border border-violet-500/15 text-xs">
              <Info className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
              <div className="text-muted-foreground leading-relaxed">
                <span className="font-bold text-foreground">Recommended Banner Specs:</span> Widescreen aspect ratio (
                <strong className="text-violet-700 dark:text-violet-300">16:9 or 21:9</strong>, minimum 1200×500px).
                Formats: JPG, PNG, WebP up to 10MB. Customers see these in an automatic sliding banner at the top of your store.
              </div>
            </div>

            {/* Slide Cards Grid */}
            {bannerUrls.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <FileImage className="h-4 w-4 text-violet-500" />
                    Carousel Slides ({bannerUrls.length})
                  </span>

                  {bannerUrls.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setIsClearAllModalOpen(true)}
                      className="text-xs text-rose-600 hover:text-rose-700 font-semibold hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" /> Clear All
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bannerUrls.map((url, index) => {
                    const isPrimary = index === 0;

                    return (
                      <div
                        key={`${url}-${index}`}
                        className={`group relative rounded-3xl overflow-hidden border-2 transition-all duration-300 bg-card flex flex-col shadow-sm hover:shadow-md ${
                          isPrimary
                            ? "border-emerald-500/60 ring-2 ring-emerald-500/20"
                            : "border-border hover:border-violet-400/50"
                        }`}
                      >
                        {/* Image Preview Container */}
                        <div className="relative aspect-video w-full bg-muted overflow-hidden">
                          <img
                            src={url}
                            alt={`Banner Slide ${index + 1}`}
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800";
                            }}
                          />

                          {/* Gradient Overlay for controls */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3" />

                          {/* Top Badges */}
                          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                            <span
                              className={`text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm backdrop-blur-md ${
                                isPrimary
                                  ? "bg-emerald-500 text-slate-950 flex items-center gap-1"
                                  : "bg-black/60 text-white"
                              }`}
                            >
                              {isPrimary && <Star className="h-3 w-3 fill-slate-950" />}
                              {isPrimary ? "Cover (Slide 1)" : `Slide #${index + 1}`}
                            </span>

                            {/* Zoom Button */}
                            <button
                              type="button"
                              onClick={() => setZoomImageUrl(url)}
                              className="pointer-events-auto h-8 w-8 rounded-full bg-black/60 backdrop-blur-md text-white grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80 shadow-md"
                              title="View full-size image"
                            >
                              <Maximize2 className="h-4 w-4" />
                            </button>
                          </div>

                          {/* Hover Actions in Bottom Corner */}
                          <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {/* Replace in-place */}
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setReplacingIndex(index);
                                replaceFileInputRef.current?.click();
                              }}
                              className="h-8 rounded-xl bg-white/90 hover:bg-white text-slate-900 font-bold text-xs px-2.5 shadow-md flex items-center gap-1"
                            >
                              <RefreshCw className="h-3 w-3" />
                              Replace
                            </Button>

                            {/* Delete Slide */}
                            <Button
                              type="button"
                              size="icon"
                              variant="destructive"
                              onClick={() => setDeleteTargetIndex(index)}
                              className="h-8 w-8 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white shadow-md"
                              title="Delete this banner"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Slide Card Footer: Reorder & Status Controls */}
                        <div className="p-3 bg-muted/30 border-t border-border flex items-center justify-between text-xs gap-2">
                          <div className="flex items-center gap-1">
                            {!isPrimary && (
                              <button
                                type="button"
                                onClick={() => makePrimaryCover(index)}
                                className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold text-[11px] flex items-center gap-1 transition-colors"
                                title="Set as primary first slide"
                              >
                                <Star className="h-3 w-3" /> Set Cover
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1 ml-auto">
                            <span className="text-[10px] text-muted-foreground mr-1">Reorder:</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              disabled={index === 0}
                              onClick={() => moveSlide(index, index - 1)}
                              className="h-7 w-7 rounded-lg border-border hover:bg-muted"
                              title="Move left"
                            >
                              <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              disabled={index === bannerUrls.length - 1}
                              onClick={() => moveSlide(index, index + 1)}
                              className="h-7 w-7 rounded-lg border-border hover:bg-muted"
                              title="Move right"
                            >
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Empty State */
              <div className="text-center py-10 px-4 rounded-3xl border-2 border-dashed border-border bg-muted/20 space-y-3">
                <div className="mx-auto h-16 w-16 rounded-3xl bg-violet-500/10 text-violet-600 dark:text-violet-400 grid place-items-center">
                  <ImagePlus className="h-8 w-8" />
                </div>
                <div>
                  <h4 className="font-display font-bold text-base text-foreground">No Cover Banners Added Yet</h4>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                    Upload eye-catching banner images to create a vibrant cover carousel on your store page.
                  </p>
                </div>
              </div>
            )}

            {/* Drag & Drop Upload Zone + Add Options */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`p-6 rounded-3xl border-2 border-dashed transition-all text-center space-y-4 ${
                isDragging
                  ? "border-violet-500 bg-violet-500/10 scale-[1.01]"
                  : "border-border hover:border-violet-400/60 bg-muted/10 hover:bg-muted/20"
              }`}
            >
              {isUploading ? (
                <div className="py-4 space-y-3">
                  <Loader2 className="h-8 w-8 animate-spin text-violet-600 mx-auto" />
                  <p className="text-sm font-bold text-foreground">{uploadProgress || "Uploading banners..."}</p>
                </div>
              ) : (
                <>
                  <div className="mx-auto h-12 w-12 rounded-2xl bg-violet-500/10 text-violet-600 flex items-center justify-center">
                    <Upload className="h-6 w-6" />
                  </div>

                  <div className="space-y-1">
                    <h5 className="font-display font-bold text-sm text-foreground">
                      Drag & Drop Multiple Banners Here
                    </h5>
                    <p className="text-xs text-muted-foreground">
                      or choose an upload method below to add slides to your carousel
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <Button
                      type="button"
                      onClick={() => {
                        setReplacingIndex(null);
                        multiFileInputRef.current?.click();
                      }}
                      className="h-10 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs px-4 shadow-md shadow-violet-600/20 flex items-center gap-2"
                    >
                      <ImagePlus className="h-4 w-4" />
                      Upload Images (Multi-select)
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setReplacingIndex(null);
                        setUrlInput("");
                        setIsUrlModalOpen(true);
                      }}
                      className="h-10 rounded-2xl border-border hover:bg-muted font-bold text-xs px-4 flex items-center gap-2"
                    >
                      <LinkIcon className="h-4 w-4" />
                      Add from Image URL
                    </Button>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          /* Live Storefront Carousel Simulator */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-display font-bold text-sm text-foreground flex items-center gap-2">
                  <Eye className="h-4 w-4 text-violet-500" />
                  Live Customer View Simulator
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  This is how your cover carousel renders to customers on the public store page.
                </p>
              </div>
            </div>

            {bannerUrls.length > 0 ? (
              <div className="rounded-3xl border border-border overflow-hidden shadow-xl bg-card">
                {/* Simulated Store Hero Carousel */}
                <div className="relative h-60 sm:h-72 overflow-hidden" ref={emblaRef}>
                  <div className="flex h-full w-full touch-pan-y">
                    {bannerUrls.map((url, idx) => (
                      <div key={idx} className="flex-[0_0_100%] min-w-0 h-full relative">
                        <img
                          src={url}
                          alt={`Store Banner ${idx + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Dark Vignette Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

                  {/* Simulated Status Badge */}
                  <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full backdrop-blur-md px-3 py-1 text-xs font-black text-white shadow-md ${
                        isOpen ? "bg-emerald-500/90" : "bg-rose-600/90"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${isOpen ? "bg-white animate-pulse" : "bg-rose-200"}`} />
                      {isRoaming
                        ? (isOpen ? "🟢 LIVE ROAMING CART" : "🔴 CART OFFLINE")
                        : (isOpen ? "🟢 STORE OPEN NOW" : "🔴 STORE CLOSED")}
                    </span>
                  </div>

                  {/* Dot Indicators */}
                  {bannerUrls.length > 1 && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full">
                      {bannerUrls.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => emblaApi?.scrollTo(i)}
                          className={`h-2 rounded-full transition-all ${
                            i === previewIndex ? "bg-white w-5" : "bg-white/50 w-2 hover:bg-white/80"
                          }`}
                          aria-label={`Go to preview slide ${i + 1}`}
                        />
                      ))}
                    </div>
                  )}

                  {/* Navigation Arrows on Hover */}
                  {bannerUrls.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => emblaApi?.scrollPrev()}
                        className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-md text-white grid place-items-center transition-all shadow-md"
                        aria-label="Previous slide"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => emblaApi?.scrollNext()}
                        className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-md text-white grid place-items-center transition-all shadow-md"
                        aria-label="Next slide"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </>
                  )}
                </div>

                {/* Simulated Store Details Header Strip */}
                <div className="p-4 bg-card border-t border-border flex items-center justify-between">
                  <div>
                    <h5 className="font-display font-black text-base text-foreground">{vendorName}</h5>
                    <p className="text-xs text-muted-foreground">Preview of header presentation</p>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    {bannerUrls.length} Active Slide{bannerUrls.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 px-4 rounded-3xl border border-border bg-muted/10 space-y-2">
                <p className="text-sm font-bold text-foreground">No banner slides to preview</p>
                <p className="text-xs text-muted-foreground">Upload banner images in the Manage tab to see the live carousel simulator.</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveView("manage")}
                  className="rounded-2xl text-xs mt-2"
                >
                  Go to Manage Tab
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Lightbox / Zoom Preview Dialog */}
      <Dialog open={!!zoomImageUrl} onOpenChange={() => setZoomImageUrl(null)}>
        <DialogContent className="sm:max-w-3xl p-0 overflow-hidden rounded-3xl border-border bg-card">
          <DialogHeader className="p-4 bg-muted/40 border-b border-border">
            <DialogTitle className="text-sm font-bold font-display flex items-center gap-2">
              <Eye className="h-4 w-4 text-violet-500" />
              Full Resolution Banner View
            </DialogTitle>
          </DialogHeader>
          <div className="p-2 bg-black/90 flex items-center justify-center max-h-[75vh] overflow-hidden">
            {zoomImageUrl && (
              <img
                src={zoomImageUrl}
                alt="Banner full view"
                className="max-h-[70vh] w-auto object-contain rounded-xl"
              />
            )}
          </div>
          <DialogFooter className="p-4 bg-muted/20 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-mono truncate max-w-md">
              {zoomImageUrl}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setZoomImageUrl(null)}
              className="rounded-xl"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteTargetIndex !== null}
        onOpenChange={() => setDeleteTargetIndex(null)}
      >
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600 font-display text-lg font-bold">
              <Trash2 className="h-5 w-5" />
              Remove Banner Slide #{deleteTargetIndex !== null ? deleteTargetIndex + 1 : ""}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to remove this banner from your store carousel?
            </DialogDescription>
          </DialogHeader>

          {deleteTargetIndex !== null && bannerUrls[deleteTargetIndex] && (
            <div className="rounded-2xl overflow-hidden border border-border aspect-video bg-muted my-2">
              <img
                src={bannerUrls[deleteTargetIndex]}
                alt="Delete candidate"
                className="h-full w-full object-cover"
              />
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTargetIndex(null)}
              className="rounded-2xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => deleteTargetIndex !== null && handleDeleteSlide(deleteTargetIndex)}
              className="rounded-2xl text-xs font-bold bg-rose-600 hover:bg-rose-700"
            >
              Confirm & Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear All Confirmation Dialog */}
      <Dialog
        open={isClearAllModalOpen}
        onOpenChange={setIsClearAllModalOpen}
      >
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600 font-display text-lg font-bold">
              <Trash2 className="h-5 w-5" />
              Clear All Carousel Banners
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              This will remove all {bannerUrls.length} banner slides from your store cover carousel. This action cannot be undone unless you upload new images.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsClearAllModalOpen(false)}
              className="rounded-2xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleClearAll}
              className="rounded-2xl text-xs font-bold bg-rose-600 hover:bg-rose-700"
            >
              Yes, Clear All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Replace via Image URL Dialog */}
      <Dialog open={isUrlModalOpen} onOpenChange={setIsUrlModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-lg font-bold">
              <LinkIcon className="h-5 w-5 text-violet-600" />
              {replacingIndex !== null
                ? `Replace Slide #${replacingIndex + 1} with URL`
                : "Add Banner from Image URL"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Paste a direct image link (e.g. from Unsplash, Cloudinary, or AWS S3).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Image Web Address (URL)
              </label>
              <Input
                placeholder="https://images.unsplash.com/photo-..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="rounded-2xl text-xs"
              />
            </div>

            {/* Live URL Preview */}
            {urlInput.trim() && /^https?:\/\/.+/i.test(urlInput.trim()) && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Live URL Preview:
                </span>
                <div className="rounded-2xl overflow-hidden border border-border aspect-video bg-muted relative">
                  <img
                    src={urlInput.trim()}
                    alt="URL preview"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800";
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsUrlModalOpen(false)}
              className="rounded-2xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAddUrl}
              className="rounded-2xl text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white"
            >
              {replacingIndex !== null ? "Replace Slide" : "Add to Carousel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
