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
        badge: "/img/sunrise.png",
        tag: data.tag || "kairo",
        renotify: true,
        silent: false, // let the OS play its notification sound
        requireInteraction: true, // stay on screen until dismissed
        vibrate: [80, 40, 80],
        timestamp: Date.now(),
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

/*
 * The browser replaced this device's push subscription (it does, now and
 * then, and the old one stops working the moment it happens). Subscribe
 * again with the same key and tell the server, right here in the worker:
 * waiting for the app to be opened next would mean silence until then.
 */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const old = event.oldSubscription || (await self.registration.pushManager.getSubscription());
        const options = old && old.options && old.options.applicationServerKey ? { userVisibleOnly: true, applicationServerKey: old.options.applicationServerKey } : null;
        const fresh = event.newSubscription || (options ? await self.registration.pushManager.subscribe(options) : null);
        if (!fresh) return; // no key to subscribe with: the app re-subscribes the next time it opens
        await fetch("/api/push/subscribe", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: fresh.toJSON(), replaces: old ? old.endpoint : null }),
        });
      } catch {
        /* the app re-subscribes the next time it opens */
      }
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = event.notification.data && event.notification.data.url;
  // only ever a page of this site: "//elsewhere" would leave it
  const url = typeof raw === "string" && /^\/(?![/\\])/.test(raw) ? raw : "/today";
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
