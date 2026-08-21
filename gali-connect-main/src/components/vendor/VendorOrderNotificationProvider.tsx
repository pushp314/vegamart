import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, WS_BASE_URL, ACCESS_TOKEN_KEY } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import {
  VendorOrderAlertModal,
  type VendorIncomingOrder,
} from "./VendorOrderAlertModal";

interface VendorOrderNotificationContextType {
  activeOrder: VendorIncomingOrder | null;
  queueLength: number;
  isSoundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  isDesktopNotificationEnabled: boolean;
  requestDesktopNotificationPermission: () => Promise<boolean>;
  testAudioAlert: () => void;
  dismissActiveOrder: () => void;
  muteActiveAlarm: () => void;
}

const VendorOrderNotificationContext = createContext<
  VendorOrderNotificationContextType | undefined
>(undefined);

export function useVendorOrderNotifications() {
  const context = useContext(VendorOrderNotificationContext);
  if (!context) {
    throw new Error(
      "useVendorOrderNotifications must be used within a VendorOrderNotificationProvider"
    );
  }
  return context;
}

const SOUND_PREF_KEY = "vegamart_vendor_sound_enabled";
const SEEN_ORDERS_KEY = "vegamart_vendor_seen_orders";

// Synthesize a pleasant, attention-grabbing multi-tone bell chime using Web Audio API
function playChimeSynth(audioCtx: AudioContext): void {
  try {
    const now = audioCtx.currentTime;
    // Harmonic chords (E major arpeggio / bell ring): E5 (659Hz), G#5 (830Hz), B5 (987Hz), E6 (1318Hz)
    const notes = [
      { freq: 659.25, time: 0, dur: 0.8, gain: 0.35 },
      { freq: 830.61, time: 0.12, dur: 0.8, gain: 0.35 },
      { freq: 987.77, time: 0.24, dur: 0.9, gain: 0.4 },
      { freq: 1318.51, time: 0.36, dur: 1.4, gain: 0.5 },
    ];

    notes.forEach(({ freq, time, dur, gain: noteGain }) => {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + time);

      // Soft envelope (instant attack, warm decay)
      gainNode.gain.setValueAtTime(0, now + time);
      gainNode.gain.linearRampToValueAtTime(noteGain, now + time + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc.start(now + time);
      osc.stop(now + time + dur);
    });
  } catch (e) {
    console.warn("Could not play audio chime", e);
  }
}

export function VendorOrderNotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const { user, isAuthenticated, accessToken } = useAuth();

  const [orderQueue, setOrderQueue] = useState<VendorIncomingOrder[]>([]);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isSoundEnabled, setIsSoundEnabledState] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem(SOUND_PREF_KEY);
    return stored !== null ? stored === "true" : true;
  });
  const [desktopPermission, setDesktopPermission] = useState<NotificationPermission>(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "default"
  );

  const audioCtxRef = useRef<AudioContext | null>(null);
  const alarmIntervalRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const seenOrdersRef = useRef<Set<string>>(new Set());

  // Restore seen orders from sessionStorage so page refresh doesn't replay old orders
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SEEN_ORDERS_KEY);
      if (stored) {
        seenOrdersRef.current = new Set(JSON.parse(stored));
      }
    } catch {}
  }, []);

  const saveSeenOrder = useCallback((orderId: string) => {
    seenOrdersRef.current.add(orderId);
    try {
      sessionStorage.setItem(
        SEEN_ORDERS_KEY,
        JSON.stringify(Array.from(seenOrdersRef.current))
      );
    } catch {}
  }, []);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    setIsSoundEnabledState(enabled);
    if (typeof window !== "undefined") {
      localStorage.setItem(SOUND_PREF_KEY, String(enabled));
    }
  }, []);

  const getAudioContext = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtxRef.current = new AudioContextClass();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }, []);

  const startAlarmSound = useCallback(() => {
    if (!isSoundEnabled || isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    // Play initial chime
    playChimeSynth(ctx);

    // Repeat chime every 4 seconds until acknowledged
    if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
    alarmIntervalRef.current = setInterval(() => {
      if (audioCtxRef.current && !isMuted) {
        playChimeSynth(audioCtxRef.current);
      }
    }, 4200);
  }, [isSoundEnabled, isMuted, getAudioContext]);

  const stopAlarmSound = useCallback(() => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
  }, []);

  const testAudioAlert = useCallback(() => {
    const ctx = getAudioContext();
    if (ctx) {
      playChimeSynth(ctx);
      toast.success("Playing test order chime! 🔔", { duration: 2500 });
    }
  }, [getAudioContext]);

  const requestDesktopNotificationPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error("Desktop notifications are not supported by this browser.");
      return false;
    }
    try {
      const permission = await Notification.requestPermission();
      setDesktopPermission(permission);
      if (permission === "granted") {
        toast.success("Desktop notifications enabled! 🔔");
        new Notification("Vegamart Vendor Alert Active", {
          body: "You will now receive desktop alerts for incoming customer orders.",
          icon: "/icons/icon-192.png",
        });
        return true;
      } else if (permission === "denied") {
        toast.error("Notification permission was denied in browser settings.");
        return false;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const fireDesktopNotification = useCallback((order: VendorIncomingOrder) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
      try {
        const notif = new Notification(`🚨 New Order #${order.order_number} Received!`, {
          body: `${order.customer_name || "A customer"} placed an order of ₹${Number(order.total || 0).toLocaleString("en-IN")}. Click to view.`,
          icon: "/icons/icon-192.png",
          badge: "/favicon.ico",
          tag: `order-${order.order_id}`,
          requireInteraction: true,
        });

        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      } catch (e) {
        console.warn("Could not dispatch desktop notification", e);
      }
    }
  }, []);

  // Handler for when a new order arrives (via WS or Polling)
  const handleIncomingOrder = useCallback(
    (order: VendorIncomingOrder) => {
      if (seenOrdersRef.current.has(order.order_id)) {
        return;
      }
      saveSeenOrder(order.order_id);

      // Add to alert queue
      setOrderQueue((prev) => {
        if (prev.some((o) => o.order_id === order.order_id)) return prev;
        return [...prev, order];
      });

      // Sound Alarm
      startAlarmSound();

      // Desktop Push Notification
      fireDesktopNotification(order);

      // Toast feedback
      toast.success(`🚨 New Order #${order.order_number} Received!`, {
        description: `₹${Number(order.total || 0).toLocaleString("en-IN")} • ${order.customer_name || "Customer"}`,
        duration: 8000,
      });

      // Invalidate relevant react-queries to update order lists & badges
      queryClient.invalidateQueries({ queryKey: ["vendorOrders"] });
      queryClient.invalidateQueries({ queryKey: ["vendorDashboard"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
    [saveSeenOrder, startAlarmSound, fireDesktopNotification, queryClient]
  );

  // Fetch current vendor profile to get vendor ID for the WebSocket room
  const { data: vendorRes } = useQuery({
    queryKey: ["vendorProfile"],
    queryFn: () => api.get<{ data: any }>("/vendors/me"),
    enabled: isAuthenticated && user?.role === "vendor",
    staleTime: 60_000,
  });
  const vendor = vendorRes?.data?.data || vendorRes?.data;
  const vendorId = vendor?.id;

  // Real-time WebSocket connection to /vendors/:vendor_id/stream-alerts
  useEffect(() => {
    if (!isAuthenticated || !vendorId || user?.role !== "vendor") {
      return;
    }

    let isUnmounted = false;

    const connectWebSocket = () => {
      if (isUnmounted) return;
      const token =
        accessToken ||
        (typeof window !== "undefined"
          ? localStorage.getItem(ACCESS_TOKEN_KEY)
          : "");

      const wsUrl = `${WS_BASE_URL}/vendors/${vendorId}/stream-alerts?token=${encodeURIComponent(
        token || ""
      )}`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          // Connected to vendor room
        };

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.type === "new_order_received" && payload.data) {
              handleIncomingOrder(payload.data as VendorIncomingOrder);
            } else if (payload.type === "gali_bell_alert" && payload.data) {
              toast.info(`🔔 Gali Bell Alert!`, {
                description: `${payload.data.customer_name} rang your bell at ${payload.data.address}`,
                duration: 6000,
              });
              startAlarmSound();
            }
          } catch (err) {
            console.error("Error parsing vendor websocket message", err);
          }
        };

        ws.onclose = () => {
          if (!isUnmounted) {
            // Auto-reconnect with 5-second backoff
            reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
          }
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch (err) {
        if (!isUnmounted) {
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
        }
      }
    };

    connectWebSocket();

    return () => {
      isUnmounted = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [isAuthenticated, vendorId, user?.role, accessToken, handleIncomingOrder, startAlarmSound]);

  // Fallback Background Polling every 25s for resilient pending order detection
  const { data: fallbackOrdersRes } = useQuery({
    queryKey: ["vendorOrders", "fallback-check"],
    queryFn: () => api.get<any[]>("/orders/vendor"),
    enabled: isAuthenticated && !!vendorId && user?.role === "vendor",
    refetchInterval: 25_000,
    staleTime: 10_000,
  });

  useEffect(() => {
    const orders = fallbackOrdersRes?.data;
    if (Array.isArray(orders) && orders.length > 0) {
      // Find any PENDING order that has not been alerted
      const pendingOrders = orders.filter(
        (o) => (o.status || "").toUpperCase() === "PENDING"
      );

      // On initial boot, initialize seen orders so existing orders don't blast alarms
      if (seenOrdersRef.current.size === 0) {
        pendingOrders.forEach((o) => seenOrdersRef.current.add(o.id));
        return;
      }

      pendingOrders.forEach((o) => {
        if (!seenOrdersRef.current.has(o.id)) {
          handleIncomingOrder({
            order_id: o.id,
            order_number: o.order_number || o.id.slice(0, 8),
            total: Number(o.total || 0),
            items_count: o.items?.length || 0,
            customer_name: o.customer?.name || o.customer_name || "Customer",
            customer_phone: o.customer?.phone || o.customer_phone,
            delivery_slot: o.delivery_slot || "Standard Delivery",
            payment_method: o.payment_method || "COD",
            items: o.items?.map((it: any) => ({
              name: it.product_name || it.name || "Item",
              quantity: Number(it.quantity || 1),
              price: Number(it.unit_price || it.total_price || 0),
            })),
            created_at: o.created_at,
          });
        }
      });
    }
  }, [fallbackOrdersRes, handleIncomingOrder]);

  const activeOrder = orderQueue.length > 0 ? orderQueue[0] : null;

  const dismissActiveOrder = useCallback(() => {
    stopAlarmSound();
    setIsMuted(false);
    setOrderQueue((prev) => prev.slice(1));
  }, [stopAlarmSound]);

  const muteActiveAlarm = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (next) stopAlarmSound();
      else startAlarmSound();
      return next;
    });
  }, [stopAlarmSound, startAlarmSound]);

  const handleAcceptAndView = useCallback(
    (orderId: string) => {
      dismissActiveOrder();
    },
    [dismissActiveOrder]
  );

  return (
    <VendorOrderNotificationContext.Provider
      value={{
        activeOrder,
        queueLength: orderQueue.length,
        isSoundEnabled,
        setSoundEnabled,
        isDesktopNotificationEnabled: desktopPermission === "granted",
        requestDesktopNotificationPermission,
        testAudioAlert,
        dismissActiveOrder,
        muteActiveAlarm,
      }}
    >
      {children}

      {/* Global Order Alert Popup Modal */}
      {activeOrder && (
        <VendorOrderAlertModal
          order={activeOrder}
          queueLength={orderQueue.length}
          isOpen={true}
          isMuted={isMuted}
          onToggleMute={muteActiveAlarm}
          onDismiss={dismissActiveOrder}
          onAcceptAndView={handleAcceptAndView}
        />
      )}
    </VendorOrderNotificationContext.Provider>
  );
}
