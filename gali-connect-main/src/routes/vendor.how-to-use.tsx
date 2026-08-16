import { createFileRoute } from "@tanstack/react-router";
import { VendorHowToUse } from "@/components/vendor/VendorHowToUse";

export const Route = createFileRoute("/vendor/how-to-use")({
  component: VendorHowToUse,
});
