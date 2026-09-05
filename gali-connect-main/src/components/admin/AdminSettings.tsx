import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  getMaintenanceStatus,
  completeMaintenanceTask,
  updateMaintenanceContact,
  type MaintenanceStatus,
  type MaintenanceTask,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Save,
  Upload,
  KeyRound,
  Wrench,
  Mail,
  CheckCircle2,
  RefreshCw,
  Wallet,
  Landmark,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";

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
  "platform.max_stores_per_order"?: number;
  "platform.logo_url"?: string;
  "platform.default_delivery_eta"?: string;
  "platform.vegamart_delivery_enabled"?: boolean;
  "platform.vendor_wallet_enabled"?: boolean;
  "platform.vendor_payout_mode"?: string;
  "platform.vendor_min_withdrawal_amount"?: number;
  "platform.checkout_charges"?: string;
  "support.email"?: string;
  "support.phone"?: string;
}

const maintenanceSeverityStyles: Record<MaintenanceTask["severity"], string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-blue-100 text-blue-700",
};

const maintenanceSeverityLabel: Record<MaintenanceTask["severity"], string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function AdminSettings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings>({});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [adminCreds, setAdminCreds] = useState({
    email: "",
    current_password: "",
    new_password: "",
  });
  const [maintenanceContact, setMaintenanceContact] = useState({
    contact_email: "",
    contact_phone: "",
  });

  const { data: maintenanceRes, isLoading: maintenanceLoading } = useQuery({
    queryKey: ["maintenance-status"],
    queryFn: getMaintenanceStatus,
  });
  const maintenance = maintenanceRes?.success ? maintenanceRes.data : null;

  useEffect(() => {
    if (maintenanceRes?.success && maintenanceRes.data) {
      setMaintenanceContact({
        contact_email: maintenanceRes.data.contact.contact_email ?? "",
        contact_phone: maintenanceRes.data.contact.contact_phone ?? "",
      });
    }
  }, [maintenanceRes]);

  const { data: settingsRes, isLoading } = useQuery({
    queryKey: ["adminSettings"],
    queryFn: () => api.get<Settings & { data?: Settings }>("/admin/settings"),
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

  const updateCredentialsMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string> = {
        current_password: adminCreds.current_password,
      };
      if (adminCreds.email.trim()) payload.email = adminCreds.email.trim();
      if (adminCreds.new_password) payload.new_password = adminCreds.new_password;
      return api.patch("/admin/credentials", payload);
    },
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Admin credentials updated. Use the new login details next time.");
        setAdminCreds({ email: "", current_password: "", new_password: "" });
      } else {
        toast.error(res.error?.message || "Failed to update admin credentials");
      }
    },
    onError: () => toast.error("Failed to update admin credentials"),
  });

  const handleSaveCredentials = () => {
    if (!adminCreds.current_password) {
      toast.error("Please enter your current password to confirm the change.");
      return;
    }
    if (!adminCreds.email.trim() && !adminCreds.new_password) {
      toast.error("Enter a new admin email id and/or a new password.");
      return;
    }
    updateCredentialsMutation.mutate();
  };

  const completeMaintenanceMutation = useMutation({
    mutationFn: (type: string) => completeMaintenanceTask(type),
    onSuccess: (res) => {
      if (res.success && res.data) {
        queryClient.setQueryData(["maintenance-status"], res);
      } else {
        queryClient.invalidateQueries({ queryKey: ["maintenance-status"] });
      }
      toast.success("Maintenance task rescheduled");
    },
    onError: () => toast.error("Failed to reschedule maintenance task"),
  });

  const updateContactMutation = useMutation({
    mutationFn: () =>
      updateMaintenanceContact({
        contact_email: maintenanceContact.contact_email.trim() || null,
        contact_phone: maintenanceContact.contact_phone.trim() || null,
      }),
    onSuccess: (res) => {
      if (res.success && res.data) {
        queryClient.setQueryData(["maintenance-status"], res);
      } else {
        queryClient.invalidateQueries({ queryKey: ["maintenance-status"] });
      }
      toast.success("Maintenance contact updated");
    },
    onError: () => toast.error("Failed to update maintenance contact"),
  });

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

        <Card className="border-border shadow-md">
          <CardHeader>
            <CardTitle>VegaMart Delivery Partner & Platform Pricing</CardTitle>
            <CardDescription>
              Centrally manage VegaMart Delivery Partner rider charges, platform free delivery thresholds, and default minimum order requirements.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-2xl border bg-muted/40">
              <div className="space-y-0.5">
                <Label className="font-semibold text-foreground">
                  Enable VegaMart Delivery Partner Fleet
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Master switch to enable or disable VegaMart Delivery Partner rider service across all stores.
                </p>
              </div>
              <Switch
                checked={settings["platform.vegamart_delivery_enabled"] !== false}
                onCheckedChange={(checked) =>
                  setSettings({
                    ...settings,
                    "platform.vegamart_delivery_enabled": checked,
                  })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold text-foreground flex items-center justify-between">
                <span>Default Rider Estimated Delivery Time</span>
                <span className="text-[11px] text-muted-foreground font-normal">Shown to customers</span>
              </Label>
              <Input
                placeholder="e.g. 20-30 mins"
                value={settings["platform.default_delivery_eta"] ?? "20-30 mins"}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    "platform.default_delivery_eta": e.target.value,
                  })
                }
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {["15-20 mins", "20-30 mins", "30-45 mins", "45-60 mins", "Same Day"].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        "platform.default_delivery_eta": preset,
                      })
                    }
                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition-colors ${
                      (settings["platform.default_delivery_eta"] || "20-30 mins") === preset
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-muted/60 text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Default estimated delivery ETA displayed on VegaMart Delivery Partner option at checkout.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold text-foreground flex items-center justify-between">
                <span>VegaMart Delivery Partner Fee (₹)</span>
                <span className="text-[11px] text-muted-foreground font-normal">Flat fee per order</span>
              </Label>
              <Input
                type="number"
                min={0}
                value={settings["platform.delivery_fee"] ?? 0}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    "platform.delivery_fee": Number(e.target.value),
                  })
                }
              />
              <p className="text-[11px] text-muted-foreground">
                Standard platform delivery partner charge billed to customer at checkout for VegaMart Delivery Partner orders (unless free delivery threshold applies).
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold text-foreground flex items-center justify-between">
                <span>VegaMart Free Delivery Threshold (₹)</span>
                <span className="text-[11px] text-muted-foreground font-normal">0 to disable</span>
              </Label>
              <Input
                type="number"
                min={0}
                value={settings["platform.free_delivery_threshold"] ?? 0}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    "platform.free_delivery_threshold": Number(e.target.value),
                  })
                }
              />
              <p className="text-[11px] text-muted-foreground">
                VegaMart Delivery Partner orders with an item subtotal equal to or exceeding this amount receive free delivery.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold text-foreground flex items-center justify-between">
                <span>VegaMart Delivery Partner Minimum Order (₹)</span>
                <span className="text-[11px] text-muted-foreground font-normal">0 for no minimum</span>
              </Label>
              <Input
                type="number"
                min={0}
                value={settings["platform.min_order_value"] ?? 0}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    "platform.min_order_value": Number(e.target.value),
                  })
                }
              />
              <p className="text-[11px] text-muted-foreground">
                Minimum cart subtotal required when customers choose VegaMart Delivery Partner.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold text-foreground flex items-center justify-between">
                <span>Tax Rate (%)</span>
                <span className="text-[11px] text-muted-foreground font-normal">GST percentage</span>
              </Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={settings["platform.tax_rate_percent"] ?? 0}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    "platform.tax_rate_percent": Number(e.target.value),
                  })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Vendor Wallet & Direct Payout Architecture */}
        <Card className="border-border shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-emerald-600" />
                Vendor Wallet & Direct Bank Payouts
              </CardTitle>
              {settings["platform.vendor_wallet_enabled"] !== false ? (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-xs">
                  Active 🟢
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-xs">
                  Disabled
                </Badge>
              )}
            </div>
            <CardDescription>
              Control whether vendors receive automatic split settlements directly into their bank account via Razorpay Route or hold ledger balances.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Master Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl border bg-muted/40">
              <div className="space-y-0.5">
                <Label className="font-semibold text-foreground">
                  Enable Vendor Wallet & Automated Payouts
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  When enabled, verified online orders trigger automated split settlements to the vendor's bank account / UPI ID.
                </p>
              </div>
              <Switch
                checked={settings["platform.vendor_wallet_enabled"] !== false}
                onCheckedChange={(checked) =>
                  setSettings({
                    ...settings,
                    "platform.vendor_wallet_enabled": checked,
                  })
                }
              />
            </div>

            {/* Payout Mode */}
            <div className="space-y-1.5">
              <Label className="font-semibold text-foreground flex items-center justify-between">
                <span>Vendor Settlement & Payout Gateway Mode</span>
                <span className="text-[11px] text-muted-foreground font-normal">Active Integration</span>
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  {
                    id: "razorpay_route",
                    title: "Razorpay Route",
                    desc: "Automated Sub-Merchant Split on Order Capture (Recommended)",
                  },
                  {
                    id: "razorpay_payouts",
                    title: "RazorpayX Payouts",
                    desc: "Instant IMPS / UPI transfer from platform current account",
                  },
                  {
                    id: "manual",
                    title: "Manual Settlement",
                    desc: "Ledger recording only; settlements done manually outside gateway",
                  },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        "platform.vendor_payout_mode": mode.id,
                      })
                    }
                    className={`text-left p-3 rounded-2xl border transition-all cursor-pointer ${
                      (settings["platform.vendor_payout_mode"] || "razorpay_route") === mode.id
                        ? "border-emerald-500 bg-emerald-500/10 text-foreground ring-1 ring-emerald-500/30"
                        : "border-border bg-card/60 text-muted-foreground hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Landmark className="h-3.5 w-3.5 text-emerald-600" />
                      {mode.title}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1 leading-tight">
                      {mode.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Minimum Withdrawal Threshold */}
            <div className="space-y-1.5">
              <Label className="font-semibold text-foreground flex items-center justify-between">
                <span>Minimum Payout / Withdrawal Threshold (₹)</span>
                <span className="text-[11px] text-muted-foreground font-normal">Minimum ledger balance</span>
              </Label>
              <Input
                type="number"
                min={0}
                value={settings["platform.vendor_min_withdrawal_amount"] ?? 100}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    "platform.vendor_min_withdrawal_amount": Number(e.target.value),
                  })
                }
              />
              <p className="text-[11px] text-muted-foreground">
                Minimum earnings balance a vendor must accumulate before automated or manual batch payouts are triggered.
              </p>
            </div>
          </CardContent>
        </Card>

        
        {/* Checkout Charges */}
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle>Checkout & Platform Charges</CardTitle>
            <CardDescription>Configure extra fees like Rain Charge, Platform Fee, Surge Pricing, etc.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              let charges: any[] = [];
              try {
                charges = JSON.parse(settings["platform.checkout_charges"] || "[]");
              } catch (e) { }

              const updateCharges = (newCharges: any[]) => {
                setSettings({ ...settings, "platform.checkout_charges": JSON.stringify(newCharges) });
              };

              return (
                <div className="space-y-4">
                  {charges.map((charge: any, i: number) => (
                    <div key={i} className="flex flex-col md:flex-row gap-4 items-start md:items-end border p-4 rounded-lg bg-muted/20">
                      <div className="space-y-2 flex-1">
                        <Label>Fee Name</Label>
                        <Input value={charge.name} onChange={e => {
                          const c = [...charges]; c[i].name = e.target.value; updateCharges(c);
                        }} placeholder="e.g. Rain Charge" />
                      </div>
                      <div className="space-y-2 w-full md:w-32">
                        <Label>Type</Label>
                        <select className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm" value={charge.type} onChange={e => {
                          const c = [...charges]; c[i].type = e.target.value; updateCharges(c);
                        }}>
                          <option value="fixed">Fixed (₹)</option>
                          <option value="percentage">Percentage (%)</option>
                        </select>
                      </div>
                      <div className="space-y-2 w-full md:w-32">
                        <Label>Amount</Label>
                        <Input type="number" value={charge.amount} onChange={e => {
                          const c = [...charges]; c[i].amount = e.target.value; updateCharges(c);
                        }} />
                      </div>
                      <div className="space-y-2 w-full md:w-24">
                         <Label className="block mb-2 text-center">Active</Label>
                         <div className="flex justify-center">
                           <Switch checked={charge.is_active} onCheckedChange={checked => {
                              const c = [...charges]; c[i].is_active = checked; updateCharges(c);
                           }} />
                         </div>
                      </div>
                      <Button variant="destructive" size="icon" className="shrink-0" onClick={() => {
                        const c = [...charges]; c.splice(i, 1); updateCharges(c);
                      }}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" className="w-full" onClick={() => {
                    const c = [...charges, { id: Date.now().toString(), name: "", type: "fixed", amount: 0, is_active: true }];
                    updateCharges(c);
                  }}>
                    + Add New Charge
                  </Button>
                </div>
              );
            })()}
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
                <p className="text-xs text-muted-foreground">
                  Allow customers to combine products from multiple stores in a single cart
                  (Disabled by default)
                </p>
              </div>
              <Switch
                checked={settings["platform.multi_store_checkout_enabled"] ?? false}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, "platform.multi_store_checkout_enabled": checked })
                }
              />
            </div>
            {settings["platform.multi_store_checkout_enabled"] && (
              <div className="flex items-center justify-between pl-6 py-2 bg-muted/50 rounded-md">
                <div>
                  <Label>Maximum Store Purchase Limit</Label>
                  <p className="text-xs text-muted-foreground">
                    Max number of distinct stores a customer can order from at once
                  </p>
                </div>
                <Input
                  type="number"
                  className="w-24 text-right"
                  value={settings["platform.max_stores_per_order"] ?? 5}
                  onChange={(e) =>
                    setSettings({ ...settings, "platform.max_stores_per_order": parseInt(e.target.value) || 5 })
                  }
                />
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <Label>Maintenance Mode</Label>
                <p className="text-xs text-muted-foreground">
                  Temporarily disable the platform for updates
                </p>
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

      {/* Admin Credentials */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Admin Credentials
            </CardTitle>
            <CardDescription>
              Change the admin login id (email) and password. You are signed in as{" "}
              <span className="font-semibold text-foreground">{user?.email || "your account"}</span>
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>New Admin Email (Login ID)</Label>
              <Input
                type="email"
                placeholder={user?.email || "admin@vegamart.in"}
                value={adminCreds.email}
                onChange={(e) => setAdminCreds({ ...adminCreds, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Current Password</Label>
              <PasswordInput
                placeholder="Enter current password to confirm"
                value={adminCreds.current_password}
                onChange={(e) => setAdminCreds({ ...adminCreds, current_password: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pr-9 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <PasswordInput
                placeholder="Minimum 8 chars with upper, lower, number & special"
                value={adminCreds.new_password}
                onChange={(e) => setAdminCreds({ ...adminCreds, new_password: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pr-9 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
              />
            </div>
            <Button
              type="button"
              onClick={handleSaveCredentials}
              disabled={updateCredentialsMutation.isPending}
            >
              {updateCredentialsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              Update Admin Credentials
            </Button>
          </CardContent>
        </Card>

        {/* Maintenance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Maintenance
            </CardTitle>
            <CardDescription>
              {maintenance?.next_due_at
                ? `Next maintenance due on ${formatDate(maintenance.next_due_at)}. Alerts appear in the panel whenever a task becomes due.`
                : "No maintenance due right now. Alerts appear automatically on the cadence below."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {maintenanceLoading && (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
            {!maintenanceLoading && maintenance && (
              <div className="space-y-2">
                {maintenance.tasks.map((task) => {
                  const due = task.status === "due";
                  return (
                    <div
                      key={task.type}
                      className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${
                        due ? "border-orange-300 bg-orange-50/60" : ""
                      }`}
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Badge className={maintenanceSeverityStyles[task.severity]}>
                            {maintenanceSeverityLabel[task.severity]}
                          </Badge>
                          <p className="truncate text-sm font-semibold">{task.label}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {due
                            ? `Due (${formatDate(task.due_at)}), ${task.overdue_days} day(s) overdue`
                            : `Next due ${formatDate(task.due_at)}`}
                          <span className="ml-2">every {task.cadence_days} days</span>
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={due ? "default" : "outline"}
                        onClick={() => completeMaintenanceMutation.mutate(task.type)}
                        disabled={completeMaintenanceMutation.isPending}
                        className="shrink-0"
                      >
                        {completeMaintenanceMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Done
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="rounded-lg border p-3 space-y-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  Developer Contact Email
                </Label>
                <Input
                  type="email"
                  placeholder="you@developer.com"
                  value={maintenanceContact.contact_email}
                  onChange={(e) =>
                    setMaintenanceContact({
                      ...maintenanceContact,
                      contact_email: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Developer Contact Phone
                </Label>
                <Input
                  placeholder="+91 00000 00000"
                  value={maintenanceContact.contact_phone}
                  onChange={(e) =>
                    setMaintenanceContact({
                      ...maintenanceContact,
                      contact_phone: e.target.value,
                    })
                  }
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => updateContactMutation.mutate()}
                disabled={updateContactMutation.isPending}
              >
                {updateContactMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Contact
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
