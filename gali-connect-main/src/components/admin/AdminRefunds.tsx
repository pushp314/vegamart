import { toast } from "sonner";
import { api } from "@/lib/api";

export function AdminRefunds() {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="font-display text-2xl font-bold px-1">Process Refunds</h2>
      <div className="rounded-3xl border bg-card p-6 shadow-sm max-w-xl">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const fd = new FormData(form);
            try {
              await api.post(`/payments/${fd.get("order_id")}/refund`, {
                amount: parseFloat(fd.get("amount") as string),
              });
              toast.success("Refund processed successfully!");
              form.reset();
            } catch (err) {
              toast.error("Failed to process refund");
            }
          }}
          className="space-y-4"
        >
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1 mb-1 block">Order ID (UUID)</label>
              <input name="order_id" placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000" required className="w-full h-11 px-4 rounded-xl border bg-muted/50 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1 mb-1 block">Refund Amount (₹)</label>
              <input name="amount" type="number" step="0.01" placeholder="0.00" required className="w-full h-11 px-4 rounded-xl border bg-muted/50 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
            </div>
          </div>
          <button type="submit" className="w-full h-11 rounded-xl bg-rose-600 text-white font-bold text-sm shadow-md hover:bg-rose-700 hover:shadow-lg transition-all">
            Process Refund
          </button>
        </form>
      </div>
    </div>
  );
}
