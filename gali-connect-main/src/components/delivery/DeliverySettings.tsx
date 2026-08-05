import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Bell, Shield, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { useNavigate } from "@tanstack/react-router";

export function DeliverySettings() {
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const { data: profileRes, isLoading } = useQuery({
    queryKey: ["deliveryProfile"],
    queryFn: () => api.get<any>("/delivery/me"),
  });

  const partner = profileRes?.data?.data ?? profileRes?.data;

  const setAvailabilityMutation = useMutation({
    mutationFn: (isAvailable: boolean) =>
      api.put("/delivery/me/availability", { is_available: isAvailable }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveryProfile"] });
      toast.success("Availability updated");
    },
  });

  const handleLogout = () => {
    logout();
    navigate({ to: "/" });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Settings</h2>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Availability
          </CardTitle>
          <CardDescription>Control when you're available for deliveries</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Online Status</p>
              <p className="text-sm text-muted-foreground">
                {partner?.is_available ? "You're online and receiving orders" : "You're offline"}
              </p>
            </div>
            <Switch
              checked={partner?.is_available ?? false}
              onCheckedChange={(checked) => setAvailabilityMutation.mutate(checked)}
              disabled={setAvailabilityMutation.isPending}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Account
          </CardTitle>
          <CardDescription>Manage your account settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium">Account Status</p>
              <p className="text-sm text-muted-foreground capitalize">{partner?.status ?? "Unknown"}</p>
            </div>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium">KYC Status</p>
              <p className="text-sm text-muted-foreground capitalize">
                {partner?.kyc?.status ?? "Not submitted"}
              </p>
            </div>
          </div>
          <Button variant="destructive" onClick={handleLogout} className="w-full">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
