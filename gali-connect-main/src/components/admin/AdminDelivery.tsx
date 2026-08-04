import { Bike, CheckCircle2, Ban, Search, ShieldCheck, Clock, UserX } from "lucide-react";
import { useMemo, useState } from "react";

interface AdminDeliveryProps {
  deliveryList: any[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
}

export function AdminDelivery({
  deliveryList,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: AdminDeliveryProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "approved" | "pending" | "rejected" | "suspended"
  >("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return deliveryList.filter((p) => {
      const status = (p.status || "").toLowerCase();
      const name = (p.user?.name || "").toLowerCase();
      const email = (p.user?.email || "").toLowerCase();
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (q && !name.includes(q) && !email.includes(q)) return false;
      return true;
    });
  }, [deliveryList, query, statusFilter]);

  const approvedCount = deliveryList.filter(
    (p) => (p.status || "").toLowerCase() === "approved",
  ).length;
  const pendingCount = deliveryList.filter(
    (p) => (p.status || "").toLowerCase() === "pending",
  ).length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Delivery Fleet Management
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Review and manage delivery partners.</p>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Total Fleet
          </div>
          <div className="text-2xl font-black font-display text-foreground mt-1">
            {deliveryList.length}
          </div>
        </div>
        <div className="rounded-3xl border border-border bg-card p-5 shadow-soft flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Active Riders
            </div>
            <div className="text-2xl font-black font-display text-emerald-600 mt-1">
              {approvedCount}
            </div>
          </div>
          <ShieldCheck className="h-8 w-8 text-emerald-500/40" />
        </div>
        <div className="rounded-3xl border border-border bg-card p-5 shadow-soft flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Pending Review
            </div>
            <div className="text-2xl font-black font-display text-amber-600 mt-1">
              {pendingCount}
            </div>
          </div>
          <Clock className="h-8 w-8 text-amber-500/40" />
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by rider name or email..."
            className="w-full rounded-2xl bg-card border border-border pl-10 pr-4 h-11 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="rounded-2xl bg-card border border-border px-4 h-11 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
        >
          <option value="all">All Statuses</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <div className="rounded-3xl border border-border bg-card shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/70 text-muted-foreground uppercase text-[11px] font-bold tracking-wider border-b border-border">
              <tr>
                <th className="px-8 py-4">Rider</th>
                <th className="px-8 py-4">Vehicle</th>
                <th className="px-8 py-4">Status</th>
                <th className="px-8 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {filtered.map((partner) => {
                const status = (partner.status || "").toLowerCase();
                return (
                  <tr key={partner.id} className="hover:bg-muted/50 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-muted border border-border text-muted-foreground flex items-center justify-center group-hover:bg-emerald-50 group-hover:text-emerald-600 group-hover:border-emerald-200 transition-all">
                          <Bike className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="font-bold text-[15px] text-foreground">
                            {partner.user?.name || "Unknown Rider"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {partner.user?.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <p className="font-black text-sm uppercase text-foreground tracking-wider bg-muted inline-block px-3 py-1 rounded-lg border border-border">
                        {partner.vehicle_number || "—"}
                      </p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1.5 tracking-widest">
                        {partner.vehicle_type || "Unknown"}
                      </p>
                    </td>
                    <td className="px-8 py-5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider border
                      ${
                        status === "approved"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30"
                          : status === "pending"
                            ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30"
                            : status === "suspended"
                              ? "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-400 dark:border-violet-500/30"
                              : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30"
                      }`}
                      >
                        {status === "approved" && <CheckCircle2 className="h-3 w-3" />}
                        {status === "rejected" && <Ban className="h-3 w-3" />}
                        {partner.status || status}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex justify-end gap-3">
                        {status === "pending" && (
                          <>
                            <button
                              onClick={() => onReject(partner.id)}
                              disabled={isRejecting}
                              className="px-4 py-2 text-xs font-bold rounded-xl bg-muted text-rose-600 hover:bg-rose-50 hover:border-rose-200 border border-border transition-all active:scale-95 disabled:opacity-50"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => onApprove(partner.id)}
                              disabled={isApproving}
                              className="px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                            >
                              Approve
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {deliveryList.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Bike className="h-12 w-12 text-muted-foreground/40 mb-4" />
                      <p className="text-foreground font-medium">No delivery partners found.</p>
                    </div>
                  </td>
                </tr>
              )}
              {deliveryList.length > 0 && filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Search className="h-12 w-12 text-muted-foreground/40 mb-4" />
                      <p className="text-foreground font-medium">No riders match your search.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
