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
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/kuvert-icon.png',
      badge: '/kuvert-icon.png',
      data: {
        url: payload.url || '/',
      },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const matchingClient = clients.find((client) => {
        try {
          return new URL(client.url).pathname === targetUrl;
        } catch {
          return false;
        }
      });

      if (matchingClient) {
        return matchingClient.focus();
      }

      return self.clients.openWindow(targetUrl);
    })
  );
});
