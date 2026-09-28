/* Kairo service worker — web push notifications, and a cache for the parts
   of the app that are the same for everyone. */

/*
 * Bump this to retire every cache the last version wrote. The name carries
 * the version, and `activate` deletes anything that isn't the current one, so
 * a stale asset can never outlive a deploy.
 */
const VERSION = "v1";
const ASSETS = `kairo-assets-${VERSION}`;
const OFFLINE_URL = "/offline";

/*
 * What is safe to keep.
 *
 * Only things that are identical for every account: the build's own static
 * files, the artwork, the fonts. A page, an RSC payload and anything under
 * /api carry somebody's tasks, and two people share a phone more often than
 * anyone plans for — so none of those are ever written to the cache, and the
 * only thing a navigation may take from it is the offline page.
 */
const IMMUTABLE = /^\/_next\/static\//;
const STATIC_FILE = /\.(?:png|jpe?g|webp|avif|gif|svg|ico|woff2?|mp3|mp4)$/i;

/*
 * The speech runtime's fallback binary is 26MB, and it only ever downloads on
 * a device with no WebGPU. Keeping it here would spend most of a small phone's
 * storage quota on one file and get the rest of the cache evicted to pay for
 * it. It already carries immutable headers, so the browser's own HTTP cache
 * holds it perfectly well.
 */
const TOO_BIG = /\.wasm$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(ASSETS);
        // `reload` so a redeploy's offline page replaces the one held by the HTTP cache
        await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      } catch {
        /* no offline page this time; every other part of the worker still works */
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith("kairo-") && n !== ASSETS).map((n) => caches.delete(n)));
      // lets a navigation answer from the cache instead of waiting on the worker
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.enable();
        } catch {
          /* not supported here; navigations just go straight to the network */
        }
      }
      await self.clients.claim();
    })()
  );
});

/** Only a real, whole, same-origin response is worth keeping. */
function keepable(res) {
  return Boolean(res) && res.ok && res.status === 200 && res.type === "basic";
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  // the worker itself must never be served from a cache, or a deploy can't land
  if (url.pathname === "/sw.js") return;

  /*
   * A page. Always from the network, because it is somebody's own data and a
   * second-old copy of it is worse than a spinner. The cache is here for one
   * thing only: when the network is gone, say so on a page that looks like
   * Kairo rather than showing the browser's error.
   */
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preloaded = await event.preloadResponse;
          if (preloaded) return preloaded;
          return await fetch(request);
        } catch {
          return (await caches.match(OFFLINE_URL)) ?? Response.error();
        }
      })()
    );
    return;
  }

  if (url.pathname.startsWith("/api/")) return;

  /*
   * The build's own files. Their names carry a content hash, so a hit is
   * always the right answer and there is nothing to revalidate.
   */
  if (IMMUTABLE.test(url.pathname)) {
    if (TOO_BIG.test(url.pathname)) return;
    event.respondWith(
      (async () => {
        const hit = await caches.match(request, { cacheName: ASSETS });
        if (hit) return hit;
        const res = await fetch(request);
        if (keepable(res)) {
          const copy = res.clone();
          event.waitUntil(caches.open(ASSETS).then((c) => c.put(request, copy)));
        }
        return res;
      })()
    );
    return;
  }

  /*
   * Artwork, icons, audio: served from the cache at once, and replaced in the
   * background for next time. These names are not hashed — an icon can be
   * swapped in place — so a refresh always goes out, it just never blocks.
   */
  if (STATIC_FILE.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const hit = await caches.match(request, { cacheName: ASSETS });
        const network = fetch(request)
          .then((res) => {
            if (keepable(res)) {
              const copy = res.clone();
              event.waitUntil(caches.open(ASSETS).then((c) => c.put(request, copy)));
            }
            return res;
          })
          .catch(() => null);
        return hit ?? (await network) ?? Response.error();
      })()
    );
  }

  /* everything else is left alone: no respondWith, so the browser does what it always did */
});

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
