import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Home, Compass, ShoppingBag, User, ShoppingCart } from "lucide-react";
import { useCart } from "@/context/cart-context";

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { itemCount } = useCart();

  const TABS = [
    { id: "home", label: "Home", icon: Home, to: "/", match: (p: string) => p === "/" },
    {
      id: "vendors",
      label: "Vendors",
      icon: Compass,
      to: "/street-vendors",
      match: (p: string) =>
        p.startsWith("/street-vendors") || p.startsWith("/vendors") || p.startsWith("/search"),
    },
    {
      id: "orders",
      label: "Orders",
      icon: ShoppingBag,
      to: "/orders",
      match: (p: string) =>
        p.startsWith("/orders") || p.startsWith("/order") || p.startsWith("/track"),
    },
    {
      id: "cart",
      label: "Cart",
      icon: ShoppingCart,
      to: "/cart",
      match: (p: string) => p.startsWith("/cart") || p.startsWith("/checkout"),
    },
    {
      id: "profile",
      label: "Profile",
      icon: User,
      to: "/profile",
      match: (p: string) =>
        p.startsWith("/profile") ||
        p.startsWith("/login") ||
        p.startsWith("/signup") ||
        p.startsWith("/wishlist") ||
        p.startsWith("/addresses") ||
        p.startsWith("/vendor") ||
        p.startsWith("/admin"),
    },
  ];

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed inset-x-0 bottom-0 z-[120] pointer-events-none"
    >
      <div className="pointer-events-auto fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-border pb-safe">
        <div className="flex justify-around items-center h-20 px-4">
          {TABS.map((t) => {
            const active = t.match(pathname);
            const Icon = t.icon;
            return (
              <Link
                key={t.id}
                to={t.to}
                aria-current={active ? "page" : undefined}
                aria-label={t.label}
                className={`flex flex-col items-center gap-1.5 w-16 transition-colors tap-highlight-none ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <span className="relative">
                  <Icon className="h-6 w-6" strokeWidth={active ? 2.4 : 2} />
                  {t.id === "cart" && itemCount > 0 && (
                    <motion.span
                      key={itemCount}
                      initial={{ scale: 0.4 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 14 }}
                      className="absolute -top-1.5 -right-2 bg-rose-600 text-white h-4 min-w-4 px-1 rounded-full flex items-center justify-center text-[9px] font-black border-2 border-background shadow-lg"
                    >
                      {itemCount > 99 ? "99+" : itemCount}
                    </motion.span>
                  )}
                  {active && (
                    <motion.span
                      layoutId="customer-bottom-nav-dot"
                      className="absolute -bottom-2 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary"
                    />
                  )}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider">{t.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
