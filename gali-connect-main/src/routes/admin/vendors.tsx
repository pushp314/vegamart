import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { AdminVendors } from "@/components/admin/AdminVendors";
import { api } from "@/lib/api";

export const Route = createFileRoute("/admin/vendors")({
  component: AdminVendorsPage,
});

function AdminVendorsPage() {
  const queryClient = useQueryClient();

  const { data: vendorsRes, isError } = useQuery({
    queryKey: ["adminVendors"],
    queryFn: () => api.get<any>("/admin/vendors"),
    retry: false,
  });

  useEffect(() => {
    if (isError) {
      toast.error("Backend unavailable. Start the Go server on port 8080.");
    }
  }, [isError]);

  const vendorList: any[] = Array.isArray(vendorsRes?.data)
    ? vendorsRes.data
    : Array.isArray((vendorsRes?.data as any)?.data)
      ? (vendorsRes?.data as any).data
      : [];

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

  const restoreVendorMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/vendors/${id}/restore`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminVendors"] });
      toast.success("Vendor unsuspended");
    },
    onError: () => toast.error("Failed to unsuspend vendor"),
  });

  const promoteVendorMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/vendors/${id}/promote`, { is_sponsored: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminVendors"] });
      toast.success("Vendor promoted to Sponsored");
    },
    onError: () => toast.error("Failed to promote vendor"),
  });

  const unpromoteVendorMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/vendors/${id}/promote`, { is_sponsored: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminVendors"] });
      toast.success("Sponsored badge removed");
    },
    onError: () => toast.error("Failed to remove Sponsored badge"),
  });

  return (
    <AdminVendors
      vendors={vendorList}
      onApprove={(id) => approveVendorMutation.mutate(id)}
      onReject={(id, reason) => rejectVendorMutation.mutate({ id, reason })}
      onSuspend={(id) => suspendVendorMutation.mutate(id)}
      onRestore={(id) => restoreVendorMutation.mutate(id)}
      onPromote={(id) => promoteVendorMutation.mutate(id)}
      onUnpromote={(id) => unpromoteVendorMutation.mutate(id)}
      isApproving={approveVendorMutation.isPending}
      isRejecting={rejectVendorMutation.isPending}
    />
  );
}
