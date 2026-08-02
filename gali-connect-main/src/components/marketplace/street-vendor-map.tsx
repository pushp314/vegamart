import { useState, useEffect, useRef } from "react";
import { Navigation, ShoppingBag, Store, Map as MapIcon, Apple, Carrot, IceCream, Bell, Send, X, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface RoamingVendor {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  distance: string;
  isMoving: boolean;
  eta: string;
}

export function StreetVendorMap() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const mapRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<{ [id: string]: any }>({});
  const [mapLoaded, setMapLoaded] = useState(false);
  const [googleMap, setGoogleMap] = useState<any>(null);

  const [vendors, setVendors] = useState<RoamingVendor[]>([]);
  const [userLocation, setUserLocation] = useState({ lat: 12.9715, lng: 77.6405 });
  const [locationError, setLocationError] = useState("");
  const [activeVendor, setActiveVendor] = useState<string | null>(null);
  const [bellVendor, setBellVendor] = useState<RoamingVendor | null>(null);
  const [bellAddress, setBellAddress] = useState("");
  const [bellNote, setBellNote] = useState("");
  const [isRinging, setIsRinging] = useState(false);
  const userMarkerRef = useRef<any>(null);

  // Live WebSocket roaming position listener
  useEffect(() => {
    const baseURL = import.meta.env.VITE_API_URL || "http://localhost:8080";
    const wsURL = baseURL.replace("http://", "ws://").replace("https://", "wss://");
    const ws = new WebSocket(`${wsURL}/api/v1/vendors/stream-roaming`);

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "roaming_vendor_location" && payload.data?.vendor_id) {
          const { vendor_id, lat, lng } = payload.data;
          setVendors(prev => prev.map(v => {
            if (v.id === vendor_id) {
              if (markersRef.current[v.id]) {
                markersRef.current[v.id].setPosition({ lat, lng });
              }
              return { ...v, lat, lng, isMoving: true };
            }
            return v;
          }));
        }
      } catch (err) {
        console.error("WS roaming parse error:", err);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const handleRingBellSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bellVendor || !bellAddress.trim()) return;

    setIsRinging(true);
    try {
      const res = await api.post(`/vendors/${bellVendor.id}/ring-bell`, {
        address: bellAddress,
        note: bellNote,
        lat: userLocation.lat,
        lng: userLocation.lng,
      });

      setIsRinging(false);
      if (res.success) {
        toast.success(`🔔 Bell rung! ${bellVendor.name} has been notified to come to your street!`);
        setBellVendor(null);
        setBellAddress("");
        setBellNote("");
      } else {
        toast.error("Failed to ring bell. Please try again.");
      }
    } catch (err) {
      setIsRinging(false);
      toast.error("Network error ringing bell");
    }
  };

  // Get real location on mount
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(newPos);
          if (googleMap) {
            googleMap.setCenter(newPos);
            if (userMarkerRef.current) {
              userMarkerRef.current.setPosition(newPos);
            }
          }
        },
        (err) => {
          setLocationError("Could not get exact location. Showing default area.");
          console.error("Location error:", err);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  }, [googleMap]);
  const { data: realVendorsData } = useQuery({
    queryKey: ['live-vendors'],
    queryFn: () => api.get<any[]>('/vendors?is_open=true'),
    refetchInterval: 5000,
  });

  useEffect(() => {
    const liveVendors = (realVendorsData?.data || [])
      .filter((v: any) => v.latitude && v.longitude && v.vendor_type === 'roaming')
        .map((v: any) => ({
          id: v.id,
          name: v.business_name,
          category: v.category?.toLowerCase() || 'vegetables',
          lat: v.latitude,
          lng: v.longitude,
          distance: "Nearby",
          isMoving: true,
          eta: "Live tracking",
        }));

      if (liveVendors.length > 0) {
        setVendors(liveVendors);
      }
  }, [realVendorsData]);

  // Load Google Maps JavaScript API
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

  // Initialize Map
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !(window as any).google) return;
    if (googleMap) return;

    const google = (window as any).google;
    const map = new google.maps.Map(mapRef.current, {
      center: userLocation,
      zoom: 15,
      disableDefaultUI: true,
      zoomControl: true,
      styles: [
        {
          featureType: "poi.business",
          stylers: [{ visibility: "off" }],
        },
      ],
    });

    // Customer Location Marker
    userMarkerRef.current = new google.maps.Marker({
      position: userLocation,
      map,
      title: "You are here",
      icon: {
        url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
      },
    });

    setGoogleMap(map);
  }, [mapLoaded]);

  // Update Markers when vendors change
  useEffect(() => {
    if (!googleMap || !(window as any).google) return;
    const google = (window as any).google;

    // Clear old markers that are no longer in the vendors list
    Object.keys(markersRef.current).forEach((id) => {
      if (!vendors.find((v) => v.id === id)) {
        markersRef.current[id].setMap(null);
        delete markersRef.current[id];
      }
    });

    // Add or update markers
    vendors.forEach((vendor) => {
      if (markersRef.current[vendor.id]) {
        // Update position if moved
        markersRef.current[vendor.id].setPosition({ lat: vendor.lat, lng: vendor.lng });
      } else {
        // Create new marker
        const marker = new google.maps.Marker({
          position: { lat: vendor.lat, lng: vendor.lng },
          map: googleMap,
          title: vendor.name,
          icon: {
            url: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
          },
        });

        marker.addListener("click", () => {
          setActiveVendor(vendor.id);
          googleMap.panTo({ lat: vendor.lat, lng: vendor.lng });
        });

        markersRef.current[vendor.id] = marker;
      }
    });
  }, [vendors, googleMap]);

  const getIcon = (category: string) => {
    switch(category) {
      case 'vegetables': return <Carrot className="h-5 w-5 text-orange-500" />;
      case 'fruits': return <Apple className="h-5 w-5 text-red-500" />;
      case 'ice_cream': return <IceCream className="h-5 w-5 text-pink-500" />;
      default: return <Store className="h-5 w-5 text-emerald-500" />;
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[500px] w-full bg-background rounded-3xl overflow-hidden shadow-none md:shadow-soft relative border-0 md:border">
      {/* Header */}
      <div className="absolute top-0 inset-x-0 z-20 p-4 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 text-white">
            <div className="bg-emerald-500 p-2 rounded-full shadow-lg animate-pulse">
              <Navigation className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold font-display text-lg drop-shadow-md">Live Radar</h3>
              <p className="text-xs text-white/90 font-medium drop-shadow-md">Finding street vendors near you...</p>
              {locationError && <p className="text-[10px] text-amber-300 font-medium drop-shadow-md mt-0.5">{locationError}</p>}
            </div>
          </div>
          <button
            type="button"
            className="pointer-events-auto flex items-center justify-center h-10 w-10 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-full shadow-lg hover:bg-white/20 transition-colors"
            onClick={() => {
              if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition((pos) => {
                  const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                  setUserLocation(newPos);
                  if (googleMap) {
                    googleMap.panTo(newPos);
                    if (userMarkerRef.current) userMarkerRef.current.setPosition(newPos);
                  }
                  setLocationError("");
                });
              }
            }}
          >
            <MapIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Google Maps Container */}
      <div className="relative flex-1 bg-[#e5e3df] overflow-hidden">
        {!apiKey && (
          <div className="absolute inset-0 z-10 bg-slate-900 overflow-hidden">
            {/* OpenStreetMap iframe backdrop */}
            <iframe
              title="OpenStreetMap Live Radar"
              width="100%"
              height="100%"
              className="w-full h-full border-0 opacity-80 filter contrast-125 saturate-150"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${userLocation.lng - 0.015}%2C${userLocation.lat - 0.015}%2C${userLocation.lng + 0.015}%2C${userLocation.lat + 0.015}&layer=mapnik&marker=${userLocation.lat}%2C${userLocation.lng}`}
            />
            {/* Overlay Radar sweep animation & interactive vendor pins */}
            <div className="absolute inset-0 pointer-events-none bg-radial from-transparent via-emerald-950/20 to-slate-950/80">
              <div className="absolute top-4 left-4 z-20 bg-slate-900/90 text-white border border-emerald-500/30 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 backdrop-blur-md shadow-lg pointer-events-auto">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                Live Street Radar Active
              </div>

              {/* Vendor Markers overlay on OpenStreetMap */}
              {vendors.map((vendor, idx) => {
                const offsetX = (idx % 2 === 0 ? 1 : -1) * (30 + idx * 20);
                const offsetY = (idx % 3 === 0 ? -1 : 1) * (40 + idx * 15);
                const isSelected = activeVendor === vendor.id;

                const getCategoryStyle = (cat: string) => {
                  switch (cat) {
                    case "vegetables":
                      return { bg: "bg-emerald-600", border: "border-emerald-300", tag: "🥦 Veg Cart" };
                    case "fruits":
                      return { bg: "bg-rose-600", border: "border-rose-300", tag: "🍎 Fruit Cart" };
                    case "ice_cream":
                      return { bg: "bg-purple-600", border: "border-purple-300", tag: "🍦 Ice Cream" };
                    default:
                      return { bg: "bg-amber-600", border: "border-amber-300", tag: "🛒 Street Cart" };
                  }
                };

                const catStyle = getCategoryStyle(vendor.category);

                return (
                  <button
                    key={vendor.id}
                    type="button"
                    onClick={() => setActiveVendor(vendor.id)}
                    style={{
                      left: `calc(50% + ${offsetX}px)`,
                      top: `calc(50% + ${offsetY}px)`,
                    }}
                    className={`absolute z-30 pointer-events-auto transform -translate-x-1/2 -translate-y-1/2 group transition-all duration-300 ${isSelected ? 'scale-125 z-40' : 'hover:scale-110'}`}
                  >
                    <div className={`relative flex items-center gap-2 px-3.5 py-2 rounded-2xl shadow-2xl backdrop-blur-md border ${catStyle.bg} text-white ${catStyle.border} ${isSelected ? 'ring-4 ring-white/60 font-black scale-105' : 'font-bold'}`}>
                      <span className="relative flex h-2.5 w-2.5 shrink-0">
                        {vendor.isMoving && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>}
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                      </span>
                      <div className="text-left leading-none">
                        <div className="text-[10px] font-black uppercase tracking-wider text-white/90 mb-0.5">{catStyle.tag}</div>
                        <div className="text-xs font-extrabold whitespace-nowrap">{vendor.name}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div ref={mapRef} className="absolute inset-0 h-full w-full" />
      </div>

      {/* Vendor Details Bottom Sheet */}
      <div className="absolute bottom-0 inset-x-0 z-20 p-4 pointer-events-none">
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x pointer-events-auto hide-scrollbar">
          {vendors.map(vendor => (
            <div 
              key={vendor.id}
              onClick={() => {
                setActiveVendor(vendor.id);
                if (googleMap) {
                  googleMap.panTo({ lat: vendor.lat, lng: vendor.lng });
                }
              }}
              className={`min-w-[280px] snap-center shrink-0 rounded-2xl bg-white/95 backdrop-blur-xl border p-4 shadow-xl transition-all cursor-pointer ${activeVendor === vendor.id ? 'border-emerald-500 ring-4 ring-emerald-500/10 scale-100' : 'border-zinc-200 scale-95 opacity-90'}`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-emerald-50 grid place-items-center">
                    {getIcon(vendor.category)}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-zinc-900">{vendor.name}</h4>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                      <span className="relative flex h-2 w-2">
                        {vendor.isMoving && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      {vendor.isMoving ? 'Moving nearby' : 'Stationary'}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-4 text-xs">
                <div className="flex items-center gap-3 text-zinc-600 font-medium">
                  <span className="flex items-center gap-1"><MapIcon className="h-3.5 w-3.5" /> {vendor.distance}</span>
                  <span className="flex items-center gap-1"><Navigation className="h-3.5 w-3.5" /> {vendor.eta}</span>
                </div>
              </div>

              {activeVendor === vendor.id && (
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setBellVendor(vendor);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 py-2.5 text-xs font-bold shadow-xs hover:bg-amber-100 transition-colors"
                  >
                    <Bell className="h-4 w-4 text-amber-600 animate-bounce" /> Ring Bell
                  </button>
                  <Link to="/vendors/$vendorId" params={{ vendorId: vendor.id }} className="flex-[1.5] flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition-colors">
                    <ShoppingBag className="h-4 w-4" /> View Cart
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Ring Bell Gali Modal */}
      {bellVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card border w-full max-w-md rounded-3xl p-6 shadow-2xl relative space-y-4 text-foreground">
            <button
              onClick={() => setBellVendor(null)}
              className="absolute right-5 top-5 p-1 rounded-full text-muted-foreground hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-amber-100 text-amber-600 grid place-items-center">
                <Bell className="h-6 w-6 animate-bounce" />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg leading-tight">Call Vendor to Your Street</h3>
                <p className="text-xs text-muted-foreground">Notify <strong>{bellVendor.name}</strong> to come to your gali</p>
              </div>
            </div>

            <form onSubmit={handleRingBellSubmit} className="space-y-3 pt-2">
              <label className="block">
                <span className="text-xs font-semibold text-foreground">Your Street Address / Landmark *</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. 4th Cross, Near Water Tank, Indiranagar"
                  value={bellAddress}
                  onChange={(e) => setBellAddress(e.target.value)}
                  className="mt-1 w-full rounded-2xl border bg-muted px-4 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-foreground">Requested Items (Optional)</span>
                <textarea
                  rows={2}
                  placeholder="e.g. 2kg Tomatoes, 1kg Spinach, Fresh Coriander"
                  value={bellNote}
                  onChange={(e) => setBellNote(e.target.value)}
                  className="mt-1 w-full rounded-2xl border bg-muted px-4 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
                />
              </label>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setBellVendor(null)}
                  className="flex-1 py-3 rounded-2xl border font-bold text-xs hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRinging || !bellAddress.trim()}
                  className="flex-[2] py-3 rounded-2xl bg-amber-500 text-zinc-950 font-bold text-xs hover:bg-amber-400 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-md"
                >
                  {isRinging ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> Ring Bell Now</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
