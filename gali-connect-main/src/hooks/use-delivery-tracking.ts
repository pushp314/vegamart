import { useEffect, useState, useCallback } from "react";
import { WS_BASE_URL, api, authStorage } from "../lib/api";

export interface Location {
  lat: number;
  lng: number;
}

export interface DeliveryPartnerInfo {
  name: string;
  phone?: string;
  rating: number;
  vehicle_type: string;
  vehicle_number: string;
}

export interface TrackingInfo {
  order_id: string;
  status: string;
  driver_location?: Location;
  pickup_location?: Location;
  dropoff_location?: Location;
  eta?: string;
  driver_info?: DeliveryPartnerInfo;
}

export function useDeliveryTracking(orderId: string) {
  const [trackingInfo, setTrackingInfo] = useState<TrackingInfo | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial tracking info
  const fetchTrackingInfo = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await api.get<TrackingInfo>(`/delivery/order/${orderId}/tracking`);
      if (res.success && res.data) {
        setTrackingInfo(res.data);
      } else {
        setError(res.error?.message || "Failed to fetch tracking info");
      }
    } catch (err) {
      setError("Network error fetching tracking info");
    }
  }, [orderId]);

  useEffect(() => {
    fetchTrackingInfo();
  }, [fetchTrackingInfo]);

  useEffect(() => {
    if (!orderId) return;

    let ws: WebSocket;
    let reconnectTimer: NodeJS.Timeout;

    const connect = () => {
      const token = authStorage.getAccessToken();
      ws = new WebSocket(
        `${WS_BASE_URL}/delivery/order/${orderId}/stream${token ? `?token=${encodeURIComponent(token)}` : ""}`
      );

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          
          if (payload.type === "location_update") {
            setTrackingInfo(prev => prev ? {
              ...prev,
              driver_location: {
                lat: payload.data.lat,
                lng: payload.data.lng,
              }
            } : null);
          } else if (payload.type === "order_eta_update") {
            setTrackingInfo(prev => prev ? {
              ...prev,
              eta: payload.data.eta
            } : null);
          } else if (payload.type === "order_status_update") {
            setTrackingInfo(prev => prev ? {
              ...prev,
              status: payload.data.status
            } : null);
          }
        } catch (e) {
          console.error("Failed to parse WS message", e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Attempt to reconnect after 3 seconds
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (ws) {
        ws.close();
      }
    };
  }, [orderId]);

  return {
    trackingInfo,
    isConnected,
    error,
    refresh: fetchTrackingInfo
  };
}
