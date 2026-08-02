import { Users, MoreHorizontal, Power, PowerOff } from "lucide-react";

interface AdminUsersProps {
  users: any[];
  onToggleStatus: (id: string, isActive: boolean) => void;
}

export function AdminUsers({ users, onToggleStatus }: AdminUsersProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 text-white">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight">User Management</h2>
          <p className="text-zinc-400 text-sm mt-1">Manage all registered customers and staff.</p>
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-950/80 text-zinc-500 uppercase text-[11px] font-bold tracking-wider border-b border-zinc-800">
              <tr>
                <th className="px-8 py-5">User</th>
                <th className="px-8 py-5">Role</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-zinc-800/30 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-zinc-800/50 border border-zinc-700 text-zinc-300 flex items-center justify-center group-hover:bg-blue-500/10 group-hover:text-blue-500 group-hover:border-blue-500/20 transition-all">
                        <Users className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-bold text-[15px] text-zinc-100">{u.name || "Unknown User"}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest bg-zinc-800/50 border border-zinc-700 px-3 py-1.5 rounded-xl">
                      {u.role?.slug || u.role || "unknown"}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider
                      ${u.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-[0_0_10px_rgba(225,29,72,0.2)]'}`}
                    >
                      {u.is_active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button
                      onClick={() => onToggleStatus(u.id, !u.is_active)}
                      className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl border transition-all active:scale-95
                        ${u.is_active 
                          ? 'bg-zinc-900 border-zinc-800 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20' 
                          : 'bg-zinc-900 border-zinc-800 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/20'}`}
                    >
                      {u.is_active ? (
                        <>
                          <PowerOff className="h-4 w-4" /> Disable
                        </>
                      ) : (
                        <>
                          <Power className="h-4 w-4" /> Enable
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Users className="h-12 w-12 text-zinc-700 mb-4" />
                      <p className="text-zinc-500 font-medium">No users found.</p>
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
