import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";
import { ClientOnly } from "@/components/system/client-only";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const ShopLocationForm = typeof window !== "undefined"
  ? lazy(() => import("@/components/vendor/shop-location-form").then((m) => ({ default: m.ShopLocationForm })))
  : () => null;

export const Route = createFileRoute("/vendor/location")({
  component: VendorLocationPage,
});

function VendorLocationPage() {
  const { data: vendorRes } = useQuery({
    queryKey: ["vendorProfile"],
    queryFn: () => api.get<{ data: any }>("/vendors/me"),
  });
  const vendor = vendorRes?.data?.data || vendorRes?.data;

  return (
    <div className="max-w-xl mx-auto">
      <ClientOnly>
        <Suspense fallback={
          <div className="p-12 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
          </div>
        }>
          <ShopLocationForm vendorProfile={vendor} />
        </Suspense>
      </ClientOnly>
    </div>
  );
}
