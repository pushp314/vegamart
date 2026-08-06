import { createFileRoute } from "@tanstack/react-router";
import { AdminCreatePartner } from "@/components/admin/AdminCreatePartner";

export const Route = createFileRoute("/admin/create-partner")({
  component: AdminCreatePartner,
});
