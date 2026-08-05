import { useEffect, useState, useRef } from "react";
import {
  Bike,
  Phone,
  MapPin,
  Store,
  Navigation,
  ShieldCheck,
  Clock,
  RefreshCw,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { useDeliveryTracking } from "@/hooks/use-delivery-tracking";

interface DeliveryLocation {
  lat: number;
  lng: number;
}

interface GoogleDeliveryTrackerProps {
  orderId?: string;
  vendorName?: string;
  vendorAddress?: string;
  deliveryAddress?: string;
  status?: string;
  vendorCoords?: DeliveryLocation;
  destCoords?: DeliveryLocation;
}

const PREPARATION_STATUSES = new Set(["pending", "confirmed", "processing", "prepared", "packed"]);

export function GoogleDeliveryTracker({
  orderId,
  vendorName,
  vendorAddress,
  deliveryAddress,
  status = "pending",
  vendorCoords,
  destCoords,
}: GoogleDeliveryTrackerProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const { trackingInfo, isConnected: wsConnected, refresh } = useDeliveryTracking(orderId || "");

  // Only render what the backend actually reports — never fabricate live data.
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

  const vCoords = trackingInfo?.pickup_location || vendorCoords;
  const dCoords = trackingInfo?.dropoff_location || destCoords;
  const hasLiveDriver = !!trackingInfo?.driver_location;

  const [driverPos, setDriverPos] = useState<DeliveryLocation | null>(null);
  const [progress, setProgress] = useState(0);

  const riderMarkerRef = useRef<any>(null);
  const routePathRef = useRef<any>(null);
  const animationFrameRef = useRef<number>(0);

  // Progress calculator — only meaningful once a live driver position exists
  useEffect(() => {
    if (!driverPos || !vCoords || !dCoords) return;
    const distTotal = Math.hypot(dCoords.lat - vCoords.lat, dCoords.lng - vCoords.lng);
    const distDriver = Math.hypot(driverPos.lat - vCoords.lat, driverPos.lng - vCoords.lng);
    if (distTotal > 0) {
      setProgress(Math.min(100, Math.max(0, Math.round((distDriver / distTotal) * 100))));
    }
  }, [driverPos, vCoords, dCoords]);

  useEffect(() => {
    if (trackingInfo?.driver_location) {
      setDriverPos(trackingInfo.driver_location);
    }
  }, [trackingInfo?.driver_location]);

  // Load Google Maps JavaScript API if API Key is configured
  useEffect(() => {
    if (!apiKey) return;

    const scriptId = "google-maps-script";
    if (document.getElementById(scriptId)) {
      setMapLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.onload = () => setMapLoaded(true);
    document.head.appendChild(script);
  }, [apiKey]);

  // Render Google Map instance when script is ready (vendor + destination only)
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !(window as any).google) return;
    if (mapInstanceRef.current) return; // Already initialized
    if (!vCoords || !dCoords) return;

    const google = (window as any).google;
    const center = {
      lat: (vCoords.lat + dCoords.lat) / 2,
      lng: (vCoords.lng + dCoords.lng) / 2,
    };

    mapInstanceRef.current = new google.maps.Map(mapRef.current, {
      center,
      zoom: 15,
      disableDefaultUI: true,
      zoomControl: true,
    });

    new google.maps.Marker({
      position: vCoords,
      map: mapInstanceRef.current,
      title: vendorName,
      icon: {
        url: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
      },
    });

    new google.maps.Marker({
      position: dCoords,
      map: mapInstanceRef.current,
      title: "Delivery Location",
      icon: {
        url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
      },
    });
  }, [mapLoaded, vCoords, dCoords, vendorName]);

  // Add rider marker + route once a real driver position arrives
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !(window as any).google) return;
    if (riderMarkerRef.current) return;
    if (!driverPos || !vCoords || !dCoords) return;

    const google = (window as any).google;
    riderMarkerRef.current = new google.maps.Marker({
      position: driverPos,
      map: mapInstanceRef.current,
      title: displayRiderName,
      icon: {
        url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
      },
    });

    routePathRef.current = new google.maps.Polyline({
      path: [vCoords, driverPos, dCoords],
      geodesic: true,
      strokeColor: "#10b981",
      strokeOpacity: 0.8,
      strokeWeight: 4,
    });
    routePathRef.current.setMap(mapInstanceRef.current);
  }, [mapLoaded, driverPos, vCoords, dCoords, displayRiderName]);

  // Smooth Animate Driver Position
  useEffect(() => {
    if (!riderMarkerRef.current || !routePathRef.current || !(window as any).google) return;
    if (!driverPos) return;

    const startPos = {
      lat: riderMarkerRef.current.getPosition().lat(),
      lng: riderMarkerRef.current.getPosition().lng(),
    };
    const endPos = driverPos;

    let startTime: number | null = null;
    const duration = 1500; // 1.5 second smooth glide

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const t = Math.min(1, elapsed / duration);

      // Easing function (easeOutCubic)
      const easeT = 1 - Math.pow(1 - t, 3);

      const currentLat = startPos.lat + (endPos.lat - startPos.lat) * easeT;
      const currentLng = startPos.lng + (endPos.lng - startPos.lng) * easeT;

      const newPos = { lat: currentLat, lng: currentLng };
      riderMarkerRef.current.setPosition(newPos);

      routePathRef.current.setPath([vCoords, newPos, dCoords]);

      if (t < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [driverPos, vCoords, dCoords]);

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

  const mapCenter = hasLiveDriver
    ? driverPos
    : vCoords && dCoords
      ? { lat: (vCoords.lat + dCoords.lat) / 2, lng: (vCoords.lng + dCoords.lng) / 2 }
      : null;

  return (
    <div className="rounded-3xl border bg-card overflow-hidden shadow-soft space-y-0">
      {/* Live Header Bar */}
      <div className="flex items-center justify-between p-4 bg-emerald-900 text-white">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-emerald-300 backdrop-blur-xs">
            <Bike className="h-5 w-5 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-bold">Live Order Tracking</span>
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${wsConnected ? "text-emerald-200 bg-emerald-800/80" : "text-amber-200 bg-amber-800/80"}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${wsConnected ? "bg-emerald-400 animate-ping" : "bg-amber-400 animate-pulse"}`}
                />
                {wsConnected ? "Live GPS" : "Connecting…"}
              </span>
            </div>
            <div className="text-xs text-emerald-200 mt-0.5">{headerSubtext()}</div>
          </div>
        </div>

        <button
          onClick={() => {
            refresh();
            toast.info("Refreshing live data...");
          }}
          className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Interactive Map Box */}
      <div className="relative h-64 w-full bg-muted overflow-hidden">
        {apiKey ? (
          <div ref={mapRef} className="h-full w-full" />
        ) : vCoords && dCoords && mapCenter ? (
          <>
            <iframe
              title="Delivery Route Map"
              width="100%"
              height="100%"
              className="absolute inset-0 border-0 opacity-80 pointer-events-none"
              loading="lazy"
              src={`https://maps.google.com/maps?q=${mapCenter.lat},${mapCenter.lng}&z=15&output=embed`}
            />

            {/* Floating Live Overlay Card */}
            <div className="relative z-10 self-start rounded-2xl bg-card/90 border p-2.5 shadow-sm backdrop-blur-xs flex items-center gap-2 text-xs m-3">
              {hasLiveDriver ? (
                <>
                  <Navigation className="h-4 w-4 text-primary animate-spin" />
                  <span className="font-bold">Tracing Delivery Rider Live GPS</span>
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="font-bold">Waiting for rider location…</span>
                </>
              )}
            </div>

            {/* Bottom Floating Route Info */}
            <div className="relative z-10 self-end rounded-2xl bg-card/90 border p-2.5 shadow-sm backdrop-blur-xs text-xs flex items-center gap-3 m-3">
              <div className="flex items-center gap-1 font-semibold text-emerald-800">
                <Store className="h-3.5 w-3.5 text-emerald-600" /> {vendorName || "Vendor"}
              </div>
              <span>→</span>
              <div className="flex items-center gap-1 font-semibold text-foreground">
                <MapPin className="h-3.5 w-3.5 text-rose-500" /> Your Doorstep
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Package className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-foreground">
                {hasLiveDriver ? "Live map is loading…" : "Tracking will appear here once a rider starts"}
              </p>
              <p className="text-xs text-muted-foreground">
                You'll see a live map and rider details once your order is out for delivery.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Delivery Rider Details & Actions */}
      <div className="p-4 space-y-4 bg-card border-t">
        {displayRiderName ? (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-primary font-display font-bold text-lg">
                    {displayRiderName.substring(0, 2).toUpperCase()}
                  </div>
                  <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-emerald-600 text-white text-[10px]">
                    <ShieldCheck className="h-3 w-3" />
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-foreground">{displayRiderName}</h4>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      Verified Rider
                    </span>
                  </div>
                  {displayRiderVehicle ? (
                    <div className="text-xs text-muted-foreground mt-0.5">{displayRiderVehicle}</div>
                  ) : null}
                </div>
              </div>

              {displayRiderPhone ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCallRider}
                    className="flex items-center gap-1.5 rounded-2xl bg-primary text-primary-foreground font-bold text-xs px-3.5 py-2.5 shadow-xs hover:bg-primary/90 transition-colors"
                  >
                    <Phone className="h-4 w-4" /> Call Rider
                  </button>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl bg-muted/60 border border-dashed p-3.5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-card border text-muted-foreground">
              {PREPARATION_STATUSES.has(liveStatus) ? (
                <Clock className="h-5 w-5" />
              ) : (
                <Bike className="h-5 w-5" />
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">
                {PREPARATION_STATUSES.has(liveStatus)
                  ? "Preparing your order"
                  : liveStatus === "out_for_delivery"
                    ? "Looking for a rider"
                    : "No rider assigned"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {PREPARATION_STATUSES.has(liveStatus)
                  ? "A rider will be assigned as soon as your order is ready."
                  : "Rider details will appear here once assigned."}
              </p>
            </div>
          </div>
        )}

        {/* Live Progress Bar */}
        <div className="space-y-1.5 pt-1 border-t">
          {hasLiveDriver ? (
            <>
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-muted-foreground">Delivery Progress</span>
                <span className="text-primary">{progress}% Completed</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-700 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center gap-2 py-1 text-xs text-muted-foreground">
              <Clock className="h-4 w-4" />
              Live progress updates once the rider begins the delivery
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
