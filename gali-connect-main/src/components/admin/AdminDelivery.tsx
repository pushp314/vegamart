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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 text-white">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight">Delivery Fleet Management</h2>
          <p className="text-zinc-400 text-sm mt-1">Review and manage delivery partners.</p>
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-950/80 text-zinc-500 uppercase text-[11px] font-bold tracking-wider border-b border-zinc-800">
              <tr>
                <th className="px-8 py-5">Rider</th>
                <th className="px-8 py-5">Vehicle</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {deliveryList.map((partner) => (
                <tr key={partner.id} className="hover:bg-zinc-800/30 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-zinc-800/50 border border-zinc-700 text-zinc-300 flex items-center justify-center group-hover:bg-emerald-500/10 group-hover:text-emerald-500 group-hover:border-emerald-500/20 transition-all">
                        <Bike className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-bold text-[15px] text-zinc-100">{partner.user?.name || "Unknown Rider"}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{partner.user?.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <p className="font-black text-sm uppercase text-zinc-200 tracking-wider bg-zinc-800/50 inline-block px-3 py-1 rounded-lg border border-zinc-700">{partner.vehicle_number}</p>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase mt-1.5 tracking-widest">{partner.vehicle_type}</p>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider
                      ${partner.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]' :
                        partner.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]' :
                        'bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-[0_0_10px_rgba(225,29,72,0.2)]'
                      }`}
                    >
                      {partner.status === 'approved' && <CheckCircle2 className="h-3 w-3" />}
                      {partner.status === 'rejected' && <Ban className="h-3 w-3" />}
                      {partner.status}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end gap-3">
                      {partner.status === "pending" && (
                        <>
                          <button
                            onClick={() => onReject(partner.id)}
                            disabled={isRejecting}
                            className="px-4 py-2 text-xs font-bold rounded-xl bg-zinc-800 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20 border border-transparent transition-all active:scale-95 disabled:opacity-50"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => onApprove(partner.id)}
                            disabled={isApproving}
                            className="px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all active:scale-95 disabled:opacity-50"
                          >
                            Approve
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {deliveryList.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Bike className="h-12 w-12 text-zinc-700 mb-4" />
                      <p className="text-zinc-500 font-medium">No delivery partners found.</p>
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
