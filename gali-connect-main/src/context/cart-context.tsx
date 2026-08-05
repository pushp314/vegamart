import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import type { Product } from "@/types";
import { api } from "@/lib/api";
import { toast } from "sonner";

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

  // Restore cart from localStorage on mount (prevents SSR hydration mismatch)
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
  const vendorName = vendorId ? vendorId.replace(/-/g, " ").toUpperCase() : null;

  const addToCart = (product: Product, quantity = 1, variantLabel?: string) => {
    setItems((prev) => {
      const pVendorId = product.vendor_id || (product as any).vendorId;
      const prevVendorId = prev[0]?.product?.vendor_id || (prev[0]?.product as any)?.vendorId;
      // Hyperlocal Single-Vendor Rule: If adding item from a different vendor, reset cart
      if (prev.length > 0 && prevVendorId && pVendorId && prevVendorId !== pVendorId) {
        toast.warning("Cart cleared — items must be from a single vendor");
        return [{ id: `c_${Date.now()}`, product, quantity, selectedVariant: variantLabel }];
      }

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
      const res = await api.post<any>("/coupons/validate", {
        code,
        items: items.map((item) => ({ product_id: item.product.id, quantity: item.quantity })),
      });
      if (!res.success || !res.data) {
        throw new Error(res.error?.message || "Invalid or expired coupon code");
      }
      const coupon = res.data;
      if (!coupon) throw new Error("Invalid or expired coupon code");

      setAppliedCoupon(code);

      const calculatedDiscount =
        coupon.discount != null && Number.isFinite(Number(coupon.discount)) ? Number(coupon.discount) : 0;

      setCouponDiscount(calculatedDiscount);
      return { success: true, message: `Coupon applied: ₹${calculatedDiscount.toFixed(2)} off!` };
    } catch (err: any) {
      setAppliedCoupon(null);
      setCouponDiscount(0);
      return {
        success: false,
        message: err?.message || err.response?.data?.message || "Invalid or expired coupon code",
      };
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
  };

  const subtotal = useMemo(
    () => items.reduce((acc, item) => acc + item.product.price * item.quantity, 0),
    [items],
  );

  const deliveryFee = subtotal > 199 || subtotal === 0 ? 0 : 25;
  const tax = Math.round(subtotal * 0.05);
  const discount = Math.min(couponDiscount, subtotal);
  const total = Math.max(0, subtotal + deliveryFee + tax - discount);
  const itemCount = useMemo(() => items.reduce((acc, item) => acc + item.quantity, 0), [items]);

  return (
    <CartContext.Provider
      value={{
        items,
        vendorId,
        vendorName,
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
