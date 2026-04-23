'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  NOTIFICATION_CENTER_CHANNEL,
  NOTIFICATION_CENTER_EVENT,
  type StoredPushNotification,
  getStoredNotifications,
  getUnreadNotificationCount,
  deleteAllStoredNotifications,
  deleteStoredNotification,
  markAllNotificationsRead,
  markNotificationRead,
  syncAppBadgeFromNotificationCenter,
} from '@/lib/notification-center';

type NotificationCenterContextValue = {
  notifications: StoredPushNotification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
};

const NotificationCenterContext = createContext<NotificationCenterContextValue>({
  notifications: [],
  unreadCount: 0,
  loading: true,
  refresh: async () => {},
  markRead: async () => {},
  markAllRead: async () => {},
  deleteNotification: async () => {},
  deleteAllNotifications: async () => {},
});

export function NotificationCenterProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<StoredPushNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [nextNotifications, nextUnreadCount] = await Promise.all([
      getStoredNotifications(),
      getUnreadNotificationCount(),
    ]);

    setNotifications(nextNotifications);
    setUnreadCount(nextUnreadCount);
    await syncAppBadgeFromNotificationCenter();
  }, []);

  useEffect(() => {
    let isMounted = true;
    const handleUpdated = () => {
      refresh().catch(() => null);
    };

    const channel =
      typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel(NOTIFICATION_CENTER_CHANNEL)
        : null;

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === NOTIFICATION_CENTER_EVENT) {
        handleUpdated();
      }
    };

    refresh()
      .catch(() => null)
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    channel?.addEventListener('message', handleUpdated);
    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);
    window.addEventListener(NOTIFICATION_CENTER_EVENT, handleUpdated as EventListener);
    window.addEventListener('focus', handleUpdated);
    document.addEventListener('visibilitychange', handleUpdated);

    return () => {
      isMounted = false;
      channel?.removeEventListener('message', handleUpdated);
      channel?.close();
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
      window.removeEventListener(NOTIFICATION_CENTER_EVENT, handleUpdated as EventListener);
      window.removeEventListener('focus', handleUpdated);
      document.removeEventListener('visibilitychange', handleUpdated);
    };
  }, [refresh]);

  const markRead = useCallback(
    async (notificationId: string) => {
      await markNotificationRead(notificationId);
      await refresh();
    },
    [refresh]
  );

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    await refresh();
  }, [refresh]);

  const deleteNotification = useCallback(
    async (notificationId: string) => {
      await deleteStoredNotification(notificationId);
      await refresh();
    },
    [refresh]
  );

  const deleteAllNotifications = useCallback(async () => {
    await deleteAllStoredNotifications();
    await refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      refresh,
      markRead,
      markAllRead,
      deleteNotification,
      deleteAllNotifications,
    }),
    [deleteAllNotifications, deleteNotification, loading, markAllRead, markRead, notifications, refresh, unreadCount]
  );

  return <NotificationCenterContext.Provider value={value}>{children}</NotificationCenterContext.Provider>;
}

export function useNotificationCenter() {
  return useContext(NotificationCenterContext);
}
