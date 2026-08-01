import React, { createContext, useContext, useState, useEffect } from "react";
import type { Product } from "@/types";

interface WishlistContextType {
  wishlist: Product[];
  isWishlisted: (productId: string) => boolean;
  toggleWishlist: (product: Product) => void;
  removeWishlist: (productId: string) => void;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [wishlist, setWishlist] = useState<Product[]>([]);

  // Restore wishlist from localStorage on mount (prevents SSR hydration mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem("vegamart_wishlist");
      if (stored) {
        setWishlist(JSON.parse(stored));
      }
    } catch (err) {
      void err;
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("vegamart_wishlist", JSON.stringify(wishlist));
    } catch (err) {
      void err;
    }
  }, [wishlist]);

  const isWishlisted = (productId: string) => {
    return wishlist.some((p) => p.id === productId);
  };

  const toggleWishlist = (product: Product) => {
    setWishlist((prev) => {
      if (prev.some((p) => p.id === product.id)) {
        return prev.filter((p) => p.id !== product.id);
      }
      return [...prev, product];
    });
  };

  const removeWishlist = (productId: string) => {
    setWishlist((prev) => prev.filter((p) => p.id !== productId));
  };

  return (
    <WishlistContext.Provider value={{ wishlist, isWishlisted, toggleWishlist, removeWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
}
