import { useEffect, useState, useRef } from "react";
import {
  Bike,
  Phone,
  MessageSquare,
  MapPin,
  Store,
  Navigation,
  ShieldCheck,
  Clock,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
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
  eta?: string;
  riderName?: string;
  riderPhone?: string;
  riderVehicle?: string;
  vendorCoords?: DeliveryLocation;
  destCoords?: DeliveryLocation;
}

export function GoogleDeliveryTracker({
  orderId = "VG-264782",
  vendorName = "Raju Sabziwala",
  vendorAddress = "Main Gali, Market Road, Indiranagar",
  deliveryAddress = "B-402, Green Valley Apartments, Bengaluru",
  status = "out_for_delivery",
  eta = "11 mins",
  riderName = "Vikram Singh",
  riderPhone = "+91 98112 34567",
  riderVehicle = "EV Scooter (KA-03-EV-8812)",
  vendorCoords = { lat: 12.9716, lng: 77.6412 },
  destCoords = { lat: 12.9785, lng: 77.6478 },
}: GoogleDeliveryTrackerProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const { trackingInfo, isConnected: wsConnected, refresh } = useDeliveryTracking(orderId || "");

  // Override props with live data if available
  const displayStatus = trackingInfo?.status || status;
  const displayEta = trackingInfo?.eta || eta;
  const displayRiderName = trackingInfo?.driver_info?.name || riderName;
  const displayRiderPhone = trackingInfo?.driver_info?.phone || riderPhone;
  const displayRiderVehicle = trackingInfo?.driver_info?.vehicle_number || riderVehicle;

  const vCoords = trackingInfo?.pickup_location || vendorCoords;
  const dCoords = trackingInfo?.dropoff_location || destCoords;

  // Live driver animated location state
  const [driverPos, setDriverPos] = useState<DeliveryLocation>({
    lat: vCoords.lat + (dCoords.lat - vCoords.lat) * 0.45,
    lng: vCoords.lng + (dCoords.lng - vCoords.lng) * 0.45,
  });

  const [progress, setProgress] = useState(45); // 45% of route completed

  const riderMarkerRef = useRef<any>(null);
  const routePathRef = useRef<any>(null);
  const animationFrameRef = useRef<number>(0);

  // Progress calculator
  useEffect(() => {
    const distTotal = Math.hypot(dCoords.lat - vCoords.lat, dCoords.lng - vCoords.lng);
    const distDriver = Math.hypot(driverPos.lat - vCoords.lat, driverPos.lng - vCoords.lng);
    if (distTotal > 0) {
      const prog = Math.min(100, Math.max(0, Math.round((distDriver / distTotal) * 100)));
      setProgress(prog);
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

  // Render Google Map instance when script is ready
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !(window as any).google) return;
    if (riderMarkerRef.current) return; // Already initialized

    const google = (window as any).google;
    const center = {
      lat: (vCoords.lat + dCoords.lat) / 2,
      lng: (vCoords.lng + dCoords.lng) / 2,
    };

    const map = new google.maps.Map(mapRef.current, {
      center,
      zoom: 15,
      disableDefaultUI: true,
      zoomControl: true,
    });

    // Vendor Marker
    new google.maps.Marker({
      position: vCoords,
      map,
      title: vendorName,
      icon: {
        url: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
      },
    });

    // Customer Destination Marker
    new google.maps.Marker({
      position: dCoords,
      map,
      title: "Delivery Location",
      icon: {
        url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
      },
    });

    // Driver Marker
    riderMarkerRef.current = new google.maps.Marker({
      position: driverPos,
      map,
      title: displayRiderName,
      icon: {
        url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
      },
    });

    // Polyline Route
    routePathRef.current = new google.maps.Polyline({
      path: [vCoords, driverPos, dCoords],
      geodesic: true,
      strokeColor: "#10b981",
      strokeOpacity: 0.8,
      strokeWeight: 4,
    });
    routePathRef.current.setMap(map);
  }, [mapLoaded, vCoords, dCoords, vendorName, displayRiderName]); // Removed driverPos

  // Smooth Animate Driver Position
  useEffect(() => {
    if (!riderMarkerRef.current || !routePathRef.current || !(window as any).google) return;

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
    window.location.href = `tel:${displayRiderPhone}`;
  };

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
            <div className="text-xs text-emerald-200 mt-0.5">
              Rider is {progress}% on route • Arriving in <strong>{displayEta}</strong>
            </div>
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

      {/* Interactive Google Map Box */}
      <div className="relative h-64 w-full bg-muted overflow-hidden">
        {apiKey ? (
          <div ref={mapRef} className="h-full w-full" />
        ) : (
          /* High-Fidelity Styled Map Fallback Canvas */
          <div className="relative h-full w-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] bg-emerald-50/40 flex flex-col justify-between p-4">
            {/* Embedded Google Map Iframe Fallback */}
            <iframe
              title="Delivery Route Map"
              width="100%"
              height="100%"
              className="absolute inset-0 border-0 opacity-80 pointer-events-none"
              loading="lazy"
              src={`https://maps.google.com/maps?q=${driverPos.lat},${driverPos.lng}&z=15&output=embed`}
            />

            {/* Floating Live Overlay Card */}
            <div className="relative z-10 self-start rounded-2xl bg-card/90 border p-2.5 shadow-sm backdrop-blur-xs flex items-center gap-2 text-xs">
              <Navigation className="h-4 w-4 text-primary animate-spin" />
              <span className="font-bold">Tracing Delivery Rider Live GPS</span>
            </div>

            {/* Bottom Floating Route Info */}
            <div className="relative z-10 self-end rounded-2xl bg-card/90 border p-2.5 shadow-sm backdrop-blur-xs text-xs flex items-center gap-3">
              <div className="flex items-center gap-1 font-semibold text-emerald-800">
                <Store className="h-3.5 w-3.5 text-emerald-600" /> {vendorName}
              </div>
              <span>→</span>
              <div className="flex items-center gap-1 font-semibold text-foreground">
                <MapPin className="h-3.5 w-3.5 text-rose-500" /> Your Doorstep
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delivery Rider Details & Actions */}
      <div className="p-4 space-y-4 bg-card border-t">
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
              <div className="text-xs text-muted-foreground mt-0.5">{displayRiderVehicle}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCallRider}
              className="flex items-center gap-1.5 rounded-2xl bg-primary text-primary-foreground font-bold text-xs px-3.5 py-2.5 shadow-xs hover:bg-primary/90 transition-colors"
            >
              <Phone className="h-4 w-4" /> Call Rider
            </button>
          </div>
        </div>

        {/* Live Progress Bar */}
        <div className="space-y-1.5 pt-1 border-t">
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
        </div>
      </div>
    </div>
  );
}
