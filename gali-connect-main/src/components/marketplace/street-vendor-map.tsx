import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, LocateFixed } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api, WS_BASE_URL } from "@/lib/api";

// Leaflet CSS is loaded dynamically below to avoid SSR issues.
import L from "leaflet";

interface RoamingVendor {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  isMoving: boolean;
}

/* ------------------------------------------------------------------ */
/*  Custom Leaflet marker icons                                        */
/* ------------------------------------------------------------------ */

// Build a vendor marker as an L.divIcon so we can style it with CSS.
function vendorIcon(category: string) {
  const colors: Record<string, { bg: string; ring: string; emoji: string }> = {
    vegetables: { bg: "#059669", ring: "#34d399", emoji: "🥦" },
    fruits:     { bg: "#e11d48", ring: "#fb7185", emoji: "🍎" },
    ice_cream:  { bg: "#7c3aed", ring: "#a78bfa", emoji: "🍦" },
    snacks:     { bg: "#d97706", ring: "#fbbf24", emoji: "🍿" },
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

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function StreetVendorMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const vendorMarkersRef = useRef<Record<string, L.Marker>>({});
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userCircleRef = useRef<L.Circle | null>(null);
  const hasFittedRef = useRef(false);

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
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        // Fallback: Bengaluru center
        setUserLoc({ lat: 12.9715, lng: 77.6405 });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // ── 3. Initialize Leaflet map once we have a location ─────────────
  useEffect(() => {
    if (!mapContainerRef.current || !userLoc || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [userLoc.lat, userLoc.lng],
      zoom: 16,
      zoomControl: false,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(map);

    // Add user marker + accuracy circle
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoc !== null]);

  // ── 4. Update user marker when geolocation changes ────────────────
  useEffect(() => {
    if (!userLoc || !mapInstanceRef.current) return;
    const latlng: L.LatLngExpression = [userLoc.lat, userLoc.lng];
    userMarkerRef.current?.setLatLng(latlng);
    userCircleRef.current?.setLatLng(latlng);
  }, [userLoc]);

  // ── 5. Fetch live vendor data from API ────────────────────────────
  const { data: realVendorsData } = useQuery({
    queryKey: ["live-vendors"],
    queryFn: () => api.get<any[]>("/vendors?is_open=true"),
    refetchInterval: 10000,
  });

  useEffect(() => {
    const list = (realVendorsData?.data || [])
      .filter((v: any) => v.latitude && v.longitude && v.roaming === true)
      .map((v: any) => ({
        id: v.id,
        name: v.business_name,
        category: v.category?.toLowerCase() || "vegetables",
        lat: v.latitude,
        lng: v.longitude,
        isMoving: true,
      }));
    if (list.length > 0) setVendors(list);
  }, [realVendorsData]);

  // ── 6. WebSocket for real-time location updates ───────────────────
  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE_URL}/vendors/stream-roaming`);
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "roaming_vendor_location" && payload.data?.vendor_id) {
          const { vendor_id, lat, lng } = payload.data;
          setVendors((prev) =>
            prev.map((v) => (v.id === vendor_id ? { ...v, lat, lng, isMoving: true } : v)),
          );
        }
      } catch {
        /* ignore parse errors */
      }
    };
    return () => ws.close();
  }, []);

  // ── 7. Sync vendor markers on map ─────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !ready) return;

    // Remove stale markers
    for (const id of Object.keys(vendorMarkersRef.current)) {
      if (!vendors.find((v) => v.id === id)) {
        vendorMarkersRef.current[id].remove();
        delete vendorMarkersRef.current[id];
      }
    }

    // Upsert markers
    for (const vendor of vendors) {
      const latlng: L.LatLngExpression = [vendor.lat, vendor.lng];
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
              <span style="font-size:11px;color:#16a34a;font-weight:600;">● Live &amp; Moving</span>
            </div>`,
          );
        vendorMarkersRef.current[vendor.id] = marker;
      }
    }

    // Auto-fit to show all vendors + user on first load
    if (vendors.length > 0 && !hasFittedRef.current) {
      const bounds = L.latLngBounds(vendors.map((v) => [v.lat, v.lng] as L.LatLngTuple));
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
      {/* Loading state */}
      {!ready && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/90 text-white gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          <span className="text-sm font-semibold">Loading live map…</span>
        </div>
      )}

      {/* Live badge */}
      <div className="absolute top-4 left-4 z-30 bg-slate-900/90 text-white border border-emerald-500/30 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 backdrop-blur-md shadow-lg">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
        </span>
        Live Street Radar Active
      </div>

      {/* Center on me */}
      <button
        onClick={centerOnUser}
        className="absolute bottom-4 left-4 z-30 bg-white shadow-lg rounded-full p-2.5 hover:bg-emerald-50 transition-colors border border-slate-200"
        title="Center on my location"
      >
        <LocateFixed className="h-5 w-5 text-emerald-600" />
      </button>

      {/* Vendor count badge */}
      {vendors.length > 0 && (
        <div className="absolute top-4 right-4 z-30 bg-emerald-600 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
          {vendors.length} vendor{vendors.length !== 1 ? "s" : ""} nearby
        </div>
      )}

      {/* Map container */}
      <div ref={mapContainerRef} className="absolute inset-0 h-full w-full z-10" />
    </div>
  );
}
