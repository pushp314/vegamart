import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bike,
  Package,
  Store,
  CheckCircle2,
  ArrowRight,
  X,
  Layers,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

const ACTIVE_STATUSES = [
  "pending",
  "booked",
  "confirmed",
  "accepted",
  "preparing",
  "processing",
  "packed",
  "ready_for_pickup",
  "pickup_in_progress",
  "picked_up",
  "out_for_delivery",
  "arrived",
];

function getStatusBadge(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "out_for_delivery" || s === "arrived") {
    return {
      label: "Out for Delivery",
      icon: Bike,
    };
  }
  if (s === "ready_for_pickup" || s === "picked_up" || s === "pickup_in_progress") {
    return {
      label: "Rider at Store / Picked Up",
      icon: Store,
    };
  }
  if (s === "preparing" || s === "processing" || s === "packed") {
    return {
      label: "Store Preparing Order",
      icon: Package,
    };
  }
  return {
    label: "Order Confirmed",
    icon: CheckCircle2,
  };
}

export function ActiveOrderTrackerPopup() {
  const { isAuthenticated, isGuest, role } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [isDismissed, setIsDismissed] = useState(false);

  // Check sessionStorage on mount so dismissal persists across route transitions
  useEffect(() => {
    try {
      const dismissed = sessionStorage.getItem("vegamart_dismiss_tracking_cta");
      if (dismissed === "true") {
        setIsDismissed(true);
      }
    } catch {
      // Ignore sessionStorage errors
    }
  }, []);

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDismissed(true);
    try {
      sessionStorage.setItem("vegamart_dismiss_tracking_cta", "true");
    } catch {
      // Ignore sessionStorage errors
    }
  };

  // Don't show inside vendor/delivery/admin portals or if already on tracking page
  const isHiddenRoute =
    pathname.includes("/track") ||
    pathname.startsWith("/vendor") ||
    pathname.startsWith("/delivery") ||
    pathname.startsWith("/admin");

  const { data: ordersRes } = useQuery({
    queryKey: ["orders", "active-popup", role],
    queryFn: () => api.get<any[]>("/orders"),
    enabled: isAuthenticated && !isGuest && role === "customer" && !isHiddenRoute,
    // Poll every 8s while there are active orders
    refetchInterval: (query) => {
      const orders = query.state.data?.data || [];
      const hasActive = orders.some((o: any) =>
        ACTIVE_STATUSES.includes(String(o.status || "").toLowerCase())
      );
      return hasActive ? 8000 : false;
    },
  });

  if (isHiddenRoute || !isAuthenticated || isGuest || role !== "customer" || isDismissed) {
    return null;
  }

  const allOrders = ordersRes?.data || [];
  const activeOrders = allOrders.filter((o: any) =>
    ACTIVE_STATUSES.includes(String(o.status || "").toLowerCase())
  );

  if (activeOrders.length === 0) {
    return null;
  }

  const isMultiple = activeOrders.length > 1;
  const order = activeOrders[0];
  const statusInfo = getStatusBadge(order?.status);
  const StatusIcon = isMultiple ? Layers : statusInfo.icon;

  const displayEta =
    order?.estimated_delivery_time ||
    (order?.status === "out_for_delivery" ? "10-15 mins" : "20-30 mins");

  const storeNames =
    order?.orders?.map((o: any) => o.vendor?.business_name).filter(Boolean).join(", ") ||
    order?.vendor?.business_name ||
    "VegaMart Merchant";

  const orderNum = order?.order_number || String(order?.id || "").slice(0, 8);

  const handleCardClick = () => {
    if (isMultiple) {
      navigate({ to: "/orders" });
    } else {
      navigate({ to: "/orders/$orderId/track", params: { orderId: order.id } });
    }
  };

  return (
    <aside
      aria-label="Active Order Tracking CTA"
      className="fixed z-[120] bottom-[76px] md:bottom-6 left-3 right-3 md:left-auto md:right-6 md:w-[420px] pointer-events-auto"
    >
      <AnimatePresence>
        <motion.div
          key="redirect-cta"
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 450, damping: 28 }}
          onClick={handleCardClick}
          className="group cursor-pointer flex items-center justify-between gap-3 bg-slate-900/95 dark:bg-card/95 text-white dark:text-foreground border border-emerald-500/50 hover:border-emerald-400 rounded-2xl px-3.5 py-2.5 shadow-2xl backdrop-blur-xl transition-all hover:shadow-emerald-950/30 active:scale-[0.99]"
        >
          {/* Left: Animated Pulse & Icon */}
          <div className="relative flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0 border border-emerald-500/30">
            <StatusIcon className="h-5 w-5 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
          </div>

          {/* Middle: Order Status & Details */}
          <div className="flex-1 min-w-0 pr-1">
            {isMultiple ? (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black tracking-wide text-white dark:text-foreground">
                    {activeOrders.length} Active Deliveries
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/30 text-emerald-300">
                    Live
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 dark:text-muted-foreground truncate mt-0.5">
                  Tap to track all ongoing orders
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-xs font-black tracking-wide text-white dark:text-foreground">
                    {statusInfo.label}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-extrabold shrink-0">
                    (~{displayEta})
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 dark:text-muted-foreground truncate mt-0.5">
                  Order #{orderNum} • {storeNames}
                </p>
              </>
            )}
          </div>

          {/* Right: Redirect CTA Button + Dismiss Button */}
          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            {isMultiple ? (
              <Link
                to="/orders"
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1 shadow-md transition-all active:scale-95 whitespace-nowrap"
              >
                <span>Track ({activeOrders.length})</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            ) : (
              <Link
                to="/orders/$orderId/track"
                params={{ orderId: order.id }}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1 shadow-md transition-all active:scale-95 whitespace-nowrap"
              >
                <span>Track Live</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            )}

            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss tracking banner"
              className="p-1.5 rounded-xl text-slate-400 hover:text-white dark:hover:text-foreground hover:bg-white/10 transition-colors"
              title="Dismiss for this session"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </aside>
  );
}
