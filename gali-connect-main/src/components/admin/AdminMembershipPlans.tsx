import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, Loader2, Crown, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { api } from "@/lib/api";

export function AdminMembershipPlans() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);

  const { data: plansRes, isLoading } = useQuery({
    queryKey: ["adminMembershipPlans"],
    queryFn: () => api.get<any>("/admin/membership-plans?include_inactive=true"),
  });

  const plans: any[] = Array.isArray(plansRes?.data)
    ? plansRes.data
    : Array.isArray(plansRes?.data?.data)
      ? plansRes.data.data
      : [];

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/admin/membership-plans", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminMembershipPlans"] });
      setIsModalOpen(false);
      toast.success("Membership plan created");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to create plan"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.patch(`/admin/membership-plans/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminMembershipPlans"] });
      setIsModalOpen(false);
      toast.success("Membership plan updated");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to update plan"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/membership-plans/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminMembershipPlans"] });
      toast.success("Membership plan deleted");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to delete plan"),
  });

  const openEditModal = (plan: any) => {
    setEditingPlan(plan);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Vendor Membership Plans
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Define pricing and features. Assigning a plan to a vendor auto-applies its benefits.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingPlan(null);
            setIsModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Plan
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12 bg-card rounded-3xl border border-border">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan: any) => {
            const features: string[] = Array.isArray(plan.features) ? plan.features : [];
            return (
              <div
                key={plan.id}
                className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden flex flex-col"
              >
                <div className="p-6 pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-saffron to-primary text-white grid place-items-center">
                        <Crown className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg leading-tight">{plan.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">/v1/{plan.slug}</p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        plan.is_active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {plan.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="mt-4 flex items-end gap-1">
                    <span className="font-display text-3xl font-black">₹{Number(plan.price)}</span>
                    <span className="text-xs text-muted-foreground mb-1.5">
                      / {plan.billing_period === "lifetime" ? "lifetime" : plan.billing_period}
                    </span>
                  </div>

                  {plan.description && (
                    <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                  )}

                  <div className="mt-4 space-y-1.5">
                    {features.map((f: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-[13px] text-foreground">
                        <Check className="h-3.5 w-3.5 mt-0.5 text-emerald-600 shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
                    <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
                      {plan.product_limit === 0 ? "Unlimited" : plan.product_limit} products
                    </span>
                    <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
                      {Number(plan.commission_rate)}% commission
                    </span>
                    {plan.includes_sponsorship && (
                      <span className="rounded-full bg-rose-50 text-rose-700 border border-rose-200 px-2 py-1">
                        Sponsored placement
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-auto p-4 pt-0 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEditModal(plan)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 border-rose-200"
                    onClick={() => {
                      if (confirm(`Delete "${plan.name}"?`)) deleteMutation.mutate(plan.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
          {plans.length === 0 && (
            <div className="col-span-full py-16 text-center text-muted-foreground border-2 border-dashed border-border rounded-3xl">
              No membership plans yet. Create one to get started.
            </div>
          )}
        </div>
      )}

      <PlanFormModal
        open={isModalOpen}
        plan={editingPlan}
        onOpenChange={setIsModalOpen}
        onSave={(data) => {
          if (editingPlan) {
            updateMutation.mutate({ id: editingPlan.id, data });
          } else {
            createMutation.mutate(data);
          }
        }}
        isSaving={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}

function PlanFormModal({
  open,
  plan,
  onOpenChange,
  onSave,
  isSaving,
}: {
  open: boolean;
  plan: any;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => void;
  isSaving: boolean;
}) {
  const [featuresText, setFeaturesText] = useState(
    (Array.isArray(plan?.features) ? plan.features : []).join("\n"),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{plan ? "Edit Plan" : "Create Plan"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.target as HTMLFormElement);
            onSave({
              name: fd.get("name"),
              slug: fd.get("slug") || undefined,
              description: fd.get("description") || null,
              price: parseFloat(fd.get("price") as string),
              billing_period: fd.get("billing_period"),
              features: featuresText
                .split("\n")
                .map((f: string) => f.trim())
                .filter(Boolean),
              product_limit: parseInt(fd.get("product_limit") as string, 10),
              commission_rate: parseFloat(fd.get("commission_rate") as string),
              includes_sponsorship: fd.get("includes_sponsorship") === "on",
              is_active: fd.get("is_active") === "on",
              sort_order: parseInt(fd.get("sort_order") as string, 10) || 0,
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">Name</label>
              <Input name="name" defaultValue={plan?.name} required />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">
                Slug (optional)
              </label>
              <Input name="slug" defaultValue={plan?.slug} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-muted-foreground">Description</label>
            <Input name="description" defaultValue={plan?.description || ""} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">Price (₹)</label>
              <Input
                name="price"
                type="number"
                min="0"
                step="0.01"
                defaultValue={plan?.price ?? "0"}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">
                Billing Period
              </label>
              <select
                name="billing_period"
                defaultValue={plan?.billing_period || "monthly"}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
                <option value="lifetime">Lifetime</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-muted-foreground">
              Features (one per line)
            </label>
            <textarea
              value={featuresText}
              onChange={(e) => setFeaturesText(e.target.value)}
              rows={4}
              placeholder={"Up to 100 products\nLower commission\nPriority support"}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">
                Product Limit
              </label>
              <Input
                name="product_limit"
                type="number"
                min="0"
                defaultValue={plan?.product_limit ?? "20"}
              />
              <p className="text-[10px] text-muted-foreground">0 = unlimited</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">
                Commission %
              </label>
              <Input
                name="commission_rate"
                type="number"
                min="0"
                max="100"
                step="0.1"
                defaultValue={plan?.commission_rate ?? "5"}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">
                Sort Order
              </label>
              <Input name="sort_order" type="number" defaultValue={plan?.sort_order ?? "0"} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name="includes_sponsorship"
                defaultChecked={plan?.includes_sponsorship || false}
                className="rounded border-input"
              />
              Sponsored placement
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={plan ? plan.is_active : true}
                className="rounded border-input"
              />
              Active plan
            </label>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : plan ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
