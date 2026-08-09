import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function Logo({ className }: { className?: string }) {
  const { data: settingsRes } = useQuery({
    queryKey: ["publicSettings"],
    queryFn: () => api.get<any>("/settings/public"),
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const logoUrl = settingsRes?.data?.["platform.logo_url"];
  const src = logoUrl || "/favicon.ico";

  return (
    <img src={src} alt="Vegamart" className={cn("object-contain", className)} />
  );
}
