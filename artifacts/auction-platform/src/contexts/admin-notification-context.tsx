import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "wouter";
import { apiUrl } from "@workspace/api-base";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import {
  ADMIN_NOTIFICATION_DROPDOWN_LIMIT,
  navigateToNotificationAction,
  priorityToastEmoji,
  type AdminNotificationItem,
  type AdminNotificationSettings,
} from "@/lib/admin-notifications";
import { playAdminNotificationSound } from "@/lib/admin-notification-sound";

type LiveNotificationPayload = {
  notification: AdminNotificationItem;
  unreadCount: number;
};

type PageListener = (payload: LiveNotificationPayload) => void;

type AdminNotificationContextValue = {
  recentItems: AdminNotificationItem[];
  unreadCount: number;
  settings: AdminNotificationSettings | null;
  connectionStatus: "connected" | "reconnecting" | "disconnected";
  loadingRecent: boolean;
  refreshRecent: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  subscribeToLiveNotifications: (listener: PageListener) => () => void;
  openNotification: (item: AdminNotificationItem) => void;
};

const AdminNotificationContext = createContext<AdminNotificationContextValue | null>(null);

const BASE_TITLE = "BIDWAR Admin";
const MAX_BACKOFF_MS = 30_000;

function ssePayloadToItem(
  notification: AdminNotificationItem & { isRead?: boolean },
): AdminNotificationItem {
  return {
    ...notification,
    entityType: notification.entityType ?? null,
    entityId: notification.entityId ?? null,
    readAt: notification.readAt ?? null,
    metadata: notification.metadata ?? null,
    isRead: notification.isRead ?? false,
  };
}

export function AdminNotificationProvider({
  children,
  enabled,
}: {
  children: ReactNode;
  enabled: boolean;
}) {
  const [, navigate] = useLocation();
  const [recentItems, setRecentItems] = useState<AdminNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [settings, setSettings] = useState<AdminNotificationSettings | null>(null);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<AdminNotificationContextValue["connectionStatus"]>("disconnected");

  const seenIdsRef = useRef<Set<number>>(new Set());
  const listenersRef = useRef<Set<PageListener>>(new Set());
  const settingsRef = useRef<AdminNotificationSettings | null>(null);
  const baseDocumentTitleRef = useRef<string | null>(null);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const updateDocumentTitle = useCallback((count: number) => {
    if (typeof document === "undefined") return;
    if (baseDocumentTitleRef.current === null) {
      const current = document.title;
      baseDocumentTitleRef.current = current.includes(") ")
        ? current.replace(/^\(\d+\)\s*/, "")
        : current || BASE_TITLE;
    }
    const base = baseDocumentTitleRef.current;
    document.title = count > 0 ? `(${count}) ${base}` : base;
  }, []);

  useEffect(() => {
    updateDocumentTitle(unreadCount);
  }, [unreadCount, updateDocumentTitle]);

  const notifyListeners = useCallback((payload: LiveNotificationPayload) => {
    for (const listener of listenersRef.current) {
      listener(payload);
    }
  }, []);

  const showLiveToast = useCallback(
    (item: AdminNotificationItem) => {
      const emoji = priorityToastEmoji(item.priority);
      const toastRef = toast({
        title: `${emoji} ${item.title}`,
        description: item.message,
        action: item.actionUrl ? (
          <ToastAction
            altText="Open notification"
            onClick={() => navigateToNotificationAction(item.actionUrl, navigate)}
          >
            View
          </ToastAction>
        ) : undefined,
      });

      window.setTimeout(() => toastRef.dismiss(), 5000);
    },
    [navigate],
  );

  const handleLiveNotification = useCallback(
    (item: AdminNotificationItem, count: number) => {
      if (seenIdsRef.current.has(item.id)) {
        setUnreadCount(count);
        return;
      }
      seenIdsRef.current.add(item.id);

      setUnreadCount(count);
      setRecentItems((prev) => {
        const next = [item, ...prev.filter((n) => n.id !== item.id)];
        return next.slice(0, ADMIN_NOTIFICATION_DROPDOWN_LIMIT);
      });

      notifyListeners({ notification: item, unreadCount: count });

      if (settingsRef.current?.notificationSoundEnabled) {
        playAdminNotificationSound();
      }

      showLiveToast(item);
    },
    [notifyListeners, showLiveToast],
  );

  const refreshRecent = useCallback(async () => {
    if (!enabled) return;
    setLoadingRecent(true);
    try {
      const [recentRes, settingsRes] = await Promise.all([
        fetch(`/api/auth/admin/admin-notifications/recent?limit=${ADMIN_NOTIFICATION_DROPDOWN_LIMIT}`, {
          credentials: "include",
        }),
        fetch("/api/auth/admin/settings/admin-notifications", { credentials: "include" }),
      ]);

      if (recentRes.ok) {
        const data = (await recentRes.json()) as {
          items: AdminNotificationItem[];
          unreadCount: number;
        };
        setRecentItems(data.items);
        setUnreadCount(data.unreadCount);
        for (const item of data.items) {
          seenIdsRef.current.add(item.id);
        }
      }

      if (settingsRes.ok) {
        const nextSettings = (await settingsRes.json()) as AdminNotificationSettings;
        setSettings(nextSettings);
        settingsRef.current = nextSettings;
      }
    } finally {
      setLoadingRecent(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setConnectionStatus("disconnected");
      return;
    }

    void refreshRecent();
  }, [enabled, refreshRecent]);

  useEffect(() => {
    if (!enabled) return;
    if (settings && !settings.liveNotificationsEnabled) {
      setConnectionStatus("disconnected");
      return;
    }

    let current: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let destroyed = false;
    let attempt = 0;

    function scheduleReconnect() {
      if (destroyed) return;
      setConnectionStatus("reconnecting");
      const delay = Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS);
      attempt += 1;
      retryTimer = setTimeout(connect, delay);
    }

    function connect() {
      if (destroyed) return;
      clearTimeout(retryTimer);
      current?.close();

      const es = new EventSource(apiUrl("/auth/admin/admin-notifications/events"), {
        withCredentials: true,
      });
      current = es;

      es.onopen = () => {
        if (es !== current || destroyed) return;
        attempt = 0;
        setConnectionStatus("connected");
      };

      es.onmessage = (event) => {
        if (es !== current || destroyed) return;
        try {
          const msg = JSON.parse(event.data) as
            | { type: "ADMIN_NOTIFICATION_SYNC"; unreadCount: number }
            | {
                type: "ADMIN_NOTIFICATION_CREATED";
                notification: AdminNotificationItem;
                unreadCount: number;
              };

          if (msg.type === "ADMIN_NOTIFICATION_SYNC") {
            setUnreadCount(msg.unreadCount);
            return;
          }

          if (msg.type === "ADMIN_NOTIFICATION_CREATED") {
            const item = ssePayloadToItem(msg.notification);
            handleLiveNotification(item, msg.unreadCount);
          }
        } catch {
          // ignore malformed SSE payloads
        }
      };

      es.onerror = () => {
        if (es !== current || destroyed) return;
        es.close();
        scheduleReconnect();
      };
    }

    connect();

    return () => {
      destroyed = true;
      clearTimeout(retryTimer);
      current?.close();
      setConnectionStatus("disconnected");
    };
  }, [enabled, settings?.liveNotificationsEnabled, handleLiveNotification]);

  const markRead = useCallback(async (id: number) => {
    await fetch(`/api/auth/admin/admin-notifications/${id}/read`, {
      method: "PATCH",
      credentials: "include",
    });
    setRecentItems((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await fetch("/api/auth/admin/admin-notifications/mark-all-read", {
      method: "PATCH",
      credentials: "include",
    });
    setRecentItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);
  }, []);

  const subscribeToLiveNotifications = useCallback((listener: PageListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const openNotification = useCallback(
    (item: AdminNotificationItem) => {
      if (!item.isRead) void markRead(item.id);
      navigateToNotificationAction(item.actionUrl, navigate);
    },
    [markRead, navigate],
  );

  const value = useMemo<AdminNotificationContextValue>(
    () => ({
      recentItems,
      unreadCount,
      settings,
      connectionStatus,
      loadingRecent,
      refreshRecent,
      markRead,
      markAllRead,
      subscribeToLiveNotifications,
      openNotification,
    }),
    [
      recentItems,
      unreadCount,
      settings,
      connectionStatus,
      loadingRecent,
      refreshRecent,
      markRead,
      markAllRead,
      subscribeToLiveNotifications,
      openNotification,
    ],
  );

  return (
    <AdminNotificationContext.Provider value={value}>{children}</AdminNotificationContext.Provider>
  );
}

export function useAdminNotifications(): AdminNotificationContextValue {
  const ctx = useContext(AdminNotificationContext);
  if (!ctx) {
    throw new Error("useAdminNotifications must be used within AdminNotificationProvider");
  }
  return ctx;
}

export function useAdminNotificationsOptional(): AdminNotificationContextValue | null {
  return useContext(AdminNotificationContext);
}
