import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

/**
 * Lightweight unread-notification count for the bottom nav badge.
 */
export function useNotifications() {
  const { isAuthenticated } = useAuth();

  const { data } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const res = await api.get<{ count: number }>("/notifications/unread-count");
      return res.success ? Number((res.data as any)?.count ?? 0) : 0;
    },
    enabled: isAuthenticated,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  return { unreadCount: data ?? 0 };
}
