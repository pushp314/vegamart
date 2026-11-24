import { useState, useEffect, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Bike,
  Navigation,
  Phone,
  CheckCircle2,
  KeyRound,
  MapPin,
  AlertCircle,
  Loader2,
  Clock,
  ShieldCheck,
  Package,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/rider/$orderId")({
  head: () => ({ meta: [{ title: "Rider Delivery Assistant — Vegamart" }] }),
  component: RiderOrderTaskPage,
});

function RiderOrderTaskPage() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [otpInput, setOtpInput] = useState("");
  const [gpsActive, setGpsActive] = useState(false);
  const [lastPingTime, setLastPingTime] = useState<Date | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  // Fetch tracking / order snapshot
  const { data: trackingRes, isLoading, refetch } = useQuery({
    queryKey: ["riderTracking", orderId],
    queryFn: () => api.get<any>(`/delivery/order/${orderId}/tracking`),
    refetchInterval: 10000,
  });

  const tracking = trackingRes?.data?.data || trackingRes?.data;
  const isAlreadyDelivered = tracking?.status === "DELIVERED" || isCompleted;

  const destLat = tracking?.delivery_location?.lat || tracking?.dropoff_lat;
  const destLng = tracking?.delivery_location?.lng || tracking?.dropoff_lng;
  const customerAddress =
    tracking?.delivery_location?.address ||
    tracking?.dropoff_address ||
    "Customer Doorstep";
  const customerPhone =
    tracking?.delivery_location?.phone ||
    tracking?.customer?.phone ||
    tracking?.customer_phone ||
    null;
  const customerName =
    tracking?.delivery_location?.name ||
    tracking?.customer?.name ||
    tracking?.customer_name ||
    "Customer";
  const customerLandmark =
    tracking?.delivery_location?.landmark ||
    tracking?.dropoff_landmark ||
    tracking?.address?.landmark ||
    null;
  const exactLocationNotes =
    tracking?.delivery_location?.exact_location ||
    tracking?.dropoff_exact_location ||
    tracking?.address?.exact_location ||
    null;

  // Google Maps Driving Navigation Intent URL
  const googleMapsUrl = useMemo(() => {
    if (destLat && destLng) {
      return `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customerAddress)}`;
  }, [destLat, destLng, customerAddress]);

  // Live GPS Tracking Broadcaster
  useEffect(() => {
    if (isAlreadyDelivered || typeof window === "undefined" || !navigator.geolocation) return;

    let watchId: number;

    const sendLocation = (pos: GeolocationPosition) => {
      const payload = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        heading: pos.coords.heading ?? undefined,
        speed: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : undefined,
      };

      api
        .post(`/delivery/order/${orderId}/location`, payload)
        .then(() => {
          setGpsActive(true);
          setLastPingTime(new Date());
        })
        .catch(() => {});
    };

    navigator.geolocation.getCurrentPosition(sendLocation, undefined, {
      enableHighAccuracy: true,
      timeout: 10000,
    });

    watchId = navigator.geolocation.watchPosition(sendLocation, undefined, {
      enableHighAccuracy: true,
      maximumAge: 5000,
    });

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [orderId, isAlreadyDelivered]);

  // OTP Verification Mutation
  const completeOrderMutation = useMutation({
    mutationFn: (otp: string) =>
      api.post(`/delivery/order/${orderId}/complete-otp`, { otp }),
    onSuccess: () => {
      toast.success("Order marked as Delivered! 🎉");
      setIsCompleted(true);
      queryClient.invalidateQueries({ queryKey: ["riderTracking", orderId] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Invalid OTP code. Please ask customer.");
    },
  });

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpInput.trim().length !== 6) {
      toast.error("Please enter the 6-digit delivery OTP from customer");
      return;
    }
    completeOrderMutation.mutate(otpInput.trim());
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-foreground pb-20">
      <AppHeader
        title="Rider Delivery Task"
        subtitle={`Order #${tracking?.master_order_id ? tracking.master_order_id.slice(0, 8) : orderId.slice(0, 8)}`}
        back={false}
      />

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {/* GPS Broadcast Status Pill */}
        {!isAlreadyDelivered && (
          <div className="flex items-center justify-between rounded-2xl bg-white dark:bg-slate-900 border border-border p-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <div>
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  {gpsActive ? "Live GPS Sharing Active" : "Connecting GPS…"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Customer is seeing your live bike location
                </p>
              </div>
            </div>
            {lastPingTime && (
              <span className="text-[10px] text-muted-foreground font-mono">
                {lastPingTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
          </div>
        )}

        {isAlreadyDelivered ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20 p-8 text-center space-y-3">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500 text-white shadow-lg">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <h2 className="font-display font-black text-xl text-emerald-900 dark:text-emerald-100">
              Delivery Completed!
            </h2>
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              This order has been verified with customer OTP and completed successfully. Great job!
            </p>
          </div>
        ) : (
          <>
            {/* 1-Tap Google Maps Navigation CTA */}
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-bold text-sm py-4 shadow-lg transition-all"
            >
              <Navigation className="h-5 w-5 fill-white" />
              <span>Open in Google Maps Navigation</span>
            </a>

            {/* Customer & Doorstep Card */}
            <div className="rounded-3xl border border-border bg-white dark:bg-slate-900 p-5 shadow-soft space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 shrink-0">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-sm text-foreground truncate">{customerName}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {customerAddress}
                    </p>
                    {customerLandmark && (
                      <div className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-xl border border-amber-200 dark:border-amber-800/40">
                        <span>📍 Landmark: {customerLandmark}</span>
                      </div>
                    )}
                    {exactLocationNotes && exactLocationNotes !== customerAddress && (
                      <p className="text-[11px] text-muted-foreground/80 mt-1 italic">
                        Doorstep: {exactLocationNotes}
                      </p>
                    )}
                  </div>
                </div>

                {customerPhone && (
                  <a
                    href={`tel:${customerPhone}`}
                    className="h-10 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all shrink-0"
                    title={`Call ${customerName}`}
                  >
                    <Phone className="h-4 w-4" />
                    <span>Call Customer</span>
                  </a>
                )}
              </div>

              {/* Stores & Pickup Sequence Info */}
              {tracking?.pickup_locations && tracking.pickup_locations.length > 0 && (
                <div className="pt-3 border-t border-border/60 space-y-2">
                  <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 text-amber-600" />
                    <span>Pickup Stores ({tracking.pickup_locations.length}):</span>
                  </div>
                  <div className="space-y-1.5">
                    {tracking.pickup_locations.map((p: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-xs bg-muted/40 px-3 py-1.5 rounded-xl">
                        <span className="font-semibold text-foreground">
                          {idx + 1}. {p.name}
                        </span>
                        {p.phone && (
                          <a href={`tel:${p.phone}`} className="text-emerald-600 font-bold text-[11px] hover:underline flex items-center gap-1">
                            <Phone className="h-3 w-3" /> Call
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* OTP Verification & Complete Delivery Box */}
            <div className="rounded-3xl border-2 border-emerald-500/50 bg-white dark:bg-slate-900 p-5 shadow-soft space-y-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-emerald-600" />
                <h3 className="font-bold text-sm">Customer Delivery OTP</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Ask the customer for the 6-digit delivery OTP shown on their VegaMart screen.
              </p>

              <form onSubmit={handleVerifyOtp} className="space-y-3 pt-1">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter 6-digit OTP"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full text-center font-mono text-2xl tracking-[0.35em] font-black rounded-2xl border-2 border-emerald-400 focus:border-emerald-600 bg-emerald-50/30 dark:bg-emerald-950/20 py-3.5 focus:outline-hidden"
                />

                <button
                  type="submit"
                  disabled={otpInput.length !== 6 || completeOrderMutation.isPending}
                  className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs py-3.5 shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {completeOrderMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  <span>Verify OTP &amp; Complete Delivery</span>
                </button>
              </form>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
