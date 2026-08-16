import { createFileRoute } from "@tanstack/react-router";
import { AdminHowToUse } from "@/components/admin/AdminHowToUse";

export const Route = createFileRoute("/admin/how-to-use")({
  component: AdminHowToUse,
});
