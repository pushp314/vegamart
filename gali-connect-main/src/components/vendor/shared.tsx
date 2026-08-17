import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, FileCheck2, Ban, Crown, Star } from "lucide-react";
import { api } from "@/lib/api";

export function EmptyState({ icon: Icon, title, desc }: any) {
  return (
    <div className="rounded-3xl border border-border border-dashed p-10 text-center flex flex-col items-center justify-center bg-muted/50">
      <Icon className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
      <h3 className="font-semibold text-foreground text-sm">{title}</h3>
      <p className="text-xs text-muted-foreground mt-1 max-w-[200px] leading-relaxed">{desc}</p>
    </div>
  );
}

export function VendorKYCForm({ vendor, initialData, onSuccess }: any) {
  const [docType, setDocType] = useState(initialData?.document_type || "Aadhaar");
  const [docNum, setDocNum] = useState(initialData?.document_number || "");
  const [fssai, setFssai] = useState(initialData?.fssai_license || "");
  const [gst, setGst] = useState(initialData?.gst_number || "");

  const mutation = useMutation({
    mutationFn: (data: any) => api.post("/vendors/me/kyc", data),
    onSuccess: () => {
      toast.success("KYC documents submitted successfully");
      onSuccess();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to submit KYC");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docNum) {
      toast.error("Document Number is required");
      return;
    }
    mutation.mutate({
      document_type: docType,
      document_number: docNum,
      fssai_license: fssai || undefined,
      gst_number: gst || undefined,
    });
  };

  return (
    <div className="rounded-3xl border border-border bg-muted/50 p-6 shadow-2xl space-y-6">
      <div className="space-y-1">
        <h2 className="font-display text-lg font-bold">Complete KYC Verification</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          As a registered marketplace, we require identity verification for all vendors.
        </p>
      </div>

      {initialData?.status === "rejected" && (
        <div className="rounded-2xl bg-rose-500/10 p-4 border border-rose-200 space-y-2">
          <div className="font-bold text-rose-800 text-xs inline-flex items-center gap-1.5">
            <Ban className="h-4 w-4" /> Previous KYC Rejected
          </div>
          <p className="text-xs text-rose-600">
            {initialData.rejection_reason || "Please upload valid documents and try again."}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">
            Document Type *
          </label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="w-full rounded-2xl border border-border bg-muted/80 px-4 py-3 text-sm focus:bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="Aadhaar">Aadhaar Card</option>
            <option value="PAN">PAN Card</option>
            <option value="Passport">Passport</option>
            <option value="Driving License">Driving License</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">
            Document Number *
          </label>
          <input
            type="text"
            value={docNum}
            onChange={(e) => setDocNum(e.target.value)}
            placeholder={`Enter ${docType} number`}
            className="w-full rounded-2xl border border-border bg-muted/80 px-4 py-3 text-sm focus:bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">
            FSSAI License (Optional)
          </label>
          <input
            type="text"
            value={fssai}
            onChange={(e) => setFssai(e.target.value)}
            placeholder="Food safety license (if applicable)"
            className="w-full rounded-2xl border border-border bg-muted/80 px-4 py-3 text-sm focus:bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">
            GST Number (Optional)
          </label>
          <input
            type="text"
            value={gst}
            onChange={(e) => setGst(e.target.value)}
            placeholder="GSTIN (if registered)"
            className="w-full rounded-2xl border border-border bg-muted/80 px-4 py-3 text-sm focus:bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded-2xl bg-emerald-500 text-black px-4 py-3.5 text-sm font-bold shadow-2xl disabled:opacity-50 mt-2 inline-flex items-center justify-center gap-2"
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileCheck2 className="h-4 w-4" />
          )}
          Submit for Verification
        </button>
      </form>
    </div>
  );
}

export function VendorMembershipCard({ vendor }: { vendor: any }) {
  const plan = vendor?.membership_plan;
  const planName =
    plan?.name ||
    (vendor?.membership_tier === "basic" ? "Basic" : vendor?.membership_tier || "Basic");
  const isExpired =
    vendor?.membership_expires_at && new Date(vendor.membership_expires_at).getTime() <= Date.now();

  const expiryLabel = (() => {
    if (!vendor?.membership_expires_at) return "Lifetime";
    const exp = new Date(vendor.membership_expires_at);
    if (isExpired) return `Expired ${exp.toLocaleDateString()}`;
    const days = Math.ceil((exp.getTime() - Date.now()) / 86400000);
    return days <= 1 ? "Expires today" : `Expires in ${days} day${days > 1 ? "s" : ""}`;
  })();

  return (
    <div className="rounded-3xl border border-border bg-gradient-to-br from-card to-muted/60 p-5 space-y-4 shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-saffron to-primary text-white shadow-sm">
            <Crown className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold capitalize">{planName} Plan</h3>
            <p className="text-xs text-muted-foreground">
              {vendor?.is_sponsored && (
                <span className="mr-1.5 inline-flex items-center gap-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider">
                  <Star className="h-2.5 w-2.5" /> Sponsored
                </span>
              )}
              {expiryLabel} · {Number(vendor?.commission_rate ?? 5)}% store commission
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
