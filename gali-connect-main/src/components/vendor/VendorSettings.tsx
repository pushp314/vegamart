import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Save, Loader2, FileText, Phone, Bike, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function VendorSettings({ vendorProfile }: { vendorProfile?: any }) {
  const queryClient = useQueryClient();

  // If vendorProfile is not passed directly, fetch it
  const { data: fetchedRes, isLoading } = useQuery({
    queryKey: ["vendorProfile"],
    queryFn: () => api.get<{ data: any }>("/vendors/me"),
    enabled: !vendorProfile,
  });

  const profile = vendorProfile || fetchedRes?.data?.data || fetchedRes?.data || {};

  const [gstin, setGstin] = useState(profile.gstin || "");
  const [freeDeliveryMin, setFreeDeliveryMin] = useState(
    profile.free_delivery_min_order ? String(profile.free_delivery_min_order) : "",
  );
  const [contactPhone, setContactPhone] = useState(profile.phone || "");
  const [providesDelivery, setProvidesDelivery] = useState(profile.provides_delivery ?? false);
  const [logoUrl, setLogoUrl] = useState(profile.logo_url || "");

  useEffect(() => {
    if (profile.gstin !== undefined) setGstin(profile.gstin || "");
    if (profile.free_delivery_min_order !== undefined)
      setFreeDeliveryMin(
        profile.free_delivery_min_order ? String(profile.free_delivery_min_order) : "",
      );
    if (profile.phone !== undefined) setContactPhone(profile.phone || "");
    if (profile.provides_delivery !== undefined) setProvidesDelivery(!!profile.provides_delivery);
    if (profile.logo_url !== undefined) setLogoUrl(profile.logo_url || "");
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.put("/vendors/me", data),
    onSuccess: () => {
      toast.success("Business settings saved successfully! ✨");
      queryClient.invalidateQueries({ queryKey: ["vendorProfile"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save settings");
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      gstin: gstin,
      provides_delivery: providesDelivery,
      free_delivery_min_order: freeDeliveryMin ? Number(freeDeliveryMin) : null,
      phone: contactPhone || null,
      logo_url: logoUrl || null,
    });
  };

  if (isLoading && !vendorProfile) {
    return (
      <div className="flex justify-center p-12 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
        <span>Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight">Business Settings</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Configure tax compliance, delivery rules, and public store contact details.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Card className="rounded-3xl border-border shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5 text-amber-500" />
              Store Branding & Logo
            </CardTitle>
            <CardDescription className="text-xs">
              Upload or provide an image link for your business logo / store DP.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-muted overflow-hidden border border-border shrink-0 grid place-items-center">
                {logoUrl ? (
                  <img src={logoUrl} alt="Store DP" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-muted-foreground">
                    {profile.business_name?.[0] || "V"}
                  </span>
                )}
              </div>
              <div className="flex-1 space-y-1.5">
                <Label
                  htmlFor="logoUrl"
                  className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                >
                  Logo Image URL
                </Label>
                <Input
                  id="logoUrl"
                  placeholder="https://example.com/logo.png"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="h-10 rounded-2xl text-xs bg-muted/40"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-emerald-600" />
              Tax & Compliance
            </CardTitle>
            <CardDescription className="text-xs">
              Manage your GSTIN tax registration and minimum order thresholds.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5 max-w-md">
              <Label
                htmlFor="gstin"
                className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
              >
                GSTIN Number (Optional)
              </Label>
              <Input
                id="gstin"
                placeholder="e.g. 22AAAAA0000A1Z5"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                className="h-10 rounded-2xl text-xs uppercase bg-muted/40"
              />
            </div>
            <div className="space-y-1.5 max-w-md">
              <Label
                htmlFor="freeDeliveryMin"
                className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
              >
                Free Delivery Order Threshold (₹)
              </Label>
              <Input
                id="freeDeliveryMin"
                type="number"
                min="0"
                placeholder="e.g. 199 or leave blank"
                value={freeDeliveryMin}
                onChange={(e) => setFreeDeliveryMin(e.target.value)}
                className="h-10 rounded-2xl text-xs bg-muted/40"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bike className="h-5 w-5 text-blue-600" />
              Delivery Options
            </CardTitle>
            <CardDescription className="text-xs">
              Configure whether your store offers vendor-fulfilled delivery at checkout.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <button
              type="button"
              role="switch"
              aria-checked={providesDelivery}
              onClick={() => setProvidesDelivery((v: boolean) => !v)}
              className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all ${
                providesDelivery
                  ? "border-emerald-500/50 bg-emerald-500/10 shadow-sm"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors ${
                    providesDelivery
                      ? "bg-emerald-500 text-slate-950 font-bold"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Bike className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-xs font-bold text-foreground">Offer Store Delivery</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    When enabled, customers will see "Vendor Delivery" as an option for your
                    products during checkout.
                  </div>
                </div>
              </div>
              <span
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  providesDelivery ? "bg-emerald-500" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    providesDelivery ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </span>
            </button>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Phone className="h-5 w-5 text-purple-600" />
              Store Contact Information
            </CardTitle>
            <CardDescription className="text-xs">
              Provide a direct contact number for customer inquiries.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5 max-w-md">
              <Label
                htmlFor="contactPhone"
                className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
              >
                Public Store Phone Number
              </Label>
              <Input
                id="contactPhone"
                type="tel"
                placeholder="e.g. +919876543210"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="h-10 rounded-2xl text-xs bg-muted/40"
              />
            </div>
          </CardContent>
        </Card>

        <Button
          type="submit"
          disabled={updateMutation.isPending}
          className="rounded-2xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 h-11 px-8 shadow-lg"
        >
          {updateMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Settings
        </Button>
      </form>
    </div>
  );
}
