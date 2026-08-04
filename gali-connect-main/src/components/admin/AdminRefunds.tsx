import { toast } from "sonner";
import { api } from "@/lib/api";
import { Banknote, Receipt } from "lucide-react";
import { useState } from "react";

export function AdminRefunds() {
  const [processing, setProcessing] = useState(false);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="font-display text-3xl font-bold tracking-tight text-foreground px-1">
          Process Refunds
        </h2>
        <p className="text-muted-foreground text-sm mt-1 px-1">
          Issue a refund against a completed payment.
        </p>
      </div>

      <div className="rounded-3xl border bg-card shadow-soft max-w-xl overflow-hidden">
        <div className="border-b border-border bg-muted/40 px-6 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center">
            <Banknote className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-sm text-foreground">Refund Request</div>
            <div className="text-xs text-muted-foreground">
              Enter the order ID and amount to reverse the payment.
            </div>
          </div>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const fd = new FormData(form);
            setProcessing(true);
            try {
              await api.post(`/payments/${fd.get("order_id")}/refund`, {
                amount: parseFloat(fd.get("amount") as string),
              });
              toast.success("Refund processed successfully!");
              form.reset();
            } catch (err) {
              toast.error("Failed to process refund");
            } finally {
              setProcessing(false);
            }
          }}
          className="space-y-4 p-6"
        >
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1 mb-1 block">
                Order ID (UUID)
              </label>
              <div className="relative">
                <Receipt className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  name="order_id"
                  placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000"
                  required
                  className="w-full h-11 pl-10 pr-4 rounded-xl border bg-muted/50 text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1 mb-1 block">
                Refund Amount (₹)
              </label>
              <input
                name="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                required
                className="w-full h-11 px-4 rounded-xl border bg-muted/50 text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={processing}
            className="w-full h-11 rounded-xl bg-rose-600 text-white font-bold text-sm shadow-md hover:bg-rose-700 hover:shadow-lg transition-all disabled:opacity-50"
          >
            {processing ? "Processing..." : "Process Refund"}
          </button>
        </form>
      </div>
    </div>
  );
}
