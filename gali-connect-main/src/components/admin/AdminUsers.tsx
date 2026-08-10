import { Users, Power, PowerOff, Search, UserCheck, UserX, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

interface AdminUsersProps {
  users: any[];
  onToggleStatus: (id: string, isActive: boolean) => void;
  onDelete: (id: string) => void;
}

export function AdminUsers({ users, onToggleStatus, onDelete }: AdminUsersProps) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<
    "all" | "customer" | "vendor" | "delivery" | "admin"
  >("all");

  const roles = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => set.add(u.role?.slug || u.role || "customer"));
    return Array.from(set);
  }, [users]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      const name = (u.name || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const role = (u.role?.slug || u.role || "customer").toLowerCase();
      if (roleFilter !== "all" && role !== roleFilter) return false;
      if (q && !name.includes(q) && !email.includes(q)) return false;
      return true;
    });
  }, [users, query, roleFilter]);

  const activeCount = users.filter((u) => u.is_active).length;
  const disabledCount = users.length - activeCount;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
            User Management
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Manage all registered customers and staff.
          </p>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Total Users
          </div>
          <div className="text-2xl font-black font-display text-foreground mt-1">
            {users.length}
          </div>
        </div>
        <div className="rounded-3xl border border-border bg-card p-5 shadow-soft flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Active
            </div>
            <div className="text-2xl font-black font-display text-emerald-600 mt-1">
              {activeCount}
            </div>
          </div>
          <UserCheck className="h-8 w-8 text-emerald-500/40" />
        </div>
        <div className="rounded-3xl border border-border bg-card p-5 shadow-soft flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Disabled
            </div>
            <div className="text-2xl font-black font-display text-rose-600 mt-1">
              {disabledCount}
            </div>
          </div>
          <UserX className="h-8 w-8 text-rose-500/40" />
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full rounded-2xl bg-card border border-border pl-10 pr-4 h-11 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as any)}
          className="rounded-2xl bg-card border border-border px-4 h-11 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
        >
          <option value="all">All Roles</option>
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
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
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-muted/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-muted border border-border text-muted-foreground flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-200 transition-all">
                        <Users className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-bold text-[15px] text-foreground">
                          {u.name || "Unknown User"}
                        </p>
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
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider border
                      ${u.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30" : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30"}`}
                    >
                      {u.is_active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => onToggleStatus(u.id, !u.is_active)}
                        className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl border transition-all active:scale-95
                          ${
                            u.is_active
                              ? "bg-card border-border text-rose-600 hover:bg-rose-50 hover:border-rose-200"
                              : "bg-card border-border text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200"
                          }`}
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
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              `Delete user "${u.name || u.email}"? This permanently removes the account and logs them out.`,
                            )
                          ) {
                            onDelete(u.id);
                          }
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl border transition-all active:scale-95 bg-card border-border text-rose-600 hover:bg-rose-50 hover:border-rose-200"
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </button>
                    </div>
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
              {users.length > 0 && filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Search className="h-12 w-12 text-muted-foreground/40 mb-4" />
                      <p className="text-foreground font-medium">No users match your search.</p>
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
