import { Store, CheckCircle2, Ban, Radio, Sparkles, Search, Crown, Trash2 } from "lucide-react";
import { useState, useMemo } from "react";
import { KYCReviewModal } from "./KYCReviewModal";
import { VendorMembershipModal } from "./VendorMembershipModal";
import { VendorEarningsModal } from "./VendorEarningsModal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

interface AdminVendorsProps {
  vendors: any[];
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onSuspend: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onPromote: (id: string, sponsoredUntil?: string | null, sponsoredPriority?: number) => void;
  onUnpromote: (id: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
}

export function AdminVendors({
  vendors,
  onApprove,
  onReject,
  onSuspend,
  onRestore,
  onDelete,
  onPromote,
  onUnpromote,
  isApproving,
  isRejecting,
}: AdminVendorsProps) {
  const [reviewVendor, setReviewVendor] = useState<any>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "shop" | "roaming">("all");
  const [query, setQuery] = useState("");
  const [editingSettingsVendor, setEditingSettingsVendor] = useState<any>(null);
  const [earningsVendor, setEarningsVendor] = useState<any>(null);
  const [promoteTargetVendor, setPromoteTargetVendor] = useState<any>(null);

  const queryClient = useQueryClient();

  const updateMembershipMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.patch(`/admin/vendors/${id}/membership`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminVendors"] });
      toast.success("Vendor membership updated successfully");
      setEditingSettingsVendor(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update vendor membership");
    },
  });

  const filteredVendors = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vendors.filter((v) => {
      const vType = v.profile?.vendor_type || v.vendor_type || "shop";
      if (typeFilter !== "all" && vType !== typeFilter) return false;
      if (q) {
        const name = (v.business_name || "").toLowerCase();
        const email = (v.user?.email || v.city || "").toLowerCase();
        if (!name.includes(q) && !email.includes(q)) return false;
      }
      return true;
    });
  }, [vendors, typeFilter, query]);

  const shopCount = vendors.filter(
    (v) => (v.profile?.vendor_type || v.vendor_type || "shop") === "shop",
  ).length;
  const roamingCount = vendors.filter(
    (v) => (v.profile?.vendor_type || v.vendor_type) === "roaming",
  ).length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Vendor Fleet Management
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Review and approve fixed shop merchants and roaming street vendors.
          </p>
        </div>
      </div>

      {/* Live Fleet Stats Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Total Registered
          </div>
          <div className="text-2xl font-black font-display text-foreground mt-1">
            {vendors.length}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-soft flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Fixed Store Merchants
            </div>
            <div className="text-2xl font-black font-display text-emerald-600 mt-1">
              {shopCount}
            </div>
          </div>
          <Store className="h-8 w-8 text-emerald-500/40" />
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-soft flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Roaming Street Carts
            </div>
            <div className="text-2xl font-black font-display text-amber-600 mt-1">
              {roamingCount}
            </div>
          </div>
          <Sparkles className="h-8 w-8 text-amber-500/40" />
        </div>
      </div>

      {/* Vendor Type Filter Tabs */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex gap-2 p-1 bg-muted border border-border rounded-2xl w-fit">
          {(["all", "shop", "roaming"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-5 py-2 rounded-xl text-xs font-bold capitalize transition-all whitespace-nowrap ${
                typeFilter === t
                  ? "bg-card text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "all" ? "All Vendors" : t === "shop" ? "Fixed Stores" : "Roaming Carts"}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vendors..."
            className="w-full rounded-2xl bg-card border border-border pl-10 pr-4 h-11 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
      </div>

      {/* Vendors Table */}
      <div className="rounded-3xl border border-border bg-card shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/70 text-muted-foreground uppercase text-[11px] font-bold tracking-wider border-b border-border">
              <tr>
                <th className="px-8 py-4">Vendor / Business</th>
                <th className="px-8 py-4">Type</th>
                <th className="px-8 py-4">Status</th>
                <th className="px-8 py-4">KYC</th>
                <th className="px-8 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {filteredVendors.map((v: any) => {
                const vType = v.profile?.vendor_type || v.vendor_type || "shop";
                const status = (v.status || "").toLowerCase();
                return (
                  <tr key={v.id} className="hover:bg-muted/50 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-muted border border-border text-muted-foreground flex items-center justify-center group-hover:bg-emerald-50 group-hover:text-emerald-600 group-hover:border-emerald-200 transition-all">
                          {vType === "roaming" ? (
                            <Radio className="h-6 w-6" />
                          ) : (
                            <Store className="h-6 w-6" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-[15px] text-foreground flex items-center gap-2">
                            {v.business_name || "Unnamed Vendor"}
                            {v.is_sponsored && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider">
                                <Crown className="h-3 w-3" /> Sponsored
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {v.user?.email || v.city || "—"}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                              <Crown className="h-2.5 w-2.5" />
                              {v.membership_plan?.name || v.membership_tier || "Basic"}
                            </span>
                            {v.membership_expires_at && (
                              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                                {new Date(v.membership_expires_at).getTime() <= Date.now()
                                  ? "Expired"
                                  : "Active"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${vType === "roaming" ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30" : "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30"}`}
                      >
                        {vType === "roaming" ? (
                          <Radio className="h-3 w-3" />
                        ) : (
                          <Store className="h-3 w-3" />
                        )}
                        {vType === "roaming" ? "Roaming Cart" : "Fixed Store"}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider
                      ${
                        status === "approved"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30"
                          : status === "pending"
                            ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30"
                            : status === "suspended"
                              ? "bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-500/15 dark:text-violet-400 dark:border-violet-500/30"
                              : "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30"
                      }`}
                      >
                        {status === "approved" && <CheckCircle2 className="h-3 w-3" />}
                        {status === "rejected" && <Ban className="h-3 w-3" />}
                        {v.status || status}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        {v.kyc?.status || "NOT SUBMITTED"}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex justify-end gap-3">
                        {status === "pending" && (
                          <button
                            onClick={() => setReviewVendor(v)}
                            className="px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm transition-all active:scale-95"
                          >
                            Review KYC
                          </button>
                        )}
                        {status === "approved" && (
                          <>
                            <button
                              onClick={() => setEditingSettingsVendor(v)}
                              className="px-4 py-2 text-xs font-bold rounded-xl bg-muted text-foreground hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 border border-border transition-all active:scale-95"
                            >
                              Settings
                            </button>
                            <button
                              onClick={() => setEarningsVendor(v)}
                              className="px-4 py-2 text-xs font-bold rounded-xl bg-muted text-foreground hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 border border-border transition-all active:scale-95"
                            >
                              Earnings
                            </button>
                            <Link
                              to="/admin/products"
                              search={{ vendor_id: v.id }}
                              className="px-4 py-2 text-xs font-bold rounded-xl bg-muted text-foreground hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 border border-border transition-all active:scale-95 text-center flex items-center justify-center"
                            >
                              Products
                            </Link>
                            <Link
                              to="/admin/orders"
                              search={{ vendor_id: v.id }}
                              className="px-4 py-2 text-xs font-bold rounded-xl bg-muted text-foreground hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 border border-border transition-all active:scale-95 text-center flex items-center justify-center"
                            >
                              Orders
                            </Link>
                            {v.is_sponsored ? (
                              <button
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Demote "${v.business_name}" and remove top search placement?`,
                                    )
                                  )
                                    onUnpromote(v.id);
                                }}
                                className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition-all active:scale-95"
                              >
                                Demote
                              </button>
                            ) : (
                              <button
                                onClick={() => setPromoteTargetVendor(v)}
                                className="px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-gradient-to-r from-rose-500 to-saffron text-white hover:opacity-90 shadow-sm transition-all active:scale-95 flex items-center gap-1"
                              >
                                <Sparkles className="h-3 w-3" /> Promote
                              </button>
                            )}
                            <button
                              onClick={() => {
                                if (confirm("Suspend this vendor?")) onSuspend(v.id);
                              }}
                              className="px-4 py-2 text-xs font-bold rounded-xl bg-muted text-rose-600 hover:bg-rose-50 hover:border-rose-200 border border-border transition-all active:scale-95"
                            >
                              Suspend
                            </button>
                            <button
                              onClick={() => {
                                if (
                                  confirm(
                                    `Delete vendor "${v.business_name || "Unnamed Vendor"}" and its account? This cannot be undone.`,
                                  )
                                ) {
                                  onDelete(v.id);
                                }
                              }}
                              className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 text-white hover:bg-rose-700 border border-rose-700 transition-all active:scale-95 inline-flex items-center gap-1"
                            >
                              <Trash2 className="h-3 w-3" /> Delete
                            </button>
                          </>
                        )}
                        {status === "suspended" && (
                          <>
                            <button
                              onClick={() => {
                                if (confirm("Unsuspend this vendor?")) onRestore(v.id);
                              }}
                              className="px-4 py-2 text-xs font-bold rounded-xl bg-violet-100 text-violet-700 hover:bg-violet-200 border border-violet-200 transition-all active:scale-95"
                            >
                              Unsuspend
                            </button>
                            <button
                              onClick={() => {
                                if (
                                  confirm(
                                    `Delete vendor "${v.business_name || "Unnamed Vendor"}" and its account? This cannot be undone.`,
                                  )
                                ) {
                                  onDelete(v.id);
                                }
                              }}
                              className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 text-white hover:bg-rose-700 border border-rose-700 transition-all active:scale-95 inline-flex items-center gap-1"
                            >
                              <Trash2 className="h-3 w-3" /> Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredVendors.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      {query ? (
                        <Search className="h-12 w-12 text-muted-foreground/40 mb-4" />
                      ) : (
                        <Store className="h-12 w-12 text-muted-foreground/40 mb-4" />
                      )}
                      <p className="text-foreground font-medium">
                        {query ? "No vendors match your search." : "No vendors found."}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {reviewVendor && (
        <KYCReviewModal
          vendor={reviewVendor}
          onClose={() => setReviewVendor(null)}
          onApprove={(id: string) => {
            onApprove(id);
            setReviewVendor(null);
          }}
          onReject={(id: string, reason: string) => {
            onReject(id, reason);
            setReviewVendor(null);
          }}
          isApproving={isApproving}
          isRejecting={isRejecting}
        />
      )}

      {editingSettingsVendor && (
        <VendorMembershipModal
          vendor={editingSettingsVendor}
          onClose={() => setEditingSettingsVendor(null)}
          onSave={(id, data) => updateMembershipMutation.mutate({ id, data })}
          isSaving={updateMembershipMutation.isPending}
        />
      )}

      {earningsVendor && (
        <VendorEarningsModal vendor={earningsVendor} onClose={() => setEarningsVendor(null)} />
      )}

      {promoteTargetVendor && (
        <PromotionScheduleModal
          vendor={promoteTargetVendor}
          onClose={() => setPromoteTargetVendor(null)}
          onConfirm={(sponsoredUntil, sponsoredPriority) => {
            onPromote(promoteTargetVendor.id, sponsoredUntil, sponsoredPriority);
            setPromoteTargetVendor(null);
          }}
        />
      )}
    </div>
  );
}

function PromotionScheduleModal({
  vendor,
  onClose,
  onConfirm,
}: {
  vendor: any;
  onClose: () => void;
  onConfirm: (sponsoredUntil: string | null, sponsoredPriority: number) => void;
}) {
  const [durationOption, setDurationOption] = useState<
    "indefinite" | "1hour" | "1day" | "7days" | "30days" | "custom"
  >("1day");
  const [customDays, setCustomDays] = useState(1);
  const [priority, setPriority] = useState<number>(vendor.sponsored_priority || 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let untilIso: string | null = null;

    if (durationOption !== "indefinite") {
      const now = new Date();
      let durationMs = 0;
      if (durationOption === "1hour") durationMs = 60 * 60 * 1000;
      else if (durationOption === "1day") durationMs = 24 * 60 * 60 * 1000;
      else if (durationOption === "7days") durationMs = 7 * 24 * 60 * 60 * 1000;
      else if (durationOption === "30days") durationMs = 30 * 24 * 60 * 60 * 1000;
      else if (durationOption === "custom")
        durationMs = (Math.max(1, customDays) || 1) * 24 * 60 * 60 * 1000;
      const expiresAt = new Date(now.getTime() + durationMs);
      untilIso = expiresAt.toISOString();
    }

    onConfirm(untilIso, Number(priority) || 0);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4 overflow-y-auto">
      <div className="bg-card text-card-foreground border border-border w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Promote Vendor</h3>
              <p className="text-xs text-muted-foreground">{vendor.business_name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-foreground block mb-2">
              Select Promotion Duration (Top Search Ranking)
            </label>
            <div className="space-y-2">
              {[
                { id: "1hour", label: "1 Hour", desc: "Short term burst promotion" },
                { id: "1day", label: "1 Day (24 Hours)", desc: "Standard daily boost" },
                { id: "7days", label: "7 Days (1 Week)", desc: "Weekly campaign boost" },
                { id: "30days", label: "30 Days (1 Month)", desc: "Monthly feature boost" },
                { id: "custom", label: "Custom Days", desc: "Specify custom number of days" },
                {
                  id: "indefinite",
                  label: "Indefinite / Permanent",
                  desc: "Promoted until manually demoted",
                },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                    durationOption === opt.id
                      ? "bg-amber-500/10 border-amber-500/40 text-foreground"
                      : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name="duration"
                    value={opt.id}
                    checked={durationOption === opt.id}
                    onChange={() => setDurationOption(opt.id as any)}
                    className="mt-0.5 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <div className="text-xs font-bold text-foreground">{opt.label}</div>
                    <div className="text-[11px] text-muted-foreground">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {durationOption === "custom" && (
            <div className="pt-1">
              <label className="text-xs font-bold text-foreground block mb-1">Number of Days</label>
              <input
                type="number"
                min="1"
                max="365"
                value={customDays}
                onChange={(e) => setCustomDays(parseInt(e.target.value) || 1)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          )}

          <div className="pt-2">
            <label className="text-xs font-bold text-foreground block mb-1">
              Promotion Priority Rank (Higher appears first)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
              />
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                (e.g., 10 = VIP, 5 = High, 0 = Normal)
              </span>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold rounded-xl border border-border bg-muted hover:bg-muted/80 text-foreground transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md hover:opacity-90 transition-all active:scale-95 flex items-center gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" /> Confirm Promotion
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
