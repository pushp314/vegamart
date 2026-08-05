import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Home, Compass, ShoppingBag, Bell, User } from "lucide-react";
import { useCart } from "@/context/cart-context";
import { useNotifications } from "@/hooks/use-notifications";

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { itemCount } = useCart();
  const { unreadCount } = useNotifications();

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
        p.startsWith("/orders") || p.startsWith("/checkout") || p.startsWith("/order"),
      badge: itemCount,
    },
    {
      id: "notifications",
      label: "Updates",
      icon: Bell,
      to: "/notifications",
      match: (p: string) => p.startsWith("/notifications"),
      badge: unreadCount,
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
      <div className="pb-safe px-3 pb-3">
        <div className="pointer-events-auto mx-auto max-w-md rounded-3xl bg-card/95 backdrop-blur border shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)]">
          <ul className="grid grid-cols-5 px-2 py-2">
            {TABS.map((t) => {
              const active = t.match(pathname);
              const Icon = t.icon;
              return (
                <li key={t.id} className="min-w-0">
                  <Link
                    to={t.to}
                    aria-current={active ? "page" : undefined}
                    aria-label={t.label}
                    className="flex flex-col items-center justify-center gap-1 py-1.5 tap-highlight-none"
                  >
                    <span
                      className={`relative grid h-10 w-10 place-items-center rounded-full transition-colors ${
                        active
                          ? "text-primary"
                          : "text-foreground/70"
                      }`}
                    >
                      <motion.span
                        layout
                        transition={{ type: "spring", stiffness: 400, damping: 24 }}
                        className={`absolute inset-0 rounded-full ${
                          active ? "bg-primary/10" : "bg-transparent"
                        }`}
                      />
                      <motion.span
                        key={t.id + (active ? "-on" : "-off")}
                        initial={active ? { scale: 0.6 } : { scale: 1 }}
                        animate={{ scale: active ? [0.7, 1.15, 1] : 1 }}
                        transition={{ duration: active ? 0.45 : 0.2, ease: "easeOut" }}
                        className="relative"
                      >
                        <Icon className="h-[21px] w-[21px]" strokeWidth={active ? 2.4 : 2} />
                      </motion.span>
                      {t.badge && t.badge > 0 ? (
                        <span className="absolute -top-0.5 -right-0.5 grid h-[17px] min-w-[17px] px-1 place-items-center rounded-full bg-saffron text-[10px] font-bold text-primary-foreground ring-2 ring-card">
                          {t.badge > 99 ? "99+" : t.badge}
                        </span>
                      ) : null}
                      {active && (
                        <motion.span
                          layoutId="bottom-nav-dot"
                          className="absolute -bottom-1 h-1 w-1 rounded-full bg-primary"
                        />
                      )}
                    </span>
                    <span
                      className={`text-[10px] font-semibold transition-colors ${
                        active ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {t.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </nav>
  );
}
