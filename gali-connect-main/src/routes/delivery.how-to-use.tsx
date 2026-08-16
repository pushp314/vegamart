import { createFileRoute } from "@tanstack/react-router";
import { DeliveryHowToUse } from "@/components/delivery/DeliveryHowToUse";

export const Route = createFileRoute("/delivery/how-to-use")({
  component: DeliveryHowToUse,
});
