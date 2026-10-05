const CACHE_NAME = "amos-assets-v1";
const OFFLINE_URL = "/offline.html";
const urlsToCache = [
  OFFLINE_URL,
  "/icon/icon-192.png",
  "/icon/icon-512.png",
  "/icon/icon-maskable-192.png",
  "/icon/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => Promise.allSettled(urlsToCache.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  let url;
  try {
    url = new URL(event.request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/auth")) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches
          .match(OFFLINE_URL)
          .then((cached) => cached ?? new Response("Offline", { status: 503 })),
      ),
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response.ok) return response;
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
          }),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const isAppInFocus = clientList.some((client) => client.focused);
      if (!isAppInFocus) {
        return self.registration.showNotification(data.title, data.options);
      }
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow("/");
    }),
  );
});
