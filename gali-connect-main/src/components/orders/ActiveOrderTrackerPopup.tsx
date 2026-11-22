import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bike,
  MapPin,
  ChevronUp,
  ChevronDown,
  Navigation,
  Clock,
  Store,
  CheckCircle2,
  ExternalLink,
  X,
  Package,
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
      color: "bg-emerald-500 text-white",
      border: "border-emerald-600",
      icon: Bike,
      step: 3,
    };
  }
  if (s === "ready_for_pickup" || s === "picked_up" || s === "pickup_in_progress") {
    return {
      label: "Rider at Store / Picked Up",
      color: "bg-purple-600 text-white",
      border: "border-purple-700",
      icon: Store,
      step: 2,
    };
  }
  if (s === "preparing" || s === "processing" || s === "packed") {
    return {
      label: "Store Preparing Order",
      color: "bg-amber-500 text-white",
      border: "border-amber-600",
      icon: Package,
      step: 1,
    };
  }
  return {
    label: "Order Confirmed",
    color: "bg-blue-600 text-white",
    border: "border-blue-700",
    icon: CheckCircle2,
    step: 0,
  };
}

export function ActiveOrderTrackerPopup() {
  const { user, isAuthenticated, isGuest, role } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [isMinimized, setIsMinimized] = useState(false);
  const [closedOrderIds, setClosedOrderIds] = useState<Record<string, boolean>>({});

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
    // Poll every 8s while there are active orders so customer sees status change immediately
    refetchInterval: (query) => {
      const orders = query.state.data?.data || [];
      const hasActive = orders.some((o: any) =>
        ACTIVE_STATUSES.includes(String(o.status || "").toLowerCase())
      );
      return hasActive ? 8000 : false;
    },
  });

  if (isHiddenRoute || !isAuthenticated || isGuest || role !== "customer") {
    return null;
  }

  const allOrders = ordersRes?.data || [];
  const activeOrders = allOrders.filter(
    (o: any) =>
      ACTIVE_STATUSES.includes(String(o.status || "").toLowerCase()) &&
      !closedOrderIds[o.id]
  );

  if (activeOrders.length === 0) {
    return null;
  }

  // Focus on the most recent active order
  const order = activeOrders[0];
  const statusInfo = getStatusBadge(order.status);
  const StatusIcon = statusInfo.icon;
  const isMultiStore = (order.sub_orders?.length || 0) > 1;
  const storeNames =
    order.orders?.map((o: any) => o.vendor?.business_name).filter(Boolean).join(", ") ||
    order.vendor?.business_name ||
    "VegaMart Merchant";

  const totalItems =
    order.items?.length ||
    order.orders?.reduce((acc: number, curr: any) => acc + (curr.items?.length || 0), 0) ||
    1;

  const displayEta =
    order.estimated_delivery_time ||
    (order.status === "out_for_delivery" ? "10-15 mins" : "20-30 mins");

  return (
    <aside aria-label="Live Order Tracking" className="fixed z-[130] bottom-[84px] md:bottom-6 left-3 right-3 md:left-auto md:right-6 md:w-[400px] pointer-events-auto">
      <AnimatePresence mode="wait">
        {isMinimized ? (
          /* Minimized Compact Floating Pill */
          <motion.div
            key="minimized"
            initial={{ opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 12 }}
            transition={{ type: "spring", stiffness: 450, damping: 25 }}
            className="flex items-center justify-between gap-3 bg-slate-900/95 text-white dark:bg-card/95 dark:text-foreground border border-emerald-500/40 rounded-full px-4 py-2.5 shadow-xl backdrop-blur-md"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              <div className="text-xs font-bold truncate">
                <span>{statusInfo.label}</span>
                <span className="text-[10px] text-muted-foreground ml-1.5 opacity-80">
                  (~{displayEta})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Link
                to="/orders/$orderId/track"
                params={{ orderId: order.id }}
                className="px-3 py-1 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] flex items-center gap-1 transition-all shadow-xs"
              >
                <Navigation className="h-3 w-3" /> Track
              </Link>
              <button
                type="button"
                onClick={() => setIsMinimized(false)}
                className="p-1 rounded-full text-slate-300 hover:text-white dark:text-muted-foreground hover:bg-white/10 transition-colors"
                title="Expand Tracking Details"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        ) : (
          /* Expanded Interactive Tracking Card */
          <motion.div
            key="expanded"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="bg-card text-card-foreground border-2 border-emerald-500/40 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl"
          >
            {/* Header: Status ribbon with animated pulse */}
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-4 py-2.5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="relative flex items-center justify-center h-6 w-6 rounded-lg bg-white/20 backdrop-blur-xs">
                  <StatusIcon className="h-3.5 w-3.5 text-white" />
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-80" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black tracking-wide uppercase truncate">
                    {statusInfo.label}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {activeOrders.length > 1 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">
                    1 of {activeOrders.length}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIsMinimized(true)}
                  className="p-1 rounded-lg hover:bg-white/20 text-white/90 hover:text-white transition-colors"
                  title="Minimize widget"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setClosedOrderIds((prev) => ({ ...prev, [order.id]: true }))}
                  className="p-1 rounded-lg hover:bg-white/20 text-white/90 hover:text-white transition-colors ml-0.5"
                  title="Dismiss popup for this order"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Body: Delivery & Progress Details */}
            <div className="p-4 space-y-3.5">
              {/* Order Meta & ETA */}
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground truncate">
                    <Store className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">{storeNames}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Order #{order.order_number || String(order.id).slice(0, 8)} • {totalItems} items
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-extrabold text-xs border border-emerald-500/20">
                    <Clock className="h-3 w-3" /> ~{displayEta}
                  </span>
                </div>
              </div>

              {/* 4-Step Visual Progress Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground">
                  <span className={statusInfo.step >= 0 ? "text-emerald-600 font-extrabold" : ""}>
                    Confirmed
                  </span>
                  <span className={statusInfo.step >= 1 ? "text-emerald-600 font-extrabold" : ""}>
                    Preparing
                  </span>
                  <span className={statusInfo.step >= 2 ? "text-emerald-600 font-extrabold" : ""}>
                    Picked Up
                  </span>
                  <span className={statusInfo.step >= 3 ? "text-emerald-600 font-extrabold" : ""}>
                    Arriving
                  </span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-emerald-600 transition-all duration-500 rounded-full"
                    style={{
                      width:
                        statusInfo.step === 0
                          ? "25%"
                          : statusInfo.step === 1
                          ? "50%"
                          : statusInfo.step === 2
                          ? "75%"
                          : "100%",
                    }}
                  />
                </div>
              </div>

              {/* Multi-Store Note if applicable */}
              {isMultiStore && (
                <div className="text-[10px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1.5 rounded-xl border border-amber-500/20 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span>
                    Multi-Store Order ({order.sub_orders.length} Vendors): Rider is routing between
                    stores.
                  </span>
                </div>
              )}

              {/* Bottom CTAs: Link to full live map & view orders */}
              <div className="flex items-center gap-2 pt-1">
                <Link
                  to="/orders/$orderId/track"
                  params={{ orderId: order.id }}
                  className="flex-1 py-2.5 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-[0.98]"
                >
                  <Navigation className="h-3.5 w-3.5" /> Live Map Tracking
                </Link>
                <Link
                  to="/orders"
                  className="py-2.5 px-3 rounded-2xl border border-border bg-muted/60 hover:bg-muted text-foreground font-semibold text-xs flex items-center justify-center transition-all"
                >
                  All Orders
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}
