import { Bike, CheckCircle2, Ban } from "lucide-react";

interface AdminDeliveryProps {
  deliveryList: any[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
}

export function AdminDelivery({ deliveryList, onApprove, onReject, isApproving, isRejecting }: AdminDeliveryProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">Delivery Fleet Management</h2>
          <p className="text-muted-foreground text-sm mt-1">Review and manage delivery partners.</p>
        </div>
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
              {deliveryList.map((partner) => {
                const status = (partner.status || "").toLowerCase();
                return (
                <tr key={partner.id} className="hover:bg-muted/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-muted border border-border text-muted-foreground flex items-center justify-center group-hover:bg-emerald-50 group-hover:text-emerald-600 group-hover:border-emerald-200 transition-all">
                        <Bike className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-bold text-[15px] text-foreground">{partner.user?.name || "Unknown Rider"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{partner.user?.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <p className="font-black text-sm uppercase text-foreground tracking-wider bg-muted inline-block px-3 py-1 rounded-lg border border-border">{partner.vehicle_number || "—"}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1.5 tracking-widest">{partner.vehicle_type || "Unknown"}</p>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider border
                      ${status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        status === 'suspended' ? 'bg-violet-50 text-violet-700 border-violet-200' :
                        'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {status === 'approved' && <CheckCircle2 className="h-3 w-3" />}
                      {status === 'rejected' && <Ban className="h-3 w-3" />}
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
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}