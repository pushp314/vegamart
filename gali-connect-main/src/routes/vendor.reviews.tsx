import { createFileRoute } from "@tanstack/react-router";
import { VendorReviews } from "@/components/vendor/VendorReviews";

export const Route = createFileRoute("/vendor/reviews")({
  component: VendorReviews,
});
