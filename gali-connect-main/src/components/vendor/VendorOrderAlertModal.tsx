import React from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Bell,
  ShoppingBag,
  Clock,
  User,
  Phone,
  Truck,
  IndianRupee,
  CheckCircle2,
  Volume2,
  VolumeX,
  X,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface VendorIncomingOrderItem {
  name: string;
  quantity: number;
  price?: number;
}

export interface VendorIncomingOrder {
  order_id: string;
  order_number: string;
  total: number;
  items_count?: number;
  customer_name?: string;
  customer_phone?: string;
  delivery_slot?: string;
  payment_method?: string;
  items?: VendorIncomingOrderItem[];
  created_at?: string;
}

interface VendorOrderAlertModalProps {
  order: VendorIncomingOrder | null;
  queueLength?: number;
  isOpen: boolean;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onDismiss: () => void;
  onAcceptAndView: (orderId: string) => void;
  onRejectOrder?: (orderId: string) => void;
}

export function VendorOrderAlertModal({
  order,
  queueLength = 1,
  isOpen,
  isMuted = false,
  onToggleMute,
  onDismiss,
  onAcceptAndView,
  onRejectOrder,
}: VendorOrderAlertModalProps) {
  const navigate = useNavigate();

  if (!order) return null;

  const isCod = (order.payment_method || "").toUpperCase() === "COD";
  const items = order.items || [];
  const itemCount = order.items_count || items.reduce((acc, it) => acc + (it.quantity || 1), 0);

  const handleViewOrder = () => {
    onAcceptAndView(order.order_id);
    navigate({
      to: "/vendor/orders",
      search: { highlight: order.order_id } as any,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onDismiss()}>
      <DialogContent className="sm:max-w-md md:max-w-lg p-0 overflow-hidden border-2 border-primary/40 shadow-2xl bg-card rounded-3xl">
        {/* Animated Glow Top Header */}
        <div className="relative bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 text-white p-6 sm:p-7 overflow-hidden">
          {/* Animated decorative glow circles */}
          <div className="absolute -right-8 -top-8 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -left-8 -bottom-8 w-36 h-36 bg-emerald-400/20 rounded-full blur-2xl pointer-events-none" />

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
                  <span className="text-[11px] font-black uppercase tracking-widest bg-amber-400 text-slate-900 px-2.5 py-0.5 rounded-full shadow-sm">
                    New Order Alert
                  </span>
                  {queueLength > 1 && (
                    <span className="text-[11px] font-bold bg-white/25 text-white px-2 py-0.5 rounded-full">
                      +{queueLength - 1} more in queue
                    </span>
                  )}
                </div>
                <h2 className="text-xl sm:text-2xl font-display font-extrabold tracking-tight mt-1 text-white">
                  Order #{order.order_number}
                </h2>
              </div>
            </div>

            {onToggleMute && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleMute}
                className="h-10 w-10 rounded-full bg-white/15 hover:bg-white/25 text-white border border-white/20 transition-all cursor-pointer"
                title={isMuted ? "Unmute Alarm" : "Mute Alarm"}
              >
                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </Button>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Customer & Slot Info Card */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-muted/50 border border-border">
            <div className="flex items-start gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                <User className="h-4 w-4" />
              </div>
              <div className="overflow-hidden">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Customer
                </span>
                <span className="text-sm font-bold text-foreground truncate block">
                  {order.customer_name || "Direct Customer"}
                </span>
                {order.customer_phone && (
                  <span className="text-xs text-muted-foreground block">
                    {order.customer_phone}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
                <Truck className="h-4 w-4" />
              </div>
              <div className="overflow-hidden">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Fulfillment
                </span>
                <span className="text-sm font-bold text-foreground truncate block">
                  {order.delivery_slot || "Standard Delivery"}
                </span>
              </div>
            </div>
          </div>

          {/* Items Summary */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ShoppingBag className="h-3.5 w-3.5 text-primary" />
                Order Items ({itemCount})
              </span>
              <Badge variant="outline" className="font-semibold text-xs py-0.5">
                {items.length > 0 ? `${items.length} unique item${items.length > 1 ? "s" : ""}` : "Items list ready"}
              </Badge>
            </div>

            <div className="space-y-2 rounded-2xl bg-background border border-border p-3">
              {items.length > 0 ? (
                items.map((it, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-1.5 px-2 rounded-xl hover:bg-muted/40 transition-colors text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className="h-6 px-2 rounded-lg bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                        {it.quantity}x
                      </span>
                      <span className="font-medium text-foreground truncate">
                        {it.name}
                      </span>
                    </div>
                    {it.price !== undefined && (
                      <span className="text-xs font-bold text-muted-foreground shrink-0">
                        ₹{Number(it.price * it.quantity).toFixed(2)}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-2 text-center text-xs text-muted-foreground">
                  {itemCount} item(s) to prepare
                </div>
              )}
            </div>
          </div>

          {/* Bill & Payment Method */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <div>
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block uppercase tracking-wider">
                Total Payable Amount
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 font-display">
                  ₹{Number(order.total || 0).toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            <div>
              {isCod ? (
                <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 px-3 py-1 font-bold text-xs">
                  💵 Cash on Delivery
                </Badge>
              ) : (
                <Badge className="bg-emerald-600 text-white border-transparent px-3 py-1 font-bold text-xs shadow-sm">
                  ✓ Paid Online (Razorpay)
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-6 bg-muted/30 border-t border-border flex flex-col sm:flex-row items-center gap-3">
          <Button
            variant="outline"
            onClick={onDismiss}
            className="w-full sm:w-auto h-12 px-5 rounded-2xl font-bold border-border hover:bg-muted text-foreground cursor-pointer"
          >
            Dismiss
          </Button>

          {onRejectOrder && (
            <Button
              variant="destructive"
              onClick={() => {
                if (order) onRejectOrder(order.order_id);
              }}
              className="w-full sm:w-auto h-12 px-5 rounded-2xl font-bold cursor-pointer transition-all hover:bg-rose-600 bg-rose-500 text-white border-transparent"
            >
              Reject
            </Button>
          )}

          <Button
            onClick={handleViewOrder}
            className="w-full sm:flex-1 h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer text-base"
          >
            <Sparkles className="h-5 w-5" />
            <span>View & Accept Order</span>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
