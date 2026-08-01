import { Store, MoreHorizontal, CheckCircle2, Ban, Radio, Sparkles, Navigation } from "lucide-react";
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

export function AdminVendors({ vendors, onApprove, onReject, onSuspend, isApproving, isRejecting }: AdminVendorsProps) {
  const [reviewVendor, setReviewVendor] = useState<any>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "shop" | "roaming">("all");

  const filteredVendors = useMemo(() => {
    if (typeFilter === "all") return vendors;
    return vendors.filter(v => (v.profile?.vendor_type || v.vendor_type || "shop") === typeFilter);
  }, [vendors, typeFilter]);

  const shopCount = vendors.filter(v => (v.profile?.vendor_type || v.vendor_type || "shop") === "shop").length;
  const roamingCount = vendors.filter(v => (v.profile?.vendor_type || v.vendor_type) === "roaming").length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 text-white">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight">Vendor Fleet Management</h2>
          <p className="text-zinc-400 text-sm mt-1">Review and approve fixed shop merchants and roaming street vendors.</p>
        </div>
      </div>

      {/* Live Fleet Stats Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Total Registered</div>
          <div className="text-2xl font-black font-display text-zinc-100 mt-1">{vendors.length}</div>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-5 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Fixed Store Merchants</div>
            <div className="text-2xl font-black font-display text-emerald-400 mt-1">{shopCount}</div>
          </div>
          <Store className="h-8 w-8 text-emerald-500/40" />
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-5 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Roaming Street Carts</div>
            <div className="text-2xl font-black font-display text-amber-400 mt-1">{roamingCount}</div>
          </div>
          <Sparkles className="h-8 w-8 text-amber-500/40" />
        </div>
      </div>

      {/* Vendor Type Filter Tabs */}
      <div className="flex gap-2 p-1 bg-zinc-900/80 border border-zinc-800 rounded-2xl w-fit">
        <button
          onClick={() => setTypeFilter("all")}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            typeFilter === "all" ? "bg-zinc-800 text-white shadow-md" : "text-zinc-400 hover:text-white"
          }`}
        >
          All Vendors ({vendors.length})
        </button>
        <button
          onClick={() => setTypeFilter("shop")}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            typeFilter === "shop" ? "bg-emerald-950 text-emerald-300 border border-emerald-800 shadow-md" : "text-zinc-400 hover:text-white"
          }`}
        >
          <Store className="h-3.5 w-3.5" /> Fixed Shops ({shopCount})
        </button>
        <button
          onClick={() => setTypeFilter("roaming")}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            typeFilter === "roaming" ? "bg-amber-950 text-amber-300 border border-amber-800 shadow-md" : "text-zinc-400 hover:text-white"
          }`}
        >
          <Navigation className="h-3.5 w-3.5 animate-pulse" /> Roaming Carts ({roamingCount})
        </button>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-950/80 text-zinc-500 uppercase text-[11px] font-bold tracking-wider border-b border-zinc-800">
              <tr>
                <th className="px-8 py-5">Vendor / Store</th>
                <th className="px-8 py-5">Type</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5">KYC Status</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filteredVendors.map((v) => {
                const vType = v.profile?.vendor_type || v.vendor_type || "shop";
                return (
                <tr key={v.id} className="hover:bg-zinc-800/30 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-zinc-800/50 border border-zinc-700 text-zinc-300 flex items-center justify-center group-hover:bg-emerald-500/10 group-hover:text-emerald-500 group-hover:border-emerald-500/20 transition-all">
                        {vType === "roaming" ? <Sparkles className="h-6 w-6 text-amber-400" /> : <Store className="h-6 w-6 text-emerald-400" />}
                      </div>
                      <div>
                        <p className="font-bold text-[15px] text-zinc-100">{v.business_name}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{v.user?.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      vType === "roaming"
                        ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                        : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                    }`}>
                      {vType === "roaming" ? "🛒 Roaming Cart" : "🏪 Fixed Store"}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider
                      ${v.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]' :
                        v.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]' :
                        'bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-[0_0_10px_rgba(225,29,72,0.2)]'
                      }`}
                    >
                      {v.status === 'approved' && <CheckCircle2 className="h-3 w-3" />}
                      {v.status === 'rejected' && <Ban className="h-3 w-3" />}
                      {v.status}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                      {v.kyc?.status || "NOT SUBMITTED"}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end gap-3">
                      {v.status === "pending" && (
                        <button
                          onClick={() => setReviewVendor(v)}
                          className="px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all active:scale-95"
                        >
                          Review KYC
                        </button>
                      )}
                      {v.status === "approved" && (
                        <button
                          onClick={() => {
                            if(confirm("Suspend this vendor?")) onSuspend(v.id);
                          }}
                          className="px-4 py-2 text-xs font-bold rounded-xl bg-zinc-800 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20 border border-transparent transition-all active:scale-95"
                        >
                          Suspend
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
              {vendors.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Store className="h-12 w-12 text-zinc-700 mb-4" />
                      <p className="text-zinc-500 font-medium">No vendors found.</p>
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
