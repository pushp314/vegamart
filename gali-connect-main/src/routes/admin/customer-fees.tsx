import { createFileRoute } from "@tanstack/react-router";
import { AdminCustomerFees } from "@/components/admin/AdminCustomerFees";

export const Route = createFileRoute("/admin/customer-fees")({
  head: () => ({ meta: [{ title: "Customer Fees — Admin Panel" }] }),
  component: AdminCustomerFees,
});
