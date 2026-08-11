import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { api } from "@/lib/api";
import type { PaginationMeta } from "@/components/admin/AdminPaginationBar";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<
    "all" | "customer" | "vendor" | "delivery" | "admin"
  >("all");

  const { data: usersRes, isError } = useQuery({
    queryKey: ["adminUsers", page, search, roleFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("per_page", "20");
      if (search.trim()) params.set("q", search.trim());
      if (roleFilter !== "all") params.set("role", roleFilter);
      return api.get<any>(`/admin/users?${params.toString()}`);
    },
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

  const pagination = usersRes?.pagination as PaginationMeta | undefined;

  const handleFilterChange = (nextSearch: string, nextRole: string) => {
    setSearch(nextSearch);
    setRoleFilter(nextRole as any);
    setPage(1);
  };

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

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      toast.success("User deleted successfully");
    },
    onError: () => toast.error("Failed to delete user"),
  });

  return (
    <AdminUsers
      users={userList}
      pagination={pagination}
      onPageChange={setPage}
      search={search}
      roleFilter={roleFilter}
      onFilterChange={handleFilterChange}
      onToggleStatus={(id, is_active) => toggleUserStatusMutation.mutate({ id, is_active })}
      onDelete={(id) => deleteUserMutation.mutate(id)}
    />
  );
}
