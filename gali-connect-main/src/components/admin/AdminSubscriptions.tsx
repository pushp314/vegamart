import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, Wallet, CreditCard, Activity } from "lucide-react";

export function AdminSubscriptions() {
  const { data: plansRes, isLoading: isLoadingPlans } = useQuery({
    queryKey: ["adminMembershipPlans"],
    queryFn: () => api.get<any>("/admin/membership-plans?include_inactive=true"),
  });

  const { data: vendorsRes, isLoading: isLoadingVendors } = useQuery({
    queryKey: ["adminVendorsList"],
    queryFn: () => api.get<any>("/admin/vendors"),
  });

  const plans = plansRes?.data?.data || plansRes?.data || [];
  const vendors = vendorsRes?.data?.data || vendorsRes?.data || [];

  if (isLoadingPlans || isLoadingVendors) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const subscribedVendors = vendors.filter(
    (v: any) => v.membership_tier && v.membership_tier !== "basic" && v.membership_tier !== "free"
  );
  
  const totalRevenue = subscribedVendors.reduce((acc: number, v: any) => {
    const plan = plans.find((p: any) => p.slug === v.membership_tier);
    return acc + (plan ? Number(plan.price) : 0);
  }, 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
          Subscriptions Overview
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Monitor active vendor subscriptions, revenue, and plan usage.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Subscribers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscribedVendors.length}</div>
            <p className="text-xs text-muted-foreground">Active paid plans</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly ARR (Est)</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalRevenue.toLocaleString("en-IN")}</div>
            <p className="text-xs text-muted-foreground">From active plans</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Plans</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{plans.filter((p: any) => p.is_active).length}</div>
            <p className="text-xs text-muted-foreground">Available to vendors</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payment Volume</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {plans.reduce((acc: number, p: any) => acc + (p.purchase_count || 0), 0)}
            </div>
            <p className="text-xs text-muted-foreground">Total purchases</p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden mt-8">
        <div className="p-6 border-b border-border bg-muted/20">
          <h3 className="font-display text-lg font-bold">Active Subscriptions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-bold">Vendor</th>
                <th className="px-6 py-4 font-bold">Plan</th>
                <th className="px-6 py-4 font-bold">Price</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold">Expiry</th>
              </tr>
            </thead>
            <tbody>
              {subscribedVendors.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                    No active subscribers found
                  </td>
                </tr>
              ) : (
                subscribedVendors.map((vendor: any) => {
                  const plan = plans.find((p: any) => p.slug === vendor.membership_tier) || {};
                  return (
                    <tr key={vendor.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-6 py-4 font-bold">{vendor.business_name}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary uppercase">
                          {vendor.membership_tier}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold">₹{Number(plan.price || 0)}</td>
                      <td className="px-6 py-4">
                        <span className="text-emerald-500 font-bold text-xs uppercase tracking-wider">Active</span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {vendor.membership_expires_at ? new Date(vendor.membership_expires_at).toLocaleDateString() : "Never"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
