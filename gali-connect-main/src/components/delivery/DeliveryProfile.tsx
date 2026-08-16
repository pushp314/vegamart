import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, User, Bike, IndianRupee } from "lucide-react";
import { toast } from "sonner";

interface DeliveryProfileProps {
  partner: any;
}

export function DeliveryProfile({ partner }: DeliveryProfileProps) {
  const queryClient = useQueryClient();
  const [vehicleType, setVehicleType] = useState(partner?.vehicle_type ?? "");
  const [vehicleNumber, setVehicleNumber] = useState(partner?.vehicle_number ?? "");
  const [licenseNumber, setLicenseNumber] = useState(partner?.license_number ?? "");
  const [baseDeliveryFee, setBaseDeliveryFee] = useState(
    partner?.base_delivery_fee !== undefined && partner?.base_delivery_fee !== null
      ? String(partner.base_delivery_fee)
      : "",
  );
  const [feePerKm, setFeePerKm] = useState(
    partner?.fee_per_km !== undefined && partner?.fee_per_km !== null
      ? String(partner.fee_per_km)
      : "",
  );

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
                base_delivery_fee: baseDeliveryFee !== "" ? Number(baseDeliveryFee) : 0,
                fee_per_km: feePerKm !== "" ? Number(feePerKm) : 0,
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5" />
            Delivery Charges
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Set the delivery fee you charge for each order. This applies when you are assigned as
            the delivery partner and is separate from the vendor's own delivery charges.
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Base Delivery Fee (₹)</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={baseDeliveryFee}
                onChange={(e) => setBaseDeliveryFee(e.target.value)}
                placeholder="e.g., 40"
              />
            </div>
            <div className="space-y-2">
              <Label>Fee per km (₹)</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={feePerKm}
                onChange={(e) => setFeePerKm(e.target.value)}
                placeholder="e.g., 8"
              />
            </div>
          </div>
          <Button
            onClick={() =>
              updateProfileMutation.mutate({
                base_delivery_fee: baseDeliveryFee !== "" ? Number(baseDeliveryFee) : 0,
                fee_per_km: feePerKm !== "" ? Number(feePerKm) : 0,
              })
            }
            disabled={updateProfileMutation.isPending}
          >
            {updateProfileMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Delivery Charges
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
