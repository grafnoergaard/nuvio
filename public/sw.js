self.BADGE_DB_NAME = 'kuvert-notification-center';
self.BADGE_DB_VERSION = 1;
self.NOTIFICATIONS_STORE = 'notifications';
self.META_STORE = 'meta';
self.UNREAD_META_KEY = 'unreadCount';
self.NOTIFICATION_CENTER_CHANNEL = 'kuvert-notification-center';
self.NOTIFICATION_CENTER_EVENT = 'kuvert-notification-center-updated';

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function openBadgeDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(self.BADGE_DB_NAME, self.BADGE_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(self.NOTIFICATIONS_STORE)) {
        db.createObjectStore(self.NOTIFICATIONS_STORE, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(self.META_STORE)) {
        db.createObjectStore(self.META_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function createNotificationId() {
  return `push:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

async function storeUnreadPushNotification(payload) {
  const db = await openBadgeDb();
  const transaction = db.transaction([self.NOTIFICATIONS_STORE, self.META_STORE], 'readwrite');
  const notificationsStore = transaction.objectStore(self.NOTIFICATIONS_STORE);
  const metaStore = transaction.objectStore(self.META_STORE);
  const notificationId = createNotificationId();
  const unreadRecord = await requestToPromise(metaStore.get(self.UNREAD_META_KEY));
  const unreadCount = Math.max(0, Number(unreadRecord?.value || 0)) + 1;

  notificationsStore.put({
    id: notificationId,
    title: payload.title || 'Kuvert',
    body: payload.body || 'Der er nyt i din Kuvert.',
    url: payload.url || '/',
    createdAt: new Date().toISOString(),
    readAt: null,
    source: 'push',
  });

  metaStore.put({ key: self.UNREAD_META_KEY, value: unreadCount });
  await transactionDone(transaction);
  db.close();

  return { notificationId, unreadCount };
}

async function markNotificationRead(notificationId) {
  if (!notificationId) return 0;

  const db = await openBadgeDb();
  const transaction = db.transaction([self.NOTIFICATIONS_STORE, self.META_STORE], 'readwrite');
  const notificationsStore = transaction.objectStore(self.NOTIFICATIONS_STORE);
  const metaStore = transaction.objectStore(self.META_STORE);
  const notification = await requestToPromise(notificationsStore.get(notificationId));
  const unreadRecord = await requestToPromise(metaStore.get(self.UNREAD_META_KEY));
  let unreadCount = Math.max(0, Number(unreadRecord?.value || 0));

  if (notification && !notification.readAt) {
    notificationsStore.put({
      ...notification,
      readAt: new Date().toISOString(),
    });
    unreadCount = Math.max(0, unreadCount - 1);
    metaStore.put({ key: self.UNREAD_META_KEY, value: unreadCount });
  }

  await transactionDone(transaction);
  db.close();
  return unreadCount;
}

async function applyAppBadgeCount(count) {
  const badgeNavigator = self.navigator;
  const nextCount = Math.max(0, Number(count || 0));

  try {
    if (nextCount > 0 && typeof badgeNavigator?.setAppBadge === 'function') {
      await badgeNavigator.setAppBadge(nextCount);
      return;
    }

    if (nextCount === 0 && typeof badgeNavigator?.clearAppBadge === 'function') {
      await badgeNavigator.clearAppBadge();
      return;
    }

    if (typeof badgeNavigator?.setAppBadge === 'function') {
      await badgeNavigator.setAppBadge(0);
    }
  } catch {
    // Best-effort only.
  }
}

async function notifyNotificationCenterClients(unreadCount) {
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(self.NOTIFICATION_CENTER_CHANNEL);
    channel.postMessage({ type: self.NOTIFICATION_CENTER_EVENT, unreadCount });
    channel.close();
  }

  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach((client) => {
    client.postMessage({ type: self.NOTIFICATION_CENTER_EVENT, unreadCount });
  });
}

function appendNotificationIdToUrl(url, notificationId) {
  if (!notificationId) return url || '/';

  try {
    const nextUrl = new URL(url || '/', self.location.origin);
    nextUrl.searchParams.set('notificationId', notificationId);
    return nextUrl.pathname + nextUrl.search + nextUrl.hash;
  } catch {
    return url || '/';
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Kuvert',
    body: 'Der er nyt i din Kuvert.',
    url: '/',
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    (async () => {
      const { notificationId, unreadCount } = await storeUnreadPushNotification(payload);
      await applyAppBadgeCount(unreadCount);
      await notifyNotificationCenterClients(unreadCount);

      await self.registration.showNotification(payload.title, {
        body: payload.body,
        lang: 'da-DK',
        dir: 'ltr',
        icon: '/kuvert-icon.png',
        badge: '/kuvert-icon.png',
        data: {
          url: payload.url || '/',
          notificationId,
        },
      });
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notificationId = event.notification.data?.notificationId;
  const targetUrl = appendNotificationIdToUrl(event.notification.data?.url || '/', notificationId);

  event.waitUntil((async () => {
    const unreadCount = await markNotificationRead(notificationId);
    await applyAppBadgeCount(unreadCount);
    await notifyNotificationCenterClients(unreadCount);

    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const sameOriginClient = clients.find((client) => {
      try {
        return new URL(client.url).origin === self.location.origin;
      } catch {
        return false;
      }
    });

    if (sameOriginClient) {
      if (typeof sameOriginClient.navigate === 'function') {
        await sameOriginClient.navigate(targetUrl);
      }
      await sameOriginClient.focus();
      return;
    }

    await self.clients.openWindow(targetUrl);
  })());
});
