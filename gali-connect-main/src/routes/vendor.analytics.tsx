import { createFileRoute } from "@tanstack/react-router";
import { VendorAnalytics } from "@/components/vendor/VendorAnalytics";

export const Route = createFileRoute("/vendor/analytics")({
  component: VendorAnalytics,
});
