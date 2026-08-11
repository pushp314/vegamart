import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminVendors } from "@/components/admin/AdminVendors";
import { api } from "@/lib/api";
import type { PaginationMeta } from "@/components/admin/AdminPaginationBar";

export const Route = createFileRoute("/admin/vendors")({
  component: AdminVendorsPage,
});

function AdminVendorsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "shop" | "roaming">("all");

  const { data: vendorsRes, isError } = useQuery({
    queryKey: ["adminVendors", page, search, typeFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("per_page", "20");
      if (search.trim()) params.set("q", search.trim());
      if (typeFilter !== "all") params.set("roaming", typeFilter === "roaming" ? "true" : "false");
      return api.get<any>(`/admin/vendors?${params.toString()}`);
    },
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

  const pagination = vendorsRes?.pagination as PaginationMeta | undefined;

  const handleFilterChange = (nextSearch: string, nextType: string) => {
    setSearch(nextSearch);
    setTypeFilter(nextType as any);
    setPage(1);
  };

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

  const deleteVendorMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/vendors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminVendors"] });
      toast.success("Vendor deleted successfully");
    },
    onError: () => toast.error("Failed to delete vendor"),
  });

  const promoteVendorMutation = useMutation({
    mutationFn: ({
      id,
      sponsored_until,
      sponsored_priority,
    }: {
      id: string;
      sponsored_until?: string | null;
      sponsored_priority?: number;
    }) =>
      api.patch(`/admin/vendors/${id}/promote`, {
        is_sponsored: true,
        sponsored_until,
        sponsored_priority,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminVendors"] });
      toast.success("Vendor promoted to Top Search Placement");
    },
    onError: () => toast.error("Failed to promote vendor"),
  });

  const unpromoteVendorMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/vendors/${id}/promote`, { is_sponsored: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminVendors"] });
      toast.success("Vendor demoted from Top Search Placement");
    },
    onError: () => toast.error("Failed to demote vendor"),
  });

  return (
    <AdminVendors
      vendors={vendorList}
      pagination={pagination}
      onPageChange={setPage}
      search={search}
      typeFilter={typeFilter}
      onFilterChange={handleFilterChange}
      onApprove={(id) => approveVendorMutation.mutate(id)}
      onReject={(id, reason) => rejectVendorMutation.mutate({ id, reason })}
      onSuspend={(id) => suspendVendorMutation.mutate(id)}
      onRestore={(id) => restoreVendorMutation.mutate(id)}
      onDelete={(id) => deleteVendorMutation.mutate(id)}
      onPromote={(id, sponsored_until, sponsored_priority) =>
        promoteVendorMutation.mutate({ id, sponsored_until, sponsored_priority })
      }
      onUnpromote={(id) => unpromoteVendorMutation.mutate(id)}
      isApproving={approveVendorMutation.isPending}
      isRejecting={rejectVendorMutation.isPending}
    />
  );
}
