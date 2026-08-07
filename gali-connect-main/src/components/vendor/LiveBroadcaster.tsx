import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Navigation } from "lucide-react";

export function LiveBroadcaster({ isRoaming, defaultIsOpen }: { isRoaming: boolean; defaultIsOpen: boolean }) {
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const toggleBroadcasting = () => {
    if (isBroadcasting) {
      stopBroadcasting();
    } else {
      startBroadcasting();
    }
  };

  const stopBroadcasting = () => {
    setIsBroadcasting(false);
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    toast.info("Live broadcasting stopped.");
  };

  const startBroadcasting = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }

    toast.info("Requesting location access...");
    
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        setIsBroadcasting(true);
        const { latitude, longitude } = position.coords;
        try {
          await api.put("/vendors/me/location", { lat: latitude, lng: longitude });
          setLastUpdated(new Date());
        } catch (err) {
          console.error("Failed to update location", err);
        }
      },
      (error) => {
        toast.error(`Location error: ${error.message}`);
        stopBroadcasting();
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );
  };

  if (!isRoaming) return null; // Only roaming vendors need live radar broadcasting

  return (
    <div className={`rounded-3xl border p-6 relative overflow-hidden transition-all ${isBroadcasting ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_40px_-15px_rgba(16,185,129,0.3)]' : 'bg-card border-border shadow-sm'}`}>
      {isBroadcasting && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] aspect-square rounded-full border border-emerald-500/20 animate-ping opacity-20 pointer-events-none" style={{ animationDuration: '3s' }} />
      )}
      
      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${isBroadcasting ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 animate-pulse' : 'bg-muted text-muted-foreground'}`}>
            <Navigation className={`h-5 w-5 ${isBroadcasting ? 'animate-bounce' : ''}`} />
          </div>
          <div>
            <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
              Live Radar Broadcasting {isBroadcasting && <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5 max-w-sm">
              {isBroadcasting 
                ? "Your location is actively updating on the customer map."
                : "Start broadcasting so customers can find your cart in real-time on the map."}
            </p>
            {isBroadcasting && lastUpdated && (
              <p className="text-[10px] font-bold text-emerald-600 mt-1 uppercase tracking-wider">
                Last ping: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={toggleBroadcasting}
          disabled={!defaultIsOpen && !isBroadcasting}
          className={`shrink-0 px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-sm ${
            !defaultIsOpen && !isBroadcasting 
              ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
              : isBroadcasting 
                ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 border border-rose-200' 
                : 'bg-emerald-500 text-white hover:bg-emerald-600 hover:shadow-emerald-500/20 hover:shadow-lg'
          }`}
        >
          {isBroadcasting ? 'Stop Radar' : 'Start Broadcasting'}
        </button>
      </div>

      {!defaultIsOpen && !isBroadcasting && (
        <p className="text-xs text-rose-500 font-medium mt-3 text-center sm:text-left">
          You must toggle your store "Online" at the top before you can start broadcasting.
        </p>
      )}
    </div>
  );
}
