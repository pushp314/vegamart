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
  Clock,
  Lock,
  Bell,
  Volume2,
  VolumeX,
  Sparkles,
  Landmark,
  Building2,
  CreditCard,
  Zap,
  Banknote,
} from "lucide-react";

import { useVendorOrderNotifications } from "./VendorOrderNotificationProvider";

import { Logo } from "@/components/system/logo";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function VendorSettings({ vendorProfile }: { vendorProfile?: any }) {
  const queryClient = useQueryClient();
  let notificationControls: ReturnType<typeof useVendorOrderNotifications> | null = null;
  try {
    notificationControls = useVendorOrderNotifications();
  } catch {
    notificationControls = null;
  }

  // If vendorProfile is not passed directly, fetch it
  const { data: fetchedProfile, isLoading } = useQuery({
    queryKey: ["vendorProfile"],
    queryFn: async () => {
      const res: any = await api.get("/vendors/me");
      return res.data?.data || res.data || res;
    },
    enabled: !vendorProfile,
  });

  const profile = vendorProfile || fetchedProfile || {};

  const [gstin, setGstin] = useState(profile.gstin || "");
  const [freeDeliveryMin, setFreeDeliveryMin] = useState(
    profile.free_delivery_min_order ? String(profile.free_delivery_min_order) : "",
  );
  const [contactPhone, setContactPhone] = useState(profile.phone || "");
  const [taxRate, setTaxRate] = useState(profile.tax_rate !== null && profile.tax_rate !== undefined ? String(profile.tax_rate) : "");
  const [estimatedDeliveryTime, setEstimatedDeliveryTime] = useState(profile.estimated_delivery_time || "20-30 mins");
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState(profile.delivery_radius_km ? String(profile.delivery_radius_km) : "5");
  const [logoUrl, setLogoUrl] = useState(profile.logo_url || "");
  const [bannerUrls, setBannerUrls] = useState<string[]>(profile.banner_urls || []);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);

  // Bank Account & Direct Payout Settings
  const [bankAccountNumber, setBankAccountNumber] = useState(
    profile.bank_account_number || ""
  );
  const [bankIfsc, setBankIfsc] = useState(profile.bank_ifsc || "");
  const [bankAccountHolderName, setBankAccountHolderName] = useState(
    profile.bank_account_holder_name || profile.owner_name || ""
  );
  const [bankName, setBankName] = useState(profile.bank_name || "");
  const [upiId, setUpiId] = useState(profile.upi_id || "");

  // 4 Delivery Options State with 4 Independent Payment Controls
  // 1. Advance Booking
  const [bookingEnabled, setBookingEnabled] = useState(false);
  const [bookingAdvance, setBookingAdvance] = useState("20");
  const [bookingMinOrder, setBookingMinOrder] = useState("0");
  const [bookingEstimatedTime, setBookingEstimatedTime] = useState("1-2 days");
  const [bookingOnlinePaymentEnabled, setBookingOnlinePaymentEnabled] = useState(true);
  const [bookingCodEnabled, setBookingCodEnabled] = useState(false);
  const [bookingFullPaymentEnabled, setBookingFullPaymentEnabled] = useState(true);
  const [bookingAdvancePaymentEnabled, setBookingAdvancePaymentEnabled] = useState(true);

  // 2. Self Pickup
  const [selfPickupEnabled, setSelfPickupEnabled] = useState(true);
  const [selfPickupAdvance, setSelfPickupAdvance] = useState("10");
  const [selfPickupMinOrder, setSelfPickupMinOrder] = useState("0");
  const [selfPickupEstimatedTime, setSelfPickupEstimatedTime] = useState("15 mins");
  const [selfPickupOnlinePaymentEnabled, setSelfPickupOnlinePaymentEnabled] = useState(true);
  const [selfPickupCodEnabled, setSelfPickupCodEnabled] = useState(true);
  const [selfPickupFullPaymentEnabled, setSelfPickupFullPaymentEnabled] = useState(true);
  const [selfPickupAdvancePaymentEnabled, setSelfPickupAdvancePaymentEnabled] = useState(true);

  // 3. Shop Direct Delivery
  const [shopDeliveryEnabled, setShopDeliveryEnabled] = useState(false);
  const [shopDeliveryFee, setShopDeliveryFee] = useState("30");
  const [shopDeliveryMinOrder, setShopDeliveryMinOrder] = useState("0");
  const [shopDeliveryEstimatedTime, setShopDeliveryEstimatedTime] = useState("30-45 mins");
  const [shopDeliveryOnlinePaymentEnabled, setShopDeliveryOnlinePaymentEnabled] = useState(true);
  const [shopDeliveryCodEnabled, setShopDeliveryCodEnabled] = useState(true);
  const [shopDeliveryFullPaymentEnabled, setShopDeliveryFullPaymentEnabled] = useState(true);
  const [shopDeliveryAdvancePaymentEnabled, setShopDeliveryAdvancePaymentEnabled] = useState(false);
  const [shopDeliveryAdvance, setShopDeliveryAdvance] = useState("20");

  // 4. VegaMart Home Delivery
  const [deliveryPartnerEnabled, setDeliveryPartnerEnabled] = useState(true);
  const [deliveryPartnerOnlinePaymentEnabled, setDeliveryPartnerOnlinePaymentEnabled] = useState(true);
  const [deliveryPartnerCodEnabled, setDeliveryPartnerCodEnabled] = useState(true);
  const [deliveryPartnerFullPaymentEnabled, setDeliveryPartnerFullPaymentEnabled] = useState(true);
  const [deliveryPartnerAdvancePaymentEnabled, setDeliveryPartnerAdvancePaymentEnabled] = useState(false);
  const [deliveryPartnerAdvance, setDeliveryPartnerAdvance] = useState("20");

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
    if (profile.delivery_radius_km !== undefined) {
      setDeliveryRadiusKm(profile.delivery_radius_km ? String(profile.delivery_radius_km) : "5");
    }
    if (profile.logo_url !== undefined) setLogoUrl(profile.logo_url || "");
    if (profile.banner_urls !== undefined) setBannerUrls(profile.banner_urls || []);
    if (profile.bank_account_number !== undefined) setBankAccountNumber(profile.bank_account_number || "");
    if (profile.bank_ifsc !== undefined) setBankIfsc(profile.bank_ifsc || "");
    if (profile.bank_account_holder_name !== undefined)
      setBankAccountHolderName(profile.bank_account_holder_name || profile.owner_name || "");
    if (profile.bank_name !== undefined) setBankName(profile.bank_name || "");
    if (profile.upi_id !== undefined) setUpiId(profile.upi_id || "");

    // Initialize 4 Delivery Options
    const configs = profile.delivery_configs || {};
    if (configs.booking) {
      setBookingEnabled(Boolean(configs.booking.enabled));
      setBookingAdvance(configs.booking.advance_percentage !== undefined ? String(configs.booking.advance_percentage) : "20");
      setBookingMinOrder(configs.booking.min_order !== undefined ? String(configs.booking.min_order) : "0");
      setBookingEstimatedTime(configs.booking.estimated_time || "1-2 days");
      setBookingOnlinePaymentEnabled(configs.booking.online_payment_enabled !== undefined ? Boolean(configs.booking.online_payment_enabled) : true);
      setBookingCodEnabled(configs.booking.cod_enabled !== undefined ? Boolean(configs.booking.cod_enabled) : false);
      setBookingFullPaymentEnabled(configs.booking.full_payment_enabled !== undefined ? Boolean(configs.booking.full_payment_enabled) : true);
      setBookingAdvancePaymentEnabled(configs.booking.advance_payment_enabled !== undefined ? Boolean(configs.booking.advance_payment_enabled) : true);
    } else {
      setBookingEnabled(false);
      setBookingAdvance("20");
      setBookingMinOrder("0");
      setBookingEstimatedTime("1-2 days");
      setBookingOnlinePaymentEnabled(true);
      setBookingCodEnabled(false);
      setBookingFullPaymentEnabled(true);
      setBookingAdvancePaymentEnabled(true);
    }

    if (configs.self_pickup) {
      setSelfPickupEnabled(Boolean(configs.self_pickup.enabled));
      setSelfPickupAdvance(
        configs.self_pickup.advance_percentage !== undefined
          ? String(configs.self_pickup.advance_percentage)
          : (profile.advance_payment_percentage ? String(profile.advance_payment_percentage) : "10")
      );
      setSelfPickupMinOrder(configs.self_pickup.min_order !== undefined ? String(configs.self_pickup.min_order) : "0");
      setSelfPickupEstimatedTime(configs.self_pickup.estimated_time || "15 mins");
      setSelfPickupOnlinePaymentEnabled(configs.self_pickup.online_payment_enabled !== undefined ? Boolean(configs.self_pickup.online_payment_enabled) : true);
      setSelfPickupCodEnabled(configs.self_pickup.cod_enabled !== undefined ? Boolean(configs.self_pickup.cod_enabled) : true);
      setSelfPickupFullPaymentEnabled(configs.self_pickup.full_payment_enabled !== undefined ? Boolean(configs.self_pickup.full_payment_enabled) : true);
      setSelfPickupAdvancePaymentEnabled(configs.self_pickup.advance_payment_enabled !== undefined ? Boolean(configs.self_pickup.advance_payment_enabled) : true);
    } else {
      setSelfPickupEnabled(true);
      setSelfPickupAdvance(profile.advance_payment_percentage ? String(profile.advance_payment_percentage) : "10");
      setSelfPickupMinOrder("0");
      setSelfPickupEstimatedTime("15 mins");
      setSelfPickupOnlinePaymentEnabled(true);
      setSelfPickupCodEnabled(true);
      setSelfPickupFullPaymentEnabled(true);
      setSelfPickupAdvancePaymentEnabled(true);
    }

    if (configs.shop_delivery) {
      setShopDeliveryEnabled(Boolean(configs.shop_delivery.enabled));
      setShopDeliveryFee(
        configs.shop_delivery.delivery_fee !== undefined
          ? String(configs.shop_delivery.delivery_fee)
          : (profile.delivery_fee ? String(profile.delivery_fee) : "30")
      );
      setShopDeliveryMinOrder(configs.shop_delivery.min_order !== undefined ? String(configs.shop_delivery.min_order) : "0");
      setShopDeliveryEstimatedTime(configs.shop_delivery.estimated_time || "30-45 mins");
      setShopDeliveryOnlinePaymentEnabled(configs.shop_delivery.online_payment_enabled !== undefined ? Boolean(configs.shop_delivery.online_payment_enabled) : true);
      setShopDeliveryCodEnabled(configs.shop_delivery.cod_enabled !== undefined ? Boolean(configs.shop_delivery.cod_enabled) : true);
      setShopDeliveryFullPaymentEnabled(configs.shop_delivery.full_payment_enabled !== undefined ? Boolean(configs.shop_delivery.full_payment_enabled) : true);
      setShopDeliveryAdvancePaymentEnabled(configs.shop_delivery.advance_payment_enabled !== undefined ? Boolean(configs.shop_delivery.advance_payment_enabled) : false);
      setShopDeliveryAdvance(configs.shop_delivery.advance_percentage !== undefined ? String(configs.shop_delivery.advance_percentage) : "20");
    } else {
      setShopDeliveryEnabled(Boolean(profile.provides_delivery));
      setShopDeliveryFee(profile.delivery_fee ? String(profile.delivery_fee) : "30");
      setShopDeliveryMinOrder("0");
      setShopDeliveryEstimatedTime("30-45 mins");
      setShopDeliveryOnlinePaymentEnabled(true);
      setShopDeliveryCodEnabled(true);
      setShopDeliveryFullPaymentEnabled(true);
      setShopDeliveryAdvancePaymentEnabled(false);
      setShopDeliveryAdvance("20");
    }

    if (configs.delivery_partner) {
      setDeliveryPartnerEnabled(configs.delivery_partner.enabled !== undefined ? Boolean(configs.delivery_partner.enabled) : true);
      setDeliveryPartnerOnlinePaymentEnabled(configs.delivery_partner.online_payment_enabled !== undefined ? Boolean(configs.delivery_partner.online_payment_enabled) : true);
      setDeliveryPartnerCodEnabled(configs.delivery_partner.cod_enabled !== undefined ? Boolean(configs.delivery_partner.cod_enabled) : true);
      setDeliveryPartnerFullPaymentEnabled(configs.delivery_partner.full_payment_enabled !== undefined ? Boolean(configs.delivery_partner.full_payment_enabled) : true);
      setDeliveryPartnerAdvancePaymentEnabled(configs.delivery_partner.advance_payment_enabled !== undefined ? Boolean(configs.delivery_partner.advance_payment_enabled) : false);
      setDeliveryPartnerAdvance(configs.delivery_partner.advance_percentage !== undefined ? String(configs.delivery_partner.advance_percentage) : "20");
    } else {
      setDeliveryPartnerEnabled(true);
      setDeliveryPartnerOnlinePaymentEnabled(true);
      setDeliveryPartnerCodEnabled(true);
      setDeliveryPartnerFullPaymentEnabled(true);
      setDeliveryPartnerAdvancePaymentEnabled(false);
      setDeliveryPartnerAdvance("20");
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.put("/vendors/me", data),
    onSuccess: () => {
      toast.success("Business settings saved successfully! ✨");
      queryClient.invalidateQueries({ queryKey: ["vendorProfile"] });
      queryClient.invalidateQueries({ queryKey: ["vendor"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["nearbyVendors"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
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
        estimated_time: bookingEstimatedTime || "1-2 days",
        online_payment_enabled: bookingOnlinePaymentEnabled,
        cod_enabled: bookingCodEnabled,
        full_payment_enabled: bookingFullPaymentEnabled,
        advance_payment_enabled: bookingAdvancePaymentEnabled,
      },
      self_pickup: {
        enabled: selfPickupEnabled,
        advance_percentage: Number(selfPickupAdvance) || 0,
        min_order: Number(selfPickupMinOrder) || 0,
        estimated_time: selfPickupEstimatedTime || "15 mins",
        online_payment_enabled: selfPickupOnlinePaymentEnabled,
        cod_enabled: selfPickupCodEnabled,
        full_payment_enabled: selfPickupFullPaymentEnabled,
        advance_payment_enabled: selfPickupAdvancePaymentEnabled,
      },
      shop_delivery: {
        enabled: shopDeliveryEnabled,
        delivery_fee: Number(shopDeliveryFee) || 0,
        min_order: Number(shopDeliveryMinOrder) || 0,
        estimated_time: shopDeliveryEstimatedTime || "30-45 mins",
        online_payment_enabled: shopDeliveryOnlinePaymentEnabled,
        cod_enabled: shopDeliveryCodEnabled,
        full_payment_enabled: shopDeliveryFullPaymentEnabled,
        advance_payment_enabled: shopDeliveryAdvancePaymentEnabled,
        advance_percentage: Number(shopDeliveryAdvance) || 0,
      },
      delivery_partner: {
        enabled: deliveryPartnerEnabled,
        online_payment_enabled: deliveryPartnerOnlinePaymentEnabled,
        cod_enabled: deliveryPartnerCodEnabled,
        full_payment_enabled: deliveryPartnerFullPaymentEnabled,
        advance_payment_enabled: deliveryPartnerAdvancePaymentEnabled,
        advance_percentage: Number(deliveryPartnerAdvance) || 0,
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
      delivery_radius_km: deliveryRadiusKm ? Number(deliveryRadiusKm) : 5,
      phone: contactPhone || null,
      tax_rate: taxRate !== "" ? Number(taxRate) : null,
      logo_url: logoUrl || null,
      banner_urls: bannerUrls,
      bank_account_number: bankAccountNumber || null,
      bank_ifsc: bankIfsc ? bankIfsc.toUpperCase().trim() : null,
      bank_account_holder_name: bankAccountHolderName || null,
      bank_name: bankName || null,
      upi_id: upiId || null,
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

        {/* 📍 Store Delivery & Customer Visibility Radius */}
        <Card className="rounded-3xl border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-card to-card shadow-xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-emerald-500/10 via-primary/5 to-transparent border-b border-border/50">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2.5 text-base font-bold">
                <div className="h-9 w-9 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center border border-emerald-500/20">
                  <Bike className="h-5 w-5" />
                </div>
                Store Delivery & Customer Visibility Radius (Sakti District)
              </CardTitle>
              <span className="text-xs font-black px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-mono">
                {deliveryRadiusKm || 5} km Radius
              </span>
            </div>
            <CardDescription className="text-xs">
              Configure how far your store delivers. Customers beyond this radius (e.g. other districts like Bilaspur) cannot place home delivery orders.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="deliveryRadiusKm" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Delivery & Visibility Radius (in km)
                </Label>
                <div className="flex items-center gap-1">
                  <Input
                    id="deliveryRadiusKm"
                    type="number"
                    min="0.5"
                    max="50"
                    step="0.5"
                    value={deliveryRadiusKm}
                    onChange={(e) => setDeliveryRadiusKm(e.target.value)}
                    className="h-8 w-20 rounded-xl text-xs font-bold text-center font-mono bg-background"
                  />
                  <span className="text-xs font-bold text-muted-foreground">km</span>
                </div>
              </div>

              {/* Slider */}
              <input
                type="range"
                min="1"
                max="50"
                step="0.5"
                value={deliveryRadiusKm || 5}
                onChange={(e) => setDeliveryRadiusKm(e.target.value)}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />

              {/* Quick Preset Chips */}
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  { label: "3 km (Hyperlocal)", val: "3" },
                  { label: "5 km (Town / City)", val: "5" },
                  { label: "10 km (Suburban)", val: "10" },
                  { label: "15 km (District Edge)", val: "15" },
                  { label: "25 km (Full Sakti District)", val: "25" },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => setDeliveryRadiusKm(preset.val)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
                      deliveryRadiusKm === preset.val
                        ? "bg-emerald-500 text-black border-emerald-500 shadow-sm"
                        : "bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-950 dark:text-emerald-200 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                Geo-Fencing & Out-of-Area Order Protection Active
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Only customers located within <strong className="text-foreground">{deliveryRadiusKm || 5} km</strong> of your shop can view your store in nearby discovery and place home delivery orders. Any customer attempting to order from distant locations (e.g. Bilaspur or other non-serviced districts) will be blocked at checkout with a clear out-of-range notification.
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
                <div className="space-y-4 mt-4 pt-4 border-t border-emerald-500/20">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <div className="space-y-1.5">
                      <Label htmlFor="bookingEstimatedTime" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-blue-500" /> Booking Fulfillment Time
                      </Label>
                      <Input
                        id="bookingEstimatedTime"
                        placeholder="e.g. 1-2 days, Same Day"
                        value={bookingEstimatedTime}
                        onChange={(e) => setBookingEstimatedTime(e.target.value)}
                        className="h-10 rounded-2xl text-xs bg-background font-medium"
                      />
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {["Same Day", "1 Day", "2 Days", "3-5 Days", "1 Week"].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setBookingEstimatedTime(preset)}
                            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition-colors ${
                              bookingEstimatedTime === preset
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-muted/60 text-muted-foreground border-border hover:bg-muted"
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Independent Payment Settings for Advance Booking */}
                  <div className="rounded-2xl bg-muted/40 border border-border/80 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5 text-emerald-500" /> Advance Booking Payment Controls
                      </h5>
                      <span className="text-[10px] text-muted-foreground font-medium">Independent Settings</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Online Payment */}
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border/60">
                        <div>
                          <p className="text-xs font-semibold flex items-center gap-1">
                            <Zap className="h-3 w-3 text-amber-500" /> Online / UPI Payment
                          </p>
                          <p className="text-[10px] text-muted-foreground">Razorpay / UPI / Cards</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={bookingOnlinePaymentEnabled}
                          onClick={() => setBookingOnlinePaymentEnabled((v) => !v)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                            bookingOnlinePaymentEnabled ? "bg-emerald-500" : "bg-muted-foreground/30"
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${bookingOnlinePaymentEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                        </button>
                      </div>

                      {/* Cash on Pickup / Booking */}
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border/60">
                        <div>
                          <p className="text-xs font-semibold flex items-center gap-1">
                            <Banknote className="h-3 w-3 text-emerald-500" /> Cash on Pickup / Booking
                          </p>
                          <p className="text-[10px] text-muted-foreground">Pay cash upon arrival</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={bookingCodEnabled}
                          onClick={() => setBookingCodEnabled((v) => !v)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                            bookingCodEnabled ? "bg-emerald-500" : "bg-muted-foreground/30"
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${bookingCodEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                        </button>
                      </div>

                      {/* Full Payment */}
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border/60">
                        <div>
                          <p className="text-xs font-semibold flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3 text-blue-500" /> Full Payment (100%)
                          </p>
                          <p className="text-[10px] text-muted-foreground">Allow full upfront payment</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={bookingFullPaymentEnabled}
                          onClick={() => setBookingFullPaymentEnabled((v) => !v)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                            bookingFullPaymentEnabled ? "bg-blue-600" : "bg-muted-foreground/30"
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${bookingFullPaymentEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                        </button>
                      </div>

                      {/* Advance Payment */}
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border/60">
                        <div>
                          <p className="text-xs font-semibold flex items-center gap-1">
                            <Percent className="h-3 w-3 text-purple-500" /> Advance Payment (%)
                          </p>
                          <p className="text-[10px] text-muted-foreground">Allow partial advance token</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={bookingAdvancePaymentEnabled}
                          onClick={() => setBookingAdvancePaymentEnabled((v) => !v)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                            bookingAdvancePaymentEnabled ? "bg-purple-600" : "bg-muted-foreground/30"
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${bookingAdvancePaymentEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                        </button>
                      </div>
                    </div>

                    {bookingAdvancePaymentEnabled && (
                      <div className="flex items-center gap-3 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
                        <Percent className="h-4 w-4 text-purple-600 shrink-0" />
                        <div className="flex-1">
                          <Label className="text-xs font-bold text-foreground">Advance Payment Percentage</Label>
                          <p className="text-[10px] text-muted-foreground">Upfront percentage customer pays when choosing Advance Payment.</p>
                        </div>
                        <div className="w-24">
                          <Input
                            type="number"
                            min="1"
                            max="99"
                            value={bookingAdvance}
                            onChange={(e) => setBookingAdvance(e.target.value)}
                            className="h-8 text-xs text-right font-bold bg-background"
                          />
                        </div>
                      </div>
                    )}
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
                <div className="space-y-4 mt-4 pt-4 border-t border-emerald-500/20">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <div className="space-y-1.5">
                      <Label htmlFor="selfPickupEstimatedTime" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-purple-500" /> Pickup Preparation Time
                      </Label>
                      <Input
                        id="selfPickupEstimatedTime"
                        placeholder="e.g. 15 mins, 30 mins"
                        value={selfPickupEstimatedTime}
                        onChange={(e) => setSelfPickupEstimatedTime(e.target.value)}
                        className="h-10 rounded-2xl text-xs bg-background font-medium"
                      />
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {["10-15 mins", "15-20 mins", "30 mins", "45 mins", "1 hour"].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setSelfPickupEstimatedTime(preset)}
                            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition-colors ${
                              selfPickupEstimatedTime === preset
                                ? "bg-purple-600 text-white border-purple-600"
                                : "bg-muted/60 text-muted-foreground border-border hover:bg-muted"
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Independent Payment Settings for Self Pickup */}
                  <div className="rounded-2xl bg-muted/40 border border-border/80 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5 text-emerald-500" /> Self Pickup Payment Controls
                      </h5>
                      <span className="text-[10px] text-muted-foreground font-medium">Independent Settings</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Online Payment */}
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border/60">
                        <div>
                          <p className="text-xs font-semibold flex items-center gap-1">
                            <Zap className="h-3 w-3 text-amber-500" /> Online / UPI Payment
                          </p>
                          <p className="text-[10px] text-muted-foreground">Razorpay / UPI / Cards</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={selfPickupOnlinePaymentEnabled}
                          onClick={() => setSelfPickupOnlinePaymentEnabled((v) => !v)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                            selfPickupOnlinePaymentEnabled ? "bg-emerald-500" : "bg-muted-foreground/30"
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${selfPickupOnlinePaymentEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                        </button>
                      </div>

                      {/* Cash on Pickup */}
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border/60">
                        <div>
                          <p className="text-xs font-semibold flex items-center gap-1">
                            <Banknote className="h-3 w-3 text-emerald-500" /> Cash on Pickup
                          </p>
                          <p className="text-[10px] text-muted-foreground">Pay cash when collecting</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={selfPickupCodEnabled}
                          onClick={() => setSelfPickupCodEnabled((v) => !v)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                            selfPickupCodEnabled ? "bg-emerald-500" : "bg-muted-foreground/30"
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${selfPickupCodEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                        </button>
                      </div>

                      {/* Full Payment */}
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border/60">
                        <div>
                          <p className="text-xs font-semibold flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3 text-blue-500" /> Full Payment (100%)
                          </p>
                          <p className="text-[10px] text-muted-foreground">Allow full payment upfront</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={selfPickupFullPaymentEnabled}
                          onClick={() => setSelfPickupFullPaymentEnabled((v) => !v)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                            selfPickupFullPaymentEnabled ? "bg-blue-600" : "bg-muted-foreground/30"
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${selfPickupFullPaymentEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                        </button>
                      </div>

                      {/* Advance Payment */}
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border/60">
                        <div>
                          <p className="text-xs font-semibold flex items-center gap-1">
                            <Percent className="h-3 w-3 text-purple-500" /> Advance Payment (%)
                          </p>
                          <p className="text-[10px] text-muted-foreground">Allow partial advance token</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={selfPickupAdvancePaymentEnabled}
                          onClick={() => setSelfPickupAdvancePaymentEnabled((v) => !v)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                            selfPickupAdvancePaymentEnabled ? "bg-purple-600" : "bg-muted-foreground/30"
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${selfPickupAdvancePaymentEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                        </button>
                      </div>
                    </div>

                    {selfPickupAdvancePaymentEnabled && (
                      <div className="flex items-center gap-3 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
                        <Percent className="h-4 w-4 text-purple-600 shrink-0" />
                        <div className="flex-1">
                          <Label className="text-xs font-bold text-foreground">Pickup Advance Percentage</Label>
                          <p className="text-[10px] text-muted-foreground">Upfront percentage customer pays when choosing Advance Payment.</p>
                        </div>
                        <div className="w-24">
                          <Input
                            type="number"
                            min="1"
                            max="99"
                            value={selfPickupAdvance}
                            onChange={(e) => setSelfPickupAdvance(e.target.value)}
                            className="h-8 text-xs text-right font-bold bg-background"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Option 3: Shop Direct Delivery */}
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
                <div className="space-y-4 mt-4 pt-4 border-t border-emerald-500/20">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="shopDeliveryEstimatedTime" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-teal-500" /> Store Direct Delivery Time
                      </Label>
                      <Input
                        id="shopDeliveryEstimatedTime"
                        placeholder="e.g. 30-45 mins, 1-2 hours"
                        value={shopDeliveryEstimatedTime}
                        onChange={(e) => setShopDeliveryEstimatedTime(e.target.value)}
                        className="h-10 rounded-2xl text-xs bg-background font-medium"
                      />
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {["20-30 mins", "30-45 mins", "45-60 mins", "1-2 hours", "Same Day"].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setShopDeliveryEstimatedTime(preset)}
                            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition-colors ${
                              shopDeliveryEstimatedTime === preset
                                ? "bg-teal-600 text-white border-teal-600"
                                : "bg-muted/60 text-muted-foreground border-border hover:bg-muted"
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Independent Payment Settings for Shop Direct Delivery */}
                  <div className="rounded-2xl bg-muted/40 border border-border/80 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5 text-emerald-500" /> Shop Direct Delivery Payment Controls
                      </h5>
                      <span className="text-[10px] text-muted-foreground font-medium">Independent Settings</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Online Payment */}
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border/60">
                        <div>
                          <p className="text-xs font-semibold flex items-center gap-1">
                            <Zap className="h-3 w-3 text-amber-500" /> Online / UPI Payment
                          </p>
                          <p className="text-[10px] text-muted-foreground">Razorpay / UPI / Cards</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={shopDeliveryOnlinePaymentEnabled}
                          onClick={() => setShopDeliveryOnlinePaymentEnabled((v) => !v)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                            shopDeliveryOnlinePaymentEnabled ? "bg-emerald-500" : "bg-muted-foreground/30"
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${shopDeliveryOnlinePaymentEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                        </button>
                      </div>

                      {/* Cash on Delivery */}
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border/60">
                        <div>
                          <p className="text-xs font-semibold flex items-center gap-1">
                            <Banknote className="h-3 w-3 text-emerald-500" /> Cash on Delivery (COD)
                          </p>
                          <p className="text-[10px] text-muted-foreground">Pay cash to delivery boy</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={shopDeliveryCodEnabled}
                          onClick={() => setShopDeliveryCodEnabled((v) => !v)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                            shopDeliveryCodEnabled ? "bg-emerald-500" : "bg-muted-foreground/30"
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${shopDeliveryCodEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                        </button>
                      </div>

                      {/* Full Payment */}
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border/60">
                        <div>
                          <p className="text-xs font-semibold flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3 text-blue-500" /> Full Payment (100%)
                          </p>
                          <p className="text-[10px] text-muted-foreground">Allow full upfront payment</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={shopDeliveryFullPaymentEnabled}
                          onClick={() => setShopDeliveryFullPaymentEnabled((v) => !v)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                            shopDeliveryFullPaymentEnabled ? "bg-blue-600" : "bg-muted-foreground/30"
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${shopDeliveryFullPaymentEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                        </button>
                      </div>

                      {/* Advance Payment */}
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border/60">
                        <div>
                          <p className="text-xs font-semibold flex items-center gap-1">
                            <Percent className="h-3 w-3 text-purple-500" /> Advance Payment (%)
                          </p>
                          <p className="text-[10px] text-muted-foreground">Allow partial advance token</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={shopDeliveryAdvancePaymentEnabled}
                          onClick={() => setShopDeliveryAdvancePaymentEnabled((v) => !v)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                            shopDeliveryAdvancePaymentEnabled ? "bg-purple-600" : "bg-muted-foreground/30"
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${shopDeliveryAdvancePaymentEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                        </button>
                      </div>
                    </div>

                    {shopDeliveryAdvancePaymentEnabled && (
                      <div className="flex items-center gap-3 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
                        <Percent className="h-4 w-4 text-purple-600 shrink-0" />
                        <div className="flex-1">
                          <Label className="text-xs font-bold text-foreground">Delivery Advance Percentage</Label>
                          <p className="text-[10px] text-muted-foreground">Upfront percentage customer pays when choosing Advance Payment.</p>
                        </div>
                        <div className="w-24">
                          <Input
                            type="number"
                            min="1"
                            max="99"
                            value={shopDeliveryAdvance}
                            onChange={(e) => setShopDeliveryAdvance(e.target.value)}
                            className="h-8 text-xs text-right font-bold bg-background"
                          />
                        </div>
                      </div>
                    )}
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-foreground">4. VegaMart Home Delivery</h4>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        deliveryPartnerEnabled ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"
                      }`}>
                        {deliveryPartnerEnabled ? "Active" : "Disabled"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      VegaMart platform fleet delivery riders automatically pick up from your store and deliver to the customer.
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

              {deliveryPartnerEnabled && (
                <div className="space-y-4 mt-4 pt-4 border-t border-emerald-500/20">
                  <div className="flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-[11px] text-muted-foreground border border-border/50">
                    <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                    <span>
                      Delivery fees and rider dispatch are centrally managed by the platform, while your store controls the accepted payment methods below.
                    </span>
                  </div>

                  {/* Independent Payment Settings for VegaMart Home Delivery */}
                  <div className="rounded-2xl bg-muted/40 border border-border/80 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5 text-emerald-500" /> Home Delivery Payment Controls
                      </h5>
                      <span className="text-[10px] text-muted-foreground font-medium">Independent Settings</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Online Payment */}
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border/60">
                        <div>
                          <p className="text-xs font-semibold flex items-center gap-1">
                            <Zap className="h-3 w-3 text-amber-500" /> Online / UPI Payment
                          </p>
                          <p className="text-[10px] text-muted-foreground">Razorpay / UPI / Cards</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={deliveryPartnerOnlinePaymentEnabled}
                          onClick={() => setDeliveryPartnerOnlinePaymentEnabled((v) => !v)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                            deliveryPartnerOnlinePaymentEnabled ? "bg-emerald-500" : "bg-muted-foreground/30"
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${deliveryPartnerOnlinePaymentEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                        </button>
                      </div>

                      {/* Cash on Delivery */}
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border/60">
                        <div>
                          <p className="text-xs font-semibold flex items-center gap-1">
                            <Banknote className="h-3 w-3 text-emerald-500" /> Cash on Delivery (COD)
                          </p>
                          <p className="text-[10px] text-muted-foreground">Pay cash upon delivery</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={deliveryPartnerCodEnabled}
                          onClick={() => setDeliveryPartnerCodEnabled((v) => !v)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                            deliveryPartnerCodEnabled ? "bg-emerald-500" : "bg-muted-foreground/30"
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${deliveryPartnerCodEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                        </button>
                      </div>

                      {/* Full Payment */}
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border/60">
                        <div>
                          <p className="text-xs font-semibold flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3 text-blue-500" /> Full Payment (100%)
                          </p>
                          <p className="text-[10px] text-muted-foreground">Allow full payment upfront</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={deliveryPartnerFullPaymentEnabled}
                          onClick={() => setDeliveryPartnerFullPaymentEnabled((v) => !v)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                            deliveryPartnerFullPaymentEnabled ? "bg-blue-600" : "bg-muted-foreground/30"
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${deliveryPartnerFullPaymentEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                        </button>
                      </div>

                      {/* Advance Payment */}
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border/60">
                        <div>
                          <p className="text-xs font-semibold flex items-center gap-1">
                            <Percent className="h-3 w-3 text-purple-500" /> Advance Payment (%)
                          </p>
                          <p className="text-[10px] text-muted-foreground">Allow partial advance token</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={deliveryPartnerAdvancePaymentEnabled}
                          onClick={() => setDeliveryPartnerAdvancePaymentEnabled((v) => !v)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                            deliveryPartnerAdvancePaymentEnabled ? "bg-purple-600" : "bg-muted-foreground/30"
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${deliveryPartnerAdvancePaymentEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                        </button>
                      </div>
                    </div>

                    {deliveryPartnerAdvancePaymentEnabled && (
                      <div className="flex items-center gap-3 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
                        <Percent className="h-4 w-4 text-purple-600 shrink-0" />
                        <div className="flex-1">
                          <Label className="text-xs font-bold text-foreground">Delivery Advance Percentage</Label>
                          <p className="text-[10px] text-muted-foreground">Upfront percentage customer pays when choosing Advance Payment.</p>
                        </div>
                        <div className="w-24">
                          <Input
                            type="number"
                            min="1"
                            max="99"
                            value={deliveryPartnerAdvance}
                            onChange={(e) => setDeliveryPartnerAdvance(e.target.value)}
                            className="h-8 text-xs text-right font-bold bg-background"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
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

        {/* Bank Account & Direct Payout Details */}
        <Card className="rounded-3xl border-border shadow-xl bg-card/60 backdrop-blur-sm overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                <Landmark className="h-5 w-5 text-emerald-600" />
                Bank Account & Direct Payouts
              </CardTitle>
              {profile.razorpay_account_id ? (
                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full w-fit flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Razorpay Route Linked ({profile.razorpay_account_id})
                </span>
              ) : profile.bank_account_number && profile.bank_ifsc ? (
                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full w-fit flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Direct Settlement Configured
                </span>
              ) : (
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full w-fit">
                  ⚠️ Payout Details Incomplete
                </span>
              )}
            </div>
            <CardDescription className="text-xs">
              Receive customer payments directly in your bank account or UPI ID rather than platform escrow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-950 dark:text-emerald-200 flex items-start gap-2.5">
              <Info className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                When customers pay online for your orders, your net earnings (Item Revenue − Store Commission) will be transferred automatically to this bank account via Razorpay Route / IMPS settlements.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="bankAccountHolderName"
                  className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                >
                  Account Holder Name
                </Label>
                <Input
                  id="bankAccountHolderName"
                  type="text"
                  placeholder="e.g. Ramesh Kumar"
                  value={bankAccountHolderName}
                  onChange={(e) => setBankAccountHolderName(e.target.value)}
                  className="h-10 rounded-2xl text-xs bg-muted/40"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="bankName"
                  className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                >
                  Bank Name
                </Label>
                <Input
                  id="bankName"
                  type="text"
                  placeholder="e.g. State Bank of India / HDFC Bank"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="h-10 rounded-2xl text-xs bg-muted/40"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="bankAccountNumber"
                  className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                >
                  Bank Account Number
                </Label>
                <Input
                  id="bankAccountNumber"
                  type="text"
                  placeholder="e.g. 50100234567890"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value.trim())}
                  className="h-10 rounded-2xl text-xs bg-muted/40 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="bankIfsc"
                  className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                >
                  IFSC Code (11 characters)
                </Label>
                <Input
                  id="bankIfsc"
                  type="text"
                  placeholder="e.g. HDFC0001234"
                  maxLength={11}
                  value={bankIfsc}
                  onChange={(e) => setBankIfsc(e.target.value.toUpperCase().trim())}
                  className="h-10 rounded-2xl text-xs bg-muted/40 uppercase font-mono tracking-wider"
                />
              </div>
            </div>

            <div className="space-y-1.5 max-w-md pt-1">
              <Label
                htmlFor="upiId"
                className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between"
              >
                <span>Direct UPI ID / VPA (Optional)</span>
                <span className="text-[10px] text-muted-foreground font-normal lowercase">for instant UPI payouts</span>
              </Label>
              <Input
                id="upiId"
                type="text"
                placeholder="e.g. yourname@okhdfcbank or 9876543210@upi"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value.trim())}
                className="h-10 rounded-2xl text-xs bg-muted/40 font-mono"
              />
            </div>
          </CardContent>
        </Card>

        {/* Notifications & Live Alert Preferences */}
        <Card className="rounded-3xl border-border bg-card/50 backdrop-blur-sm shadow-sm overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Real-Time Order Notifications & Sound
            </CardTitle>
            <CardDescription className="text-xs">
              Configure how you get notified when customers place new orders or ring your bell.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Audio Alert Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-muted/40 border border-border">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">
                    Order Chime & Audio Alarm
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full">
                    Recommended
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Plays a loud, attention-grabbing chime whenever a new customer order arrives.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {notificationControls && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={notificationControls.testAudioAlert}
                    className="h-9 px-3 rounded-xl border-border hover:bg-muted text-xs font-bold gap-1.5 cursor-pointer"
                  >
                    <Volume2 className="h-4 w-4 text-primary" />
                    Test Sound
                  </Button>
                )}

                {notificationControls && (
                  <button
                    type="button"
                    onClick={() =>
                      notificationControls.setSoundEnabled(!notificationControls.isSoundEnabled)
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      notificationControls.isSoundEnabled ? "bg-emerald-500" : "bg-muted-foreground/30"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        notificationControls.isSoundEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                )}
              </div>
            </div>

            {/* Desktop Notifications Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-muted/40 border border-border">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">
                    Browser Desktop Notifications
                  </span>
                  {notificationControls?.isDesktopNotificationEnabled ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                      Enabled 🟢
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">
                      Not Enabled
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Receive popup alerts even when your browser is minimized or you are viewing another tab.
                </p>
              </div>

              {notificationControls && !notificationControls.isDesktopNotificationEnabled && (
                <Button
                  type="button"
                  size="sm"
                  onClick={notificationControls.requestDesktopNotificationPermission}
                  className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold shrink-0 cursor-pointer shadow-sm"
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  Enable Alerts
                </Button>
              )}
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
