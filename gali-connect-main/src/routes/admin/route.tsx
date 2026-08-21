import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  Store,
  Bike,
  FileText,
  Banknote,
  ShoppingCart,
  Bell,
  FileBarChart,
  ClipboardList,
  Settings,
  UserPlus,
  Tag,
  Layers,
  LifeBuoy,
  HelpCircle,
  Crown,
  BookOpen,
} from "lucide-react";
import { PortalLayout } from "@/components/layout/portal-layout";
import { MaintenanceAlertModal } from "@/components/admin/MaintenanceAlertModal";
import { StorageAlertBanner } from "@/components/admin/StorageAlertBanner";
import { useAuth } from "@/context/auth-context";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      navigate({ to: "/login" });
    }
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  const navItems = [
    { id: "overview", title: "Dashboard", icon: LayoutDashboard, url: "/admin" },
    { id: "orders", title: "Orders", icon: ShoppingCart, url: "/admin/orders" },
    { id: "create_partner", title: "Create Partner", icon: UserPlus, url: "/admin/create-partner" },
    { id: "vendors", title: "Vendors", icon: Store, url: "/admin/vendors" },
    {
      id: "membership_plans",
      title: "Membership Plans",
      icon: Crown,
      url: "/admin/membership-plans",
    },
    {
      id: "subscriptions",
      title: "Subscriptions",
      icon: Crown,
      url: "/admin/subscriptions",
    },
    { id: "users", title: "Users", icon: Users, url: "/admin/users" },
    { id: "delivery", title: "Delivery Boys", icon: Bike, url: "/admin/delivery" },
    { id: "categories", title: "Categories", icon: Layers, url: "/admin/categories" },
    { id: "products", title: "Products", icon: FileText, url: "/admin/products" },
    { id: "cms", title: "CMS", icon: ClipboardList, url: "/admin/cms" },
    { id: "coupons", title: "Coupons", icon: Tag, url: "/admin/coupons" },
    { id: "reports", title: "Reports", icon: FileBarChart, url: "/admin/reports" },
    { id: "notifications", title: "Notifications", icon: Bell, url: "/admin/notifications" },
    {
      id: "support_tickets",
      title: "Support Tickets",
      icon: LifeBuoy,
      url: "/admin/support-tickets",
    },
    { id: "audit_logs", title: "Audit Logs", icon: FileText, url: "/admin/audit-logs" },
    { id: "payouts", title: "Vendor Payouts", icon: Banknote, url: "/admin/payouts" },
    { id: "refunds", title: "Refunds", icon: Banknote, url: "/admin/refunds" },
    { id: "settings", title: "Settings", icon: Settings, url: "/admin/settings" },
    { id: "faqs", title: "FAQs", icon: HelpCircle, url: "/admin/faqs" },
    { id: "how-to-use", title: "How to Use", icon: BookOpen, url: "/admin/how-to-use" },
  ];

  const section = location.pathname.split("/")[2] || "";
  const activeTab =
    section === ""
      ? "overview"
      : navItems.find((n) => n.url === `/admin/${section}`)?.id || "overview";

  if (authLoading || !isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PortalLayout
      navItems={navItems}
      activeItemId={activeTab}
      portalName="Admin"
      userEmail={user?.email}
      onLogout={() => {
        logout();
        navigate({ to: "/login" });
      }}
    >
      <StorageAlertBanner />
      <MaintenanceAlertModal />
      <Outlet />
    </PortalLayout>
  );
}
