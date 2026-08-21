import { useState } from "react";
import {
  AlertOctagon,
  HelpCircle,
  RefreshCw,
  Banknote,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  CreditCard,
  CheckCircle2,
  Loader2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { useCart } from "@/context/cart-context";

interface PaymentFailureModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: any[]; // The created order(s)
  errorMessage?: string;
  onRetryRazorpay: (orders: any[]) => Promise<void>;
}

export function PaymentFailureModal({
  isOpen,
  onClose,
  orders,
  errorMessage,
  onRetryRazorpay,
}: PaymentFailureModalProps) {
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const [showFaq, setShowFaq] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isSwitchingCod, setIsSwitchingCod] = useState(false);

  const firstOrder = orders?.[0]?.order || orders?.[0] || null;
  const orderTotal = orders.reduce((sum, o) => sum + (Number(o?.order?.total || o?.total || 0)), 0);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetryRazorpay(orders);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Payment retry failed. You can switch to Cash on Delivery.");
    } finally {
      setIsRetrying(false);
    }
  };

  const handleSwitchToCod = async () => {
    if (!firstOrder?.id) {
      toast.error("Order reference not found. Please place order again.");
      onClose();
      return;
    }
    setIsSwitchingCod(true);
    try {
      // Switch all orders in the batch to COD
      await Promise.all(
        orders.map((entry) => {
          const id = entry?.order?.id || entry?.id;
          return id ? api.post(`/payments/${id}/switch-to-cod`, {}) : Promise.resolve();
        })
      );

      clearCart();
      toast.success("Switched to Cash on Delivery! Order placed successfully. 🎉");
      onClose();
      navigate({ to: "/order-success", search: { orderId: firstOrder.id } });
    } catch (err: any) {
      toast.error(err?.message || "Failed to switch to Cash on Delivery. Please try placing your order again.");
    } finally {
      setIsSwitchingCod(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-3xl border-rose-500/20 bg-card p-6 max-h-[92vh] overflow-y-auto">
        <DialogHeader className="text-center sm:text-center items-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-rose-500/10 text-rose-600 border border-rose-500/20 mb-3 shadow-inner">
            <AlertOctagon className="h-8 w-8 animate-pulse" />
          </div>
          <DialogTitle className="font-display text-xl font-bold text-foreground">
            Payment Incomplete or Declined
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            {errorMessage || "Your bank or UPI app declined or timed out the transaction."}
          </DialogDescription>
        </DialogHeader>

        {/* Order total & Status Summary */}
        <div className="rounded-2xl border border-border bg-muted/30 p-4 mt-2 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Amount Due
            </span>
            <div className="font-display text-2xl font-black text-foreground">
              ₹{orderTotal.toFixed(2)}
            </div>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-rose-700 bg-rose-100 dark:bg-rose-950 dark:text-rose-300 px-2.5 py-1 rounded-full">
              Payment Pending
            </span>
            <div className="text-[11px] text-muted-foreground mt-1">
              Cart preserved
            </div>
          </div>
        </div>

        {/* 1-Click Fallback Recovery Actions */}
        <div className="space-y-2.5 mt-4">
          <Button
            onClick={handleRetry}
            disabled={isRetrying || isSwitchingCod}
            className="w-full h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-sm flex items-center justify-center gap-2 shadow-md"
          >
            {isRetrying ? (
              <Loader2 className="h-4 w-4 animate-spin text-black" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Retry Payment (UPI / Cards / NetBanking)
          </Button>

          <Button
            onClick={handleSwitchToCod}
            disabled={isRetrying || isSwitchingCod}
            variant="outline"
            className="w-full h-12 rounded-2xl border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold text-sm flex items-center justify-center gap-2"
          >
            {isSwitchingCod ? (
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
            ) : (
              <Banknote className="h-4 w-4 text-emerald-600" />
            )}
            ⚡ 1-Click Switch to Cash on Delivery (COD)
          </Button>

          <button
            onClick={onClose}
            className="w-full py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors text-center"
          >
            Change payment method or edit cart
          </button>
        </div>

        {/* "What Happened?" Transparency Accordion */}
        <div className="mt-4 rounded-2xl border border-border bg-card overflow-hidden">
          <button
            onClick={() => setShowFaq(!showFaq)}
            className="w-full p-3.5 flex items-center justify-between text-left text-xs font-bold text-foreground bg-muted/20 hover:bg-muted/40 transition-colors"
          >
            <span className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-amber-500" />
              What happened? Frequently Asked Questions
            </span>
            {showFaq ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showFaq && (
            <div className="p-3.5 space-y-3 text-xs text-muted-foreground border-t border-border/60 bg-muted/10">
              <div className="space-y-1">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Why did my payment not go through?
                </div>
                <p className="text-[11px] leading-relaxed pl-3">
                  Transactions usually fail due to bank server timeouts, UPI app cancellation, incorrect OTP, or temporary network drops.
                </p>
              </div>

              <div className="space-y-1">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Was money deducted from my bank?
                </div>
                <p className="text-[11px] leading-relaxed pl-3 text-foreground/90 font-medium">
                  <strong>Don't worry!</strong> If any amount was deducted by your bank, it was not captured by VegaMart and will be <strong>automatically refunded to your original payment account within 3 to 5 business days</strong> by your bank.
                </p>
              </div>

              <div className="space-y-1">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Will I lose the items in my cart?
                </div>
                <p className="text-[11px] leading-relaxed pl-3">
                  No, your items and delivery address are preserved so you can easily retry payment or switch to Cash on Delivery.
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
