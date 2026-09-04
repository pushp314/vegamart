import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Loader2, IndianRupee, Percent } from "lucide-react";
import { toast } from "sonner";

export interface FeeConfig {
  key: string;
  name: string;
  enabled: boolean;
  type: 'FIXED' | 'PERCENTAGE';
  amount: number;
  min_order_amount: number;
  max_cap: number;
  conditions: Record<string, any>;
}

export function AdminCustomerFees() {
  const queryClient = useQueryClient();
  const [fees, setFees] = useState<FeeConfig[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  const { data: settingsRes, isLoading } = useQuery({
    queryKey: ["adminSettings"],
    queryFn: () => api.get<any>("/admin/settings"),
  });

  useEffect(() => {
    if (settingsRes?.success && settingsRes.data?.["platform.customer_fees_config"]) {
      try {
        const parsed = JSON.parse(settingsRes.data["platform.customer_fees_config"]);
        if (Array.isArray(parsed)) {
          setFees(parsed);
        }
      } catch (e) {
        console.error("Failed to parse customer fees config", e);
      }
    }
  }, [settingsRes]);

  const updateMutation = useMutation({
    mutationFn: (data: string) => api.patch("/admin/settings", { "platform.customer_fees_config": data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminSettings"] });
      toast.success("Customer fees updated successfully");
      setIsDirty(false);
    },
    onError: () => toast.error("Failed to update fees"),
  });

  const handleSave = () => {
    updateMutation.mutate(JSON.stringify(fees));
  };

  const updateFee = (index: number, updates: Partial<FeeConfig>) => {
    const newFees = [...fees];
    newFees[index] = { ...newFees[index], ...updates };
    setFees(newFees);
    setIsDirty(true);
  };

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Customer Fees & Charges</h2>
          <p className="text-muted-foreground text-sm">
            Configure dynamic fees applied during checkout based on conditions.
          </p>
        </div>
        <Button onClick={handleSave} disabled={!isDirty || updateMutation.isPending}>
          {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
      </div>

      <div className="grid gap-6">
        {fees.map((fee, index) => (
          <Card key={fee.key} className={fee.enabled ? "border-primary" : "opacity-80"}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {fee.name}
                  </CardTitle>
                  <CardDescription className="font-mono text-xs mt-1">{fee.key}</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Label htmlFor={`enable-${fee.key}`} className="cursor-pointer">
                    {fee.enabled ? "Active" : "Disabled"}
                  </Label>
                  <Switch
                    id={`enable-${fee.key}`}
                    checked={fee.enabled}
                    onCheckedChange={(c) => updateFee(index, { enabled: c })}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Fee Type</Label>
                  <Select
                    disabled={!fee.enabled}
                    value={fee.type}
                    onValueChange={(v: "FIXED" | "PERCENTAGE") => updateFee(index, { type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FIXED">Fixed Amount (₹)</SelectItem>
                      <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Amount {fee.type === "PERCENTAGE" ? "(%)" : "(₹)"}</Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                      {fee.type === "PERCENTAGE" ? <Percent className="h-4 w-4" /> : <IndianRupee className="h-4 w-4" />}
                    </div>
                    <Input
                      type="number"
                      className="pl-9"
                      disabled={!fee.enabled}
                      value={fee.amount}
                      onChange={(e) => updateFee(index, { amount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Min Order Amount (₹)</Label>
                  <Input
                    type="number"
                    disabled={!fee.enabled}
                    value={fee.min_order_amount}
                    onChange={(e) => updateFee(index, { min_order_amount: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                {fee.type === "PERCENTAGE" && (
                  <div className="space-y-2">
                    <Label>Max Cap (₹)</Label>
                    <Input
                      type="number"
                      disabled={!fee.enabled}
                      value={fee.max_cap}
                      onChange={(e) => updateFee(index, { max_cap: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                )}
                
                {fee.key === "DISTANCE_DELIVERY_FEE" && (
                   <div className="space-y-2">
                     <Label>Free Radius (KM)</Label>
                     <Input
                       type="number"
                       disabled={!fee.enabled}
                       value={fee.conditions?.free_radius_km || 0}
                       onChange={(e) => updateFee(index, { conditions: { ...fee.conditions, free_radius_km: parseFloat(e.target.value) || 0 } })}
                     />
                   </div>
                )}
                
                {fee.key === "BAD_WEATHER_FEE" && (
                   <div className="space-y-2 flex items-center pt-8">
                     <Switch
                        id={`override-${fee.key}`}
                        disabled={!fee.enabled}
                        checked={fee.conditions?.is_active_override || false}
                        onCheckedChange={(c) => updateFee(index, { conditions: { ...fee.conditions, is_active_override: c } })}
                      />
                      <Label htmlFor={`override-${fee.key}`} className="ml-2 cursor-pointer">
                        Force Active Right Now
                      </Label>
                   </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
