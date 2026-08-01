"use client";

/**
 * The tracking client. Deliberately sink-agnostic: everything here talks to
 * /api/track and nothing else, so the storage behind that route can change
 * without touching a single call site.
 *
 * Identity is anonymous and local: a visitor id in localStorage (the "unique
 * user"), a session id in sessionStorage (the "visit"). Acquisition context,
 * the referrer and any UTM parameters, is captured once per session on the
 * first event, which is how "landed from campaign X" stays attached to a
 * visit without repeating itself on every click.
 *
 * Nothing here may ever break the app: every failure path swallows.
 */

type Props = Record<string, string | number | boolean>;

function id(store: Storage, key: string): string {
  let v = store.getItem(key);
  if (!v) {
    v = crypto.randomUUID();
    store.setItem(key, v);
  }
  return v;
}

/** Referrer and UTM, only when they exist and only once per session. */
function firstTouch(): Record<string, unknown> | undefined {
  try {
    if (sessionStorage.getItem("kairo-ctx-sent")) return undefined;
    sessionStorage.setItem("kairo-ctx-sent", "1");

    const ctx: Record<string, unknown> = { landing: location.pathname };
    const ref = document.referrer;
    if (ref && !ref.startsWith(location.origin)) ctx.ref = ref.slice(0, 300);

    const q = new URLSearchParams(location.search);
    const utm: Record<string, string> = {};
    for (const k of ["source", "medium", "campaign", "term", "content"]) {
      const v = q.get(`utm_${k}`);
      if (v) utm[k] = v.slice(0, 100);
    }
    if (Object.keys(utm).length > 0) ctx.utm = utm;
    return ctx;
  } catch {
    return undefined;
  }
}

export function track(event: string, props?: Props): void {
  try {
    // the admin's own poking around is noise, not signal
    if (location.pathname.startsWith("/admin")) return;

    const body = JSON.stringify({
      e: event,
      path: location.pathname,
      vid: id(localStorage, "kairo-vid"),
      sid: id(sessionStorage, "kairo-sid"),
      props,
      ctx: firstTouch(),
    });

    // sendBeacon survives navigation; keepalive fetch is the fallback
    if (!navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // never let telemetry take the app down with it
  }
}
