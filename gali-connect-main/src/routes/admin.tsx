import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

// Components
import { AdminTab } from "@/components/admin/AdminSidebar";
import { PortalLayout } from "@/components/layout/portal-layout";
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
} from "lucide-react";
import { AdminOverview } from "@/components/admin/AdminOverview";
import { AdminVendors } from "@/components/admin/AdminVendors";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { AdminDelivery } from "@/components/admin/AdminDelivery";
import { AdminCMS } from "@/components/admin/AdminCMS";
import { AdminRefunds } from "@/components/admin/AdminRefunds";
import { AdminCreatePartner } from "@/components/admin/AdminCreatePartner";
import { AdminOrders } from "@/components/admin/AdminOrders";
import { AdminProducts } from "@/components/admin/AdminProducts";
import { AdminReports } from "@/components/admin/AdminReports";
import { AdminNotifications } from "@/components/admin/AdminNotifications";
import { AdminAuditLogs } from "@/components/admin/AdminAuditLogs";
import { AdminSettings } from "@/components/admin/AdminSettings";
import { UserPlus } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin Portal — Vegamart" }] }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      navigate({ to: "/login" });
    }
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  // Dashboard Stats
  const { data: statsRes, isLoading: statsLoading } = useQuery({
    queryKey: ["adminDashboardStats"],
    queryFn: () => api.get<{ data: any }>("/admin/dashboard"),
    enabled: isAuthenticated && isAdmin,
  });
  const stats = statsRes?.data?.data || statsRes?.data || {};

  // Admin Vendors List
  const { data: vendorsRes } = useQuery({
    queryKey: ["adminVendors"],
    queryFn: () => api.get<any>("/admin/vendors"),
    enabled: isAuthenticated && isAdmin,
  });
  const vendorList: any[] = Array.isArray(vendorsRes?.data)
    ? vendorsRes.data
    : Array.isArray((vendorsRes?.data as any)?.data)
      ? (vendorsRes?.data as any).data
      : [];

  // Admin Users List
  const { data: usersRes } = useQuery({
    queryKey: ["adminUsers"],
    queryFn: () => api.get<any>("/admin/users"),
    enabled: isAuthenticated && isAdmin,
  });
  const userList: any[] = Array.isArray(usersRes?.data)
    ? usersRes.data
    : Array.isArray((usersRes?.data as any)?.data)
      ? (usersRes?.data as any).data
      : [];

  // Admin Delivery Fleet
  const { data: deliveryRes } = useQuery({
    queryKey: ["adminDelivery"],
    queryFn: () => api.get<any>("/admin/delivery-partners"),
    enabled: isAuthenticated && isAdmin,
  });
  const deliveryList: any[] = Array.isArray(deliveryRes?.data)
    ? deliveryRes.data
    : Array.isArray((deliveryRes?.data as any)?.data)
      ? (deliveryRes?.data as any).data
      : [];

  // Mutations
  const approveVendorMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/vendors/${id}/review`, { decision: "approve" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminVendors"] });
      toast.success("Vendor approved successfully!");
    },
    onError: () => toast.error("Failed to approve vendor"),
  });

  const rejectVendorMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/admin/vendors/${id}/review`, { decision: "reject", reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminVendors"] });
      toast.success("Vendor rejected");
    },
    onError: () => toast.error("Failed to reject vendor"),
  });

  const suspendVendorMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/vendors/${id}/suspend`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminVendors"] });
      toast.success("Vendor suspended");
    },
    onError: () => toast.error("Failed to suspend vendor"),
  });

  const toggleUserStatusMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => {
      if (is_active) {
        return api.post(`/admin/users/${id}/activate`, {});
      } else {
        return api.post(`/admin/users/${id}/suspend`, {});
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      toast.success("User status updated");
    },
    onError: () => toast.error("Failed to update user status"),
  });

  const approveDeliveryMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/admin/delivery-partners/${id}/review`, { decision: "approve" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminDelivery"] });
      toast.success("Delivery partner approved");
    },
    onError: () => toast.error("Failed to approve delivery partner"),
  });

  const rejectDeliveryMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/admin/delivery-partners/${id}/review`, { decision: "reject" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminDelivery"] });
      toast.success("Delivery partner rejected");
    },
    onError: () => toast.error("Failed to reject delivery partner"),
  });

  const navItems = [
    {
      id: "overview",
      title: "Dashboard",
      icon: LayoutDashboard,
      onClick: () => setActiveTab("overview"),
    },
    {
      id: "orders",
      title: "Orders",
      icon: ShoppingCart,
      onClick: () => setActiveTab("orders"),
    },
    {
      id: "create_partner",
      title: "Create Partner",
      icon: UserPlus,
      onClick: () => setActiveTab("create_partner"),
    },
    { id: "vendors", title: "Vendors", icon: Store, onClick: () => setActiveTab("vendors") },
    { id: "users", title: "Users", icon: Users, onClick: () => setActiveTab("users") },
    {
      id: "delivery",
      title: "Delivery Fleet",
      icon: Bike,
      onClick: () => setActiveTab("delivery"),
    },
    { id: "products", title: "Products", icon: FileText, onClick: () => setActiveTab("products") },
    { id: "cms", title: "CMS", icon: ClipboardList, onClick: () => setActiveTab("cms") },
    { id: "reports", title: "Reports", icon: FileBarChart, onClick: () => setActiveTab("reports") },
    {
      id: "notifications",
      title: "Notifications",
      icon: Bell,
      onClick: () => setActiveTab("notifications"),
    },
    {
      id: "audit_logs",
      title: "Audit Logs",
      icon: FileText,
      onClick: () => setActiveTab("audit_logs"),
    },
    { id: "refunds", title: "Refunds", icon: Banknote, onClick: () => setActiveTab("refunds") },
    { id: "settings", title: "Settings", icon: Settings, onClick: () => setActiveTab("settings") },
  ];

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
    >
      {activeTab === "overview" && <AdminOverview stats={stats} />}
      {activeTab === "orders" && <AdminOrders />}
      {activeTab === "create_partner" && <AdminCreatePartner />}
      {activeTab === "vendors" && (
        <AdminVendors
          vendors={vendorList}
          onApprove={(id) => approveVendorMutation.mutate(id)}
          onReject={(id, reason) => rejectVendorMutation.mutate({ id, reason })}
          onSuspend={(id) => suspendVendorMutation.mutate(id)}
          isApproving={approveVendorMutation.isPending}
          isRejecting={rejectVendorMutation.isPending}
        />
      )}
      {activeTab === "users" && (
        <AdminUsers
          users={userList}
          onToggleStatus={(id, is_active) => toggleUserStatusMutation.mutate({ id, is_active })}
        />
      )}
      {activeTab === "delivery" && (
        <AdminDelivery
          deliveryList={deliveryList}
          onApprove={(id) => approveDeliveryMutation.mutate(id)}
          onReject={(id) => rejectDeliveryMutation.mutate(id)}
          isApproving={approveDeliveryMutation.isPending}
          isRejecting={rejectDeliveryMutation.isPending}
        />
      )}
      {activeTab === "products" && <AdminProducts />}
      {activeTab === "cms" && <AdminCMS />}
      {activeTab === "reports" && <AdminReports />}
      {activeTab === "notifications" && <AdminNotifications />}
      {activeTab === "audit_logs" && <AdminAuditLogs />}
      {activeTab === "refunds" && <AdminRefunds />}
      {activeTab === "settings" && <AdminSettings />}
    </PortalLayout>
  );
}
