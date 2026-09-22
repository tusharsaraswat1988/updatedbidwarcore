/* BidWar Scoring App PWA — Service Worker for standalone installability & network resilience */
const CACHE_NAME = "bidwar-scorer-pwa-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) {
            return caches.delete(k);
          }
        }),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  // Let browser handle navigation and API requests directly
  // Passes through network-first to avoid caching stale API / auth responses
  if (event.request.method !== "GET") {
    return;
  }
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      return new Response("Network error", { status: 503, statusText: "Service Unavailable" });
    }),
  );
});
