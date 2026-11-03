import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Ticket, Pencil } from "lucide-react";
import { api, formatErrorMessage } from "@/lib/api";

interface CreateCouponModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coupon?: any | null;
}

const COUPON_TYPES = [
  { value: "PERCENTAGE", label: "Percentage (%)" },
  { value: "FIXED", label: "Fixed Amount (₹)" },
  { value: "FREE_DELIVERY", label: "Free Delivery" },
];

function formatDateTimeLocal(dateString?: string | null): string {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const defaultForm = {
  code: "",
  type: "PERCENTAGE",
  value: "",
  max_discount: "",
  min_order_value: "",
  usage_limit: "",
  per_user_limit: "1",
  valid_from: "",
  valid_until: "",
};

export function CreateCouponModal({ open, onOpenChange, coupon }: CreateCouponModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(defaultForm);
  const isEditing = Boolean(coupon?.id);

  useEffect(() => {
    if (coupon) {
      setForm({
        code: coupon.code || "",
        type: coupon.type || "PERCENTAGE",
        value: coupon.type === "FREE_DELIVERY" ? "0" : String(coupon.value ?? ""),
        max_discount: coupon.max_discount != null && Number(coupon.max_discount) > 0 ? String(coupon.max_discount) : "",
        min_order_value: coupon.min_order_value != null && Number(coupon.min_order_value) > 0 ? String(coupon.min_order_value) : "",
        usage_limit: coupon.usage_limit && coupon.usage_limit > 0 ? String(coupon.usage_limit) : "",
        per_user_limit: coupon.per_user_limit ? String(coupon.per_user_limit) : "1",
        valid_from: formatDateTimeLocal(coupon.valid_from),
        valid_until: formatDateTimeLocal(coupon.valid_until),
      });
    } else {
      setForm(defaultForm);
    }
  }, [coupon, open]);

  const setField = (key: keyof typeof defaultForm, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const mutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = isEditing
        ? await api.patch(`/vendors/me/coupons/${coupon.id}`, data)
        : await api.post("/vendors/me/coupons", data);
      if (!res.success) {
        throw new Error(formatErrorMessage(res.error, isEditing ? "Failed to update coupon" : "Failed to create coupon"));
      }
      return res.data;
    },
    onSuccess: () => {
      toast.success(isEditing ? "Coupon updated successfully" : "Coupon created successfully");
      queryClient.invalidateQueries({ queryKey: ["vendorCoupons"] });
      setForm(defaultForm);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error?.message || (isEditing ? "Failed to update coupon" : "Failed to create coupon"));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = form.code.trim().toUpperCase();
    if (!cleanCode) {
      toast.error("Coupon code is required");
      return;
    }

    let val = 0;
    if (form.type !== "FREE_DELIVERY") {
      if (form.value === "" || form.value === undefined || isNaN(Number(form.value)) || Number(form.value) <= 0) {
        toast.error("Valid discount value is required");
        return;
      }
      val = Number(form.value);
    }

    if (form.valid_from && form.valid_until) {
      if (new Date(form.valid_until) <= new Date(form.valid_from)) {
        toast.error("Valid until must be after valid from");
        return;
      }
    }

    const payload: Record<string, unknown> = {
      code: cleanCode,
      type: form.type,
      value: val,
      valid_from: form.valid_from ? new Date(form.valid_from).toISOString() : new Date(Date.now() - 60000).toISOString(),
      valid_until: form.valid_until
        ? new Date(form.valid_until).toISOString()
        : new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
      max_discount: form.type === "PERCENTAGE" && form.max_discount ? Number(form.max_discount) : null,
      min_order_value: form.min_order_value ? Number(form.min_order_value) : null,
      usage_limit: form.usage_limit ? Number(form.usage_limit) : 0,
      per_user_limit: form.per_user_limit ? Number(form.per_user_limit) : 1,
    };
    mutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Pencil className="h-5 w-5 text-amber-500" /> Edit Coupon: {coupon?.code}
              </>
            ) : (
              <>
                <Ticket className="h-5 w-5 text-amber-500" /> Create Coupon
              </>
            )}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">
              Coupon Code *
            </label>
            <Input
              value={form.code}
              onChange={(e) => setField("code", e.target.value)}
              placeholder="e.g. SAVE10"
              maxLength={50}
              className="uppercase"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">
                Discount Type *
              </label>
              <select
                value={form.type}
                onChange={(e) => setField("type", e.target.value)}
                className="w-full rounded-xl border border-border bg-muted/60 px-3 py-2.5 text-sm focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {COUPON_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">
                {form.type === "PERCENTAGE"
                  ? "Discount (%) *"
                  : form.type === "FIXED"
                    ? "Discount (₹) *"
                    : "Delivery Benefit"}
              </label>
              {form.type === "FREE_DELIVERY" ? (
                <div className="h-10 px-3 rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/30 flex items-center text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  🚚 100% Free Delivery (₹0 Fee)
                </div>
              ) : (
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.value}
                  onChange={(e) => setField("value", e.target.value)}
                  placeholder={form.type === "PERCENTAGE" ? "e.g. 10 for 10%" : "e.g. 50 for ₹50"}
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">
                Max Discount (optional)
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.max_discount}
                onChange={(e) => setField("max_discount", e.target.value)}
                placeholder="Cap for % discounts"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">
                Min Order Value (optional)
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.min_order_value}
                onChange={(e) => setField("min_order_value", e.target.value)}
                placeholder="₹"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">
                Total Usage Limit (0 = unlimited)
              </label>
              <Input
                type="number"
                min="0"
                value={form.usage_limit}
                onChange={(e) => setField("usage_limit", e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">
                Per-User Limit
              </label>
              <Input
                type="number"
                min="1"
                value={form.per_user_limit}
                onChange={(e) => setField("per_user_limit", e.target.value)}
                placeholder="1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">
                Valid From *
              </label>
              <Input
                type="datetime-local"
                value={form.valid_from}
                onChange={(e) => setField("valid_from", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">
                Valid Until *
              </label>
              <Input
                type="datetime-local"
                value={form.valid_until}
                onChange={(e) => setField("valid_until", e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-amber-500 text-slate-950 hover:bg-amber-400 font-bold"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {isEditing ? "Saving..." : "Creating..."}
                </>
              ) : isEditing ? (
                "Save Changes"
              ) : (
                "Create Coupon"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
