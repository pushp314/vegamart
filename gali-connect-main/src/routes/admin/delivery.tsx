import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { AdminDelivery } from "@/components/admin/AdminDelivery";
import { api } from "@/lib/api";

export const Route = createFileRoute("/admin/delivery")({
  component: AdminDeliveryPage,
});

function AdminDeliveryPage() {
  const queryClient = useQueryClient();

  const { data: deliveryRes, isError } = useQuery({
    queryKey: ["adminDelivery"],
    queryFn: () => api.get<any>("/admin/delivery-partners"),
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
