"use client";

/** Browser-side push helpers: registration, permission, scheduling. */

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function pushPermission(): NotificationPermission | "unsupported" {
  if (!pushSupported()) return "unsupported";
  return Notification.permission;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

function base64ToUint8(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** True when permission is granted AND this browser has an active subscription. */
export async function pushEnabled(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return false;
  return (await reg.pushManager.getSubscription()) !== null;
}

/**
 * Keeps this device reachable. Browsers replace a push subscription now and
 * then, and a server that hears a subscription is gone deletes it; either way
 * the device stops getting pushes while everything here still looks "on". So
 * each time the app opens, a device that was allowed to notify makes sure it
 * still has a subscription (subscribing again if not) and tells the server
 * which one it is. Never asks for permission: that's what enablePush is for.
 */
export async function syncPushSubscription(): Promise<"synced" | "off"> {
  if (!pushSupported() || Notification.permission !== "granted") return "off";
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return "off";
  try {
    const reg = (await navigator.serviceWorker.getRegistration()) ?? (await registerServiceWorker());
    if (!reg) return "off";
    let subscription = await reg.pushManager.getSubscription();
    // only a device that was subscribed before is put back: turning pushes off stays off
    const wasOn = localStorage.getItem(PUSH_ON_KEY) === "1";
    if (!subscription) {
      if (!wasOn) return "off";
      subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToUint8(key) as BufferSource });
    }
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });
    if (res.ok) localStorage.setItem(PUSH_ON_KEY, "1");
    return res.ok ? "synced" : "off";
  } catch {
    return "off";
  }
}

/** Remembers that this device had pushes on, so a lost subscription is put back rather than quietly staying lost. */
const PUSH_ON_KEY = "kairo:push-on";

export type EnableResult =
  | { status: "enabled" }
  | { status: "denied" }
  | { status: "insecure" }
  | { status: "unsupported" }
  | { status: "failed"; detail: string };

/** Full enable flow: permission → subscribe → save server-side. Loud on failure. */
export async function enablePush(): Promise<EnableResult> {
  if (typeof window !== "undefined" && window.isSecureContext === false) {
    return { status: "insecure" };
  }
  if (!pushSupported()) return { status: "unsupported" };
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return { status: "failed", detail: "VAPID public key missing from the build" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { status: "denied" };

  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await registerServiceWorker());
  if (!reg) return { status: "failed", detail: "service worker registration failed" };

  // wait for the worker to activate — but never hang the UI on it
  const start = Date.now();
  while (!reg.active && Date.now() - start < 5000) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!reg.active) return { status: "failed", detail: "service worker didn't activate" };

  try {
    const subscription =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ToUint8(key) as BufferSource,
      }));

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });
    if (!res.ok) return { status: "failed", detail: `server rejected subscription (${res.status})` };
    try {
      localStorage.setItem(PUSH_ON_KEY, "1");
    } catch {
      /* private mode: it just won't be put back by itself */
    }
    return { status: "enabled" };
  } catch (err) {
    console.error("Push subscribe failed:", err);
    const message = err instanceof Error ? err.message : "unknown error";
    return { status: "failed", detail: message };
  }
}

export async function disablePush(): Promise<void> {
  try {
    localStorage.removeItem(PUSH_ON_KEY);
  } catch {
    /* nothing to forget */
  }
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  try {
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
  } catch {}
  await sub.unsubscribe().catch(() => {});
}

/** Schedules a server-sent push; same tag replaces any pending one. */
export async function schedulePush(opts: {
  fireAt: number;
  title: string;
  body?: string;
  tag: string;
  url?: string;
  /** Link to a task: the push is skipped if that task is done/deleted by fire time. */
  taskId?: string;
}): Promise<void> {
  try {
    await fetch("/api/push/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    });
  } catch {}
}

export async function cancelPush(tag: string): Promise<void> {
  try {
    await fetch("/api/push/schedule", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag }),
    });
  } catch {}
}
