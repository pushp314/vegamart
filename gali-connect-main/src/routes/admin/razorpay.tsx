import { createFileRoute } from "@tanstack/react-router";
import { AdminRazorpayFinance } from "@/components/admin/AdminRazorpayFinance";

export const Route = createFileRoute("/admin/razorpay")({
  component: AdminRazorpayFinance,
});
