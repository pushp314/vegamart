import { createFileRoute } from "@tanstack/react-router";
import { AdminPayouts } from "@/components/admin/AdminPayouts";

export const Route = createFileRoute("/admin/payouts")({
  component: AdminPayouts,
});
