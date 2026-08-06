import { createFileRoute } from "@tanstack/react-router";
import { AdminSubscriptions } from "@/components/admin/AdminSubscriptions";

export const Route = createFileRoute("/admin/subscriptions")({
  component: AdminSubscriptions,
});
