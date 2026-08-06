import { createFileRoute } from "@tanstack/react-router";
import { AdminMembershipPlans } from "@/components/admin/AdminMembershipPlans";

export const Route = createFileRoute("/admin/membership-plans")({
  component: AdminMembershipPlans,
});
