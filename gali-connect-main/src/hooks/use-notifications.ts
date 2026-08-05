import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/**
 * Lightweight unread-notification count for the bottom nav badge.
 */
export function useNotifications() {
  const { data } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const res = await api.get<{ count: number }>("/notifications/unread-count");
      return res.success ? Number((res.data as any)?.count ?? 0) : 0;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  return { unreadCount: data ?? 0 };
}
