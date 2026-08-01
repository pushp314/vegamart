import { Link, useRouterState } from "@tanstack/react-router";
import { Home, MapPin, ShoppingBag, User } from "lucide-react";
import { useCart } from "@/context/cart-context";

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { itemCount } = useCart();

  const TABS = [
    { id: "home", label: "Home", icon: Home, to: "/", match: (p: string) => p === "/" },
    {
      id: "live",
      label: "Live Vendors",
      icon: MapPin,
      to: "/vendors",
      match: (p: string) =>
        p.startsWith("/vendors") || p.startsWith("/products") || p.startsWith("/search"),
    },
    {
      id: "cart",
      label: "Cart",
      icon: ShoppingBag,
      to: "/cart",
      match: (p: string) =>
        p.startsWith("/cart") || p.startsWith("/checkout") || p.startsWith("/order"),
      badge: itemCount,
    },
    {
      id: "account",
      label: "Account",
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
          <ul className="grid grid-cols-4 px-2 py-2">
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
                      className={`relative grid h-10 w-10 place-items-center rounded-full transition-all ${
                        active
                          ? "bg-primary text-primary-foreground shadow-[0_6px_20px_-6px_color-mix(in_oklab,var(--primary)_60%,transparent)]"
                          : "text-foreground/70"
                      }`}
                    >
                      <Icon className="h-[20px] w-[20px]" strokeWidth={active ? 2.4 : 2} />
                      {t.badge && t.badge > 0 ? (
                        <span className="absolute -top-1 -right-1 grid h-[18px] min-w-[18px] px-1 place-items-center rounded-full bg-saffron text-[10px] font-bold text-primary-foreground ring-2 ring-card">
                          {t.badge}
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={`text-[11px] font-semibold transition-colors ${
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
