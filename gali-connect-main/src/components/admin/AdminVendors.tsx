import { Store, CheckCircle2, Ban, Radio, Sparkles, Search } from "lucide-react";
import { useState, useMemo } from "react";
import { KYCReviewModal } from "./KYCReviewModal";

interface AdminVendorsProps {
  vendors: any[];
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onSuspend: (id: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
}

export function AdminVendors({
  vendors,
  onApprove,
  onReject,
  onSuspend,
  isApproving,
  isRejecting,
}: AdminVendorsProps) {
  const [reviewVendor, setReviewVendor] = useState<any>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "shop" | "roaming">("all");
  const [query, setQuery] = useState("");

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
                          <p className="font-bold text-[15px] text-foreground">
                            {v.business_name || "Unnamed Vendor"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {v.user?.email || v.city || "—"}
                          </p>
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
                          <button
                            onClick={() => {
                              if (confirm("Suspend this vendor?")) onSuspend(v.id);
                            }}
                            className="px-4 py-2 text-xs font-bold rounded-xl bg-muted text-rose-600 hover:bg-rose-50 hover:border-rose-200 border border-border transition-all active:scale-95"
                          >
                            Suspend
                          </button>
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
    </div>
  );
}
