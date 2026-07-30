/* Kairo service worker — web push notifications */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    /* non-JSON payload */
  }
  const title = data.title || "Kairo";

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, {
        body: data.body || "Something needs your attention.",
        icon: "/img/sunrise.png",
        tag: data.tag || "kairo",
        renotify: true,
        silent: false, // let the OS play its notification sound
        requireInteraction: true, // stay on screen until dismissed
        vibrate: [80, 40, 80],
        data: { url: data.url || "/today" },
      });

      // any open Kairo tab plays the in-app chime for a richer sound
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        client.postMessage({ type: "kairo-push", title, body: data.body || "" });
      }
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/today";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.startsWith(self.location.origin)) {
          client.focus();
          if (client.navigate) client.navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
