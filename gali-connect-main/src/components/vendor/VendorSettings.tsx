import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Save,
  Loader2,
  FileText,
  Phone,
  Bike,
  ShieldCheck,
  Upload,
  ImagePlus,
  X,
  Calendar,
  User,
  Store,
  CheckCircle2,
  Info,
  Percent,
  IndianRupee,
} from "lucide-react";

import { Logo } from "@/components/system/logo";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function VendorSettings({ vendorProfile }: { vendorProfile?: any }) {
  const queryClient = useQueryClient();

  // If vendorProfile is not passed directly, fetch it
  const { data: fetchedRes, isLoading } = useQuery({
    queryKey: ["vendorProfile"],
    queryFn: () => api.get<{ data: any }>("/vendors/me"),
    enabled: !vendorProfile,
  });

  const profile = vendorProfile || fetchedRes?.data?.data || fetchedRes?.data || {};

  const [gstin, setGstin] = useState(profile.gstin || "");
  const [freeDeliveryMin, setFreeDeliveryMin] = useState(
    profile.free_delivery_min_order ? String(profile.free_delivery_min_order) : "",
  );
  const [contactPhone, setContactPhone] = useState(profile.phone || "");
  const [taxRate, setTaxRate] = useState(profile.tax_rate !== undefined && profile.tax_rate !== null ? String(profile.tax_rate) : "");
  const [estimatedDeliveryTime, setEstimatedDeliveryTime] = useState(
    profile.estimated_delivery_time || profile.delivery_configs?.estimated_delivery_time || "20-30 mins"
  );
  const [logoUrl, setLogoUrl] = useState(profile.logo_url || "");
  const [bannerUrls, setBannerUrls] = useState<string[]>(profile.banner_urls || []);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);

  // 4 Delivery Options States
  const [bookingEnabled, setBookingEnabled] = useState(false);
  const [bookingAdvance, setBookingAdvance] = useState("20");
  const [bookingMinOrder, setBookingMinOrder] = useState("0");

  const [selfPickupEnabled, setSelfPickupEnabled] = useState(true);
  const [selfPickupAdvance, setSelfPickupAdvance] = useState("10");
  const [selfPickupMinOrder, setSelfPickupMinOrder] = useState("0");

  const [shopDeliveryEnabled, setShopDeliveryEnabled] = useState(false);
  const [shopDeliveryFee, setShopDeliveryFee] = useState("30");
  const [shopDeliveryMinOrder, setShopDeliveryMinOrder] = useState("0");

  const [deliveryPartnerEnabled, setDeliveryPartnerEnabled] = useState(true);

  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size exceeds 10MB limit.");
      return;
    }

    setIsUploadingLogo(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "vendors");

    try {
      const res: any = await api.post("/uploads", formData);
      const uploadedUrl = res?.data?.data?.url || res?.data?.url || res?.url || res?.data?.fileUrl;
      if (uploadedUrl) {
        setLogoUrl(uploadedUrl);
        toast.success("Logo uploaded successfully! Click Save to apply changes.");
      } else {
        toast.error("Failed to parse uploaded image URL");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload logo image");
    } finally {
      setIsUploadingLogo(false);
      if (logoFileInputRef.current) logoFileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    if (profile.gstin !== undefined) setGstin(profile.gstin || "");
    if (profile.free_delivery_min_order !== undefined)
      setFreeDeliveryMin(
        profile.free_delivery_min_order ? String(profile.free_delivery_min_order) : "",
      );
    if (profile.phone !== undefined) setContactPhone(profile.phone || "");
    if (profile.tax_rate !== undefined) setTaxRate(profile.tax_rate !== null ? String(profile.tax_rate) : "");
    if (profile.estimated_delivery_time !== undefined || profile.delivery_configs?.estimated_delivery_time !== undefined) {
      setEstimatedDeliveryTime(profile.estimated_delivery_time || profile.delivery_configs?.estimated_delivery_time || "20-30 mins");
    }
    if (profile.logo_url !== undefined) setLogoUrl(profile.logo_url || "");
    if (profile.banner_urls !== undefined) setBannerUrls(profile.banner_urls || []);

    // Initialize 4 Delivery Options
    const configs = profile.delivery_configs || {};
    if (configs.booking) {
      setBookingEnabled(Boolean(configs.booking.enabled));
      setBookingAdvance(configs.booking.advance_percentage !== undefined ? String(configs.booking.advance_percentage) : "20");
      setBookingMinOrder(configs.booking.min_order !== undefined ? String(configs.booking.min_order) : "0");
    } else {
      setBookingEnabled(false);
      setBookingAdvance("20");
      setBookingMinOrder("0");
    }

    if (configs.self_pickup) {
      setSelfPickupEnabled(Boolean(configs.self_pickup.enabled));
      setSelfPickupAdvance(
        configs.self_pickup.advance_percentage !== undefined
          ? String(configs.self_pickup.advance_percentage)
          : (profile.advance_payment_percentage ? String(profile.advance_payment_percentage) : "10")
      );
      setSelfPickupMinOrder(configs.self_pickup.min_order !== undefined ? String(configs.self_pickup.min_order) : "0");
    } else {
      setSelfPickupEnabled(true);
      setSelfPickupAdvance(profile.advance_payment_percentage ? String(profile.advance_payment_percentage) : "10");
      setSelfPickupMinOrder("0");
    }

    if (configs.shop_delivery) {
      setShopDeliveryEnabled(Boolean(configs.shop_delivery.enabled));
      setShopDeliveryFee(
        configs.shop_delivery.delivery_fee !== undefined
          ? String(configs.shop_delivery.delivery_fee)
          : (profile.delivery_fee ? String(profile.delivery_fee) : "30")
      );
      setShopDeliveryMinOrder(configs.shop_delivery.min_order !== undefined ? String(configs.shop_delivery.min_order) : "0");
    } else {
      setShopDeliveryEnabled(Boolean(profile.provides_delivery));
      setShopDeliveryFee(profile.delivery_fee ? String(profile.delivery_fee) : "30");
      setShopDeliveryMinOrder("0");
    }

    if (configs.delivery_partner) {
      setDeliveryPartnerEnabled(configs.delivery_partner.enabled !== false);
    } else {
      setDeliveryPartnerEnabled(true);
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.put("/vendors/me", data),
    onSuccess: () => {
      toast.success("Business settings saved successfully! ✨");
      queryClient.invalidateQueries({ queryKey: ["vendorProfile"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save settings");
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const delivery_configs = {
      booking: {
        enabled: bookingEnabled,
        advance_percentage: Number(bookingAdvance) || 0,
        min_order: Number(bookingMinOrder) || 0,
      },
      self_pickup: {
        enabled: selfPickupEnabled,
        advance_percentage: Number(selfPickupAdvance) || 0,
        min_order: Number(selfPickupMinOrder) || 0,
      },
      shop_delivery: {
        enabled: shopDeliveryEnabled,
        delivery_fee: Number(shopDeliveryFee) || 0,
        min_order: Number(shopDeliveryMinOrder) || 0,
      },
      delivery_partner: {
        enabled: deliveryPartnerEnabled,
      },
    };

    updateMutation.mutate({
      gstin: gstin,
      provides_delivery: shopDeliveryEnabled,
      free_delivery_min_order: freeDeliveryMin ? Number(freeDeliveryMin) : null,
      delivery_fee: Number(shopDeliveryFee) || 0,
      advance_payment_percentage: Number(selfPickupAdvance) || 10,
      delivery_configs: {
        ...delivery_configs,
        estimated_delivery_time: estimatedDeliveryTime,
      },
      estimated_delivery_time: estimatedDeliveryTime,
      phone: contactPhone || null,
      tax_rate: taxRate !== "" ? Number(taxRate) : null,
      logo_url: logoUrl || null,
      banner_urls: bannerUrls,
    });
  };

  if (isLoading && !vendorProfile) {
    return (
      <div className="flex justify-center p-12 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
        <span>Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight">Business Settings</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Configure tax compliance, delivery rules, and public store contact details.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Card className="rounded-3xl border-border shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5 text-amber-500" />
              Store Branding & Logo
            </CardTitle>
            <CardDescription className="text-xs">
              Upload or provide an image link for your business logo / store DP.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="relative group h-20 w-20 rounded-2xl bg-muted overflow-hidden border border-border shrink-0 grid place-items-center shadow-inner">
                {logoUrl ? (
                  <img src={logoUrl} alt="Store DP" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-emerald-100 flex items-center justify-center p-4">
                    <div className="h-16 w-16 opacity-50 grayscale">
                      <Logo className="h-full w-full object-contain opacity-80" />
                    </div>
                  </div>
                )}
                {isUploadingLogo && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-xs grid place-items-center z-10">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
              </div>

              <div className="flex-1 w-full space-y-2">
                <Label
                  htmlFor="logoUrl"
                  className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                >
                  Logo Image / DP
                </Label>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <Input
                    id="logoUrl"
                    placeholder="https://example.com/logo.png or upload image"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    className="h-10 rounded-2xl text-xs bg-muted/40 flex-1"
                  />
                  <input
                    type="file"
                    ref={logoFileInputRef}
                    onChange={handleLogoFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => logoFileInputRef.current?.click()}
                    disabled={isUploadingLogo}
                    className="h-10 rounded-2xl text-xs font-bold shrink-0 border-primary/30 hover:border-primary/60 hover:bg-primary/5 flex items-center gap-1.5"
                  >
                    {isUploadingLogo ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    ) : (
                      <Upload className="h-3.5 w-3.5 text-primary" />
                    )}
                    Upload Image
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Upload an image file (PNG, JPG, WebP) up to 10MB or paste an image URL directly.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Banner Images Section */}
        <Card className="rounded-3xl border-border shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ImagePlus className="h-5 w-5 text-violet-500" />
              Store Banners / Cover Images
            </CardTitle>
            <CardDescription className="text-xs">
              Upload multiple banner images for your store's cover carousel. They will appear on your store page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Banner Preview Grid */}
            {bannerUrls.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {bannerUrls.map((url, idx) => (
                  <div key={idx} className="relative group rounded-2xl overflow-hidden border border-border aspect-video bg-muted">
                    <img src={url} alt={`Banner ${idx + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setBannerUrls((prev) => prev.filter((_, i) => i !== idx));
                        toast.info(`Banner ${idx + 1} removed. Click Save to apply.`);
                      }}
                      className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-black/60 backdrop-blur-sm text-white grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      aria-label={`Remove banner ${idx + 1}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <div className="absolute bottom-1.5 left-1.5 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {idx + 1}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Button */}
            <div className="flex items-center gap-3">
              <input
                type="file"
                ref={bannerFileInputRef}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 10 * 1024 * 1024) {
                    toast.error("File size exceeds 10MB limit.");
                    return;
                  }
                  setIsUploadingBanner(true);
                  const formData = new FormData();
                  formData.append("file", file);
                  formData.append("folder", "vendors");
                  try {
                    const res: any = await api.post("/uploads", formData);
                    const uploadedUrl = res?.data?.data?.url || res?.data?.url || res?.url || res?.data?.fileUrl;
                    if (uploadedUrl) {
                      setBannerUrls((prev) => [...prev, uploadedUrl]);
                      toast.success("Banner uploaded! Click Save to apply.");
                    } else {
                      toast.error("Failed to parse uploaded image URL");
                    }
                  } catch (err: any) {
                    toast.error(err?.message || "Failed to upload banner image");
                  } finally {
                    setIsUploadingBanner(false);
                    if (bannerFileInputRef.current) bannerFileInputRef.current.value = "";
                  }
                }}
                accept="image/*"
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => bannerFileInputRef.current?.click()}
                disabled={isUploadingBanner}
                className="h-10 rounded-2xl text-xs font-bold border-violet-300 hover:border-violet-500 hover:bg-violet-50 flex items-center gap-1.5"
              >
                {isUploadingBanner ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500" />
                ) : (
                  <ImagePlus className="h-3.5 w-3.5 text-violet-500" />
                )}
                Add Banner Image
              </Button>
              <span className="text-[11px] text-muted-foreground">
                {bannerUrls.length} banner{bannerUrls.length !== 1 ? "s" : ""} added
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-emerald-600" />
              Tax & Compliance
            </CardTitle>
            <CardDescription className="text-xs">
              Manage your GSTIN tax registration and minimum order thresholds.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5 max-w-md">
              <Label
                htmlFor="gstin"
                className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
              >
                GSTIN Number (Optional)
              </Label>
              <Input
                id="gstin"
                placeholder="e.g. 22AAAAA0000A1Z5"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                className="h-10 rounded-2xl text-xs uppercase bg-muted/40"
              />
            </div>
            <div className="space-y-1.5 max-w-md">
              <Label
                htmlFor="freeDeliveryMin"
                className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
              >
                Free Delivery Order Threshold (₹)
              </Label>
              <Input
                id="freeDeliveryMin"
                type="number"
                min="0"
                placeholder="e.g. 199 or leave blank"
                value={freeDeliveryMin}
                onChange={(e) => setFreeDeliveryMin(e.target.value)}
                className="h-10 rounded-2xl text-xs bg-muted/40"
              />
            </div>
            <div className="space-y-1.5 max-w-md">
              <Label
                htmlFor="estimatedDeliveryTime"
                className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"
              >
                Estimated Delivery Time (Shown to Customers)
              </Label>
              <Input
                id="estimatedDeliveryTime"
                placeholder="e.g. 20-30 mins, 15-20 mins, Same Day"
                value={estimatedDeliveryTime}
                onChange={(e) => setEstimatedDeliveryTime(e.target.value)}
                className="h-10 rounded-2xl text-xs bg-muted/40 font-medium"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {["15-20 mins", "20-30 mins", "30-45 mins", "45-60 mins", "Same Day Delivery"].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setEstimatedDeliveryTime(preset)}
                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition-colors ${
                      estimatedDeliveryTime === preset
                        ? "bg-emerald-500 text-white border-emerald-500"
                        : "bg-muted/60 text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                This delivery time estimate will be dynamically displayed on your store profile and product cards.
              </p>
            </div>
            <div className="space-y-1.5 max-w-md">
              <Label
                htmlFor="taxRate"
                className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
              >
                Custom Tax Rate % (Optional)
              </Label>
              <Input
                id="taxRate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="Leave blank to use platform default"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                className="h-10 rounded-2xl text-xs bg-muted/40"
              />
              <p className="text-[11px] text-muted-foreground">
                Set a custom tax rate for your products. Leave blank to use the platform's default tax rate.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border shadow-xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-emerald-500/10 via-primary/5 to-transparent border-b border-border/50">
            <CardTitle className="flex items-center gap-2.5 text-base font-bold">
              <Bike className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Store Delivery Management (4 Options)
            </CardTitle>
            <CardDescription className="text-xs">
              Choose which delivery options your store provides. Any option turned <strong>OFF</strong> will be completely hidden from customers at checkout.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {/* Option 1: Booking */}
            <div className={`rounded-2xl border p-4 sm:p-5 transition-all ${
              bookingEnabled ? "border-emerald-500/40 bg-emerald-500/5 shadow-sm" : "border-border bg-card/40 opacity-75"
            }`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors ${
                    bookingEnabled ? "bg-emerald-500 text-slate-950 font-bold" : "bg-muted text-muted-foreground"
                  }`}>
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-foreground">1. Advance Booking</h4>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        bookingEnabled ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"
                      }`}>
                        {bookingEnabled ? "Active" : "Disabled"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Allow customers to pre-book items in advance with custom upfront payment.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={bookingEnabled}
                  onClick={() => setBookingEnabled((v) => !v)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    bookingEnabled ? "bg-emerald-500" : "bg-muted-foreground/30"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      bookingEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {bookingEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-emerald-500/20">
                  <div className="space-y-1.5">
                    <Label htmlFor="bookingAdvance" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Percent className="h-3.5 w-3.5" /> Advance Payment (%)
                    </Label>
                    <Input
                      id="bookingAdvance"
                      type="number"
                      min="0"
                      max="100"
                      placeholder="e.g. 20"
                      value={bookingAdvance}
                      onChange={(e) => setBookingAdvance(e.target.value)}
                      className="h-10 rounded-2xl text-xs bg-background"
                    />
                    <p className="text-[11px] text-muted-foreground">Upfront payment required to book.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bookingMinOrder" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <IndianRupee className="h-3.5 w-3.5" /> Minimum Order Amount (₹)
                    </Label>
                    <Input
                      id="bookingMinOrder"
                      type="number"
                      min="0"
                      placeholder="0 for no minimum"
                      value={bookingMinOrder}
                      onChange={(e) => setBookingMinOrder(e.target.value)}
                      className="h-10 rounded-2xl text-xs bg-background"
                    />
                    <p className="text-[11px] text-muted-foreground">Minimum cart value required for booking.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Option 2: Self Pickup */}
            <div className={`rounded-2xl border p-4 sm:p-5 transition-all ${
              selfPickupEnabled ? "border-emerald-500/40 bg-emerald-500/5 shadow-sm" : "border-border bg-card/40 opacity-75"
            }`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors ${
                    selfPickupEnabled ? "bg-emerald-500 text-slate-950 font-bold" : "bg-muted text-muted-foreground"
                  }`}>
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-foreground">2. Self Pickup (Takeaway)</h4>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        selfPickupEnabled ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"
                      }`}>
                        {selfPickupEnabled ? "Active" : "Disabled"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Customers visit your store in person to collect their packed order.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={selfPickupEnabled}
                  onClick={() => setSelfPickupEnabled((v) => !v)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    selfPickupEnabled ? "bg-emerald-500" : "bg-muted-foreground/30"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      selfPickupEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {selfPickupEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-emerald-500/20">
                  <div className="space-y-1.5">
                    <Label htmlFor="selfPickupAdvance" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Percent className="h-3.5 w-3.5" /> Advance Payment (%)
                    </Label>
                    <Input
                      id="selfPickupAdvance"
                      type="number"
                      min="0"
                      max="100"
                      placeholder="e.g. 10"
                      value={selfPickupAdvance}
                      onChange={(e) => setSelfPickupAdvance(e.target.value)}
                      className="h-10 rounded-2xl text-xs bg-background"
                    />
                    <p className="text-[11px] text-muted-foreground">Upfront payment required for pickup.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="selfPickupMinOrder" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <IndianRupee className="h-3.5 w-3.5" /> Minimum Order Amount (₹)
                    </Label>
                    <Input
                      id="selfPickupMinOrder"
                      type="number"
                      min="0"
                      placeholder="0 for no minimum"
                      value={selfPickupMinOrder}
                      onChange={(e) => setSelfPickupMinOrder(e.target.value)}
                      className="h-10 rounded-2xl text-xs bg-background"
                    />
                    <p className="text-[11px] text-muted-foreground">Minimum cart value for store pickup.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Option 3: Shop Delivery */}
            <div className={`rounded-2xl border p-4 sm:p-5 transition-all ${
              shopDeliveryEnabled ? "border-emerald-500/40 bg-emerald-500/5 shadow-sm" : "border-border bg-card/40 opacity-75"
            }`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors ${
                    shopDeliveryEnabled ? "bg-emerald-500 text-slate-950 font-bold" : "bg-muted text-muted-foreground"
                  }`}>
                    <Store className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-foreground">3. Shop Direct Delivery</h4>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        shopDeliveryEnabled ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"
                      }`}>
                        {shopDeliveryEnabled ? "Active" : "Disabled"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Your own shop staff or delivery boys deliver directly to customer addresses.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={shopDeliveryEnabled}
                  onClick={() => setShopDeliveryEnabled((v) => !v)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    shopDeliveryEnabled ? "bg-emerald-500" : "bg-muted-foreground/30"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      shopDeliveryEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {shopDeliveryEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-emerald-500/20">
                  <div className="space-y-1.5">
                    <Label htmlFor="shopDeliveryFee" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <IndianRupee className="h-3.5 w-3.5" /> Shop Delivery Charge (₹)
                    </Label>
                    <Input
                      id="shopDeliveryFee"
                      type="number"
                      min="0"
                      placeholder="e.g. 30"
                      value={shopDeliveryFee}
                      onChange={(e) => setShopDeliveryFee(e.target.value)}
                      className="h-10 rounded-2xl text-xs bg-background"
                    />
                    <p className="text-[11px] text-muted-foreground">Delivery fee charged by your store.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="shopDeliveryMinOrder" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <IndianRupee className="h-3.5 w-3.5" /> Minimum Order Amount (₹)
                    </Label>
                    <Input
                      id="shopDeliveryMinOrder"
                      type="number"
                      min="0"
                      placeholder="0 for no minimum"
                      value={shopDeliveryMinOrder}
                      onChange={(e) => setShopDeliveryMinOrder(e.target.value)}
                      className="h-10 rounded-2xl text-xs bg-background"
                    />
                    <p className="text-[11px] text-muted-foreground">Minimum cart value for store delivery.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Option 4: VegaMart Delivery Partner */}
            <div className={`rounded-2xl border p-4 sm:p-5 transition-all ${
              deliveryPartnerEnabled ? "border-emerald-500/40 bg-emerald-500/5 shadow-sm" : "border-border bg-card/40 opacity-75"
            }`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors ${
                    deliveryPartnerEnabled ? "bg-emerald-500 text-slate-950 font-bold" : "bg-muted text-muted-foreground"
                  }`}>
                    <Bike className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-foreground">4. VegaMart Delivery Partner</h4>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        deliveryPartnerEnabled ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"
                      }`}>
                        {deliveryPartnerEnabled ? "Active" : "Disabled"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      VegaMart platform fleet delivery riders pick up from your store and deliver to the customer.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={deliveryPartnerEnabled}
                  onClick={() => setDeliveryPartnerEnabled((v) => !v)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    deliveryPartnerEnabled ? "bg-emerald-500" : "bg-muted-foreground/30"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      deliveryPartnerEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="mt-3.5 flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-[11px] text-muted-foreground border border-border/50">
                <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                <span>
                  Delivery charge and minimum order for VegaMart Delivery Partner are centrally configured by Admin. Turning this option ON allows customers to request VegaMart rider delivery for your products.
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Phone className="h-5 w-5 text-purple-600" />
              Store Contact Information
            </CardTitle>
            <CardDescription className="text-xs">
              Provide a direct contact number for customer inquiries.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5 max-w-md">
              <Label
                htmlFor="contactPhone"
                className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
              >
                Public Store Phone Number
              </Label>
              <Input
                id="contactPhone"
                type="tel"
                placeholder="e.g. +919876543210"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="h-10 rounded-2xl text-xs bg-muted/40"
              />
            </div>
          </CardContent>
        </Card>

        <Button
          type="submit"
          disabled={updateMutation.isPending}
          className="rounded-2xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 h-11 px-8 shadow-lg"
        >
          {updateMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Settings
        </Button>
      </form>
    </div>
  );
}
