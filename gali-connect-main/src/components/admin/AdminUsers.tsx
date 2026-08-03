import { Users, Power, PowerOff } from "lucide-react";

interface AdminUsersProps {
  users: any[];
  onToggleStatus: (id: string, isActive: boolean) => void;
}

export function AdminUsers({ users, onToggleStatus }: AdminUsersProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">User Management</h2>
          <p className="text-muted-foreground text-sm mt-1">Manage all registered customers and staff.</p>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/70 text-muted-foreground uppercase text-[11px] font-bold tracking-wider border-b border-border">
              <tr>
                <th className="px-8 py-4">User</th>
                <th className="px-8 py-4">Role</th>
                <th className="px-8 py-4">Status</th>
                <th className="px-8 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-muted border border-border text-muted-foreground flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-200 transition-all">
                        <Users className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-bold text-[15px] text-foreground">{u.name || "Unknown User"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-muted border border-border px-3 py-1.5 rounded-xl">
                      {u.role?.slug || u.role || "unknown"}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider border
                      ${u.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}
                    >
                      {u.is_active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button
                      onClick={() => onToggleStatus(u.id, !u.is_active)}
                      className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl border transition-all active:scale-95
                        ${u.is_active 
                          ? 'bg-card border-border text-rose-600 hover:bg-rose-50 hover:border-rose-200' 
                          : 'bg-card border-border text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200'}`}
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
                      <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
                      <p className="text-foreground font-medium">No users found.</p>
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