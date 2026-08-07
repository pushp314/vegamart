import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function Logo({ className }: { className?: string }) {
  const { data: settingsRes } = useQuery({
    queryKey: ["publicSettings"],
    queryFn: () => api.get<any>("/settings/public"),
    refetchInterval: 60000, // Refetch every minute to get logo updates
  });
  
  const settings = settingsRes?.data || {};
  const logoUrl = settings["platform.logo_url"] || "/icons/icon-512.png";

  return (
    <img src={logoUrl} alt="Vegamart" className={cn("object-contain", className)} />
  );
}
