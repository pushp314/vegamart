import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { VendorSettings } from "@/components/vendor/VendorSettings";

export const Route = createFileRoute("/vendor/settings")({
  component: VendorSettingsPage,
});

function VendorSettingsPage() {
  const { data: vendorRes } = useQuery({
    queryKey: ["vendorProfile"],
    queryFn: () => api.get<{ data: any }>("/vendors/me"),
  });
  const vendor = vendorRes?.data?.data || vendorRes?.data;

  return <VendorSettings vendorProfile={vendor} />;
}
