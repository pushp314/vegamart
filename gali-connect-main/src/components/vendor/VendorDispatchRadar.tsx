import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Bike,
  Store,
  Phone,
  Clock,
  Navigation,
  ChevronDown,
  ChevronUp,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Volume2,
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { playArrivalChime } from "@/lib/chime";
import { toast } from "sonner";

interface VendorDispatchRadarProps {
  orders: any[];
  vendorProfile: any;
}

function RadarMapBounds({
  shopPos,
  riderPositions,
}: {
  shopPos: [number, number];
  riderPositions: [number, number][];
}) {
  const map = useMap();

  useEffect(() => {
    const valid = [shopPos, ...riderPositions].filter(
      ([lat, lng]) =>
        typeof lat === "number" &&
        typeof lng === "number" &&
        !isNaN(lat) &&
        !isNaN(lng) &&
        lat > 5 &&
        lng > 60
    );

    if (valid.length === 0) return;
    if (valid.length === 1 && valid[0]) {
      map.setView(valid[0], 15, { animate: true });
    } else {
      const bounds = L.latLngBounds(valid);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16, animate: true });
    }
  }, [map, shopPos, riderPositions]);

  return null;
}

export function VendorDispatchRadar({ orders, vendorProfile }: VendorDispatchRadarProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const chimedOrdersRef = useRef<Set<string>>(new Set());

  const shopLat = Number(vendorProfile?.latitude || vendorProfile?.lat || 21.9588);
  const shopLng = Number(vendorProfile?.longitude || vendorProfile?.lng || 82.9588);
  const shopPos: [number, number] = [shopLat, shopLng];

  // Filter active orders that have an assigned rider
  const activeDispatches = useMemo(() => {
    return orders.filter((o: any) => {
      const status = (o.status || "").toUpperCase();
      const isActiveStatus = [
        "CONFIRMED",
        "PREPARING",
        "PACKED",
        "READY_FOR_PICKUP",
        "OUT_FOR_DELIVERY",
      ].includes(status);
      const hasRider = Boolean(
        o.delivery_partner ||
        o.delivery_partner_id ||
        o.in_house_rider ||
        o.delivery_tracking?.history?.in_house_rider
      );
      return isActiveStatus && hasRider;
    }).map((o: any) => {
      const isOutForDelivery = (o.status || "").toUpperCase() === "OUT_FOR_DELIVERY";
      const partner = o.delivery_partner;
      const inHouse = o.delivery_tracking?.history?.in_house_rider || o.in_house_rider;

      const riderName = partner?.user?.name || partner?.name || inHouse?.name || "Delivery Boy";
      const riderPhone = partner?.user?.phone || partner?.phone || inHouse?.phone || null;
      const riderLat = Number(
        partner?.current_lat || partner?.latitude || (o.delivery_tracking as any)?.driver_lat || shopLat - 0.003
      );
      const riderLng = Number(
        partner?.current_lng || partner?.longitude || (o.delivery_tracking as any)?.driver_lng || shopLng - 0.003
      );

      // Simple distance calculation to shop in meters
      const R = 6371e3;
      const phi1 = (shopLat * Math.PI) / 180;
      const phi2 = (riderLat * Math.PI) / 180;
      const dPhi = ((riderLat - shopLat) * Math.PI) / 180;
      const dLam = ((riderLng - shopLng) * Math.PI) / 180;
      const a =
        Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLam / 2) * Math.sin(dLam / 2);
      const distMeters = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));

      return {
        orderId: o.id,
        orderNumber: o.order_number || o.id?.slice(-6) || "Order",
        status: o.status,
        isOutForDelivery,
        customerName: o.user?.name || o.customer?.name || "Customer",
        riderName,
        riderPhone,
        riderPos: [riderLat, riderLng] as [number, number],
        distMeters,
        etaMinutes: o.eta_minutes || partner?.eta_minutes || Math.max(1, Math.ceil(distMeters / 300)),
        isApproachingStore: !isOutForDelivery && distMeters <= 350,
      };
    });
  }, [orders, shopLat, shopLng]);

  // Pre-Arrival Proximity Ping (Trigger chime when rider is within 300 meters on pickup leg)
  useEffect(() => {
    activeDispatches.forEach((dispatch) => {
      if (dispatch.isApproachingStore && !chimedOrdersRef.current.has(dispatch.orderId)) {
        chimedOrdersRef.current.add(dispatch.orderId);
        playArrivalChime();
        toast.info(
          `🛵 Rider ${dispatch.riderName} 1 minute me pahunch raha hai — Order #${dispatch.orderNumber} ready rakhein!`,
          { duration: 8000 }
        );
      }
    });
  }, [activeDispatches]);

  // If no active dispatches exist, don't show the radar
  if (activeDispatches.length === 0) {
    return null;
  }

  const approachingOrders = activeDispatches.filter((d) => !d.isOutForDelivery);
  const outForDeliveryOrders = activeDispatches.filter((d) => d.isOutForDelivery);

  const shopIcon = L.divIcon({
    className: "vendor-shop-pin",
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
        <div style="width: 44px; height: 44px; background: #064e3b; border-radius: 9999px; border: 3.5px solid #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(6, 78, 59, 0.5); font-size: 22px;">
          🏪
        </div>
        <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 8px solid #064e3b; margin-top: -1px;"></div>
      </div>
    `,
    iconSize: [44, 54],
    iconAnchor: [22, 54],
  });

  const riderIcon = L.divIcon({
    className: "dispatch-rider-pin",
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px;">
        <span style="position: absolute; width: 44px; height: 44px; border-radius: 9999px; background-color: rgba(16, 185, 129, 0.3); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
        <div style="position: relative; z-index: 10; width: 36px; height: 36px; background: linear-gradient(135deg, #10b981, #047857); border-radius: 9999px; display: flex; align-items: center; justify-content: center; border: 2.5px solid #ffffff; box-shadow: 0 4px 10px rgba(4, 120, 87, 0.4); font-size: 18px;">
          🛵
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });

  return (
    <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 overflow-hidden shadow-sm animate-in fade-in">
      {/* Top Header Bar */}
      <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-emerald-500/20 bg-emerald-500/10">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <div className="flex items-center gap-2">
            <h3 className="font-display font-black text-sm text-foreground flex items-center gap-1.5">
              <Radio className="h-4 w-4 text-emerald-600 animate-pulse" />
              <span>Merchant Live Dispatch Radar</span>
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white">
              {activeDispatches.length} Active {activeDispatches.length === 1 ? "Rider" : "Riders"}
            </span>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 px-2.5 py-1 rounded-xl bg-background/60 hover:bg-background border border-border transition-colors"
        >
          <span>{isExpanded ? "Collapse Radar" : "View Live Radar"}</span>
          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Pre-Arrival High Priority Banner */}
      {approachingOrders.some((d) => d.isApproachingStore) && (
        <div className="p-3 bg-amber-500 text-white flex items-center justify-between gap-3 text-xs font-bold animate-pulse">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 shrink-0" />
            <span>
              {approachingOrders
                .filter((d) => d.isApproachingStore)
                .map((d) => `🛵 Rider ${d.riderName} (${d.distMeters}m away) is reaching in ~1 min for Order #${d.orderNumber}`)
                .join(" • ")}
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-black/20 text-[10px] uppercase font-black shrink-0">
            Keep Order Ready!
          </span>
        </div>
      )}

      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Quick Active Dispatches Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeDispatches.map((d) => (
              <div
                key={d.orderId}
                className={`rounded-2xl p-3 border text-xs space-y-2 transition-all ${
                  d.isApproachingStore
                    ? "bg-amber-500/10 border-amber-500/40 shadow-xs"
                    : d.isOutForDelivery
                    ? "bg-card border-border"
                    : "bg-emerald-500/10 border-emerald-500/30"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-extrabold text-foreground">Order #{d.orderNumber}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                      d.isApproachingStore
                        ? "bg-amber-500 text-white animate-pulse"
                        : d.isOutForDelivery
                        ? "bg-blue-600 text-white"
                        : "bg-emerald-600 text-white"
                    }`}
                  >
                    {d.isApproachingStore
                      ? "Reaching Store (<1 min)"
                      : d.isOutForDelivery
                      ? "En Route to Customer"
                      : "Coming for Pickup"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <div>
                    <p className="font-bold text-foreground flex items-center gap-1">
                      <Bike className="h-3.5 w-3.5 text-emerald-600" />
                      {d.riderName}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {d.distMeters}m away • ~{d.etaMinutes} min ETA
                    </p>
                  </div>

                  {d.riderPhone && (
                    <a
                      href={`tel:${d.riderPhone}`}
                      className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs transition-colors shrink-0"
                    >
                      <Phone className="h-3 w-3" /> Call
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Mini Live Radar Canvas */}
          <div className="relative h-64 sm:h-72 w-full rounded-2xl overflow-hidden border border-border shadow-xs">
            <MapContainer
              center={shopPos}
              zoom={15}
              scrollWheelZoom={false}
              className="h-full w-full z-0"
            >
              <TileLayer
                url="https://tile.openstreetmap.de/{z}/{x}/{y}.png"
                maxZoom={19}
              />

              <RadarMapBounds
                shopPos={shopPos}
                riderPositions={activeDispatches.map((d) => d.riderPos)}
              />

              {/* Merchant Store Center Pin */}
              <Marker position={shopPos} icon={shopIcon}>
                <Popup>
                  <div className="p-1 text-xs">
                    <strong className="block font-bold text-emerald-800">
                      🏪 Your Store: {vendorProfile?.business_name || "Merchant Shop"}
                    </strong>
                    <span className="text-muted-foreground text-[10px]">
                      Pickup Point for Riders
                    </span>
                  </div>
                </Popup>
              </Marker>

              {/* Active Riders Pins */}
              {activeDispatches.map((d) => (
                <Marker key={d.orderId} position={d.riderPos} icon={riderIcon}>
                  <Popup>
                    <div className="p-1 text-xs space-y-1">
                      <strong className="block font-bold text-foreground">
                        🛵 {d.riderName} (Order #{d.orderNumber})
                      </strong>
                      <p className="text-muted-foreground text-[10px]">
                        Status: {d.isOutForDelivery ? "Delivering to customer" : "Coming to store"}
                      </p>
                      <p className="font-semibold text-emerald-600 text-[10px]">
                        Distance: {d.distMeters}m • ~{d.etaMinutes} min
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>
      )}
    </div>
  );
}
