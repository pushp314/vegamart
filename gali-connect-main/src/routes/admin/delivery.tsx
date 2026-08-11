import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminDelivery } from "@/components/admin/AdminDelivery";
import { api } from "@/lib/api";
import type { PaginationMeta } from "@/components/admin/AdminPaginationBar";

export const Route = createFileRoute("/admin/delivery")({
  component: AdminDeliveryPage,
});

function AdminDeliveryPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "approved" | "pending" | "rejected" | "suspended"
  >("all");

  const { data: deliveryRes, isError } = useQuery({
    queryKey: ["adminDelivery", page, search, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("per_page", "20");
      if (search.trim()) params.set("q", search.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      return api.get<any>(`/admin/delivery-partners?${params.toString()}`);
    },
    retry: false,
  });

  useEffect(() => {
    if (isError) {
      toast.error("Backend unavailable. Start the Go server on port 8080.");
    }
  }, [isError]);

  const deliveryList: any[] = Array.isArray(deliveryRes?.data)
    ? deliveryRes.data
    : Array.isArray((deliveryRes?.data as any)?.data)
      ? (deliveryRes?.data as any).data
      : [];

  const pagination = deliveryRes?.pagination as PaginationMeta | undefined;

  const handleFilterChange = (nextSearch: string, nextStatus: string) => {
    setSearch(nextSearch);
    setStatusFilter(nextStatus as any);
    setPage(1);
  };

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

  const suspendDeliveryMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/delivery-partners/${id}/suspend`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminDelivery"] });
      toast.success("Delivery partner suspended");
    },
    onError: () => toast.error("Failed to suspend delivery partner"),
  });

  const restoreDeliveryMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/delivery-partners/${id}/restore`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminDelivery"] });
      toast.success("Delivery partner restored");
    },
    onError: () => toast.error("Failed to restore delivery partner"),
  });

  return (
    <AdminDelivery
      deliveryList={deliveryList}
      pagination={pagination}
      onPageChange={setPage}
      search={search}
      statusFilter={statusFilter}
      onFilterChange={handleFilterChange}
      onApprove={(id) => approveDeliveryMutation.mutate(id)}
      onReject={(id) => rejectDeliveryMutation.mutate(id)}
      onSuspend={(id) => suspendDeliveryMutation.mutate(id)}
      onRestore={(id) => restoreDeliveryMutation.mutate(id)}
      isApproving={approveDeliveryMutation.isPending}
      isRejecting={rejectDeliveryMutation.isPending}
      isSuspending={suspendDeliveryMutation.isPending}
      isRestoring={restoreDeliveryMutation.isPending}
      onRefresh={() => queryClient.invalidateQueries({ queryKey: ["adminDelivery"] })}
    />
  );
}
