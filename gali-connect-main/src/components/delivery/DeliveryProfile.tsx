import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, User, Bike } from "lucide-react";
import { toast } from "sonner";

interface DeliveryProfileProps {
  partner: any;
}

export function DeliveryProfile({ partner }: DeliveryProfileProps) {
  const queryClient = useQueryClient();
  const [vehicleType, setVehicleType] = useState(partner?.vehicle_type ?? "");
  const [vehicleNumber, setVehicleNumber] = useState(partner?.vehicle_number ?? "");
  const [licenseNumber, setLicenseNumber] = useState(partner?.license_number ?? "");

  const updateProfileMutation = useMutation({
    mutationFn: (data: any) => api.put("/delivery/me/profile", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveryProfile"] });
      toast.success("Profile updated");
    },
    onError: () => toast.error("Failed to update profile"),
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Profile Settings</h2>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={partner?.full_name ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={partner?.phone ?? ""} disabled />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={partner?.user?.email ?? ""} disabled />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bike className="h-5 w-5" />
            Vehicle Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Vehicle Type</Label>
              <Input
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                placeholder="e.g., Bike, Scooter"
              />
            </div>
            <div className="space-y-2">
              <Label>Vehicle Number</Label>
              <Input
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                placeholder="e.g., KA-01-AB-1234"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>License Number</Label>
            <Input
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              placeholder="Driving license number"
            />
          </div>
          <Button
            onClick={() =>
              updateProfileMutation.mutate({
                vehicle_type: vehicleType,
                vehicle_number: vehicleNumber,
                license_number: licenseNumber,
              })
            }
            disabled={updateProfileMutation.isPending}
          >
            {updateProfileMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
