import React, { createContext, useContext, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Product, Vendor, CouponValidation } from "@/types";
import { api } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { toast } from "sonner";
import { Store, AlertTriangle, Trash2, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const MAX_ITEM_QTY = 20;

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  selectedVariant?: string;
}

interface CartContextType {
  items: CartItem[];
  vendorId: string | null;
  vendorName: string | null;
  subtotal: number;
  deliveryFee: number;
  tax: number;
  discount: number;
  total: number;
  itemCount: number;
  appliedCoupon: string | null;
  addToCart: (product: Product, quantity?: number, variantLabel?: string) => void;
  updateQuantity: (id: string, qty: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  applyCoupon: (code: string) => Promise<{ success: boolean; message: string }>;
  removeCoupon: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState<number>(0);

  // Store Change Modal State
  const [pendingItem, setPendingItem] = useState<{
    product: Product;
    quantity: number;
    variantLabel?: string;
  } | null>(null);

  const { data: settingsRes } = useQuery({
    queryKey: ["publicSettings"],
    queryFn: () => api.get<any>("/settings/public"),
  });
  const settings = settingsRes?.data || {};

  const multiStoreEnabled = !!settings["platform.multi_store_checkout_enabled"];

  // Restore cart from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("vegamart_cart");
      if (stored) {
        setItems(JSON.parse(stored));
      }
    } catch (err) {
      void err;
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("vegamart_cart", JSON.stringify(items));
    } catch (err) {
      void err;
    }
  }, [items]);

  const firstProduct = items.length > 0 ? items[0]?.product : null;
  const vendorId = firstProduct?.vendor_id || (firstProduct as any)?.vendorId || null;
  const currentVendorName =
    firstProduct?.vendor?.business_name ||
    (firstProduct?.vendor as any)?.name ||
    (vendorId ? vendorId.replace(/-/g, " ").toUpperCase() : "Current Store");

  const addToCartDirectly = (product: Product, quantity = 1, variantLabel?: string) => {
    setItems((prev) => {
      const existingIndex = prev.findIndex(
        (i) => i.product.id === product.id && i.selectedVariant === variantLabel,
      );

      if (existingIndex > -1) {
        const next = [...prev];
        const existing = next[existingIndex];
        if (existing.quantity + quantity > MAX_ITEM_QTY) {
          toast.warning(`Maximum ${MAX_ITEM_QTY} units per item`);
          next[existingIndex] = { ...existing, quantity: MAX_ITEM_QTY };
          return next;
        }
        next[existingIndex].quantity += quantity;
        return next;
      }

      return [...prev, { id: `c_${Date.now()}`, product, quantity, selectedVariant: variantLabel }];
    });
  };

  const addToCart = (product: Product, quantity = 1, variantLabel?: string) => {
    const pVendorId = product.vendor_id || (product as any).vendorId;
    const prevVendorId = items[0]?.product?.vendor_id || (items[0]?.product as any)?.vendorId;

    // Single Store Enforcement Rule
    if (
      !multiStoreEnabled &&
      items.length > 0 &&
      prevVendorId &&
      pVendorId &&
      prevVendorId !== pVendorId
    ) {
      // Trigger Store Changed Modal Popup
      setPendingItem({ product, quantity, variantLabel });
      return;
    }

    addToCartDirectly(product, quantity, variantLabel);
    toast.success(`Added ${product.name} to cart`);
  };

  const handleConfirmClearAndAdd = () => {
    if (!pendingItem) return;
    setItems([
      {
        id: `c_${Date.now()}`,
        product: pendingItem.product,
        quantity: pendingItem.quantity,
        selectedVariant: pendingItem.variantLabel,
      },
    ]);
    setAppliedCoupon(null);
    setCouponDiscount(0);
    toast.success(`Cart cleared & added ${pendingItem.product.name}`);
    setPendingItem(null);
  };

  const updateQuantity = (id: string, qty: number) => {
    if (qty <= 0) {
      removeItem(id);
      return;
    }
    const capped = Math.min(MAX_ITEM_QTY, qty);
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, quantity: capped } : item)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setItems([]);
    setAppliedCoupon(null);
    setCouponDiscount(0);
  };

  const applyCoupon = async (code: string) => {
    try {
      const res = await api.post<CouponValidation>("/coupons/validate", {
        code,
        items: items.map((item) => ({ product_id: item.product.id, quantity: item.quantity })),
      });
      if (!res.success || !res.data) {
        throw new Error(res.error?.message || "Invalid or expired coupon code");
      }
      const coupon = res.data;
      setAppliedCoupon(code);
      setCouponDiscount(coupon.discount || 0);
      return { success: true, message: "Coupon applied successfully" };
    } catch (err: any) {
      return { success: false, message: err.message || "Failed to apply coupon" };
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
  };

  const { isAuthenticated, isGuest, user } = useAuth();
  const canPreview = !!isAuthenticated && !isGuest && user?.role === "customer" && items.length > 0;

  // Authoritative totals come from the backend checkout preview endpoint, which
  // applies the exact same per-vendor delivery fee / free-delivery threshold /
  // tax / coupon rules as order creation. The frontend never re-implements those
  // business rules; the settings-based estimate below is only a fallback for
  // guests, who cannot call the preview endpoint.
  const previewRes = useQuery({
    queryKey: ["checkout-preview", items, appliedCoupon],
    queryFn: () =>
      api.post<{
        items_subtotal?: number;
        delivery_fee?: number;
        tax?: number;
        discount?: number;
        total?: number;
      }>("/checkout/preview", {
        coupon_code: appliedCoupon ?? undefined,
        items: items.map((item) => ({ product_id: item.product.id, quantity: item.quantity })),
      }),
    enabled: canPreview,
  });
  const preview = previewRes?.data?.data;

  const localSubtotal = items.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const subtotal = preview ? Number(preview.items_subtotal ?? localSubtotal) : localSubtotal;
  // Guest fallback mirrors the backend checkout `computeDeliveryFee`: the
  // vendor's own delivery_fee/free_delivery_min_order win, otherwise the global
  // settings apply, and a subtotal at/above the free-delivery threshold waives it.
  const vendorProfile = firstProduct?.vendor as (Vendor & { delivery_fee?: number }) | undefined;
  const vendorFee =
    typeof vendorProfile?.delivery_fee === "number" && vendorProfile.delivery_fee > 0
      ? vendorProfile.delivery_fee
      : null;
  const vendorFreeThreshold =
    typeof vendorProfile?.free_delivery_min_order === "number"
      ? vendorProfile.free_delivery_min_order
      : null;
  const settingsDeliveryFee = (settings["platform.delivery_fee"] as number) || 30;
  const settingsFreeThreshold = (settings["platform.free_delivery_threshold"] as number) || 0;
  const freeDeliveryThreshold = vendorFreeThreshold ?? settingsFreeThreshold;
  const baseDeliveryFee = vendorFee ?? settingsDeliveryFee;
  const deliveryFee = preview
    ? Number(preview.delivery_fee ?? 0)
    : subtotal > 0
      ? freeDeliveryThreshold > 0 && subtotal >= freeDeliveryThreshold
        ? 0
        : baseDeliveryFee
      : 0;
  const taxRate = (settings["platform.tax_rate_percent"] as number) || 5;
  const tax = preview ? Number(preview.tax ?? 0) : Math.round((subtotal * taxRate) / 100);
  const discount = preview ? Number(preview.discount ?? couponDiscount) : couponDiscount;
  const total = preview
    ? Number(preview.total ?? 0)
    : Math.max(0, subtotal + deliveryFee + tax - discount);
  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);

  const pendingVendorName =
    pendingItem?.product?.vendor?.business_name ||
    (pendingItem?.product?.vendor as any)?.name ||
    "New Store";

  return (
    <CartContext.Provider
      value={{
        items,
        vendorId,
        vendorName: currentVendorName,
        subtotal,
        deliveryFee,
        tax,
        discount,
        total,
        itemCount,
        appliedCoupon,
        addToCart,
        updateQuantity,
        removeItem,
        clearCart,
        applyCoupon,
        removeCoupon,
      }}
    >
      {children}

      {/* Store Changed Modal Popup */}
      <Dialog open={!!pendingItem} onOpenChange={(open) => !open && setPendingItem(null)}>
        <DialogContent className="rounded-3xl border-border max-w-md p-6">
          <DialogHeader className="text-center space-y-3">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-amber-500/10 text-amber-500">
              <Store className="h-8 w-8" />
            </div>
            <DialogTitle className="font-display text-xl font-bold">
              अलग Store का Product / Store Changed
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
              आपके Cart में पहले से <span className="font-bold text-foreground">{currentVendorName}</span> का सामान मौजूद है।
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs space-y-2 text-foreground">
            <p className="font-medium text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              एक समय में सिर्फ एक ही Store से Order किया जा सकता है।
            </p>
            <p className="text-muted-foreground text-[11px]">
              पहले वाले store का cart clear करें या उसी store से shopping जारी रखें।
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            <button
              onClick={handleConfirmClearAndAdd}
              className="w-full rounded-2xl bg-amber-500 text-slate-950 px-4 py-3 text-xs font-black uppercase tracking-wider shadow-lg hover:bg-amber-400 flex items-center justify-center gap-2 transition-all"
            >
              <Trash2 className="h-4 w-4" />
              पहले वाला Cart Clear करें और {pendingVendorName} से Item जोड़ें
            </button>

            <button
              onClick={() => setPendingItem(null)}
              className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-xs font-bold text-muted-foreground hover:text-foreground transition-all"
            >
              पुराने Store ({currentVendorName}) से Shopping जारी रखें
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
