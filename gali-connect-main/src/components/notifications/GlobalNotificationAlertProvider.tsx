import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { api } from "@/lib/api";
import {
  playNotificationChime,
  isSoundEnabled as getSoundPref,
  setSoundEnabled as setSoundPref,
  initAudioUnlocker,
  ChimeType,
} from "@/lib/audio-chime";
import {
  GlobalNotificationPopupModal,
  PopupNotificationData,
} from "./GlobalNotificationPopupModal";

interface GlobalNotificationAlertContextType {
  queueLength: number;
  isSoundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  triggerTestAlert: (chimeType?: ChimeType) => void;
  showNotificationPopup: (notif: PopupNotificationData) => void;
  dismissActiveNotification: () => void;
  dismissAllNotifications: () => void;
}

const GlobalNotificationAlertContext = createContext<
  GlobalNotificationAlertContextType | undefined
>(undefined);

export function useGlobalNotificationAlert() {
  const context = useContext(GlobalNotificationAlertContext);
  if (!context) {
    throw new Error(
      "useGlobalNotificationAlert must be used within a GlobalNotificationAlertProvider"
    );
  }
  return context;
}

export function GlobalNotificationAlertProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();

  const [notificationQueue, setNotificationQueue] = useState<PopupNotificationData[]>([]);
  const [isSoundActive, setIsSoundActive] = useState<boolean>(() => getSoundPref());
  const initialAlertPlayedRef = useRef<boolean>(false);
  const alertedIdsRef = useRef<Set<string>>(new Set());

  // Initialize Web Audio API unlock listener on first user interaction
  useEffect(() => {
    const cleanup = initAudioUnlocker();
    return cleanup;
  }, []);

  const toggleSound = useCallback(() => {
    setIsSoundActive((prev) => {
      const next = !prev;
      setSoundPref(next);
      return next;
    });
  }, []);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    setIsSoundActive(enabled);
    setSoundPref(enabled);
  }, []);

  // Play role-appropriate chime
  const playRoleChime = useCallback(() => {
    if (!isSoundActive) return;
    const role = user?.role;
    let chimeType: ChimeType = "default";
    if (role === "vendor") chimeType = "order";
    else if (role === "delivery") chimeType = "delivery";
    else if (role === "customer") chimeType = "order";
    playNotificationChime(chimeType);
  }, [isSoundActive, user?.role]);

  // Show a popup notification directly (e.g. from real-time WS or manual trigger)
  const showNotificationPopup = useCallback(
    (notif: PopupNotificationData) => {
      alertedIdsRef.current.add(notif.id);
      setNotificationQueue((prev) => {
        if (prev.some((n) => n.id === notif.id)) return prev;
        return [...prev, notif];
      });
      playRoleChime();
    },
    [playRoleChime]
  );

  // Fetch notifications with background polling
  const { data: notifRes } = useQuery({
    queryKey: ["notifications", "global-alert-feed"],
    queryFn: () => api.get<any[]>("/notifications"),
    enabled: isAuthenticated,
    refetchInterval: 15_000,
    staleTime: 5_000,
  });

  // Whenever notifications are loaded/updated, populate any unread notifications into the visible queue
  useEffect(() => {
    if (!isAuthenticated || !notifRes?.data || !Array.isArray(notifRes.data)) {
      return;
    }

    const rawList: any[] = notifRes.data;

    // Filter to unread notifications from DB
    const unreadList = rawList.filter((n) => !n.is_read);

    if (unreadList.length === 0) {
      // No unread notifications - clear queue
      if (notificationQueue.length > 0) {
        setNotificationQueue([]);
      }
      return;
    }

    // Identify unread notifications that need to be visible
    const unreadQueueItems: PopupNotificationData[] = unreadList.map((n) => ({
      id: n.id,
      title: n.title || "New Notification",
      message: n.body || n.message || "",
      type: n.type || "order",
      channel: n.channel,
      created_at: n.created_at,
      data: n.data || null,
      source: n.source === "announcement" ? "announcement" : "notification",
    }));

    // Check if any fresh notifications need sound alert
    const hasFreshUnread = unreadList.some((n) => !alertedIdsRef.current.has(n.id));

    unreadList.forEach((n) => alertedIdsRef.current.add(n.id));

    setNotificationQueue((prev) => {
      // Reconcile unread queue
      const unreadMap = new Map(unreadQueueItems.map((item) => [item.id, item]));
      // Keep existing ordering if present, append new unread items
      const existingInQueue = prev.filter((item) => unreadMap.has(item.id));
      const existingIds = new Set(existingInQueue.map((item) => item.id));
      const freshItems = unreadQueueItems.filter((item) => !existingIds.has(item.id));
      return [...existingInQueue, ...freshItems];
    });

    if (hasFreshUnread || !initialAlertPlayedRef.current) {
      initialAlertPlayedRef.current = true;
      playRoleChime();
    }
  }, [notifRes, isAuthenticated, playRoleChime]);

  // Active notification is the first in queue
  const activeNotification = notificationQueue.length > 0 ? notificationQueue[0] : null;

  // Mark single active notification as read and remove from queue
  const dismissActiveNotification = useCallback(async () => {
    if (!activeNotification) return;
    const currentId = activeNotification.id;

    // Optimistically advance queue
    setNotificationQueue((prev) => prev.filter((n) => n.id !== currentId));

    try {
      if (activeNotification.source !== "announcement") {
        await api.put(`/notifications/${currentId}/read`);
      }
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "global-alert-feed"] });
    } catch (e) {
      console.warn("Could not mark notification read on dismiss", e);
    }
  }, [activeNotification, queryClient]);

  // Mark all unread notifications as read and clear queue
  const dismissAllNotifications = useCallback(async () => {
    setNotificationQueue([]);

    try {
      await api.put("/notifications/read-all");
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "global-alert-feed"] });
      queryClient.setQueryData(["notifications", "unread-count"], { count: 0 });
    } catch (e) {
      console.warn("Could not mark all notifications read", e);
    }
  }, [queryClient]);

  // Test alert trigger
  const triggerTestAlert = useCallback(
    (chimeType: ChimeType = "default") => {
      playNotificationChime(chimeType);
      showNotificationPopup({
        id: `test-alert-${Date.now()}`,
        title: "🔔 Test Notification Alert",
        message: `This is a live preview test of the notification popup and chime audio for ${user?.role || "your account"}.`,
        type: "order",
        created_at: new Date().toISOString(),
      });
    },
    [showNotificationPopup, user?.role]
  );

  return (
    <GlobalNotificationAlertContext.Provider
      value={{
        queueLength: notificationQueue.length,
        isSoundEnabled: isSoundActive,
        setSoundEnabled,
        triggerTestAlert,
        showNotificationPopup,
        dismissActiveNotification,
        dismissAllNotifications,
      }}
    >
      {children}

      {/* Global Live / Unseen Notification Popup Modal */}
      {activeNotification && (
        <GlobalNotificationPopupModal
          notification={activeNotification}
          queueLength={notificationQueue.length}
          isOpen={true}
          userRole={user?.role || "customer"}
          isSoundEnabled={isSoundActive}
          onToggleSound={toggleSound}
          onDismiss={dismissActiveNotification}
          onDismissAll={dismissAllNotifications}
        />
      )}
    </GlobalNotificationAlertContext.Provider>
  );
}
