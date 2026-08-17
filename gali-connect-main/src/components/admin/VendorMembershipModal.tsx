import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Crown, Check } from "lucide-react";
import { api } from "@/lib/api";

interface VendorMembershipModalProps {
  vendor: any;
  onClose: () => void;
  onSave: (vendorId: string, data: any) => void;
  isSaving: boolean;
}

export function VendorMembershipModal({
  vendor,
  onClose,
  onSave,
  isSaving,
}: VendorMembershipModalProps) {
  const { data: plansRes } = useQuery({
    queryKey: ["adminMembershipPlans"],
    queryFn: () => api.get<any>("/admin/membership-plans?include_inactive=true"),
  });

  const plans: any[] = Array.isArray(plansRes?.data)
    ? plansRes.data
    : Array.isArray(plansRes?.data?.data)
      ? plansRes.data.data
      : [];

  const initialPlanId =
    vendor.membership_plan_id || plans.find((p) => p.slug === vendor.membership_tier)?.id || "";
  const [planId, setPlanId] = useState<string>(initialPlanId);
  const [commissionRate, setCommissionRate] = useState<string>(
    vendor.commission_rate?.toString() || "5",
  );
  const [membershipTier, setMembershipTier] = useState<string>(vendor.membership_tier || "basic");

  const getInitialDate = () => {
    if (vendor.membership_expires_at) {
      const d = new Date(vendor.membership_expires_at);
      if (!isNaN(d.getTime())) {
        return d.toISOString().slice(0, 16);
      }
    }
    return "";
  };

  const [membershipExpiresAt, setMembershipExpiresAt] = useState<string>(getInitialDate());

  const selectedPlan = plans.find((p) => p.id === planId);

  const handleSave = () => {
    onSave(vendor.id, {
      membership_plan_id: planId || null,
      commission_rate: parseFloat(commissionRate),
      membership_tier: membershipTier,
      membership_expires_at: membershipExpiresAt
        ? new Date(membershipExpiresAt).toISOString()
        : null,
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Membership & Settings — {vendor.business_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
          <div className="space-y-2">
            <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
              Membership Plan
            </label>
            <select
              value={planId}
              onChange={(e) => {
                setPlanId(e.target.value);
                const plan = plans.find((p) => p.id === e.target.value);
                if (plan) {
                  setMembershipTier(plan.slug);
                }
              }}
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">No plan (manual)</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — ₹{Number(p.price)} /{" "}
                  {p.billing_period === "lifetime" ? "lifetime" : p.billing_period}
                </option>
              ))}
            </select>
            {selectedPlan && (
              <div className="rounded-2xl border border-border bg-muted/40 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-black text-rose-600 uppercase tracking-wider">
                  <Crown className="h-3.5 w-3.5" /> Auto-applied benefits
                </div>
                {(selectedPlan.features || []).map((f: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-[12.5px] text-foreground">
                    <Check className="h-3.5 w-3.5 mt-0.5 text-emerald-600 shrink-0" />
                    {f}
                  </div>
                ))}
                <div className="pt-1 text-[11px] text-muted-foreground">
                  {selectedPlan.product_limit === 0 ? "Unlimited" : selectedPlan.product_limit}{" "}
                  products · {selectedPlan.includes_sponsorship ? "Sponsored ✓" : "No sponsorship"}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                Store Commission Rate (%)
              </label>
              <span className="text-[10px] font-semibold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                Admin Controlled
              </span>
            </div>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={commissionRate}
              onChange={(e) => setCommissionRate(e.target.value)}
              placeholder="e.g. 5, 10, 7, 12"
            />
            <p className="text-[10px] text-muted-foreground">
              Applied automatically to all sales from this store. Independent of membership plans.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
              Membership Tier
            </label>
            <Input
              value={membershipTier}
              onChange={(e) => setMembershipTier(e.target.value)}
              placeholder="basic"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
              Membership Expires At
            </label>
            <Input
              type="datetime-local"
              value={membershipExpiresAt}
              onChange={(e) => setMembershipExpiresAt(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground">
              Leave blank to use the plan's default duration, or lifetime for no expiry.
            </p>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
