import { createFileRoute } from "@tanstack/react-router";
import { AdminNotifications } from "@/components/admin/AdminNotifications";

export const Route = createFileRoute("/admin/notifications")({
  component: AdminNotifications,
});
