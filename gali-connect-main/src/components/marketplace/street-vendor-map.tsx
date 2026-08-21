import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, LocateFixed } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { api, WS_BASE_URL } from "@/lib/api";

export interface RoamingVendor {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  isMoving: boolean;
  logo_url?: string | null;
  banner_url?: string | null;
  rating?: number | string;
  phone?: string | null;
  address?: string | null;
  slug?: string | null;
}

type LeafletModule = typeof import("leaflet");
type LatLngExpression = [number, number] | { lat: number; lng: number } | [number, number, number];
type LatLngTuple = [number, number];

interface CategoryMeta {
  bg: string;
  ring: string;
  emoji: string;
  label: string;
}

export function getCategoryMeta(categoryName?: string): CategoryMeta {
  const cat = (categoryName || "").toLowerCase().trim();

  if (cat.includes("veg") || cat.includes("sabzi")) {
    return { bg: "#059669", ring: "#34d399", emoji: "🥦", label: "Vegetables" };
  }
  if (cat.includes("fruit")) {
    return { bg: "#e11d48", ring: "#fb7185", emoji: "🍎", label: "Fruits" };
  }
  if (cat.includes("dairy") || cat.includes("milk") || cat.includes("egg") || cat.includes("dahi") || cat.includes("paneer")) {
    return { bg: "#0284c7", ring: "#38bdf8", emoji: "🥛", label: "Dairy & Milk" };
  }
  if (
    cat.includes("mistri") ||
    cat.includes("repair") ||
    cat.includes("service") ||
    cat.includes("thekedar") ||
    cat.includes("plumb") ||
    cat.includes("electr") ||
    cat.includes("carpenter")
  ) {
    return { bg: "#ea580c", ring: "#fb923c", emoji: "🔧", label: "Mistri Services" };
  }
  if (cat.includes("mobile") || cat.includes("electron") || cat.includes("phone") || cat.includes("gadget")) {
    return { bg: "#6366f1", ring: "#818cf8", emoji: "📱", label: "Mobile & Electronics" };
  }
  if (cat.includes("fashion") || cat.includes("cloth") || cat.includes("wear") || cat.includes("dress") || cat.includes("garment")) {
    return { bg: "#db2777", ring: "#f472b6", emoji: "👗", label: "Fashion & Clothing" };
  }
  if (cat.includes("bakery") || cat.includes("bread") || cat.includes("cake") || cat.includes("pastry")) {
    return { bg: "#d97706", ring: "#fbbf24", emoji: "🍞", label: "Bakery & Snacks" };
  }
  if (cat.includes("snack") || cat.includes("chaat") || cat.includes("samosa") || cat.includes("food") || cat.includes("fast")) {
    return { bg: "#f97316", ring: "#fdba74", emoji: "🥟", label: "Street Food & Snacks" };
  }
  if (cat.includes("ice") || cat.includes("cream") || cat.includes("kulfi") || cat.includes("dessert")) {
    return { bg: "#7c3aed", ring: "#a78bfa", emoji: "🍦", label: "Ice Cream & Desserts" };
  }
  if (cat.includes("tea") || cat.includes("chai") || cat.includes("coffee") || cat.includes("beverage")) {
    return { bg: "#92400e", ring: "#b45309", emoji: "☕", label: "Chai & Beverages" };
  }
  if (cat.includes("meat") || cat.includes("chicken") || cat.includes("fish") || cat.includes("mutton")) {
    return { bg: "#be123c", ring: "#f43f5e", emoji: "🍗", label: "Meat & Fish" };
  }
  if (cat.includes("flower") || cat.includes("pooja")) {
    return { bg: "#ec4899", ring: "#f9a8d4", emoji: "🌸", label: "Flowers & Pooja" };
  }
  if (cat.includes("grocery") || cat.includes("kirana") || cat.includes("general") || cat.includes("store")) {
    return { bg: "#0d9488", ring: "#2dd4bf", emoji: "🛍️", label: "Grocery & General" };
  }

  return { bg: "#059669", ring: "#34d399", emoji: "🏪", label: categoryName || "Local Store" };
}

export function StreetVendorMap() {
  const navigate = useNavigate();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const vendorMarkersRef = useRef<Record<string, any>>({});
  const userMarkerRef = useRef<any>(null);
  const userCircleRef = useRef<any>(null);
  const hasFittedRef = useRef(false);
  const leafletRef = useRef<LeafletModule | null>(null);
  const userIconRef = useRef<any>(null);
  const fetchedVendorIdsRef = useRef<Set<string>>(new Set());

  const [vendors, setVendors] = useState<RoamingVendor[]>([]);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [ready, setReady] = useState(false);

  // Global redirection hook for popup action button
  useEffect(() => {
    (window as any).__vegamart_nav = (url: string) => {
      navigate({ to: url as any });
    };
    return () => {
      delete (window as any).__vegamart_nav;
    };
  }, [navigate]);

  // ── 1. Load Leaflet CSS and inject custom popup styles ─────────────
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

    const styleId = "vegamart-leaflet-custom-styles";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.innerHTML = `
        .leaflet-popup-content-wrapper {
          padding: 0 !important;
          border-radius: 20px !important;
          overflow: hidden !important;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.2) !important;
          border: 1px solid rgba(226, 232, 240, 0.8) !important;
        }
        .leaflet-popup-content {
          margin: 0 !important;
          width: auto !important;
          line-height: normal !important;
        }
        .leaflet-container a.leaflet-popup-close-button {
          top: 10px !important;
          right: 10px !important;
          color: #ffffff !important;
          background: rgba(0, 0, 0, 0.35) !important;
          border-radius: 50% !important;
          width: 22px !important;
          height: 22px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          font-size: 14px !important;
          line-height: 1 !important;
          backdrop-filter: blur(4px) !important;
          border: 1px solid rgba(255, 255, 255, 0.3) !important;
        }
        .leaflet-container a.leaflet-popup-close-button:hover {
          background: rgba(0, 0, 0, 0.6) !important;
          color: #ffffff !important;
        }
        .vegamart-pin-pulse {
          animation: vegamart-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes vegamart-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: .75; transform: scale(1.08); }
        }
      `;
      document.head.appendChild(style);
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

      const userIcon = L.divIcon({
        className: "",
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        html: `
          <div style="
            width:24px;height:24px;border-radius:50%;
            background:#3b82f6;border:3px solid #fff;
            box-shadow:0 0 0 5px rgba(59,130,246,.35), 0 3px 8px rgba(0,0,0,.35);
          "></div>
        `,
      });

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
    const rawList = Array.isArray(realVendorsData?.data)
      ? realVendorsData.data
      : Array.isArray((realVendorsData?.data as any)?.data)
        ? (realVendorsData?.data as any).data
        : [];

    const list: RoamingVendor[] = (rawList || [])
      .filter((v: any) => v.latitude && v.longitude)
      .map((v: any) => ({
        id: v.id,
        name: v.business_name || v.name || "Local Vendor",
        category: v.category || v.profile?.category || "General",
        lat: v.latitude,
        lng: v.longitude,
        isMoving: v.roaming === true || v.profile?.roaming === true,
        logo_url: v.logo_url || v.profile?.logo_url || null,
        banner_url: v.banner_url || v.profile?.banner_url || null,
        rating: v.rating || v.profile?.rating || 4.8,
        phone: v.phone || v.profile?.phone || "+919876543210",
        address: v.address || v.profile?.address || "Main Market Street",
        slug: v.slug || v.id,
      }));

    if (list.length > 0) setVendors(list);
  }, [realVendorsData]);

  // ── 6. WebSocket for real-time location updates ───────────────────
  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | null = null;
    let connectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;

    const MAX_RECONNECT_ATTEMPTS = 10;
    const BASE_RECONNECT_MS = 1000;
    const MAX_RECONNECT_MS = 30000;

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
                      name: v.business_name || v.name,
                      category: v.category || "General",
                      lat,
                      lng,
                      isMoving,
                      logo_url: v.logo_url || v.profile?.logo_url,
                      banner_url: v.banner_url || v.profile?.banner_url,
                      rating: v.rating || v.profile?.rating || 4.8,
                      phone: v.phone || v.profile?.phone || "+919876543210",
                      address: v.address || v.profile?.address || "Main Market Street",
                      slug: v.slug || v.id,
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

    const scheduleReconnect = () => {
      if (cancelled || reconnectTimer) return;
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
      const delay = Math.min(BASE_RECONNECT_MS * 2 ** reconnectAttempts, MAX_RECONNECT_MS);
      reconnectAttempts += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    };

    const connect = () => {
      if (cancelled) return;
      try {
        ws = new WebSocket(`${WS_BASE_URL}/vendors/stream-roaming`);
      } catch {
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        reconnectAttempts = 0;
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "roaming_vendor_location" && payload.data?.vendor_id) {
            const { vendor_id, lat, lng } = payload.data;
            applyLocation(vendor_id, lat, lng, true);
          }
          if (payload.type === "vendor_location" && payload.data?.vendor_id) {
            const { vendor_id, lat, lng } = payload.data;
            applyLocation(vendor_id, lat, lng, false);
          }
        } catch {}
      };

      ws.onerror = () => {
        try {
          ws?.close();
        } catch {}
      };

      ws.onclose = () => {
        ws = null;
        scheduleReconnect();
      };
    };

    connectTimer = setTimeout(() => {
      if (cancelled) return;
      connect();
    }, 100);

    return () => {
      cancelled = true;
      if (connectTimer) clearTimeout(connectTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        try {
          if (ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
            ws.close();
          }
        } catch {}
      }
      ws = null;
    };
  }, []);

  // ── 7. Build Map Pin & Map Card Popup HTML ─────────────────────────
  const buildVendorPinIcon = useCallback(
    (L: LeafletModule, vendor: RoamingVendor) => {
      const cat = getCategoryMeta(vendor.category);
      const hasLogo = Boolean(vendor.logo_url);

      return L.divIcon({
        className: "vegamart-map-pin-container",
        iconSize: [46, 46],
        iconAnchor: [23, 23],
        popupAnchor: [0, -28],
        html: `
          <div style="
            width:46px;height:46px;border-radius:50%;
            background:${hasLogo ? "#ffffff" : cat.bg};
            border:3px solid ${cat.ring};
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 4px 14px rgba(0,0,0,.28), 0 0 0 2.5px rgba(255,255,255,0.95);
            position:relative;
            cursor:pointer;
            transition:transform 0.2s ease, box-shadow 0.2s ease;
          " class="hover:scale-110">
            ${
              hasLogo
                ? `<img src="${vendor.logo_url}" alt="${vendor.name}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" /><div style="display:none;width:100%;height:100%;border-radius:50%;background:${cat.bg};align-items:center;justify-content:center;font-size:22px;">${cat.emoji}</div>`
                : `<span style="font-size:22px;line-height:1;">${cat.emoji}</span>`
            }
            <span style="
              position:absolute;top:-3px;right:-3px;width:13px;height:13px;
              border-radius:50%;background:#22c55e;border:2.5px solid #ffffff;
              box-shadow:0 0 8px rgba(34,197,94,0.85);
            "></span>
          </div>
        `,
      });
    },
    []
  );

  const buildPopupCardHtml = useCallback((vendor: RoamingVendor): string => {
    const cat = getCategoryMeta(vendor.category);
    const shopUrl = `/vendors/${vendor.id}`;
    const phone = vendor.phone || "+919876543210";

    return `
      <div style="width:240px;font-family:system-ui,-apple-system,sans-serif;overflow:hidden;background:#ffffff;border-radius:18px;">
        <!-- Card Top Banner -->
        <div style="background:linear-gradient(135deg, ${cat.bg}, ${cat.ring});padding:14px 14px 12px;color:#ffffff;position:relative;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
            <span style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.04em;background:rgba(0,0,0,0.25);padding:3px 8px;border-radius:999px;backdrop-filter:blur(4px);">
              ${cat.emoji} ${cat.label}
            </span>
            <span style="font-size:10px;font-weight:700;background:#22c55e;color:#ffffff;padding:2px 7px;border-radius:999px;box-shadow:0 1px 4px rgba(0,0,0,0.2);">
              ● ${vendor.isMoving ? "Live & Moving" : "Open Store"}
            </span>
          </div>
          <div style="font-size:15px;font-weight:800;margin-top:7px;line-height:1.25;color:#ffffff;text-shadow:0 1px 2px rgba(0,0,0,0.3);">
            ${vendor.name}
          </div>
        </div>

        <!-- Card Body Content -->
        <div style="padding:12px 14px 14px;background:#ffffff;color:#1e293b;">
          <div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;color:#64748b;margin-bottom:12px;">
            <span style="font-weight:700;color:#f59e0b;display:inline-flex;align-items:center;gap:3px;background:#fef3c7;padding:2px 6px;border-radius:6px;">
              ★ ${vendor.rating || "4.8"}
            </span>
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px;font-weight:500;">
              📍 ${vendor.address || "Main Market Street"}
            </span>
          </div>

          <!-- Action Buttons -->
          <div style="display:grid;grid-template-columns:1fr auto;gap:8px;">
            <button
              onclick="window.__vegamart_nav('${shopUrl}')"
              style="background:#10b981;color:#ffffff;border:none;border-radius:12px;padding:9px 12px;font-size:12px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;box-shadow:0 3px 8px rgba(16,185,129,0.35);transition:background 0.2s;"
              onmouseover="this.style.background='#059669'"
              onmouseout="this.style.background='#10b981'"
            >
              <span>Visit Shop</span>
              <span>→</span>
            </button>
            <a
              href="tel:${phone}"
              onclick="event.stopPropagation();"
              style="background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;border-radius:12px;padding:9px 11px;font-size:13px;font-weight:700;text-decoration:none;display:flex;align-items:center;justify-content:center;"
              title="Call Vendor"
            >
              📞
            </a>
          </div>
        </div>
      </div>
    `;
  }, []);

  // ── 8. Sync vendor markers on map ─────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = leafletRef.current;
    if (!map || !ready || !L) return;

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
        existing.setIcon(buildVendorPinIcon(L, vendor));
        existing.setPopupContent(buildPopupCardHtml(vendor));
      } else {
        const marker = L.marker(latlng, { icon: buildVendorPinIcon(L, vendor) })
          .addTo(map)
          .bindPopup(buildPopupCardHtml(vendor), {
            maxWidth: 260,
            className: "vegamart-custom-popup",
          });

        vendorMarkersRef.current[vendor.id] = marker;
      }
    }

    if (vendors.length > 0 && !hasFittedRef.current) {
      const bounds = L.latLngBounds(vendors.map((v) => [v.lat, v.lng] as LatLngTuple));
      if (userLoc) bounds.extend([userLoc.lat, userLoc.lng]);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      hasFittedRef.current = true;
    }
  }, [vendors, ready, buildVendorPinIcon, buildPopupCardHtml]);

  // ── 9. "Center on me" button ──────────────────────────────────────
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
          <span className="text-sm font-semibold">Loading live radar…</span>
        </div>
      )}

      <div className="absolute top-4 left-4 z-30 bg-slate-900/90 text-white border border-emerald-500/30 px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 backdrop-blur-md shadow-lg">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
        </span>
        Live Street Radar Active
      </div>

      <button
        onClick={centerOnUser}
        className="absolute bottom-4 left-4 z-30 bg-white shadow-lg rounded-full p-2.5 hover:bg-emerald-50 transition-colors border border-slate-200 cursor-pointer"
        title="Center on my location"
      >
        <LocateFixed className="h-5 w-5 text-emerald-600" />
      </button>

      {vendors.length > 0 && (
        <div className="absolute top-4 right-4 z-30 bg-emerald-600 text-white px-3.5 py-1.5 rounded-full text-xs font-bold shadow-lg">
          {vendors.length} vendor{vendors.length !== 1 ? "s" : ""} on map
        </div>
      )}

      <div ref={mapContainerRef} className="absolute inset-0 h-full w-full z-10" />
    </div>
  );
}
