import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bike, CheckCircle, ShieldCheck, ArrowRight, Loader2, FileText, Smartphone } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { useAuth } from "@/context/auth-context";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/become-delivery")({
  head: () => ({ meta: [{ title: "Become a Delivery Partner — Vegamart" }] }),
  component: BecomeDeliveryPage,
});

function BecomeDeliveryPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  
  const [vehicleType, setVehicleType] = useState("bike");
  const [vehicleNumber, setVehicleNumber] = useState("");

  const registerMutation = useMutation({
    mutationFn: (data: any) => api.post("/delivery/register", data),
    onSuccess: () => {
      toast.success("Delivery partner application submitted! Redirecting to KYC...", { duration: 4000 });
      setTimeout(() => navigate({ to: "/delivery" }), 1500);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to submit application");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error("Please login to apply as a delivery partner.");
      navigate({ to: "/login" });
      return;
    }
    
    registerMutation.mutate({
      vehicle_type: vehicleType,
      vehicle_number: vehicleNumber,
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader title="Join Vegamart Fleet" back={true} />

      <main className="mx-auto max-w-lg px-4 pt-12 space-y-8">
        <div className="text-center space-y-4">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-emerald-600 shadow-soft">
            <Bike className="h-10 w-10" />
          </div>
          <h1 className="font-display text-3xl font-bold">Become a Delivery Partner</h1>
          <p className="text-sm text-muted-foreground leading-relaxed px-4">
            Earn money on your own schedule. Join Vegamart's hyperlocal delivery fleet and start delivering fresh groceries in your neighborhood.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-3xl border bg-card p-5 space-y-2 shadow-soft">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Smartphone className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-sm">Flexible Hours</h3>
            <p className="text-[11px] text-muted-foreground">Work whenever you want, seamlessly toggle your availability.</p>
          </div>
          <div className="rounded-3xl border bg-card p-5 space-y-2 shadow-soft">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-100 text-amber-600">
              <CheckCircle className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-sm">Weekly Payouts</h3>
            <p className="text-[11px] text-muted-foreground">Get your earnings deposited directly into your bank account.</p>
          </div>
        </div>

        <div className="rounded-3xl border bg-card p-6 md:p-8 shadow-glow relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <ShieldCheck className="w-32 h-32" />
          </div>
          
          <h2 className="font-display text-xl font-bold mb-6">Application Details</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
            <label className="block">
              <div className="mb-1 text-xs font-semibold text-foreground flex items-center gap-1">
                Vehicle Type
              </div>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="w-full rounded-2xl bg-muted border h-12 px-4 text-sm font-medium outline-none"
              >
                <option value="bike">Motorcycle / Bike</option>
                <option value="scooter">Scooter / Activa</option>
                <option value="ev">Electric Vehicle</option>
                <option value="bicycle">Bicycle</option>
              </select>
            </label>

            <label className="block">
              <div className="mb-1 text-xs font-semibold text-foreground flex items-center gap-1">
                Vehicle Registration Number
              </div>
              <input
                type="text"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                placeholder="e.g. MH 02 AB 1234"
                required
                className="w-full rounded-2xl bg-muted border h-12 px-4 text-sm font-medium outline-none uppercase placeholder:normal-case"
              />
            </label>

            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 flex gap-3 text-emerald-800 mt-6">
              <FileText className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed font-medium">
                By submitting this application, you agree to Vegamart's partner terms. You will be required to submit your Driving License, PAN, and Aadhaar card on the next screen for KYC verification.
              </div>
            </div>

            <button
              type="submit"
              disabled={registerMutation.isPending}
              className="w-full rounded-full bg-primary text-primary-foreground font-bold text-sm h-14 mt-4 flex items-center justify-center gap-2 shadow-md hover:bg-primary/90 transition-all active:scale-[0.98]"
            >
              {registerMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  Start Application <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
