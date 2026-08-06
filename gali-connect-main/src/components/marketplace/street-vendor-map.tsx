import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, LocateFixed } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api, WS_BASE_URL } from "@/lib/api";

interface RoamingVendor {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  isMoving: boolean;
}

type LeafletModule = typeof import("leaflet");
type LatLngExpression = [number, number] | { lat: number; lng: number } | [number, number, number];
type LatLngTuple = [number, number];

export function StreetVendorMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const vendorMarkersRef = useRef<Record<string, any>>({});
  const userMarkerRef = useRef<any>(null);
  const userCircleRef = useRef<any>(null);
  const hasFittedRef = useRef(false);
  const leafletRef = useRef<LeafletModule | null>(null);
  const vendorIconRef = useRef<(category: string) => any>(null);
  const userIconRef = useRef<any>(null);
  const fetchedVendorIdsRef = useRef<Set<string>>(new Set());

  const [vendors, setVendors] = useState<RoamingVendor[]>([]);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [ready, setReady] = useState(false);

  // ── 1. Load Leaflet CSS once ──────────────────────────────────────
  useEffect(() => {
    if (typeof document === "undefined") return;
    const id = "leaflet-css";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
  }, []);

  // ── 2. Get user geolocation ───────────────────────────────────────
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setUserLoc({ lat: 12.9715, lng: 77.6405 });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    );
  }, []);

  // ── 3. Initialize Leaflet map once we have a location ─────────────
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || !userLoc || mapInstanceRef.current) return;

    import("leaflet").then((leafletModule) => {
      const L = leafletModule.default || leafletModule;
      leafletRef.current = L;

      function createVendorIcon(category: string) {
        const colors: Record<string, { bg: string; ring: string; emoji: string }> = {
          vegetables: { bg: "#059669", ring: "#34d399", emoji: "🥦" },
          fruits: { bg: "#e11d48", ring: "#fb7185", emoji: "🍎" },
          ice_cream: { bg: "#7c3aed", ring: "#a78bfa", emoji: "🍦" },
          snacks: { bg: "#d97706", ring: "#fbbf24", emoji: "🍿" },
        };
        const c = colors[category.toLowerCase()] ?? { bg: "#d97706", ring: "#fbbf24", emoji: "🛒" };

        return L.divIcon({
          className: "",
          iconSize: [40, 40],
          iconAnchor: [20, 20],
          popupAnchor: [0, -24],
          html: `
            <div style="
              width:40px;height:40px;border-radius:50%;
              background:${c.bg};border:3px solid ${c.ring};
              display:flex;align-items:center;justify-content:center;
              font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,.35);
              position:relative;
            ">
              ${c.emoji}
              <span style="
                position:absolute;top:-2px;right:-2px;width:10px;height:10px;
                border-radius:50%;background:#22c55e;border:2px solid #fff;
              "></span>
            </div>
          `,
        });
      }

      const userIcon = L.divIcon({
        className: "",
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        html: `
          <div style="
            width:22px;height:22px;border-radius:50%;
            background:#3b82f6;border:3px solid #fff;
            box-shadow:0 0 0 4px rgba(59,130,246,.3), 0 2px 6px rgba(0,0,0,.3);
          "></div>
        `,
      });

      vendorIconRef.current = createVendorIcon;
      userIconRef.current = userIcon;

      const map = L.map(container, {
        center: [userLoc.lat, userLoc.lng],
        zoom: 16,
        zoomControl: false,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      }).addTo(map);

      userMarkerRef.current = L.marker([userLoc.lat, userLoc.lng], { icon: userIcon })
        .addTo(map)
        .bindPopup("You are here");

      userCircleRef.current = L.circle([userLoc.lat, userLoc.lng], {
        radius: 120,
        color: "#3b82f6",
        fillColor: "#3b82f6",
        fillOpacity: 0.08,
        weight: 1,
      }).addTo(map);

      mapInstanceRef.current = map;
      setReady(true);

      return () => {
        map.remove();
        mapInstanceRef.current = null;
        vendorMarkersRef.current = {};
        userMarkerRef.current = null;
        userCircleRef.current = null;
        setReady(false);
      };
    });
  }, [userLoc !== null]);

  // ── 4. Update user marker when geolocation changes ────────────────
  useEffect(() => {
    if (!userLoc || !mapInstanceRef.current) return;
    const latlng: LatLngExpression = [userLoc.lat, userLoc.lng];
    userMarkerRef.current?.setLatLng(latlng);
    userCircleRef.current?.setLatLng(latlng);
  }, [userLoc]);

  // ── 5. Fetch live vendor data from API ────────────────────────────
  const { data: realVendorsData, isError: vendorsError } = useQuery({
    queryKey: ["live-vendors"],
    queryFn: () => api.get<any[]>("/vendors?is_open=true"),
    refetchInterval: 10000,
    retry: false,
  });

  useEffect(() => {
    if (vendorsError) {
      console.warn("Vendor API unavailable - backend may not be running");
    }
  }, [vendorsError]);

  useEffect(() => {
    const list = (realVendorsData?.data || [])
      .filter((v: any) => v.latitude && v.longitude)
      .map((v: any) => ({
        id: v.id,
        name: v.business_name,
        category: v.category?.toLowerCase() || "vegetables",
        lat: v.latitude,
        lng: v.longitude,
        isMoving: v.roaming === true,
      }));
    if (list.length > 0) setVendors(list);
  }, [realVendorsData]);

  // ── 6. WebSocket for real-time location updates ───────────────────
  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | null = null;

    // Delay WS creation slightly to avoid Strict Mode double-invoke race
    const timer = setTimeout(() => {
      if (cancelled) return;
      ws = new WebSocket(`${WS_BASE_URL}/vendors/stream-roaming`);

      const applyLocation = (vendorId: string, lat: number, lng: number, isMoving: boolean) => {
        setVendors((prev) => {
          if (prev.some((v) => v.id === vendorId)) {
            return prev.map((v) => (v.id === vendorId ? { ...v, lat, lng, isMoving } : v));
          }
          if (fetchedVendorIdsRef.current.has(vendorId)) return prev;
          fetchedVendorIdsRef.current.add(vendorId);
          api
            .get<any>(`/vendors/${vendorId}`)
            .then((res) => {
              const v = res?.data?.data ?? res?.data;
              if (!v || !v.latitude || !v.longitude || v.is_open === false) {
                fetchedVendorIdsRef.current.delete(vendorId);
                return;
              }
              setVendors((curr) =>
                curr.some((x) => x.id === v.id)
                  ? curr.map((x) => (x.id === v.id ? { ...x, lat, lng, isMoving } : x))
                  : [
                      ...curr,
                      {
                        id: v.id,
                        name: v.business_name,
                        category: v.category?.toLowerCase() || "vegetables",
                        lat,
                        lng,
                        isMoving,
                      },
                    ],
              );
            })
            .catch(() => {
              fetchedVendorIdsRef.current.delete(vendorId);
            });
          return prev;
        });
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "roaming_vendor_location" && payload.data?.vendor_id) {
            const { vendor_id, lat, lng } = payload.data;
            applyLocation(vendor_id, lat, lng, true);
          }
          // Also handle general vendor location updates
          if (payload.type === "vendor_location" && payload.data?.vendor_id) {
            const { vendor_id, lat, lng } = payload.data;
            applyLocation(vendor_id, lat, lng, false);
          }
        } catch {
          /* ignore parse errors */
        }
      };

      ws.onerror = () => {
        /* suppress console noise */
      };
    }, 100);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (ws && ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
        ws.close();
      }
    };
  }, []);

  // ── 7. Sync vendor markers on map ─────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = leafletRef.current;
    const vendorIcon = vendorIconRef.current;
    if (!map || !ready || !L || !vendorIcon) return;

    for (const id of Object.keys(vendorMarkersRef.current)) {
      if (!vendors.find((v) => v.id === id)) {
        vendorMarkersRef.current[id].remove();
        delete vendorMarkersRef.current[id];
      }
    }

    for (const vendor of vendors) {
      const latlng: LatLngExpression = [vendor.lat, vendor.lng];
      const existing = vendorMarkersRef.current[vendor.id];
      if (existing) {
        existing.setLatLng(latlng);
      } else {
        const marker = L.marker(latlng, { icon: vendorIcon(vendor.category) })
          .addTo(map)
          .bindPopup(
            `<div style="font-family:system-ui;text-align:center;">
              <strong style="font-size:13px;">${vendor.name}</strong><br/>
              <span style="font-size:11px;color:#666;">📍 ${vendor.category}</span><br/>
              <span style="font-size:11px;color:${vendor.isMoving ? "#16a34a" : "#2563eb"};font-weight:600;">
                ${vendor.isMoving ? "● Live & Moving" : "● Stationary"}
              </span>
            </div>`,
          );
        vendorMarkersRef.current[vendor.id] = marker;
      }
    }

    if (vendors.length > 0 && !hasFittedRef.current) {
      const bounds = L.latLngBounds(vendors.map((v) => [v.lat, v.lng] as LatLngTuple));
      if (userLoc) bounds.extend([userLoc.lat, userLoc.lng]);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      hasFittedRef.current = true;
    }
  }, [vendors, ready]);

  // ── 8. "Center on me" button ──────────────────────────────────────
  const centerOnUser = useCallback(() => {
    if (!mapInstanceRef.current || !userLoc) return;
    mapInstanceRef.current.flyTo([userLoc.lat, userLoc.lng], 16, { duration: 0.8 });
  }, [userLoc]);

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="relative h-full w-full bg-[#e5e3df] overflow-hidden">
      {!ready && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/90 text-white gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          <span className="text-sm font-semibold">Loading live map…</span>
        </div>
      )}

      <div className="absolute top-4 left-4 z-30 bg-slate-900/90 text-white border border-emerald-500/30 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 backdrop-blur-md shadow-lg">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
        </span>
        Live Street Radar Active
      </div>

      <button
        onClick={centerOnUser}
        className="absolute bottom-4 left-4 z-30 bg-white shadow-lg rounded-full p-2.5 hover:bg-emerald-50 transition-colors border border-slate-200"
        title="Center on my location"
      >
        <LocateFixed className="h-5 w-5 text-emerald-600" />
      </button>

      {vendors.length > 0 && (
        <div className="absolute top-4 right-4 z-30 bg-emerald-600 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
          {vendors.length} vendor{vendors.length !== 1 ? "s" : ""} on map
        </div>
      )}

      <div ref={mapContainerRef} className="absolute inset-0 h-full w-full z-10" />
    </div>
  );
}
