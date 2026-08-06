import { createFileRoute } from "@tanstack/react-router";
import { AdminCMS } from "@/components/admin/AdminCMS";

export const Route = createFileRoute("/admin/cms")({
  component: AdminCMS,
});
