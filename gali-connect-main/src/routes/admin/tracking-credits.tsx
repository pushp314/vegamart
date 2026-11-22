import { createFileRoute } from "@tanstack/react-router";
import { AdminTrackingCredits } from "@/components/admin/AdminTrackingCredits";

export const Route = createFileRoute("/admin/tracking-credits")({
  component: AdminTrackingCredits,
});
