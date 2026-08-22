import React from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Bell,
  ShoppingBag,
  Truck,
  Sparkles,
  ShieldAlert,
  Volume2,
  VolumeX,
  ChevronRight,
  ChevronLeft,
  Store,
  Clock,
  CheckCheck,
  Check,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface PopupNotificationData {
  id: string;
  title: string;
  message: string;
  type?: string;
  channel?: string;
  created_at?: string;
  time?: string;
  data?: {
    order_id?: string;
    order_number?: string;
    vendor_id?: string;
    status?: string;
    url?: string;
    [key: string]: any;
  } | null;
  source?: "notification" | "announcement" | "realtime";
}

interface GlobalNotificationPopupModalProps {
  notification: PopupNotificationData | null;
  queueLength: number;
  isOpen: boolean;
  userRole?: string;
  isSoundEnabled: boolean;
  onToggleSound: () => void;
  onDismiss: () => void;
  onDismissAll: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  hasMultiple?: boolean;
  onAction?: (notification: PopupNotificationData) => void;
}

export function GlobalNotificationPopupModal({
  notification,
  queueLength = 1,
  isOpen,
  userRole = "customer",
  isSoundEnabled = true,
  onToggleSound,
  onDismiss,
  onDismissAll,
  onNext,
  onPrevious,
  hasMultiple = false,
  onAction,
}: GlobalNotificationPopupModalProps) {
  const navigate = useNavigate();

  if (!notification) return null;

  const notifType = (notification.type || "").toLowerCase();
  const notifData = notification.data || {};
  const orderId = notifData.order_id || (notifType.includes("order") ? notifData.id : undefined);

  // Role details config
  const getRoleBadge = () => {
    switch (userRole) {
      case "vendor":
        return {
          label: "Merchant Alert",
          icon: Store,
          gradient: "from-emerald-600 via-teal-600 to-emerald-700",
        };
      case "delivery":
        return {
          label: "Delivery Partner Alert",
          icon: Truck,
          gradient: "from-blue-600 via-indigo-600 to-blue-700",
        };
      case "admin":
      case "super_admin":
        return {
          label: "Admin & System Alert",
          icon: ShieldAlert,
          gradient: "from-violet-600 via-purple-600 to-indigo-700",
        };
      default:
        return {
          label: "Vegamart Update",
          icon: ShoppingBag,
          gradient: "from-emerald-600 via-green-600 to-teal-700",
        };
    }
  };

  const roleConfig = getRoleBadge();

  // Smart action navigation based on role and notification metadata
  const handlePrimaryAction = () => {
    if (onAction) {
      onAction(notification);
      return;
    }

    onDismiss();

    // Redirection routes
    if (orderId) {
      if (userRole === "vendor") {
        navigate({
          to: "/vendor/orders",
          search: { highlight: orderId } as any,
        });
        return;
      }
      if (userRole === "delivery") {
        navigate({ to: "/delivery" });
        return;
      }
      if (userRole === "admin" || userRole === "super_admin") {
        navigate({ to: "/admin/orders" });
        return;
      }
      // Customer
      navigate({
        to: "/orders/$orderId/track",
        params: { orderId },
      });
      return;
    }

    if (notifType.includes("promo") || notifType.includes("announcement")) {
      if (userRole === "vendor") {
        navigate({ to: "/vendor/coupons" });
        return;
      }
      if (userRole === "admin" || userRole === "super_admin") {
        navigate({ to: "/admin/coupons" });
        return;
      }
      navigate({ to: "/notifications" });
      return;
    }

    if (userRole === "vendor") {
      navigate({ to: "/vendor" });
      return;
    }

    if (userRole === "delivery") {
      navigate({ to: "/delivery" });
      return;
    }

    navigate({ to: "/notifications" });
  };

  const getActionLabel = () => {
    if (orderId) {
      if (userRole === "vendor") return "View Order Details";
      if (userRole === "delivery") return "View Delivery Task";
      return "Track Order Status";
    }
    if (notifType.includes("promo")) return "Explore Offers";
    if (userRole === "vendor") return "Open Vendor Hub";
    if (userRole === "delivery") return "Open Delivery Hub";
    return "View Notification";
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onDismiss()}>
      <DialogContent className="sm:max-w-md md:max-w-lg p-0 overflow-hidden border-2 border-primary/30 shadow-2xl bg-card rounded-3xl animate-in zoom-in-95 duration-200">
        {/* Glowing Top Banner */}
        <div className={`relative bg-gradient-to-br ${roleConfig.gradient} text-white p-6 sm:p-7 overflow-hidden`}>
          <div className="absolute -right-8 -top-8 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -left-8 -bottom-8 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center h-12 w-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 shadow-inner">
                <Bell className="h-6 w-6 text-white animate-bounce" />
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-400"></span>
                </span>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-widest bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full shadow-sm">
                    {roleConfig.label}
                  </span>
                  {queueLength > 1 && (
                    <span className="text-[11px] font-bold bg-white/25 text-white px-2 py-0.5 rounded-full">
                      {queueLength} unread alert{queueLength > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <h2 className="text-xl sm:text-2xl font-display font-extrabold tracking-tight mt-1 text-white leading-tight">
                  {notification.title}
                </h2>
              </div>
            </div>

            {/* Mute Audio Toggle */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onToggleSound}
              className="h-10 w-10 rounded-full bg-white/15 hover:bg-white/25 text-white border border-white/20 transition-all cursor-pointer shrink-0 ml-2"
              title={isSoundEnabled ? "Mute notification sound" : "Unmute notification sound"}
            >
              {isSoundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Notification Message Card */}
          <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-3">
            <p className="text-sm text-foreground leading-relaxed">
              {notification.message || "You have a new update from Vegamart."}
            </p>

            {/* Meta details if present */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50 text-xs text-muted-foreground">
              {notification.time || notification.created_at ? (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {notification.time || new Date(notification.created_at || "").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              ) : null}

              {orderId && (
                <span className="font-mono font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10">
                  Order #{notifData.order_number || orderId.slice(0, 8)}
                </span>
              )}

              <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Unread Alert
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-6 bg-muted/30 border-t border-border space-y-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Secondary: Mark as Read & Dismiss */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={onDismiss}
                className="flex-1 sm:flex-none text-xs rounded-xl font-bold h-10 border-border hover:bg-muted text-foreground flex items-center gap-1.5"
              >
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                Mark as Read
              </Button>

              {queueLength > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onDismissAll}
                  className="flex-1 sm:flex-none text-xs rounded-xl font-semibold h-10 text-muted-foreground hover:text-foreground flex items-center gap-1.5"
                >
                  <CheckCheck className="h-3.5 w-3.5 text-primary" />
                  Read All ({queueLength})
                </Button>
              )}
            </div>

            {/* Primary: View & Action */}
            <Button
              type="button"
              onClick={handlePrimaryAction}
              className="w-full sm:w-auto h-10 px-5 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm"
            >
              <Sparkles className="h-4 w-4" />
              <span>{getActionLabel()}</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
