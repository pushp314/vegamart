import {
  LayoutDashboard,
  Users,
  Store,
  Bike,
  Settings,
  RotateCcw,
  Package,
  LogOut,
  UserPlus,
  ShoppingCart,
  Bell,
  FileBarChart,
  ClipboardList,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";

export type AdminTab =
  | "overview"
  | "create_partner"
  | "vendors"
  | "users"
  | "delivery"
  | "cms"
  | "refunds"
  | "orders"
  | "products"
  | "reports"
  | "notifications"
  | "audit_logs"
  | "settings";

interface AdminSidebarProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
}

export function AdminSidebar({ activeTab, onTabChange }: AdminSidebarProps) {
  const { logout } = useAuth();

  const navItems: { id: string; label: string; icon: any; disabled?: boolean }[] = [
    { id: "overview", label: "Dashboard", icon: LayoutDashboard },
    { id: "orders", label: "Orders", icon: ShoppingCart },
    { id: "create_partner", label: "Create Partner", icon: UserPlus },
    { id: "vendors", label: "Vendors", icon: Store },
    { id: "users", label: "Users", icon: Users },
    { id: "delivery", label: "Delivery Fleet", icon: Bike },
    { id: "products", label: "Products", icon: Package },
    { id: "cms", label: "CMS & Marketing", icon: ClipboardList },
    { id: "reports", label: "Reports", icon: FileBarChart },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "audit_logs", label: "Audit Logs", icon: RotateCcw },
    { id: "refunds", label: "Refunds", icon: RotateCcw },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <aside className="w-64 border-r bg-card h-screen sticky top-0 flex flex-col hidden md:flex">
      <div className="p-6">
        <h1 className="font-display text-2xl font-black tracking-tight text-primary">
          VegaMart<span className="text-foreground">Admin</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Management Portal</p>
      </div>

      <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => !item.disabled && onTabChange(item.id as AdminTab)}
              disabled={item.disabled}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              } ${item.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <Icon className={`h-5 w-5 ${isActive ? "" : "opacity-70"}`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t mt-auto">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
        >
          <LogOut className="h-5 w-5 opacity-70" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
