/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();

// Injected precache manifest from VitePWA
precacheAndRoute(
  (self as unknown as { __WB_MANIFEST?: Array<{ url: string; revision: string | null }> })
    .__WB_MANIFEST ?? [],
);

// ── Push notification handler ────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data: { title?: string; body?: string; url?: string } = {};
  try { data = event.data?.json() ?? {}; } catch { /* ignore */ }

  const title = data.title || "BidWar";
  const body  = data.body  || "Your auction is now live";
  const url   = data.url   || "/owner-app/";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:  "/pwa-icon-192.png",
      badge: "/pwa-icon-192.png",
      data: { url },
    } as NotificationOptions),
  );
});

// ── Notification click: open/focus the owner URL ─────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string })?.url || "/owner-app/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes("/owner-app/") && "focus" in client) {
            (client as WindowClient).navigate(url);
            return (client as WindowClient).focus();
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
