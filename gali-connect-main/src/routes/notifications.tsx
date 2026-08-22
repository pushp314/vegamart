import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, ShoppingBag, Tag, CheckCheck, Sparkles, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Vegamart" }] }),
  component: NotificationsPage,
});

const READ_NOTIFICATIONS_KEY = "vegamart_read_notifications";

function getLocallyReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_NOTIFICATIONS_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function persistLocallyReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify([...ids]));
  } catch {
    void 0;
  }
}

function addLocallyReadId(id: string) {
  const ids = getLocallyReadIds();
  ids.add(id);
  persistLocallyReadIds(ids);
}

function markAllLocallyRead(ids: string[]) {
  const set = getLocallyReadIds();
  ids.forEach((id) => set.add(id));
  persistLocallyReadIds(set);
}

function isLocallyRead(id: string): boolean {
  return getLocallyReadIds().has(id);
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: "order" | "promo" | "system";
  time?: string;
  created_at?: string;
  is_read: boolean;
  source?: "announcement" | "notification";
}

interface BackendNotification {
  id: string;
  title: string;
  body?: string | null;
  type: string;
  time?: string;
  created_at?: string;
  is_read: boolean;
  source?: string;
}

function toNotificationType(type: string): NotificationItem["type"] {
  const t = (type || "").toLowerCase();
  if (t.includes("order")) return "order";
  if (t.includes("promo")) return "promo";
  return "system";
}

function NotificationsPage() {
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const { data: notifRes, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<BackendNotification[]>("/notifications"),
    enabled: isAuthenticated,
  });

  const notifications: NotificationItem[] = (notifRes?.data || []).map((n) => ({
    id: n.id,
    title: n.title,
    message: n.body || "",
    type: toNotificationType(n.type),
    time: n.time,
    created_at: n.created_at,
    is_read: n.is_read || isLocallyRead(n.id),
    source: n.source === "announcement" ? "announcement" : undefined,
  }));

  const markReadMutation = useMutation<unknown, unknown, NotificationItem>({
    mutationFn: (n: NotificationItem): Promise<unknown> => {
      addLocallyReadId(n.id);
      queryClient.setQueryData<BackendNotification[]>(["notifications"], (old = []) =>
        old.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)),
      );
      if (n.source === "announcement") {
        return Promise.resolve();
      }
      return api.put(`/notifications/${n.id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "global-alert-feed"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => {
      markAllLocallyRead(notifications.map((n) => n.id));
      queryClient.setQueryData<BackendNotification[]>(["notifications"], (old = []) =>
        (old || []).map((x) => ({ ...x, is_read: true })),
      );
      return api.put("/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "global-alert-feed"] });
      queryClient.setQueryData(["notifications", "unread-count"], { count: 0 });
      toast.success("All notifications marked as read");
    },
  });

  const markAllRead = () => {
    markAllReadMutation.mutate();
  };

  const markSingleRead = (n: NotificationItem) => {
    markReadMutation.mutate(n);
  };

  if (!authLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background pb-28 md:pb-16">
        <AppHeader title="Notifications" subtitle="Order updates & promos" />
        <main className="mx-auto max-w-3xl px-4 py-6 space-y-4">
          <div className="rounded-3xl border bg-card p-12 text-center space-y-3">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-primary">
              <Bell className="h-6 w-6" />
            </div>
            <h3 className="font-display text-base font-bold">Sign in to see notifications</h3>
            <p className="text-xs text-muted-foreground">
              Your order updates and promos will show up here after you sign in.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Sign in
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background pb-28 md:pb-16">
        <AppHeader title="Notifications" subtitle="Order updates & promos" />
        <main className="mx-auto flex max-w-3xl items-center justify-center px-4 py-24">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-16">
      <AppHeader title="Notifications" subtitle="Order updates & promos" />

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="hidden md:block font-display text-2xl font-bold">Notifications</h1>
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline ml-auto"
          >
            <CheckCheck className="h-4 w-4" /> Mark all read
          </button>
        </div>

        {notifications.length === 0 ? (
          <div className="rounded-3xl border bg-card p-12 text-center space-y-3">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-primary">
              <Bell className="h-6 w-6" />
            </div>
            <h3 className="font-display text-base font-bold">No notifications yet</h3>
            <p className="text-xs text-muted-foreground">
              We'll alert you when order updates or deals arrive!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => {
              const Icon = n.type === "order" ? ShoppingBag : n.type === "promo" ? Tag : Sparkles;
              return (
                <div
                  key={n.id}
                  onClick={() => markSingleRead(n)}
                  className={`rounded-3xl border p-4 transition-all cursor-pointer bg-card ${
                    !n.is_read
                      ? "border-primary/50 bg-emerald-50/40 ring-1 ring-primary/20 shadow-soft"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${
                        n.type === "order"
                          ? "bg-emerald-100 text-emerald-700"
                          : n.type === "promo"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-display text-sm font-bold truncate">{n.title}</h4>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {n.time || n.created_at}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        {n.message}
                      </p>
                    </div>

                    {!n.is_read && (
                      <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
