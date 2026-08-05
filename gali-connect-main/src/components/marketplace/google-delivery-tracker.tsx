import { useEffect, useState, useRef } from "react";
import {
  Bike,
  Phone,
  MapPin,
  Store,
  Clock,
  RefreshCw,
  Package,
  CheckCircle2,
  Truck,
  Loader2,
  AlertCircle,
  Navigation,
} from "lucide-react";
import { toast } from "sonner";
import { useDeliveryTracking } from "@/hooks/use-delivery-tracking";

interface SimpleDeliveryTrackerProps {
  orderId?: string;
  vendorName?: string;
  vendorAddress?: string;
  deliveryAddress?: string;
  status?: string;
}

const STATUS_STEPS = [
  { key: "pending", label: "Order Placed", icon: Package },
  { key: "confirmed", label: "Confirmed", icon: CheckCircle2 },
  { key: "preparing", label: "Preparing", icon: Loader2 },
  { key: "packed", label: "Packed", icon: Package },
  { key: "ready_for_pickup", label: "Ready", icon: CheckCircle2 },
  { key: "picked_up", label: "Picked Up", icon: Truck },
  { key: "out_for_delivery", label: "Out for Delivery", icon: Bike },
  { key: "delivered", label: "Delivered", icon: CheckCircle2 },
];

const PREPARATION_STATUSES = new Set([
  "pending",
  "confirmed",
  "processing",
  "prepared",
  "packed",
]);

export function GoogleDeliveryTracker({
  orderId,
  vendorName,
  vendorAddress,
  deliveryAddress,
  status = "pending",
}: SimpleDeliveryTrackerProps) {
  const { trackingInfo, isConnected: wsConnected, refresh } = useDeliveryTracking(
    orderId || "",
  );

  const liveStatus = trackingInfo?.status || status;
  const displayEta = trackingInfo?.eta;
  const displayRiderName = trackingInfo?.driver_info?.name;
  const displayRiderPhone = trackingInfo?.driver_info?.phone;
  const displayRiderVehicle = [
    trackingInfo?.driver_info?.vehicle_type,
    trackingInfo?.driver_info?.vehicle_number,
  ]
    .filter(Boolean)
    .join(" • ");

  const hasLiveDriver = !!trackingInfo?.driver_location;
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);

  useEffect(() => {
    const driverPos = trackingInfo?.driver_location;
    if (hasLiveDriver && trackingInfo?.pickup_location && trackingInfo?.dropoff_location && driverPos) {
      const vPos = trackingInfo.pickup_location;
      const dPos = trackingInfo.dropoff_location;
      const distTotal = Math.hypot(
        dPos.lat - vPos.lat,
        dPos.lng - vPos.lng,
      );
      const distDriver = Math.hypot(
        driverPos.lat - vPos.lat,
        driverPos.lng - vPos.lng,
      );
      if (distTotal > 0) {
        const pct = Math.min(100, Math.max(0, Math.round((distDriver / distTotal) * 100)));
        progressRef.current = pct;
        setProgress(pct);
      }
    } else {
      progressRef.current = 0;
      setProgress(0);
    }
  }, [hasLiveDriver, trackingInfo?.driver_location, trackingInfo?.pickup_location, trackingInfo?.dropoff_location]);

  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.key === liveStatus);
  const displayStep = currentStepIndex >= 0 ? currentStepIndex : liveStatus === "cancelled" ? STATUS_STEPS.length : Math.max(0, currentStepIndex);

  const handleCallRider = () => {
    if (displayRiderPhone) {
      window.location.href = `tel:${displayRiderPhone}`;
    }
  };

  const headerSubtext = () => {
    if (hasLiveDriver) {
      return (
        <>
          Rider is {progress}% on route
          {displayEta ? (
            <>
              {" "}
              • Arriving in <strong>{displayEta}</strong>
            </>
          ) : null}
        </>
      );
    }
    if (liveStatus === "out_for_delivery") {
      return "Connecting to rider… tracking will appear live once connected";
    }
    if (liveStatus === "delivered") {
      return "This order has been delivered";
    }
    if (liveStatus === "cancelled") {
      return "This order was cancelled";
    }
    return "Order is being prepared — live tracking starts once a rider is assigned";
  };

  return (
    <div className="rounded-3xl border bg-card overflow-hidden shadow-soft space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-emerald-900 text-white">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-emerald-300">
            <Bike className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-bold">Order Tracking</span>
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  wsConnected
                    ? "text-emerald-200 bg-emerald-800/80"
                    : "text-amber-200 bg-amber-800/80"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    wsConnected ? "bg-emerald-400 animate-ping" : "bg-amber-400 animate-pulse"
                  }`}
                />
                {wsConnected ? "Live" : "Connecting…"}
              </span>
            </div>
            <div className="text-xs text-emerald-200 mt-0.5">{headerSubtext()}</div>
          </div>
        </div>

        <button
          onClick={() => {
            refresh();
            toast.info("Refreshing tracking data…");
          }}
          className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Simple Status Timeline */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
            {PREPARATION_STATUSES.has(liveStatus) ? (
              <Clock className="h-5 w-5" />
            ) : liveStatus === "delivered" ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : liveStatus === "cancelled" ? (
              <AlertCircle className="h-5 w-5" />
            ) : (
              <Bike className="h-5 w-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground capitalize">
              {liveStatus?.replace(/_/g, " ") || "Pending"}
            </p>
            {displayEta && (
              <p className="text-xs text-muted-foreground">ETA: {displayEta}</p>
            )}
          </div>
        </div>

        {/* Progress Steps */}
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-muted" />
          <div className="space-y-2">
            {STATUS_STEPS.slice(0, displayStep + 1).map((step, idx) => {
              const isActive = idx <= displayStep;
              const Icon = step.icon;
              return (
                <div key={step.key} className="flex items-center gap-3 relative">
                  <div
                    className={`relative z-10 grid h-8 w-8 place-items-center rounded-full border-2 ${
                      isActive
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : "bg-card border-border text-muted-foreground"
                    }`}
                  >
                    {isActive ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      isActive ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Route Info */}
        {(vendorAddress || deliveryAddress) && (
          <div className="rounded-2xl bg-muted/60 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <Store className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span className="text-muted-foreground truncate">{vendorAddress || vendorName || "Vendor"}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Navigation className="h-3.5 w-3.5 text-rose-500 shrink-0" />
              <span className="text-muted-foreground truncate">{deliveryAddress || "Your location"}</span>
            </div>
          </div>
        )}
      </div>

      {/* Rider Details */}
      {displayRiderName ? (
        <div className="p-4 space-y-3 bg-card border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-100 text-primary font-display font-bold">
                  {displayRiderName.substring(0, 2).toUpperCase()}
                </div>
                <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-emerald-600 text-white text-[8px]">
                  <CheckCircle2 className="h-3 w-3" />
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-foreground">{displayRiderName}</h4>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    Verified
                  </span>
                </div>
                {displayRiderVehicle ? (
                  <div className="text-xs text-muted-foreground mt-0.5">{displayRiderVehicle}</div>
                ) : null}
              </div>
            </div>

            {displayRiderPhone ? (
              <button
                onClick={handleCallRider}
                className="flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs px-3 py-2 shadow-xs hover:bg-primary/90 transition-colors"
              >
                <Phone className="h-3.5 w-3.5" /> Call
              </button>
            ) : null}
          </div>

          {hasLiveDriver && (
            <div className="space-y-1.5 pt-1 border-t">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-muted-foreground">Delivery Progress</span>
                <span className="text-primary">{progress}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-700 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 bg-card border-t">
          <div className="flex items-center gap-3 rounded-2xl bg-muted/60 border border-dashed p-3.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-card border text-muted-foreground">
              {PREPARATION_STATUSES.has(liveStatus) ? (
                <Clock className="h-4 w-4" />
              ) : (
                <Bike className="h-4 w-4" />
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">
                {PREPARATION_STATUSES.has(liveStatus)
                  ? "Preparing your order"
                  : liveStatus === "out_for_delivery"
                    ? "Looking for a rider"
                    : "No rider assigned"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {PREPARATION_STATUSES.has(liveStatus)
                  ? "A rider will be assigned as soon as your order is ready."
                  : "Rider details will appear here once assigned."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}