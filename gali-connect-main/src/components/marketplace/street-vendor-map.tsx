import { useState, useEffect, useRef } from "react";
import {
  Map as MapIcon,
  Loader2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

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
  const userMarkerRef = useRef<any>(null);

  useEffect(() => {
    const baseURL = import.meta.env.VITE_API_URL || "http://localhost:8080";
    const wsURL = baseURL.replace("http://", "ws://").replace("https://", "wss://");
    const ws = new WebSocket(`${wsURL}/api/v1/vendors/stream-roaming`);

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "roaming_vendor_location" && payload.data?.vendor_id) {
          const { vendor_id, lat, lng } = payload.data;
          setVendors((prev) =>
            prev.map((v) => {
              if (v.id === vendor_id) {
                if (markersRef.current[v.id]) {
                  markersRef.current[v.id].setPosition({ lat, lng });
                }
                return { ...v, lat, lng, isMoving: true };
              }
              return v;
            }),
          );
        }
      } catch (err) {
        console.error("WS roaming parse error:", err);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

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
        () => {
          setUserLocation({ lat: 12.9715, lng: 77.6405 });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    }
  }, [googleMap]);

  const { data: realVendorsData } = useQuery({
    queryKey: ["live-vendors"],
    queryFn: () => api.get<any[]>("/vendors?is_open=true"),
    refetchInterval: 5000,
  });

  useEffect(() => {
    const liveVendors = (realVendorsData?.data || [])
      .filter((v: any) => v.latitude && v.longitude && v.vendor_type === "roaming")
      .map((v: any) => ({
        id: v.id,
        name: v.business_name,
        category: v.category?.toLowerCase() || "vegetables",
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

  useEffect(() => {
    if (!googleMap || !(window as any).google) return;
    const google = (window as any).google;

    Object.keys(markersRef.current).forEach((id) => {
      if (!vendors.find((v) => v.id === id)) {
        markersRef.current[id].setMap(null);
        delete markersRef.current[id];
      }
    });

    vendors.forEach((vendor) => {
      if (markersRef.current[vendor.id]) {
        markersRef.current[vendor.id].setPosition({ lat: vendor.lat, lng: vendor.lng });
      } else {
        const marker = new google.maps.Marker({
          position: { lat: vendor.lat, lng: vendor.lng },
          map: googleMap,
          title: vendor.name,
          icon: {
            url: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
          },
        });

        marker.addListener("click", () => {
          googleMap.panTo({ lat: vendor.lat, lng: vendor.lng });
        });

        markersRef.current[vendor.id] = marker;
      }
    });
  }, [vendors, googleMap]);

  return (
    <div className="relative h-full w-full bg-[#e5e3df] overflow-hidden">
      {!apiKey && (
        <div className="absolute inset-0 z-10 bg-slate-900 overflow-hidden">
          <iframe
            title="OpenStreetMap Live Radar"
            width="100%"
            height="100%"
            className="w-full h-full border-0 opacity-80 filter contrast-125 saturate-150"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${userLocation.lng - 0.015}%2C${userLocation.lat - 0.015}%2C${userLocation.lng + 0.015}%2C${userLocation.lat + 0.015}&layer=mapnik&marker=${userLocation.lat}%2C${userLocation.lng}`}
          />
          <div className="absolute inset-0 pointer-events-none bg-radial from-transparent via-emerald-950/20 to-slate-950/80">
            <div className="absolute top-4 left-4 z-20 bg-slate-900/90 text-white border border-emerald-500/30 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 backdrop-blur-md shadow-lg">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              Live Street Radar Active
            </div>

            {vendors.map((vendor, idx) => {
              const offsetX = (idx % 2 === 0 ? 1 : -1) * (30 + idx * 20);
              const offsetY = (idx % 3 === 0 ? -1 : 1) * (40 + idx * 15);

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
                  style={{
                    left: `calc(50% + ${offsetX}px)`,
                    top: `calc(50% + ${offsetY}px)`,
                  }}
                  className="absolute z-30 pointer-events-auto transform -translate-x-1/2 -translate-y-1/2 group transition-all duration-300 hover:scale-110"
                >
                  <div
                    className={`relative flex items-center gap-2 px-3.5 py-2 rounded-2xl shadow-2xl backdrop-blur-md border ${catStyle.bg} text-white ${catStyle.border} font-bold`}
                  >
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      {vendor.isMoving && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                      )}
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                    </span>
                    <div className="text-left leading-none">
                      <div className="text-[10px] font-black uppercase tracking-wider text-white/90 mb-0.5">
                        {catStyle.tag}
                      </div>
                      <div className="text-xs font-extrabold whitespace-nowrap">
                        {vendor.name}
                      </div>
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
  );
}
