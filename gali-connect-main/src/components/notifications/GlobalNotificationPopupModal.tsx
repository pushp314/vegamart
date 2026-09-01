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
          color: "text-emerald-600 dark:text-emerald-400",
          bg: "bg-emerald-100 dark:bg-emerald-900/30",
          border: "border-emerald-200 dark:border-emerald-800",
        };
      case "delivery":
        return {
          label: "Delivery Partner Alert",
          icon: Truck,
          color: "text-blue-600 dark:text-blue-400",
          bg: "bg-blue-100 dark:bg-blue-900/30",
          border: "border-blue-200 dark:border-blue-800",
        };
      case "admin":
      case "super_admin":
        return {
          label: "Admin & System Alert",
          icon: ShieldAlert,
          color: "text-violet-600 dark:text-violet-400",
          bg: "bg-violet-100 dark:bg-violet-900/30",
          border: "border-violet-200 dark:border-violet-800",
        };
      default:
        return {
          label: "Vegamart Update",
          icon: Bell,
          color: "text-primary",
          bg: "bg-primary/10",
          border: "border-primary/20",
        };
    }
  };

  const roleConfig = getRoleBadge();
  const Icon = roleConfig.icon;

  const handlePrimaryAction = () => {
    if (onAction) {
      onAction(notification);
      return;
    }
    onDismiss();

    if (orderId) {
      if (userRole === "vendor") {
        navigate({ to: "/vendor/orders", search: { highlight: orderId } as any });
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
      navigate({ to: "/orders/$orderId/track", params: { orderId } });
      return;
    }

    if (notifType.includes("promo") || notifType.includes("announcement")) {
      if (userRole === "vendor") return navigate({ to: "/vendor/coupons" });
      if (userRole === "admin" || userRole === "super_admin") return navigate({ to: "/admin/coupons" });
      return navigate({ to: "/notifications" });
    }

    if (userRole === "vendor") return navigate({ to: "/vendor" });
    if (userRole === "delivery") return navigate({ to: "/delivery" });
    navigate({ to: "/notifications" });
  };

  const getActionLabel = () => {
    if (orderId) {
      if (userRole === "vendor") return "View Order Details";
      if (userRole === "delivery") return "View Delivery Task";
      return "Track Order";
    }
    if (notifType.includes("promo")) return "Explore Offers";
    if (userRole === "vendor") return "Open Vendor Hub";
    if (userRole === "delivery") return "Open Delivery Hub";
    return "View Notification";
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onDismiss()}>
      {/* [&>button]:hidden hides the default close button to prevent overlapping with our custom layout */}
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border border-border shadow-2xl bg-background rounded-2xl animate-in zoom-in-95 duration-200 [&>button]:hidden gap-0">
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-4">
              <div className={`mt-1 flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full ${roleConfig.bg} ${roleConfig.color} border ${roleConfig.border}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${roleConfig.color}`}>
                    {roleConfig.label}
                  </span>
                  {queueLength > 1 && (
                    <span className="text-[10px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                      {queueLength} unread
                    </span>
                  )}
                  {notification.time || notification.created_at ? (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {notification.time || new Date(notification.created_at || "").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  ) : null}
                </div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground leading-tight">
                  {notification.title}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                  {notification.message || "You have a new update from Vegamart."}
                </p>
                {orderId && (
                  <div className="mt-2">
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-foreground bg-muted px-2 py-1 rounded-md">
                      Order #{notifData.order_number || orderId.slice(0, 8)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 bg-muted/40 border-t border-border flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onToggleSound}
              className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
              title={isSoundEnabled ? "Mute sound" : "Unmute sound"}
            >
              {isSoundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
            {queueLength > 1 && (
              <Button
                type="button"
                variant="ghost"
                onClick={onDismissAll}
                className="h-9 text-xs rounded-lg font-medium text-muted-foreground hover:text-foreground"
              >
                Clear all ({queueLength})
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
             <Button
                type="button"
                variant="outline"
                onClick={onDismiss}
                className="flex-1 sm:flex-none text-xs rounded-lg font-medium h-9"
              >
                Dismiss
              </Button>
            <Button
              type="button"
              onClick={handlePrimaryAction}
              className="flex-1 sm:flex-none h-9 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm transition-all flex items-center justify-center gap-1.5 text-xs"
            >
              <span>{getActionLabel()}</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
