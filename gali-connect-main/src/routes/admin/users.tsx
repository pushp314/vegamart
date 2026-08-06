import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { api } from "@/lib/api";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const queryClient = useQueryClient();

  const { data: usersRes, isError } = useQuery({
    queryKey: ["adminUsers"],
    queryFn: () => api.get<any>("/admin/users"),
    retry: false,
  });

  useEffect(() => {
    if (isError) {
      toast.error("Backend unavailable. Start the Go server on port 8080.");
    }
  }, [isError]);

  const userList: any[] = Array.isArray(usersRes?.data)
    ? usersRes.data
    : Array.isArray((usersRes?.data as any)?.data)
      ? (usersRes?.data as any).data
      : [];

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

  return (
    <AdminUsers
      users={userList}
      onToggleStatus={(id, is_active) => toggleUserStatusMutation.mutate({ id, is_active })}
    />
  );
}
