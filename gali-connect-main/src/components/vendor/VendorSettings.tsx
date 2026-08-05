import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Loader2, CreditCard, FileText } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function VendorSettings({ vendorProfile }: any) {
  const queryClient = useQueryClient();
  const [gstin, setGstin] = useState(vendorProfile.gstin || "");
  const [subscriptionPlan, setSubscriptionPlan] = useState(vendorProfile.subscription_plan || "basic");

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.put("/vendors/me", data),
    onSuccess: () => {
      toast.success("Settings updated successfully");
      queryClient.invalidateQueries({ queryKey: ["vendorProfile"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update settings");
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      gstin: gstin,
      subscription_plan: subscriptionPlan
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="font-display text-lg font-bold">Business Settings</h2>
      
      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-600" />
              Tax & Compliance
            </CardTitle>
            <CardDescription>Manage your GST settings and compliance information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5 max-w-sm">
              <Label htmlFor="gstin" className="text-xs font-medium">GSTIN (Optional)</Label>
              <Input
                id="gstin"
                placeholder="e.g. 22AAAAA0000A1Z5"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                className="h-9 text-sm uppercase"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-600" />
              Membership Plan
            </CardTitle>
            <CardDescription>Upgrade your plan to unlock more features.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Basic Plan */}
              <div 
                className={`relative rounded-2xl border-2 p-5 cursor-pointer transition-all ${subscriptionPlan === "basic" ? "border-emerald-500 bg-emerald-50/50" : "border-border hover:border-emerald-200"}`}
                onClick={() => setSubscriptionPlan("basic")}
              >
                {subscriptionPlan === "basic" && (
                  <div className="absolute -top-3 -right-3 h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </div>
                )}
                <div className="font-display font-bold text-lg mb-1">Basic</div>
                <div className="text-2xl font-black text-emerald-700 mb-3">Free</div>
                <ul className="text-xs text-muted-foreground space-y-2">
                  <li>• Upto 100 products</li>
                  <li>• 5% Platform fee</li>
                  <li>• Basic Support</li>
                </ul>
              </div>

              {/* Premium Plan */}
              <div 
                className={`relative rounded-2xl border-2 p-5 cursor-pointer transition-all ${subscriptionPlan === "premium" ? "border-emerald-500 bg-emerald-50/50" : "border-border hover:border-emerald-200"}`}
                onClick={() => setSubscriptionPlan("premium")}
              >
                {subscriptionPlan === "premium" && (
                  <div className="absolute -top-3 -right-3 h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </div>
                )}
                <div className="absolute top-0 right-0 bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg rounded-tr-xl">POPULAR</div>
                <div className="font-display font-bold text-lg mb-1">Premium</div>
                <div className="text-2xl font-black text-emerald-700 mb-3">₹499<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
                <ul className="text-xs text-muted-foreground space-y-2">
                  <li>• Unlimited products</li>
                  <li>• 2% Platform fee</li>
                  <li>• Priority Support</li>
                  <li>• Featured Listings</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button 
          type="submit" 
          disabled={updateMutation.isPending} 
          className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 text-white"
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
