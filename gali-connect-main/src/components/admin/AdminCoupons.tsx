import { useState } from "react";
import { Plus, Tag, Search, CheckCircle2, Ban } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminPaginationBar, type PaginationMeta } from "./AdminPaginationBar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AdminCoupons() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data: couponsRes, isLoading } = useQuery({
    queryKey: ["adminCoupons", query, page],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("per_page", "20");
      if (query.trim()) params.set("q", query.trim());
      return api.get<any>(`/coupons?${params.toString()}`);
    },
  });

  const coupons = Array.isArray(couponsRes?.data) ? couponsRes.data : [];
  const pagination = couponsRes?.pagination as PaginationMeta | undefined;

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/coupons", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminCoupons"] });
      toast.success("Coupon created successfully");
      setIsCreateModalOpen(false);
    },
    onError: (err: any) => toast.error(err?.message || "Failed to create coupon"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/coupons/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminCoupons"] });
      toast.success("Coupon deleted successfully");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to delete coupon"),
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Coupons
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Manage promotional codes and discounts.
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Coupon
        </Button>
      </div>

      <div className="flex items-center gap-4 bg-card border border-border p-3 rounded-2xl">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search coupons..."
            className="pl-10 rounded-xl bg-muted/50 border-transparent focus:bg-background"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {coupons.map((coupon: any) => (
          <div
            key={coupon.id}
            className="rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Tag className="h-5 w-5 text-primary" />
                  <span className="font-black text-lg text-foreground tracking-tight">
                    {coupon.code}
                  </span>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${coupon.is_active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}
                >
                  {coupon.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground font-medium mb-1">
                {coupon.type === "PERCENTAGE" ? `${coupon.value}% OFF` : `₹${coupon.value} OFF`}
              </p>
              <p className="text-xs text-muted-foreground/70">
                Max Discount: ₹{coupon.max_discount}
              </p>
              {coupon.valid_until && (
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Expires: {new Date(coupon.valid_until).toLocaleDateString()}
                </p>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-border flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                onClick={() => {
                  if (confirm("Are you sure you want to delete this coupon?")) {
                    deleteMutation.mutate(coupon.id);
                  }
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      {coupons.length === 0 && !isLoading && (
        <div className="text-center py-20 bg-card rounded-3xl border border-border">
          <Tag className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-bold">No coupons found</h3>
          <p className="text-muted-foreground text-sm">Create a new coupon to get started.</p>
        </div>
      )}

      <AdminPaginationBar pagination={pagination} onPageChange={setPage} />

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Coupon</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.target as HTMLFormElement);
              createMutation.mutate({
                code: fd.get("code"),
                type: fd.get("discount_type"),
                value: Number(fd.get("discount_value")),
                min_order_value: Number(fd.get("min_order_value")) || 0,
                max_discount: Number(fd.get("max_discount")) || 0,
                valid_from: new Date().toISOString(),
                valid_until: fd.get("expires_at")
                  ? new Date(fd.get("expires_at") as string).toISOString()
                  : new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
                usage_limit: fd.get("usage_limit") ? Number(fd.get("usage_limit")) : 0,
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">
                Coupon Code
              </label>
              <Input name="code" placeholder="e.g. SUMMER20" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Type</label>
                <select
                  name="discount_type"
                  required
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="FLAT">Flat Amount</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Value</label>
                <Input name="discount_value" type="number" step="0.01" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  Min Order (₹)
                </label>
                <Input name="min_order_value" type="number" step="0.01" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  Max Discount (₹)
                </label>
                <Input name="max_discount" type="number" step="0.01" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  Expires At
                </label>
                <Input name="expires_at" type="datetime-local" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  Usage Limit
                </label>
                <Input name="usage_limit" type="number" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
