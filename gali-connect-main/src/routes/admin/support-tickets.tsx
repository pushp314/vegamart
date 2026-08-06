import { createFileRoute } from "@tanstack/react-router";
import { AdminSupportTickets } from "@/components/admin/AdminSupportTickets";

export const Route = createFileRoute("/admin/support-tickets")({
  component: AdminSupportTickets,
});
