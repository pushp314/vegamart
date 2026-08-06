import { createFileRoute } from "@tanstack/react-router";
import { AdminRefunds } from "@/components/admin/AdminRefunds";

export const Route = createFileRoute("/admin/refunds")({
  component: AdminRefunds,
});
