"use client";

import { useEffect, useState } from "react";
import { enablePush, pushEnabled, pushPermission } from "@/lib/push-client";
import { Modal } from "./ui";

/**
 * Asking for a permission, properly.
 *
 * A browser gives a site exactly one chance at each permission. Ask cold, in
 * the middle of something else, and most people click whichever button makes
 * the box go away — and that answer is close to permanent, because almost
 * nobody goes hunting through site settings afterwards. Kairo used to do
 * exactly that: pick a reminder time, and the browser's own box appeared with
 * no clue what it was for.
 *
 * So nothing here touches a browser API until the person has said yes to us
 * first:
 *
 *   1. We explain, in our own words, what they get and what happens next.
 *      "Not now" costs nothing — the browser is never asked, so the real
 *      answer is still available tomorrow.
 *   2. Only on "Allow" do we call the browser, while they are expecting it.
 *   3. If it was already refused, we don't ask again into a wall. We say how
 *      to undo it where they actually are — this browser, this device — and
 *      check again when they come back.
 *   4. On an iPhone, Safari delivers notifications only to a web app that
 *      lives on the home screen. Asking there would fail whatever they
 *      tapped, so we show them how to install it instead.
 *
 * Call it from anywhere: `if (await askPermission("notifications")) { ... }`.
 */

export type PermissionKind = "notifications" | "microphone";

type Pending = { kind: PermissionKind; resolve: (granted: boolean) => void };

let notify: ((p: Pending | null) => void) | null = null;
let queued: Pending | null = null;

/**
 * Ask for a permission and settle once it's known. Resolves true only if it
 * ended up granted; "Not now" resolves false without the browser being asked.
 */
export function askPermission(kind: PermissionKind): Promise<boolean> {
  return new Promise((resolve) => {
    queued = { kind, resolve };
    notify?.(queued);
  });
}

/* --------------------------------------------------------- where we are */

type Place = {
  ios: boolean;
  android: boolean;
  safari: boolean;
  firefox: boolean;
  /** Running from the home screen, as an installed app. */
  installed: boolean;
};

const NOWHERE: Place = { ios: false, android: false, safari: false, firefox: false, installed: false };

function place(): Place {
  if (typeof navigator === "undefined") return NOWHERE;
  const ua = navigator.userAgent;
  const ios = /iP(hone|ad|od)/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return {
    ios,
    android: /Android/.test(ua),
    safari: /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(ua),
    firefox: /firefox|fxios/i.test(ua),
    installed:
      (typeof window !== "undefined" && Boolean(window.matchMedia?.("(display-mode: standalone)").matches)) ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
  };
}

/** Where this browser keeps the switch, in the fewest words that still find it. */
function howToUnblock(kind: PermissionKind, p: Place): string[] {
  const what = kind === "notifications" ? "Notifications" : "Microphone";
  if (p.ios && p.installed) return ["Open the iPhone's Settings app", "Scroll down to Kairo", `Turn ${what} on`, "Come back here"];
  if (p.ios) return ["Tap the AA button in Safari's address bar", "Choose Website Settings", `Set ${what} to Allow`, "Reload the page"];
  if (p.android) return ["Tap the lock icon beside the address", "Open Permissions", `Set ${what} to Allow`, "Reload the page"];
  if (p.safari) return ["Open Safari, then Settings, then Websites", `Choose ${what} in the sidebar`, "Find Kairo and set it to Allow", "Come back here"];
  if (p.firefox) return ["Click the lock icon beside the address", `Clear the blocked ${what.toLowerCase()} setting`, "Reload the page"];
  return ["Click the lock icon beside the address", `Set ${what} to Allow`, "Reload the page"];
}

const COPY: Record<PermissionKind, { title: string; lead: string; gets: string[]; allow: string }> = {
  notifications: {
    title: "Let Kairo reach you",
    lead: "The only way anything can find you once Kairo is closed.",
    gets: [
      "Reminders arrive at the minute you set them, not whenever you next open the app",
      "A quiet ping when a focus timer runs out",
      "A question from an agent working for you, so it isn't left waiting",
    ],
    allow: "Allow notifications",
  },
  microphone: {
    title: "Say it instead of typing",
    lead: "Talk, and Kairo writes it down as a task.",
    gets: [
      "Say a whole sentence — the day, the time and the list are picked out of it",
      "Useful with your hands full, or walking",
      "Your browser does the listening; Kairo only receives the words",
    ],
    allow: "Allow the microphone",
  },
};

/* -------------------------------------------------------------- the sheet */

type Stage = "ask" | "blocked" | "install" | "insecure" | "unsupported";

export function PermissionAsk() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [stage, setStage] = useState<Stage>("ask");
  const [busy, setBusy] = useState(false);
  const [p, setP] = useState<Place>(NOWHERE);

  const settle = (next: Pending, granted: boolean) => {
    next.resolve(granted);
    if (queued === next) queued = null;
    setPending(null);
    setBusy(false);
  };

  /** Work out what this person actually needs to see, before anything is shown. */
  const open = async (next: Pending) => {
    const here = place();
    setP(here);
    if (next.kind === "notifications") {
      const state = pushPermission();
      if (state === "granted") {
        // already said yes: quietly make sure this device is really subscribed
        if (await pushEnabled()) return settle(next, true);
        if ((await enablePush()).status === "enabled") return settle(next, true);
      }
      if (state === "unsupported") setStage(here.ios && !here.installed ? "install" : "unsupported");
      else if (typeof window !== "undefined" && window.isSecureContext === false) setStage("insecure");
      else if (state === "denied") setStage("blocked");
      // Safari delivers push only to an installed web app; asking here fails whatever they tap
      else if (here.ios && !here.installed) setStage("install");
      else setStage("ask");
    } else {
      const state = await micState();
      if (state === "granted") return settle(next, true);
      setStage(state === "denied" ? "blocked" : "ask");
    }
    setPending(next);
  };

  useEffect(() => {
    // the subscription, and nothing else: what to show is decided in open()
    notify = (next) => {
      if (next) void open(next);
      else setPending(null);
    };
    if (queued) queueMicrotask(() => queued && void open(queued));
    return () => {
      notify = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  if (!pending) return null;
  const kind = pending.kind;
  const copy = COPY[kind];
  const close = () => settle(pending, false);

  /* the one place a browser API is actually called */
  const allow = async () => {
    setBusy(true);
    if (kind === "notifications") {
      const r = await enablePush();
      if (r.status === "enabled") return settle(pending, true);
      setBusy(false);
      setStage(r.status === "denied" ? "blocked" : r.status === "insecure" ? "insecure" : "unsupported");
      return;
    }
    // speech asks for the microphone itself, the moment it starts listening
    settle(pending, true);
  };

  const recheck = async () => {
    setBusy(true);
    if (kind === "notifications" && pushPermission() === "granted" && (await enablePush()).status === "enabled") return settle(pending, true);
    if (kind === "microphone" && (await micState()) !== "denied") return settle(pending, true);
    setBusy(false);
  };

  const steps = stage === "install"
    ? ["Tap the Share button at the bottom of Safari", "Scroll down and tap Add to Home Screen", "Open Kairo from its new icon", "Set your reminder again — it'll ask properly this time"]
    : howToUnblock(kind, p);

  return (
    <Modal onClose={close}>
      <div className="p-5 sm:p-6" data-permission={kind} data-permission-stage={stage}>
        {stage === "ask" && (
          <>
            <h2 className="font-display text-2xl leading-tight">{copy.title}</h2>
            <p className="mt-1.5 text-sm text-ink-soft">{copy.lead}</p>
            <ul className="mt-4 space-y-2.5">
              {copy.gets.map((g) => (
                <li key={g} className="flex gap-2.5 text-sm leading-snug">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sun" aria-hidden />
                  <span className="text-ink-soft">{g}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 rounded-xl bg-paper-deep px-3.5 py-2.5 text-[13px] text-ink-soft">Your browser will ask next — choose Allow.</p>
            <div className="mt-5 flex items-center justify-between gap-2">
              <button onClick={close} className="-ml-2 rounded-full px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-paper-deep" data-permission-later>
                Not now
              </button>
              <button onClick={() => void allow()} disabled={busy} className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper disabled:opacity-50" data-permission-allow>
                {busy ? "Asking…" : copy.allow}
              </button>
            </div>
            <p className="mt-3 text-center text-[11px] text-ink-faint">Not now is safe — your browser isn&apos;t asked, so you can still say yes later.</p>
          </>
        )}

        {(stage === "blocked" || stage === "install") && (
          <>
            <h2 className="font-display text-2xl leading-tight">
              {stage === "install" ? "Put Kairo on your home screen" : kind === "notifications" ? "Notifications are blocked" : "The microphone is blocked"}
            </h2>
            <p className="mt-1.5 text-sm text-ink-soft">
              {stage === "install"
                ? "On an iPhone, Safari only delivers notifications to an app that lives on the home screen. It takes about ten seconds, and Kairo opens like any other app afterwards."
                : "This browser is refusing on your behalf, so Kairo can't ask again. Undoing it takes a moment:"}
            </p>
            <ol className="mt-4 space-y-2.5">
              {steps.map((step, i) => (
                <li key={step} className="flex gap-3 text-sm leading-snug">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-paper-deep text-[11px] font-bold text-ink-soft">{i + 1}</span>
                  <span className="text-ink-soft">{step}</span>
                </li>
              ))}
            </ol>
            <div className="mt-5 flex items-center justify-between gap-2">
              <button onClick={close} className="-ml-2 rounded-full px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-paper-deep">
                {stage === "install" ? "Got it" : "Close"}
              </button>
              {stage === "blocked" && (
                <button onClick={() => void recheck()} disabled={busy} className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper disabled:opacity-50" data-permission-recheck>
                  {busy ? "Checking…" : "I've allowed it"}
                </button>
              )}
            </div>
          </>
        )}

        {(stage === "insecure" || stage === "unsupported") && (
          <>
            <h2 className="font-display text-2xl leading-tight">{stage === "insecure" ? "This address can't receive them" : "This browser can't do that"}</h2>
            <p className="mt-1.5 text-sm text-ink-soft">
              {stage === "insecure"
                ? "Notifications need a secure connection. Opened from a network address like 192.168.x.x they can't arrive — open Kairo on its own web address instead."
                : kind === "notifications"
                  ? "Notifications aren't supported here. Kairo still keeps the reminder and shows it the next time you open the app."
                  : "This browser has no speech recognition. Typing works everywhere."}
            </p>
            <div className="mt-5 flex justify-end">
              <button onClick={close} className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper">
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/** What the browser already thinks about the microphone, where it will say. */
async function micState(): Promise<PermissionState | "unknown"> {
  try {
    const r = await navigator.permissions?.query({ name: "microphone" as PermissionName });
    return r?.state ?? "unknown";
  } catch {
    return "unknown";
  }
}
