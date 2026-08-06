import { createFileRoute } from "@tanstack/react-router";
import { AdminFAQ } from "@/components/admin/AdminFAQ";

export const Route = createFileRoute("/admin/faqs")({
  component: AdminFAQ,
});
