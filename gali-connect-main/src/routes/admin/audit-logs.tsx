import { createFileRoute } from "@tanstack/react-router";
import { AdminAuditLogs } from "@/components/admin/AdminAuditLogs";

export const Route = createFileRoute("/admin/audit-logs")({
  component: AdminAuditLogs,
});
