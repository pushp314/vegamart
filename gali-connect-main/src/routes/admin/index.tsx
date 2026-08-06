import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { AdminOverview } from "@/components/admin/AdminOverview";
import { api } from "@/lib/api";

export const Route = createFileRoute("/admin/")({
  component: AdminOverviewPage,
});

function AdminOverviewPage() {
  const {
    data: statsRes,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["adminDashboardStats"],
    queryFn: () => api.get<{ data: any }>("/admin/dashboard"),
    retry: false,
  });

  useEffect(() => {
    if (isError) {
      toast.error("Backend unavailable. Start the Go server on port 8080.");
    }
  }, [isError]);

  const stats = statsRes?.data?.data || statsRes?.data || {};

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <AdminOverview stats={stats} />;
}
