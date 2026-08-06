import { useEffect } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  MapPin,
  Search,
  ShoppingCart,
  Heart,
  User,
  Sparkles,
  Mic,
  Store,
  ShieldAlert,
  Bell,
  Bike,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/system/logo";
import { useCart } from "@/context/cart-context";
import { useWishlist } from "@/context/wishlist-context";
import { useAuth } from "@/context/auth-context";
import { useLocation } from "@/hooks/use-location";

/**
 * Desktop / tablet header. Rendered globally at md+ from __root.
 * Mobile uses per-page AppHeader (or Home's inline header).
 */
export function Navbar() {
  const { itemCount } = useCart();
  const { wishlist } = useWishlist();
  const { user, role } = useAuth();
  const { displayLocation } = useLocation();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Support the advertised ⌘K / Ctrl+K shortcut for search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        navigate({ to: "/search" });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  return (
    <header className="sticky top-0 z-40 hidden md:block w-full bg-background/85 backdrop-blur border-b">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <Logo className="h-9 w-9" />
          <div className="min-w-0">
            <div className="text-sm font-bold leading-none font-display">Vegamart</div>
            <div className="text-[10px] text-muted-foreground leading-none mt-0.5">
              Live vendor network
            </div>
          </div>
        </Link>

        <Link
          to="/addresses"
          className="hidden lg:flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-left text-sm hover:border-primary/40 transition-colors"
        >
          <MapPin className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground leading-none">
              Deliver to
            </div>
            <div className="text-xs font-medium truncate max-w-[150px]">{displayLocation}</div>
          </div>
        </Link>

        <div className="flex flex-1 max-w-xl">
          <Link
            to="/search"
            className="relative w-full flex items-center gap-2 rounded-full bg-card border h-11 px-4 text-left text-sm text-muted-foreground hover:border-primary/40 transition-colors"
          >
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 truncate">Search vendors, vegetables, chai, samosa…</span>
            <kbd className="hidden lg:inline text-[10px] rounded border bg-background px-1.5 py-0.5 text-muted-foreground">
              ⌘K
            </kbd>
          </Link>
        </div>

        <nav className="ml-auto flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link
              to="/street-vendors"
              className="text-emerald-700 font-bold flex items-center gap-1"
            >
              <Sparkles className="h-3.5 w-3.5" /> Street Radar
            </Link>
          </Button>

          {role === "vendor" ? (
            <div className="flex items-center gap-1.5">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold"
              >
                <Link to="/vendor">
                  <Store className="h-4 w-4 mr-1 text-emerald-600" /> Shop Portal
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 font-bold"
              >
                <Link to="/vendor">
                  <Sparkles className="h-4 w-4 mr-1 text-amber-600 animate-pulse" /> Street Cart
                  Portal
                </Link>
              </Button>
            </div>
          ) : (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold"
            >
              <Link to="/become-vendor">
                <Store className="h-4 w-4 mr-1 text-emerald-600" /> Become Vendor
              </Link>
            </Button>
          )}

          {role === "delivery" && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            >
              <Link to="/delivery">
                <Bike className="h-4 w-4 mr-1" /> Delivery Portal
              </Link>
            </Button>
          )}

          {(role === "admin" || role === "super_admin") && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
            >
              <Link to="/admin">
                <ShieldAlert className="h-4 w-4 mr-1" /> Admin
              </Link>
            </Button>
          )}

          <Button asChild variant="ghost" size="icon" aria-label="Notifications">
            <Link to="/notifications">
              <Bell className="h-5 w-5" />
            </Link>
          </Button>

          <Button asChild variant="ghost" size="icon" aria-label="Wishlist" className="relative">
            <Link to="/wishlist">
              <Heart className="h-5 w-5" />
              {wishlist.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-[16px] px-1 place-items-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                  {wishlist.length}
                </span>
              )}
            </Link>
          </Button>

          <Button asChild variant="ghost" size="icon" aria-label="Cart" className="relative">
            <Link to="/cart">
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-[16px] px-1 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {itemCount}
                </span>
              )}
            </Link>
          </Button>

          <Button asChild variant="ghost" size="icon" aria-label="Account">
            <Link to="/profile">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt=""
                  className="h-6 w-6 rounded-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || "User")}&background=10b981&color=fff`;
                  }}
                />
              ) : (
                <User className="h-5 w-5" />
              )}
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
