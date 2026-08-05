import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Store,
  Package,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Bike,
  Power,
  Loader2,
  X,
  Hourglass,
  Ban,
  UploadCloud,
  FileCheck2,
  MapPin,
  Star,
  BarChart3,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { PortalLayout } from "@/components/layout/portal-layout";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LayoutDashboard, Store as StoreIcon, ClipboardList, Wallet } from "lucide-react";
import type { Category, Product } from "@/types";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { DailyLocationForm } from "@/components/vendor/daily-location-form";
import { VendorReviews } from "@/components/vendor/VendorReviews";
import { VendorAnalytics } from "@/components/vendor/VendorAnalytics";

export const Route = createFileRoute("/vendor")({
  head: () => ({ meta: [{ title: "Vendor Portal — Vegamart" }] }),
  component: VendorParentLayout,
});

function VendorParentLayout() {
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  if (pathname === "/vendor/roaming" || pathname === "/vendor/login") {
    return <Outlet />;
  }

  return <VendorDashboard />;
}

type VendorTab =
  | "overview"
  | "products"
  | "orders"
  | "earnings"
  | "location"
  | "reviews"
  | "coupons"
  | "analytics";

function VendorDashboard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (user && user.role !== "vendor") {
      toast.error("Access restricted: Vendor account required.");
      if (user.role === "delivery") navigate({ to: "/delivery" });
      else if (user.role === "admin" || user.role === "super_admin") navigate({ to: "/admin" });
      else navigate({ to: "/" });
    }
  }, [user, navigate]);

  const [activeTab, setActiveTab] = useState<VendorTab>("overview");

  // Fetch Vendor Profile
  const { data: vendorRes, isLoading: vendorLoading } = useQuery({
    queryKey: ["vendorProfile"],
    queryFn: () => api.get<{ data: any }>("/vendors/me"),
    enabled: isAuthenticated,
  });

  const vendor = vendorRes?.data?.data || vendorRes?.data;

  // Redirect to roaming portal if this is a street vendor
  useEffect(() => {
    const vType = vendor?.profile?.vendor_type || vendor?.vendor_type;
    if (vendor && vType === "roaming") {
      navigate({ to: "/vendor/roaming" });
    }
  }, [vendor, navigate]);

  // Fetch Vendor Products (include inactive so the vendor sees their full catalog)
  const { data: productsRes, isLoading: prodsLoading } = useQuery({
    queryKey: ["vendorProducts", vendor?.id],
    queryFn: () => api.get<Product[]>("/products/me?include_inactive=true"),
    enabled: !!vendor?.id && vendor?.status === "approved",
  });

  const productList: Product[] = productsRes?.data || [];

  // Fetch Categories
  const { data: categoriesRes } = useQuery({
    queryKey: ["vendorCategories"],
    queryFn: () => api.get<Category[]>("/categories"),
    enabled: !!vendor?.id && vendor?.status === "approved",
  });

  const categoriesList: Category[] = categoriesRes?.data || [];

  // Fetch Vendor Orders
  const { data: ordersRes, isLoading: ordersLoading } = useQuery({
    queryKey: ["vendorOrders"],
    queryFn: () => api.get<any[]>("/orders/vendor"),
    enabled: !!vendor?.id && vendor?.status === "approved",
  });

  const vendorOrders = ordersRes?.data || [];

  // Fetch KYC
  const { data: kycRes, isLoading: kycLoading } = useQuery({
    queryKey: ["vendorKYC"],
    queryFn: () => api.get<{ data: any }>("/vendors/me/kyc"),
    enabled: !!vendor?.id,
  });

  const kyc = kycRes?.data?.data || kycRes?.data;

  // Fetch Earnings
  const { data: earningsRes, isLoading: earningsLoading } = useQuery({
    queryKey: ["vendorEarnings"],
    queryFn: () => api.get<{ data: any }>("/vendors/me/earnings"),
    enabled: !!vendor?.id && vendor?.status === "approved",
  });

  const earnings = earningsRes?.data?.data || {};

  // Toggle Availability Mutation
  const toggleAvailabilityMutation = useMutation({
    mutationFn: (isOpen: boolean) => api.put("/vendors/me/availability", { is_open: isOpen }),
    onSuccess: (_, isOpen) => {
      queryClient.invalidateQueries({ queryKey: ["vendorProfile"] });
      toast.success(isOpen ? "Store is now LIVE 🟢" : "Store marked as CLOSED 🔴");
    },
  });

  // Product Add/Edit Modal
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [prodName, setProdName] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodMrp, setProdMrp] = useState("");
  const [prodUnit, setProdUnit] = useState("1 kg");
  const [prodCategoryId, setProdCategoryId] = useState("");
  const [prodDescription, setProdDescription] = useState("");
  const [prodImageFile, setProdImageFile] = useState<File | null>(null);
  const [prodImageUrl, setProdImageUrl] = useState("");
  const [prodImageChanged, setProdImageChanged] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [suggestedImages, setSuggestedImages] = useState<string[]>([]);
  const [isSearchingImages, setIsSearchingImages] = useState(false);

  useEffect(() => {
    if (!productModalOpen || !prodName || prodName.length < 3) {
      setSuggestedImages([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingImages(true);
      try {
        const res = await api.get<Product[]>(`/products?q=${encodeURIComponent(prodName)}`);
        if (res.success && res.data) {
          const images = new Set<string>();
          res.data.forEach((p) => {
            if (p.images?.[0]?.url) {
              images.add(p.images[0].url);
            }
          });
          setSuggestedImages(Array.from(images));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearchingImages(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [prodName, productModalOpen]);

  const saveProductMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = editingProduct
        ? await api.patch<Product>(`/products/${editingProduct.id}`, data)
        : await api.post<Product>("/products", data);
      if (!res.success || !res.data) {
        throw new Error(res.error?.message || "Failed to save product");
      }
      return res.data as Product;
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["vendorProducts"] });
      toast.success("Product removed from catalog");
    },
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) => {
      const VENDOR_ORDER_STATUS_MAP: Record<string, string> = {
        accepted: "CONFIRMED",
        preparing: "PREPARING",
        packed: "PACKED",
        ready_for_pickup: "READY_FOR_PICKUP",
        out_for_delivery: "OUT_FOR_DELIVERY",
        delivered: "DELIVERED",
      };
      return api.patch(`/vendors/orders/${orderId}/status`, {
        status: VENDOR_ORDER_STATUS_MAP[status] || status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorOrders"] });
      toast.success("Order status updated");
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: any) => api.put("/vendors/me/profile", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorProfile"] });
      toast.success("Subscription activated successfully!");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update subscription");
    },
  });

  if (authLoading || vendorLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-500" /> Loading vendor portal...
        </div>
      </div>
    );
  }

  // Not logged in or not a vendor
  if (!isAuthenticated || !vendor) {
    return (
      <div className="min-h-screen bg-background text-foreground pb-28 md:pb-16">
        <AppHeader title="Vendor Portal" />
        <main className="mx-auto max-w-md px-4 pt-16 text-center space-y-4">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/10 border border-border border-emerald-500/20 text-emerald-500">
            <Store className="h-8 w-8" />
          </div>
          <h2 className="font-display text-xl font-bold">Become a Vegamart Vendor</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            You don't have an active vendor account registered with your profile yet.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <Link
              to="/become-vendor"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-black  font-bold text-xs px-6 py-3 shadow-md hover:bg-emerald-400"
            >
              Apply as a Vendor
            </Link>
            <Link to="/login" className="text-xs text-muted-foreground hover:underline">
              Sign in with another account
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // APPROVAL GUARD: Status Pending
  if (vendor.status === "pending") {
    if (kycLoading) {
      return (
        <div className="p-10 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-emerald-500" />
        </div>
      );
    }

    if (!kyc || kyc.status === "rejected") {
      return (
        <div className="min-h-screen bg-background text-foreground pb-28 md:pb-16">
          <AppHeader title="Vendor Portal" subtitle="KYC Verification" />
          <main className="mx-auto max-w-lg px-4 pt-8 space-y-6">
            <VendorKYCForm
              vendor={vendor}
              initialData={kyc}
              onSuccess={() => queryClient.invalidateQueries({ queryKey: ["vendorKYC"] })}
            />
          </main>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background text-foreground pb-28 md:pb-16">
        <AppHeader title="Vendor Portal" subtitle="Application Status" />
        <main className="mx-auto max-w-lg px-4 pt-12 space-y-6">
          <div className="rounded-3xl border border-border bg-muted/50 border-border p-8 text-center space-y-4 shadow-2xl">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-500/10 border border-border border-amber-500/20 text-amber-600">
              <Hourglass className="h-8 w-8 animate-pulse" />
            </div>
            <span className="inline-flex items-center gap-1 bg-amber-50 border border-border border-amber-200 text-amber-800 text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              Verification Under Review
            </span>
            <h2 className="font-display text-xl font-bold">Admin Review in Progress</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your vendor KYC documents for <strong>"{vendor.business_name}"</strong> have been
              submitted and are currently waiting for admin approval.
            </p>
            <div className="rounded-2xl bg-accent/50 p-4 text-left text-xs space-y-2 border border-border">
              <div className="font-semibold text-foreground border-b pb-1">Submitted KYC</div>
              <div>
                <strong>Document Type:</strong> {kyc.document_type}
              </div>
              <div>
                <strong>Status:</strong>{" "}
                <span className="text-amber-600 font-bold uppercase">Pending Verification</span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Once approved by our platform administrator, you will be able to list products, toggle
              store availability, and receive live orders.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // APPROVAL GUARD: Status Rejected / Suspended
  if (vendor.status === "rejected" || vendor.status === "suspended") {
    return (
      <div className="min-h-screen bg-background text-foreground pb-28 md:pb-16">
        <AppHeader title="Vendor Portal" />
        <main className="mx-auto max-w-md px-4 pt-16 text-center space-y-4">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-rose-500/10 border border-border border-rose-500/20 text-rose-500">
            <Ban className="h-8 w-8" />
          </div>
          <h2 className="font-display text-xl font-bold text-destructive">
            Vendor Application {vendor.status === "rejected" ? "Rejected" : "Suspended"}
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your vendor account for <strong>"{vendor.business_name}"</strong> is currently{" "}
            {vendor.status}. Please contact Vegamart support for assistance.
          </p>
        </main>
      </div>
    );
  }

  // SUBSCRIPTION GUARD
  if (
    vendor.status === "approved" &&
    (!vendor.subscription_plan || vendor.subscription_plan === "none")
  ) {
    return (
      <div className="min-h-screen bg-background text-foreground pb-28 md:pb-16">
        <AppHeader title="Choose Subscription" subtitle="Vendor Portal" />
        <main className="mx-auto max-w-4xl px-4 pt-12">
          <div className="text-center space-y-4 mb-10">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/10 border border-border border-emerald-500/20 text-emerald-500">
              <Store className="h-8 w-8" />
            </div>
            <h2 className="font-display text-2xl font-bold">You're Approved! 🎉</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Your vendor application has been approved. Please select a subscription plan to unlock
              your dashboard and start selling.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Basic Plan */}
            <div className="rounded-3xl border border-border bg-muted/50 border-border p-6 shadow-2xl hover:shadow-md transition-shadow relative">
              <div className="space-y-4">
                <h3 className="font-display text-xl font-bold">Starter Plan</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black">₹0</span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Perfect for new vendors starting their online journey.
                </p>
                <ul className="space-y-2 text-sm pt-4 border-t">
                  <li className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 text-black" /> Up to 50
                    active products
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 text-black" /> 10%
                    Platform Commission
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 text-black" /> Standard
                    Support
                  </li>
                </ul>
                <button
                  onClick={() => updateProfileMutation.mutate({ subscription_plan: "starter" })}
                  disabled={updateProfileMutation.isPending}
                  className="w-full mt-6 rounded-2xl bg-accent/50 text-foreground font-bold py-3 hover:bg-accent/50/80 transition-colors"
                >
                  {updateProfileMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  ) : (
                    "Start for Free"
                  )}
                </button>
              </div>
            </div>

            {/* Pro Plan */}
            <div className="rounded-3xl border-2 border-primary bg-muted/50 border-border p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-emerald-500 text-black  text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                Recommended
              </div>
              <div className="space-y-4">
                <h3 className="font-display text-xl font-bold text-emerald-500">Pro Plan</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-emerald-500">₹999</span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  For growing businesses that need more volume.
                </p>
                <ul className="space-y-2 text-sm pt-4 border-t">
                  <li className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 text-black" /> Unlimited
                    products
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 text-black" /> 5%
                    Platform Commission
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 text-black" /> Priority
                    Support 24/7
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 text-black" /> Featured
                    in Search
                  </li>
                </ul>
                <button
                  onClick={() => updateProfileMutation.mutate({ subscription_plan: "pro" })}
                  disabled={updateProfileMutation.isPending}
                  className="w-full mt-6 rounded-2xl bg-emerald-500 text-black  font-bold py-3 hover:bg-emerald-400 transition-colors shadow-md hover:shadow-lg"
                >
                  {updateProfileMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  ) : (
                    "Upgrade to Pro"
                  )}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // APPROVED VENDOR DASHBOARD
  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProdName("");
    setProdPrice("");
    setProdMrp("");
    setProdUnit("1 kg");
    setProdCategoryId(categoriesList[0]?.id || "");
    setProdDescription("");
    setProdImageFile(null);
    setProdImageUrl("");
    setProdImageChanged(false);
    setProductModalOpen(true);
  };

  const handleOpenEditProduct = (p: Product) => {
    setEditingProduct(p);
    setProdName(p.name);
    setProdPrice(p.price.toString());
    setProdMrp(p.mrp.toString());
    setProdUnit(p.unit);
    setProdCategoryId(p.category_id);
    setProdDescription(p.description || "");
    setProdImageFile(null);
    setProdImageUrl(p.images?.[0]?.url || "");
    setProdImageChanged(false);
    setProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName || !prodPrice || !prodUnit) {
      toast.error("Please fill in required product details");
      return;
    }
    if (!prodCategoryId) {
      toast.error("Please select a category");
      return;
    }

    const price = parseFloat(prodPrice);
    const mrp = parseFloat(prodMrp || prodPrice);
    if (Number.isNaN(price) || price < 0 || Number.isNaN(mrp) || mrp < 0) {
      toast.error("Please enter a valid price");
      return;
    }

    // 1. Upload image (if a new file was picked)
    let attachImageUrl: string | null = null;
    if (prodImageFile) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", prodImageFile);
        formData.append("folder", "products");
        const uploadRes = await api.post<{ url: string; key: string }>("/uploads", formData);
        if (uploadRes.success && uploadRes.data?.url) {
          attachImageUrl = uploadRes.data.url;
        } else {
          toast.error(uploadRes.error?.message || "Image upload failed");
          return;
        }
      } finally {
        setIsUploading(false);
      }
    } else if (prodImageChanged && prodImageUrl) {
      attachImageUrl = prodImageUrl;
    }

    // 2. Create or update the product
    try {
      const saved = await saveProductMutation.mutateAsync({
        name: prodName.trim(),
        price,
        mrp,
        unit: prodUnit.trim(),
        category_id: prodCategoryId,
        description: prodDescription.trim() || undefined,
      });

      // 3. Attach the image to the product (single-image form, so replace old ones on edit)
      if (attachImageUrl && saved?.id) {
        if (editingProduct && editingProduct.images?.length) {
          for (const img of editingProduct.images) {
            await api.delete(`/products/${editingProduct.id}/images/${img.id}`);
          }
        }
        await api.post(`/products/${saved.id}/images`, { images: [{ url: attachImageUrl }] });
      }

      queryClient.invalidateQueries({ queryKey: ["vendorProducts"] });
      toast.success(editingProduct ? "Product updated!" : "Product listed successfully!");
      setProductModalOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save product");
    }
  };

  const navItems = [
    {
      id: "overview",
      title: "Overview",
      icon: LayoutDashboard,
      onClick: () => setActiveTab("overview"),
    },
    { id: "products", title: "Products", icon: Package, onClick: () => setActiveTab("products") },
    { id: "orders", title: "Orders", icon: ClipboardList, onClick: () => setActiveTab("orders") },
    { id: "earnings", title: "Earnings", icon: Wallet, onClick: () => setActiveTab("earnings") },
    { id: "reviews", title: "Reviews", icon: Star, onClick: () => setActiveTab("reviews") },
    {
      id: "analytics",
      title: "Analytics",
      icon: BarChart3,
      onClick: () => setActiveTab("analytics"),
    },
    ...(vendor?.roaming
      ? [
          {
            id: "location",
            title: "Location",
            icon: MapPin,
            onClick: () => setActiveTab("location" as VendorTab),
          },
        ]
      : []),
  ];

  return (
    <PortalLayout
      navItems={navItems}
      activeItemId={activeTab}
      portalName="Vendor"
      userEmail={vendor.business_name}
    >
      <div className="space-y-6">
        {/* Status Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl bg-muted/50 border-border border border-border p-5 shadow-2xl">
          <div className="flex items-center gap-3">
            <div
              className={`grid h-12 w-12 place-items-center rounded-2xl ${
                vendor.is_open
                  ? "bg-emerald-500/10 border border-border border-emerald-500/20 text-emerald-500"
                  : "bg-accent/50 text-muted-foreground"
              }`}
            >
              <Store className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-lg font-bold">{vendor.business_name}</h1>
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-500/10 border border-border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="h-3 w-3" /> Approved
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {vendor.category} • {vendor.address}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-3 sm:pt-0">
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Plan: {vendor.subscription_plan?.toUpperCase() || "BASIC"}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">
                Store Status
              </div>
              <div className="text-xs font-bold flex items-center gap-1.5 justify-end">
                <span
                  className={`h-2 w-2 rounded-full ${
                    vendor.is_open ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                  }`}
                />
                {vendor.is_open ? "LIVE (Taking Orders)" : "CLOSED"}
              </div>
            </div>

            <button
              onClick={() => toggleAvailabilityMutation.mutate(!vendor.is_open)}
              disabled={toggleAvailabilityMutation.isPending}
              className={`flex items-center gap-2 rounded-2xl font-bold text-xs px-4 py-2.5 shadow-2xl transition-all ${
                vendor.is_open
                  ? "bg-rose-500/10 border border-border border-rose-500/20 text-rose-800 hover:bg-rose-200"
                  : "bg-emerald-500 text-black  hover:bg-emerald-400"
              }`}
            >
              <Power className="h-4 w-4" />
              {vendor.is_open ? "Close Store" : "Go LIVE"}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "overview"
                ? "bg-emerald-500 text-black  shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("products")}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "products"
                ? "bg-emerald-500 text-black  shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
          >
            My Products ({productList.length})
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "orders"
                ? "bg-emerald-500 text-black  shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
          >
            Live Orders ({vendorOrders.length})
          </button>
          <button
            onClick={() => setActiveTab("earnings")}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "earnings"
                ? "bg-emerald-500 text-black  shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
          >
            Earnings
          </button>
          {vendor?.roaming && (
            <button
              onClick={() => setActiveTab("location")}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === "location"
                  ? "bg-emerald-500 text-black  shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              <MapPin className="inline h-3 w-3 mr-1" />
              Location
            </button>
          )}
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-3xl border border-border bg-muted/50 border-border p-4 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Lifetime Earnings
                </div>
                <div className="font-display text-xl font-bold text-emerald-600">
                  ₹{earnings.total_payout || 0}
                </div>
              </div>
              <div className="rounded-3xl border border-border bg-muted/50 border-border p-4 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Active Orders
                </div>
                <div className="font-display text-xl font-bold text-foreground">
                  {vendorOrders.length}
                </div>
              </div>
              <div className="rounded-3xl border border-border bg-muted/50 border-border p-4 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Listed Products
                </div>
                <div className="font-display text-xl font-bold text-foreground">
                  {productList.length}
                </div>
              </div>
              <div className="rounded-3xl border border-border bg-muted/50 border-border p-4 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Rating
                </div>
                <div className="font-display text-xl font-bold text-amber-600">
                  ★ {vendor.rating || 4.8}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-muted/50 border-border p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-bold">Catalog Management</h3>
                <button
                  onClick={handleOpenAddProduct}
                  className="flex items-center gap-1.5 rounded-2xl bg-emerald-500 text-black  font-semibold text-xs px-4 py-2 shadow-xs hover:bg-emerald-400"
                >
                  <Plus className="h-4 w-4" /> Add Product
                </button>
              </div>

              {prodsLoading ? (
                <div className="flex items-center justify-center p-8 text-muted-foreground text-xs gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-500" /> Loading products...
                </div>
              ) : productList.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground space-y-2">
                  <Package className="h-8 w-8 mx-auto text-muted-foreground/60" />
                  <p>No products listed yet. Click "Add Product" to start selling.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {productList.slice(0, 4).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-2xl border border-border p-3 bg-muted"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            p.images?.[0]?.url ||
                            "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=300"
                          }
                          alt={p.name}
                          className="h-10 w-10 rounded-xl object-cover"
                        />
                        <div>
                          <div className="font-bold text-xs truncate max-w-[140px]">{p.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            ₹{p.price} / {p.unit}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleOpenEditProduct(p)}
                        className="p-1.5 rounded-xl border border-border hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PRODUCTS TAB */}
        {activeTab === "products" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Store Catalog</h2>
              <button
                onClick={handleOpenAddProduct}
                className="flex items-center gap-1.5 rounded-2xl bg-emerald-500 text-black  font-semibold text-xs px-4 py-2 shadow-xs hover:bg-emerald-400"
              >
                <Plus className="h-4 w-4" /> Add Product
              </button>
            </div>

            {productList.length === 0 ? (
              <div className="rounded-3xl border border-border bg-muted/50 border-border p-12 text-center space-y-3">
                <Package className="h-10 w-10 mx-auto text-emerald-500" />
                <h3 className="font-bold text-sm">Your store catalog is empty</h3>
                <p className="text-xs text-muted-foreground">
                  List your fresh products for nearby customers.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {productList.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-3xl border border-border bg-muted/50 border-border p-4 space-y-3 shadow-2xl"
                  >
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
                      <div className="text-xs font-bold text-emerald-600 mt-0.5">
                        ₹{p.price}{" "}
                        <span className="text-muted-foreground font-normal text-[11px]">
                          / {p.unit}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <button
                        onClick={() => handleOpenEditProduct(p)}
                        className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-border py-1.5 text-xs font-semibold hover:bg-accent/50"
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
        )}

        {/* ORDERS TAB */}
        {activeTab === "orders" && (
          <div className="space-y-4">
            <h2 className="font-display text-lg font-bold">Incoming & Live Orders</h2>

            {vendorOrders.length === 0 ? (
              <div className="rounded-3xl border border-border bg-muted/50 border-border p-12 text-center space-y-3">
                <Bike className="h-10 w-10 mx-auto text-emerald-500" />
                <h3 className="font-bold text-sm">No incoming orders</h3>
                <p className="text-xs text-muted-foreground">
                  New customer orders will appear here in real-time.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {vendorOrders.map((o: any) => {
                  const getNextStatuses = (currentStatus: string) => {
                    const statusFlow: Record<
                      string,
                      { status: string; label: string; color: string }[]
                    > = {
                      PENDING: [
                        {
                          status: "accepted",
                          label: "Accept",
                          color: "bg-emerald-500/10 text-emerald-800 hover:bg-emerald-200",
                        },
                      ],
                      CONFIRMED: [
                        {
                          status: "preparing",
                          label: "Start Preparing",
                          color: "bg-blue-100 text-blue-800 hover:bg-blue-200",
                        },
                      ],
                      PREPARING: [
                        {
                          status: "packed",
                          label: "Mark Packed",
                          color: "bg-indigo-100 text-indigo-800 hover:bg-indigo-200",
                        },
                      ],
                      PACKED: [
                        {
                          status: "ready_for_pickup",
                          label: "Ready for Pickup",
                          color: "bg-cyan-100 text-cyan-800 hover:bg-cyan-200",
                        },
                      ],
                      READY_FOR_PICKUP: [
                        {
                          status: "out_for_delivery",
                          label: "Out for Delivery",
                          color: "bg-orange-100 text-orange-800 hover:bg-orange-200",
                        },
                      ],
                      OUT_FOR_DELIVERY: [
                        {
                          status: "delivered",
                          label: "Delivered",
                          color: "bg-green-100 text-green-800 hover:bg-green-200",
                        },
                      ],
                    };
                    return statusFlow[currentStatus] || [];
                  };
                  const nextStatuses = getNextStatuses(o.status);

                  return (
                    <div
                      key={o.id}
                      className="rounded-3xl border border-border bg-muted/50 border-border p-4 space-y-3 shadow-2xl"
                    >
                      <div className="flex items-center justify-between border-b pb-3">
                        <div>
                          <div className="font-bold text-sm">
                            Order #{o.order_number || o.id.slice(0, 8)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {o.customer_name || "Customer"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-emerald-600 text-sm">₹{o.total}</div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            {o.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-muted-foreground">Update Status:</span>
                        <div className="flex gap-1 flex-wrap justify-end">
                          {nextStatuses.length > 0 ? (
                            nextStatuses.map((ns) => (
                              <button
                                key={ns.status}
                                onClick={() =>
                                  updateOrderStatusMutation.mutate({
                                    orderId: o.id,
                                    status: ns.status,
                                  })
                                }
                                className={`px-2.5 py-1 rounded-xl border border-border text-[11px] font-bold ${ns.color}`}
                              >
                                {ns.label}
                              </button>
                            ))
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic">
                              {o.status === "DELIVERED" ? "Completed" : "Awaiting delivery partner"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* LOCATION TAB */}
        {activeTab === "location" && vendor?.roaming && (
          <div className="max-w-lg">
            <DailyLocationForm vendorProfile={vendor} />
          </div>
        )}

        {/* REVIEWS TAB */}
        {activeTab === "reviews" && <VendorReviews />}

        {/* ANALYTICS TAB */}
        {activeTab === "analytics" && <VendorAnalytics />}

        {/* EARNINGS TAB */}
        {activeTab === "earnings" && (
          <div className="space-y-6">
            {earningsLoading ? (
              <div className="flex items-center justify-center p-12 text-muted-foreground text-xs gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-amber-600" /> Calculating payouts...
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-3xl border border-border bg-muted/50 border-border p-5 space-y-2 shadow-2xl">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Gross Revenue
                    </div>
                    <div className="font-display text-2xl font-bold text-foreground">
                      ₹{earnings.total_revenue || 0}
                    </div>
                    <div className="text-[11px] text-muted-foreground">Total order value</div>
                  </div>
                  <div className="rounded-3xl border border-border bg-muted/50 border-border p-5 space-y-2 shadow-2xl">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-rose-500/80">
                      Platform Fees
                    </div>
                    <div className="font-display text-2xl font-bold text-rose-500">
                      -₹{earnings.total_commission || 0}
                    </div>
                    <div className="text-[11px] text-muted-foreground">Vegamart commission</div>
                  </div>
                  <div className="rounded-3xl border border-border bg-muted/50 border-border p-5 space-y-2 shadow-2xl bg-emerald-500/10 border-emerald-200">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                      Net Payout
                    </div>
                    <div className="font-display text-2xl font-bold text-emerald-600">
                      ₹{earnings.total_payout || 0}
                    </div>
                    <div className="text-[11px] text-emerald-700 font-semibold">
                      Ready for withdrawal
                    </div>
                  </div>
                  <div className="rounded-3xl border border-border bg-muted/50 border-border p-5 space-y-2 shadow-2xl">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                      Pending Payout
                    </div>
                    <div className="font-display text-2xl font-bold text-amber-600">
                      ₹{earnings.pending_payout || 0}
                    </div>
                    <div className="text-[11px] text-amber-700 font-semibold">Active orders</div>
                  </div>
                </div>

                <div className="rounded-3xl border border-border bg-muted/50 border-border p-6 space-y-4">
                  <h3 className="font-display text-lg font-bold">Recent Transactions</h3>
                  {!earnings.recent_transactions || earnings.recent_transactions.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground text-xs">
                      No recent transactions found.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {earnings.recent_transactions.map((t: any) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between p-4 rounded-2xl border border-border bg-muted"
                        >
                          <div>
                            <div className="font-bold text-sm">{t.order_number}</div>
                            <div className="text-[10px] uppercase font-semibold text-muted-foreground mt-0.5">
                              {new Date(t.created_at).toLocaleDateString()} • {t.status}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-emerald-600">+₹{t.total}</div>
                            <div className="text-[10px] text-muted-foreground">Gross Amount</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Product Add/Edit Modal */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-muted/50 border-border border border-border rounded-3xl p-6 shadow-glow">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-display text-base font-bold">
                {editingProduct ? "Edit Product" : "List New Product"}
              </h3>
              <button
                onClick={() => setProductModalOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full hover:bg-accent/50 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="mt-4 space-y-4" onSubmit={handleSaveProduct}>
              {/* Image Upload */}
              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16 overflow-hidden rounded-2xl bg-accent border border-border shrink-0 flex items-center justify-center">
                  {prodImageFile ? (
                    <img
                      src={URL.createObjectURL(prodImageFile)}
                      alt="preview"
                      className="h-full w-full object-cover"
                    />
                  ) : prodImageUrl ? (
                    <img src={prodImageUrl} alt="preview" className="h-full w-full object-cover" />
                  ) : (
                    <UploadCloud className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Product Image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setProdImageFile(e.target.files[0]);
                        setProdImageChanged(true);
                      }
                    }}
                    className="w-full text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                  />
                </div>
              </div>

              <label className="block">
                <div className="mb-1 text-xs font-semibold text-foreground">Product Name *</div>
                <input
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  placeholder="e.g. Fresh Red Tomatoes"
                  className="w-full rounded-2xl bg-accent/50 border border-border h-11 px-3 text-sm outline-none"
                />
              </label>

              <label className="block">
                <div className="mb-1 text-xs font-semibold text-foreground">Description</div>
                <textarea
                  value={prodDescription}
                  onChange={(e) => setProdDescription(e.target.value)}
                  placeholder="Describe your product (optional)"
                  rows={3}
                  className="w-full rounded-2xl bg-accent/50 border border-border px-3 py-2 text-sm outline-none resize-none"
                />
              </label>

              {/* Suggested Images */}
              {isSearchingImages ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Finding suggested images...
                </div>
              ) : suggestedImages.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground">
                    Suggested Images (Click to use)
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                    {suggestedImages.map((url, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setProdImageUrl(url);
                          setProdImageFile(null); // Clear local file if any
                          setProdImageChanged(true);
                        }}
                        className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border hover:ring-2 hover:ring-emerald-500 transition-all"
                      >
                        <img
                          src={url}
                          alt={`Suggestion ${idx}`}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <div className="mb-1 text-xs font-semibold text-foreground">
                    Selling Price (₹) *
                  </div>
                  <input
                    type="number"
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    placeholder="40"
                    className="w-full rounded-2xl bg-accent/50 border border-border h-11 px-3 text-sm outline-none"
                  />
                </label>
                <label className="block">
                  <div className="mb-1 text-xs font-semibold text-foreground">MRP (₹)</div>
                  <input
                    type="number"
                    value={prodMrp}
                    onChange={(e) => setProdMrp(e.target.value)}
                    placeholder="50"
                    className="w-full rounded-2xl bg-accent/50 border border-border h-11 px-3 text-sm outline-none"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <div className="mb-1 text-xs font-semibold text-foreground">Unit *</div>
                  <input
                    value={prodUnit}
                    onChange={(e) => setProdUnit(e.target.value)}
                    placeholder="1 kg"
                    className="w-full rounded-2xl bg-accent/50 border border-border h-11 px-3 text-sm outline-none"
                  />
                </label>
                <label className="block">
                  <div className="mb-1 text-xs font-semibold text-foreground">Category</div>
                  <select
                    value={prodCategoryId}
                    onChange={(e) => setProdCategoryId(e.target.value)}
                    className="w-full rounded-2xl bg-accent/50 border border-border h-11 px-3 text-sm outline-none font-semibold text-foreground"
                  >
                    <option value="" disabled>
                      Select category
                    </option>
                    {categoriesList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  className="flex-1 rounded-2xl border border-border bg-accent/50 py-2.5 text-xs font-semibold text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveProductMutation.isPending || isUploading}
                  className="flex-1 rounded-2xl bg-emerald-500 text-black  font-semibold text-xs py-2.5 flex items-center justify-center gap-2"
                >
                  {saveProductMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Save Product"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Product?</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove "{deleteTarget?.name}" from your catalog? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose className="inline-flex items-center justify-center rounded-2xl border border-border bg-accent/50 px-4 py-2.5 text-xs font-semibold text-muted-foreground">
              Cancel
            </DialogClose>
            <button
              onClick={() => deleteTarget && deleteProductMutation.mutate(deleteTarget.id)}
              disabled={deleteProductMutation.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-destructive px-4 py-2.5 text-xs font-semibold text-white"
            >
              {deleteProductMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete Product"
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}

function EmptyState({ icon: Icon, title, desc }: any) {
  return (
    <div className="rounded-3xl border border-border border-dashed border-border p-10 text-center flex flex-col items-center justify-center bg-muted/50 border-border">
      <Icon className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
      <h3 className="font-semibold text-foreground text-sm">{title}</h3>
      <p className="text-xs text-muted-foreground mt-1 max-w-[200px] leading-relaxed">{desc}</p>
    </div>
  );
}

function VendorKYCForm({ vendor, initialData, onSuccess }: any) {
  const [docType, setDocType] = useState(initialData?.document_type || "Aadhaar");
  const [docNum, setDocNum] = useState(initialData?.document_number || "");
  const [fssai, setFssai] = useState(initialData?.fssai_license || "");
  const [gst, setGst] = useState(initialData?.gst_number || "");

  const mutation = useMutation({
    mutationFn: (data: any) => api.post("/vendors/me/kyc", data),
    onSuccess: () => {
      toast.success("KYC documents submitted successfully");
      onSuccess();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to submit KYC");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docNum) {
      toast.error("Document Number is required");
      return;
    }
    mutation.mutate({
      document_type: docType,
      document_number: docNum,
      fssai_license: fssai || undefined,
      gst_number: gst || undefined,
    });
  };

  return (
    <div className="rounded-3xl border border-border bg-muted/50 border-border p-6 shadow-2xl space-y-6">
      <div className="space-y-1">
        <h2 className="font-display text-lg font-bold">Complete KYC Verification</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          As a registered marketplace, we require identity verification for all vendors.
        </p>
      </div>

      {initialData?.status === "rejected" && (
        <div className="rounded-2xl bg-rose-500/10 p-4 border border-border border-rose-200 space-y-2">
          <div className="font-bold text-rose-800 text-xs inline-flex items-center gap-1.5">
            <Ban className="h-4 w-4" /> Previous KYC Rejected
          </div>
          <p className="text-xs text-rose-600">
            {initialData.rejection_reason || "Please upload valid documents and try again."}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">
            Document Type *
          </label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="w-full rounded-2xl border border-border bg-muted/80 px-4 py-3 text-sm focus:bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="Aadhaar">Aadhaar Card</option>
            <option value="PAN">PAN Card</option>
            <option value="Passport">Passport</option>
            <option value="Driving License">Driving License</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">
            Document Number *
          </label>
          <input
            type="text"
            value={docNum}
            onChange={(e) => setDocNum(e.target.value)}
            placeholder={`Enter ${docType} number`}
            className="w-full rounded-2xl border border-border bg-muted/80 px-4 py-3 text-sm focus:bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">
            FSSAI License (Optional)
          </label>
          <input
            type="text"
            value={fssai}
            onChange={(e) => setFssai(e.target.value)}
            placeholder="Food safety license (if applicable)"
            className="w-full rounded-2xl border border-border bg-muted/80 px-4 py-3 text-sm focus:bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">
            GST Number (Optional)
          </label>
          <input
            type="text"
            value={gst}
            onChange={(e) => setGst(e.target.value)}
            placeholder="GSTIN (if registered)"
            className="w-full rounded-2xl border border-border bg-muted/80 px-4 py-3 text-sm focus:bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded-2xl bg-emerald-500 text-black px-4 py-3.5 text-sm font-bold  shadow-2xl disabled:opacity-50 mt-2 inline-flex items-center justify-center gap-2"
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileCheck2 className="h-4 w-4" />
          )}
          Submit for Verification
        </button>
      </form>
    </div>
  );
}
