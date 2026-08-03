import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Bike,
  MapPin,
  Power,
  Navigation,
  Package,
  Store,
  ShieldCheck,
  Loader2,
  AlertCircle,
  Hourglass,
  Ban,
  Radio,
  CheckCircle2,
  Wallet
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

export const Route = createFileRoute("/delivery")({
  component: DeliveryDashboard,
});

function DeliveryDashboard() {
  const { user, isAuthenticated, accessToken: token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (user && user.role !== "delivery") {
      toast.error("Access restricted: Delivery Partner account required.");
      if (user.role === "vendor") navigate({ to: "/vendor" });
      else if (user.role === "admin" || user.role === "super_admin") navigate({ to: "/admin" });
      else navigate({ to: "/" });
    }
  }, [user, navigate]);
  const [activeTab, setActiveTab] = useState<"requests" | "active" | "earnings">("requests");
  const [isOnline, setIsOnline] = useState(false);

  // Fetch Delivery Profile
  const { data: profileRes, isLoading: partnerLoading } = useQuery({
    queryKey: ["deliveryProfile"],
    queryFn: () => api.get<{ data: any }>("/delivery/me"),
    enabled: isAuthenticated,
    retry: false,
  });

  const partner = profileRes?.data?.data || profileRes?.data;

  // Fetch Delivery Requests
  const { data: requestsRes, refetch: refetchRequests } = useQuery({
    queryKey: ["deliveryRequests"],
    queryFn: () => api.get<any[]>("/delivery/requests"),
    enabled: !!partner && partner.status === "approved" && isOnline,
    refetchInterval: 5000,
  });

  // Fetch My Active Deliveries
  const { data: myDeliveriesRes } = useQuery({
    queryKey: ["myDeliveries"],
    queryFn: () => api.get<any[]>("/delivery/my-deliveries"),
    enabled: !!partner && partner.status === "approved",
  });

  const requests = requestsRes?.data || [];
  const myDeliveries = myDeliveriesRes?.data || [];
  
  const completedOrders = myDeliveries.filter((o: any) => o.status === "delivered");
  const activeOrders = myDeliveries.filter((o: any) => o.status !== "delivered");

  const totalEarnings = completedOrders.reduce((sum: number, o: any) => sum + (o.delivery_fee || 0), 0);

  // Accept Delivery Mutation
  const acceptMutation = useMutation({
    mutationFn: (id: string) => api.put(`/delivery/orders/${id}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveryRequests"] });
      queryClient.invalidateQueries({ queryKey: ["myDeliveries"] });
      toast.success("Delivery accepted! Head to the vendor.");
      setActiveTab("active");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to accept delivery request");
    },
  });

  // Update Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string, status: string }) => 
      api.put(`/delivery/orders/${orderId}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myDeliveries"] });
      toast.success("Status updated!");
    },
  });

  // Geolocation broadcasting when online
  useEffect(() => {
    let watchId: number;
    if (isOnline && partner && partner.status === "approved") {
      if ('geolocation' in navigator) {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            api.put('/delivery/location', {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude
            }).catch(err => console.error("Failed to update location", err));
          },
          (err) => console.error("Geolocation error:", err),
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
        );
      }
    }
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [isOnline, partner]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-foreground pb-28 flex flex-col items-center justify-center p-6 text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-50 text-emerald-600 mb-6 shadow-soft border border-emerald-200">
          <Bike className="h-10 w-10" />
        </div>
        <h2 className="font-display text-2xl font-bold mb-3">Vegamart Fleet</h2>
        <p className="text-muted-foreground mb-8 max-w-xs">
          Deliver fresh produce locally and earn on your schedule.
        </p>
        <Link
          to="/become-delivery"
          className="w-full max-w-sm rounded-full bg-emerald-600 text-white font-black text-sm px-6 py-4 shadow-soft hover:bg-emerald-500 active:scale-95 transition-all"
        >
          Apply to Ride
        </Link>
      </div>
    );
  }

  if (partnerLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>;
  }

  if (!partner) {
    return (
      <div className="min-h-screen bg-background text-foreground pb-28 flex flex-col items-center justify-center p-6 text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-50 text-emerald-600 mb-6 border border-emerald-200">
          <Bike className="h-10 w-10" />
        </div>
        <h2 className="font-display text-2xl font-bold mb-3">Join the Fleet</h2>
        <p className="text-muted-foreground mb-8 max-w-xs">
          You don't have an active delivery profile yet.
        </p>
        <Link
          to="/become-delivery"
          className="w-full max-w-sm rounded-full bg-emerald-600 text-white font-black text-sm px-6 py-4 shadow-soft hover:bg-emerald-500 active:scale-95 transition-all"
        >
          Complete your profile
        </Link>
      </div>
    );
  }

  if (partner.status === "pending") {
    if (!partner.kyc || partner.kyc.status === "rejected") {
      return (
        <div className="min-h-screen bg-background text-foreground p-6 pb-28">
          <DeliveryKYCForm 
            partner={partner} 
            initialData={partner.kyc} 
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ["deliveryProfile"] })} 
          />
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-amber-50 text-amber-600 mb-6 border border-amber-200">
          <Hourglass className="h-10 w-10 animate-pulse" />
        </div>
        <h2 className="font-display text-2xl font-bold mb-3">Review in Progress</h2>
        <p className="text-muted-foreground max-w-xs mb-8">
          Your documents are being verified. We will notify you once approved.
        </p>
      </div>
    );
  }

  if (partner.status === "rejected" || partner.status === "suspended") {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-rose-50 text-rose-600 mb-6 border border-rose-200">
          <Ban className="h-10 w-10" />
        </div>
        <h2 className="font-display text-2xl font-bold text-rose-600 mb-3">Account {partner.status}</h2>
        <p className="text-muted-foreground max-w-xs mb-8">
          Your account is currently disabled. Please contact fleet support.
        </p>
      </div>
    );
  }

  // ACTIVE RIDER DASHBOARD
  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-emerald-500/20 pb-24">
      
      {/* Top Status Bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-card/90 backdrop-blur-md sticky top-0 z-40 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center border border-border">
            <Bike className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <div className="font-bold text-sm leading-tight">{partner.full_name}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Rider ID: {partner.id.substring(0,6)}</div>
          </div>
        </div>
        
        <button 
          onClick={() => setIsOnline(!isOnline)}
          className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs transition-all ${
            isOnline 
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-soft' 
              : 'bg-muted text-muted-foreground border border-border'
          }`}
        >
          <Power className="h-4 w-4" />
          {isOnline ? 'ONLINE' : 'OFFLINE'}
        </button>
      </div>

      <main className="p-4 space-y-6">
        
        {/* RADAR TAB */}
        {activeTab === "requests" && (
          <div className="space-y-4">
            {!isOnline ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-32 w-32 rounded-full bg-muted flex items-center justify-center mb-6 border border-border">
                  <Power className="h-12 w-12 text-muted-foreground/50" />
                </div>
                <h3 className="text-xl font-bold mb-2">You are Offline</h3>
                <p className="text-muted-foreground text-sm max-w-xs">Go online to receive delivery requests from nearby vendors.</p>
              </div>
            ) : requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-48 w-48 rounded-full border border-emerald-500/30 animate-[ping_3s_linear_infinite]" />
                  <div className="absolute h-32 w-32 rounded-full border border-emerald-500/40 animate-[ping_2s_linear_infinite]" />
                </div>
                <div className="h-20 w-20 rounded-full bg-emerald-50 flex items-center justify-center mb-6 relative z-10 border border-emerald-200">
                  <Radio className="h-8 w-8 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold mb-2 relative z-10">Scanning for Orders</h3>
                <p className="text-muted-foreground text-sm max-w-xs relative z-10">Stay in your zone. New orders will appear here instantly.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((r: any) => (
                  <div key={r.id} className="bg-card rounded-3xl p-5 border border-border shadow-soft relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 bg-emerald-50 rounded-bl-3xl border-l border-b border-emerald-100">
                      <div className="text-xl font-black text-emerald-600">₹{r.delivery_fee}</div>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-6">
                      <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                      <span className="text-xs font-bold text-amber-600 uppercase tracking-widest">New Request</span>
                    </div>

                    <div className="space-y-4 mb-6">
                      <div className="flex gap-4">
                        <div className="mt-1"><Store className="h-5 w-5 text-muted-foreground" /></div>
                        <div>
                          <div className="text-xs text-muted-foreground font-bold uppercase mb-1">Pickup From</div>
                          <div className="font-bold text-lg">{r.vendor?.business_name || "Vendor"}</div>
                          <div className="text-sm text-muted-foreground">{r.vendor?.address}</div>
                        </div>
                      </div>
                      
                      <div className="flex gap-4">
                        <div className="mt-1"><MapPin className="h-5 w-5 text-rose-600" /></div>
                        <div>
                          <div className="text-xs text-muted-foreground font-bold uppercase mb-1">Dropoff At</div>
                          <div className="font-bold text-lg">{r.user?.name || "Customer"}</div>
                          <div className="text-sm text-muted-foreground">{r.address?.street_address}</div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => acceptMutation.mutate(r.id)}
                      disabled={acceptMutation.isPending}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl text-lg flex justify-center items-center gap-2 shadow-soft active:scale-[0.98] transition-transform disabled:opacity-60"
                    >
                      {acceptMutation.isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : "Accept Delivery"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ACTIVE DELIVERIES TAB */}
        {activeTab === "active" && (
          <div className="space-y-4">
            {activeOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-6 border border-border">
                  <Package className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-xl font-bold mb-2">No Active Orders</h3>
                <p className="text-muted-foreground text-sm max-w-xs">Accept a request from the Radar to start delivering.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {activeOrders.map((o: any) => (
                  <div key={o.id} className="bg-card rounded-3xl border border-border shadow-soft overflow-hidden">
                    <div className="p-4 bg-muted/50 flex justify-between items-center border-b border-border">
                      <div className="font-bold text-xs text-muted-foreground">Order #{o.id.substring(0,8)}</div>
                      <div className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-black uppercase tracking-wider">
                        {o.status.replace(/_/g, ' ')}
                      </div>
                    </div>

                    <div className="p-5 space-y-6">
                      <div className="flex items-start gap-4 relative">
                        <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-border" />
                        <div className="z-10 bg-card p-1"><Store className="h-4 w-4 text-emerald-600" /></div>
                        <div>
                          <div className="text-[10px] text-emerald-600 font-bold uppercase mb-1">Pickup</div>
                          <div className="font-bold">{o.vendor?.business_name}</div>
                          <div className="text-xs text-muted-foreground">{o.vendor?.address}</div>
                        </div>
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="z-10 bg-card p-1"><MapPin className="h-4 w-4 text-rose-600" /></div>
                        <div>
                          <div className="text-[10px] text-rose-600 font-bold uppercase mb-1">Dropoff</div>
                          <div className="font-bold">{o.user?.name}</div>
                          <div className="text-xs text-muted-foreground">{o.address?.street_address}</div>
                          <div className="mt-2 text-emerald-600 font-black text-sm">Collect: ₹{o.total_amount}</div>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-muted/50 border-t border-border flex gap-2">
                      <button
                        onClick={() => updateStatusMutation.mutate({ orderId: o.id, status: "out_for_delivery" })}
                        disabled={o.status === "out_for_delivery"}
                        className={`flex-1 py-3 rounded-xl font-bold text-sm transition-colors ${o.status === "out_for_delivery" ? 'bg-muted text-muted-foreground' : 'bg-blue-600 text-white hover:bg-blue-500'}`}
                      >
                        Picked Up
                      </button>
                      <button
                        onClick={() => {
                          const otp = window.prompt("Enter 4-digit Delivery OTP from Customer:");
                          if (otp && otp.length === 4) {
                            api.put(`/delivery/order/${o.id}/delivered`, { otp }).then(() => {
                               toast.success("Order marked as delivered!");
                               queryClient.invalidateQueries({ queryKey: ["myDeliveries"] });
                            }).catch((err) => toast.error(err?.message || "Failed to mark delivered"));
                          } else if (otp) {
                            toast.error("Invalid OTP format");
                          }
                        }}
                        className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="h-4 w-4" /> Delivered
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* EARNINGS TAB */}
        {activeTab === "earnings" && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-3xl p-6 border border-emerald-200 shadow-soft relative overflow-hidden">
              <div className="absolute right-0 top-0 opacity-10">
                <Wallet className="h-32 w-32 -mt-4 -mr-4 text-emerald-600" />
              </div>
              <div className="text-emerald-700 font-bold text-xs uppercase tracking-widest mb-2">Today's Earnings</div>
              <div className="font-black text-5xl text-emerald-900 mb-6">₹{totalEarnings}</div>
              
              <div className="grid grid-cols-2 gap-4 border-t border-emerald-200/60 pt-4">
                <div>
                  <div className="text-[10px] text-emerald-700 uppercase font-bold mb-1">Completed</div>
                  <div className="font-bold text-xl text-foreground">{completedOrders.length}</div>
                </div>
                <div>
                  <div className="text-[10px] text-emerald-700 uppercase font-bold mb-1">Rating</div>
                  <div className="font-bold text-xl text-amber-600">★ 4.9</div>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-3xl p-5 border border-border shadow-soft">
              <h3 className="font-bold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Recent Deliveries</h3>
              {completedOrders.length === 0 ? (
                <div className="text-muted-foreground/70 text-sm italic">No deliveries completed today.</div>
              ) : (
                <div className="space-y-3">
                  {completedOrders.map((o: any) => (
                    <div key={o.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                      <div>
                        <div className="font-bold text-sm">Order #{o.id.substring(0,6)}</div>
                        <div className="text-xs text-muted-foreground">{o.vendor?.business_name}</div>
                      </div>
                      <div className="font-black text-emerald-600">+₹{o.delivery_fee}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* BOTTOM NAVIGATION */}
      <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-border pb-safe">
        <div className="flex justify-around items-center h-20 px-4">
          <button 
            onClick={() => setActiveTab("requests")}
            className={`flex flex-col items-center gap-1.5 w-20 transition-colors ${activeTab === "requests" ? "text-emerald-600" : "text-muted-foreground"}`}
          >
            <Radio className={`h-6 w-6 ${activeTab === "requests" ? "animate-pulse" : ""}`} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Radar</span>
          </button>
          
          <button 
            onClick={() => setActiveTab("active")}
            className="relative -top-4 bg-emerald-600 text-white h-16 w-16 rounded-full flex flex-col items-center justify-center gap-1 shadow-soft border-4 border-background"
          >
            <Navigation className="h-6 w-6" />
            {activeOrders.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-600 text-white h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-background shadow-lg">
                {activeOrders.length}
              </span>
            )}
          </button>
          
          <button 
            onClick={() => setActiveTab("earnings")}
            className={`flex flex-col items-center gap-1.5 w-20 transition-colors ${activeTab === "earnings" ? "text-emerald-600" : "text-muted-foreground"}`}
          >
            <Wallet className="h-6 w-6" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Wallet</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// KYC FORM (Light Mode)
function DeliveryKYCForm({ partner, initialData, onSuccess }: { partner: any, initialData: any, onSuccess: () => void }) {
  const [aadhaar, setAadhaar] = useState(initialData?.aadhaar_number || "");
  const [pan, setPan] = useState(initialData?.pan_number || "");
  const [drivingLicense, setDrivingLicense] = useState(initialData?.driving_license || "");
  
  const submitKYCMutation = useMutation({
    mutationFn: (data: any) => api.post("/delivery/me/kyc", data),
    onSuccess: () => {
      toast.success("Documents submitted!");
      onSuccess();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to submit KYC");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitKYCMutation.mutate({
      aadhaar_number: aadhaar,
      pan_number: pan,
      driving_license: drivingLicense,
    });
  };

  return (
    <div className="bg-card rounded-3xl p-6 border border-border mt-10 shadow-soft">
      <div className="text-center space-y-2 mb-8">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 mb-4">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h2 className="font-display text-2xl font-bold">Identity Verification</h2>
        <p className="text-sm text-muted-foreground">
          Provide your documents to activate your rider account.
        </p>
      </div>

      {initialData?.status === "rejected" && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 flex gap-3 text-rose-700 text-sm mb-6">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <div className="font-bold">Rejected</div>
            <div className="mt-1">{initialData.rejection_reason || "Invalid documents."}</div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block">
          <div className="mb-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">Driving License</div>
          <input
            type="text"
            value={drivingLicense}
            onChange={(e) => setDrivingLicense(e.target.value.toUpperCase())}
            placeholder="MH02 20110012345"
            required
            className="w-full rounded-2xl bg-muted border border-border h-14 px-4 text-sm font-bold text-foreground outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
          />
        </label>

        <label className="block">
          <div className="mb-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">Aadhaar Number</div>
          <input
            type="text"
            value={aadhaar}
            onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, ''))}
            placeholder="1234 5678 9012"
            maxLength={12}
            required
            className="w-full rounded-2xl bg-muted border border-border h-14 px-4 text-sm font-bold text-foreground outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
          />
        </label>

        <label className="block">
          <div className="mb-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">PAN Number</div>
          <input
            type="text"
            value={pan}
            onChange={(e) => setPan(e.target.value.toUpperCase())}
            placeholder="ABCDE1234F"
            maxLength={10}
            required
            className="w-full rounded-2xl bg-muted border border-border h-14 px-4 text-sm font-bold text-foreground outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all uppercase"
          />
        </label>

        <button
          type="submit"
          disabled={submitKYCMutation.isPending}
          className="w-full rounded-2xl bg-emerald-600 text-white font-black text-lg h-14 mt-4 flex items-center justify-center hover:bg-emerald-500 active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          {submitKYCMutation.isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : "Submit Documents"}
        </button>
      </form>
    </div>
  );
}
