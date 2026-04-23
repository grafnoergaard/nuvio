'use client';

export type StoredPushNotification = {
  id: string;
  title: string;
  body: string;
  url: string;
  createdAt: string;
  readAt: string | null;
  source: 'push';
};

const DB_NAME = 'kuvert-notification-center';
const DB_VERSION = 1;
const NOTIFICATIONS_STORE = 'notifications';
const META_STORE = 'meta';
const UNREAD_META_KEY = 'unreadCount';
export const NOTIFICATION_CENTER_CHANNEL = 'kuvert-notification-center';
export const NOTIFICATION_CENTER_EVENT = 'kuvert-notification-center-updated';

type MetaRecord = {
  key: string;
  value: number;
};

type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function openNotificationCenterDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(NOTIFICATIONS_STORE)) {
        db.createObjectStore(NOTIFICATIONS_STORE, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function isBrowser() {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

async function getUnreadCountFromMeta() {
  if (!isBrowser()) return 0;

  const db = await openNotificationCenterDb();
  const transaction = db.transaction(META_STORE, 'readonly');
  const store = transaction.objectStore(META_STORE);
  const record = await requestToPromise<MetaRecord | undefined>(store.get(UNREAD_META_KEY));
  db.close();
  return typeof record?.value === 'number' ? Math.max(0, record.value) : 0;
}

async function setUnreadCountMeta(count: number) {
  if (!isBrowser()) return 0;

  const db = await openNotificationCenterDb();
  const transaction = db.transaction(META_STORE, 'readwrite');
  const store = transaction.objectStore(META_STORE);
  store.put({ key: UNREAD_META_KEY, value: Math.max(0, Math.trunc(count)) } satisfies MetaRecord);
  await transactionDone(transaction);
  db.close();
  return Math.max(0, Math.trunc(count));
}

export async function getStoredNotifications() {
  if (!isBrowser()) return [] as StoredPushNotification[];

  const db = await openNotificationCenterDb();
  const transaction = db.transaction(NOTIFICATIONS_STORE, 'readonly');
  const store = transaction.objectStore(NOTIFICATIONS_STORE);
  const notifications = await requestToPromise<StoredPushNotification[]>(store.getAll());
  db.close();

  return [...notifications].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export async function getUnreadNotificationCount() {
  return getUnreadCountFromMeta();
}

export function supportsAppBadge() {
  if (typeof navigator === 'undefined') return false;
  const badgeNavigator = navigator as BadgeNavigator;
  return typeof badgeNavigator.setAppBadge === 'function' || typeof badgeNavigator.clearAppBadge === 'function';
}

export async function applyAppBadgeCount(count: number) {
  if (typeof navigator === 'undefined') return;

  const badgeNavigator = navigator as BadgeNavigator;
  const nextCount = Math.max(0, Math.trunc(count));

  try {
    if (nextCount > 0 && typeof badgeNavigator.setAppBadge === 'function') {
      await badgeNavigator.setAppBadge(nextCount);
      return;
    }

    if (nextCount === 0 && typeof badgeNavigator.clearAppBadge === 'function') {
      await badgeNavigator.clearAppBadge();
      return;
    }

    if (typeof badgeNavigator.setAppBadge === 'function') {
      await badgeNavigator.setAppBadge(0);
    }
  } catch {
    // Badging API is best-effort only.
  }
}

export async function syncAppBadgeFromNotificationCenter() {
  const count = await getUnreadNotificationCount();
  await applyAppBadgeCount(count);
  return count;
}

function broadcastNotificationCenterUpdate(unreadCount?: number) {
  if (typeof window === 'undefined') return;

  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(NOTIFICATION_CENTER_CHANNEL);
    channel.postMessage({ type: NOTIFICATION_CENTER_EVENT, unreadCount });
    channel.close();
  }

  window.dispatchEvent(
    new CustomEvent(NOTIFICATION_CENTER_EVENT, {
      detail: { unreadCount },
    })
  );
}

export async function markNotificationRead(notificationId: string) {
  if (!isBrowser()) return 0;

  const db = await openNotificationCenterDb();
  const transaction = db.transaction([NOTIFICATIONS_STORE, META_STORE], 'readwrite');
  const notificationsStore = transaction.objectStore(NOTIFICATIONS_STORE);
  const metaStore = transaction.objectStore(META_STORE);
  const notification = await requestToPromise<StoredPushNotification | undefined>(notificationsStore.get(notificationId));

  let unreadCount = await requestToPromise<MetaRecord | undefined>(metaStore.get(UNREAD_META_KEY));
  let nextUnread = typeof unreadCount?.value === 'number' ? unreadCount.value : 0;

  if (notification && !notification.readAt) {
    notificationsStore.put({
      ...notification,
      readAt: new Date().toISOString(),
    } satisfies StoredPushNotification);
    nextUnread = Math.max(0, nextUnread - 1);
    metaStore.put({ key: UNREAD_META_KEY, value: nextUnread } satisfies MetaRecord);
  }

  await transactionDone(transaction);
  db.close();
  await applyAppBadgeCount(nextUnread);
  broadcastNotificationCenterUpdate(nextUnread);
  return nextUnread;
}

export async function markAllNotificationsRead() {
  if (!isBrowser()) return;

  const db = await openNotificationCenterDb();
  const transaction = db.transaction([NOTIFICATIONS_STORE, META_STORE], 'readwrite');
  const notificationsStore = transaction.objectStore(NOTIFICATIONS_STORE);
  const metaStore = transaction.objectStore(META_STORE);
  const notifications = await requestToPromise<StoredPushNotification[]>(notificationsStore.getAll());

  notifications.forEach((notification) => {
    if (!notification.readAt) {
      notificationsStore.put({
        ...notification,
        readAt: new Date().toISOString(),
      } satisfies StoredPushNotification);
    }
  });

  metaStore.put({ key: UNREAD_META_KEY, value: 0 } satisfies MetaRecord);
  await transactionDone(transaction);
  db.close();
  await applyAppBadgeCount(0);
  broadcastNotificationCenterUpdate(0);
}

export async function initializeNotificationCenterFromBrowser() {
  if (!isBrowser()) return { notifications: [] as StoredPushNotification[], unreadCount: 0 };

  const [notifications, unreadCount] = await Promise.all([
    getStoredNotifications(),
    syncAppBadgeFromNotificationCenter(),
  ]);

  return { notifications, unreadCount };
}

export async function resetNotificationCenterBadgeOnly() {
  const unreadCount = await setUnreadCountMeta(0);
  await applyAppBadgeCount(unreadCount);
  broadcastNotificationCenterUpdate(unreadCount);
}
