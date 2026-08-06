import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

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
  const [commissionRate, setCommissionRate] = useState<string>(
    vendor.commission_rate?.toString() || "5",
  );
  const [membershipTier, setMembershipTier] = useState<string>(vendor.membership_tier || "basic");

  // Format dates correctly for input type="datetime-local"
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

  const handleSave = () => {
    onSave(vendor.id, {
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
          <DialogTitle>Edit Settings for {vendor.business_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
              Commission Rate (%)
            </label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={commissionRate}
              onChange={(e) => setCommissionRate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
              Membership Tier
            </label>
            <select
              value={membershipTier}
              onChange={(e) => setMembershipTier(e.target.value)}
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="basic">Basic (Free)</option>
              <option value="premium">Premium</option>
              <option value="gold">Gold (Featured)</option>
            </select>
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
              Leave blank for lifetime membership.
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
