import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Upload } from "lucide-react";
import { toast } from "sonner";

interface Settings {
  "platform.name"?: string;
  "platform.currency"?: string;
  "platform.tax_rate_percent"?: number;
  "platform.delivery_fee"?: number;
  "platform.free_delivery_threshold"?: number;
  "platform.min_order_value"?: number;
  "platform.order_expiry_minutes"?: number;
  "platform.default_delivery_radius_km"?: number;
  "platform.deliveries_active"?: boolean;
  "platform.maintenance_mode"?: boolean;
  "platform.multi_store_checkout_enabled"?: boolean;
  "platform.logo_url"?: string;
  "support.email"?: string;
  "support.phone"?: string;
}

export function AdminSettings() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<Settings>({});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const { data: settingsRes, isLoading } = useQuery({
    queryKey: ["adminSettings"],
    queryFn: () => api.get<any>("/admin/settings"),
  });

  useEffect(() => {
    if (settingsRes?.data) {
      const data = settingsRes.data?.data ?? settingsRes.data;
      setSettings(data);
    }
  }, [settingsRes]);

  const updateSettingsMutation = useMutation({
    mutationFn: (data: Partial<Settings>) => api.patch("/admin/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminSettings"] });
      toast.success("Settings updated");
    },
    onError: () => toast.error("Failed to update settings"),
  });

  const handleLogoUpload = async () => {
    if (!logoFile) return;

    setIsUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", logoFile);
      formData.append("folder", "profiles");

      const uploadRes = await api.post<{ url: string; key: string }>("/uploads", formData);
      if (uploadRes.success && uploadRes.data?.url) {
        setSettings({ ...settings, "platform.logo_url": uploadRes.data.url });
        toast.success("Logo uploaded successfully");
      } else {
        toast.error(uploadRes.error?.message || "Logo upload failed");
      }
    } catch (error) {
      toast.error("Failed to upload logo");
    } finally {
      setIsUploadingLogo(false);
      setLogoFile(null);
    }
  };

  const handleSave = () => {
    updateSettingsMutation.mutate(settings);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Platform Settings</h2>
        <Button onClick={handleSave} disabled={updateSettingsMutation.isPending}>
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
            <CardDescription>Basic platform configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Platform Name</Label>
              <Input
                value={settings["platform.name"] ?? ""}
                onChange={(e) => setSettings({ ...settings, "platform.name": e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Input
                value={settings["platform.currency"] ?? "INR"}
                onChange={(e) => setSettings({ ...settings, "platform.currency": e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Platform Logo</Label>
              <div className="flex items-center gap-4">
                {settings["platform.logo_url"] && (
                  <img
                    src={settings["platform.logo_url"]}
                    alt="Platform Logo"
                    className="h-12 w-12 object-cover rounded-lg"
                  />
                )}
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setLogoFile(e.target.files[0]);
                      }
                    }}
                    className="w-full text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                  />
                </div>
                {logoFile && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleLogoUpload}
                    disabled={isUploadingLogo}
                  >
                    {isUploadingLogo ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
            <CardDescription>Fees and thresholds</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tax Rate (%)</Label>
              <Input
                type="number"
                value={settings["platform.tax_rate_percent"] ?? 0}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    "platform.tax_rate_percent": Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Delivery Fee (₹)</Label>
              <Input
                type="number"
                value={settings["platform.delivery_fee"] ?? 0}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    "platform.delivery_fee": Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Free Delivery Threshold (₹)</Label>
              <Input
                type="number"
                value={settings["platform.free_delivery_threshold"] ?? 0}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    "platform.free_delivery_threshold": Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Min Order Value (₹)</Label>
              <Input
                type="number"
                value={settings["platform.min_order_value"] ?? 0}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    "platform.min_order_value": Number(e.target.value),
                  })
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Support</CardTitle>
            <CardDescription>Contact information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Support Email</Label>
              <Input
                type="email"
                value={settings["support.email"] ?? ""}
                onChange={(e) => setSettings({ ...settings, "support.email": e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Support Phone</Label>
              <Input
                value={settings["support.phone"] ?? ""}
                onChange={(e) => setSettings({ ...settings, "support.phone": e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delivery & Service Areas</CardTitle>
            <CardDescription>Configure service boundaries</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Default Max Delivery Radius (km)</Label>
              <Input
                type="number"
                value={settings["platform.default_delivery_radius_km"] ?? 10}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    "platform.default_delivery_radius_km": Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Global Service Status</Label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="delivery_active"
                  checked={settings["platform.deliveries_active"] ?? true}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      "platform.deliveries_active": e.target.checked,
                    })
                  }
                  className="rounded border-input"
                />
                <label htmlFor="delivery_active" className="text-sm">
                  Accepting Delivery Orders
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System</CardTitle>
            <CardDescription>System configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <Label>Multi-Store Checkout</Label>
                <p className="text-xs text-muted-foreground">Allow customers to combine products from multiple stores in a single cart (Disabled by default)</p>
              </div>
              <Switch
                checked={settings["platform.multi_store_checkout_enabled"] ?? false}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, "platform.multi_store_checkout_enabled": checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Maintenance Mode</Label>
                <p className="text-xs text-muted-foreground">Temporarily disable the platform for updates</p>
              </div>
              <Switch
                checked={settings["platform.maintenance_mode"] ?? false}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, "platform.maintenance_mode": checked })
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
