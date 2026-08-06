"use client";

import { useEffect, useMemo, useState } from "react";
import type { List, UserProfile } from "@/lib/types";
import { FEATURE_KEYS } from "@/lib/features";
import { track } from "@/lib/analytics-client";
import { AppProvider, useApp } from "./store";
import { EntitlementsProvider } from "./entitlements";
import { Shell } from "./shell";
import { AppViews } from "./app-views";
import { Icon3d } from "./img3d";
import { Modal } from "./ui";

/**
 * Try-before-signup: the real app on "/", no account needed.
 *
 * The store runs in guest mode (localStorage instead of the network), so a
 * visitor lands inside a working Today view and starts planning immediately.
 * Five tasks in, they are invited to sign in, and GuestSync carries the tasks
 * into the account they create.
 */

export const GUEST_USER: UserProfile = {
  id: "guest",
  email: "",
  name: "Friend",
  appLockEnabled: false,
  isAdmin: false,
  isPaying: false,
  guest: true,
};

/** Starter lists so filing ("#personal") works before any setup. */
const GUEST_LISTS: List[] = [
  { id: "guest-list-personal", name: "Personal", emoji: "🌱", order: 1, locked: false, role: "owner", memberCount: 0 },
  { id: "guest-list-work", name: "Work", emoji: "💼", order: 2, locked: false, role: "owner", memberCount: 0 },
];

const INTRO_SEEN_KEY = "kairo-guest-intro";
const NUDGE_AT_KEY = "kairo-guest-nudged-at";
/** First invitation after this many tasks; again every RENUDGE_EVERY after. */
const NUDGE_AFTER = 5;
const RENUDGE_EVERY = 3;

export function GoogleBadge({ size = 24 }: { size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-white shadow-sm"
      style={{ width: size, height: size }}
    >
      <svg width={Math.round(size * 0.6)} height={Math.round(size * 0.6)} viewBox="0 0 48 48" aria-hidden>
        <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C40.9 35.5 44 30.2 44 24c0-1.3-.1-2.6-.4-3.9z" />
      </svg>
    </span>
  );
}

export function GuestExperience({ authError }: { authError?: string }) {
  return (
    <AppProvider
      guest
      user={GUEST_USER}
      accounts={[]}
      initialTasks={[]}
      initialLists={GUEST_LISTS}
      initialPeople={[]}
    >
      <EntitlementsProvider features={FEATURE_KEYS}>
        <Shell>
          <AppViews />
        </Shell>
        <GuestOverlays authError={authError} />
      </EntitlementsProvider>
    </AppProvider>
  );
}

function GuestOverlays({ authError }: { authError?: string }) {
  const { state, setOmnibar } = useApp();
  const [intro, setIntro] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [errorShown, setErrorShown] = useState(Boolean(authError));

  const taskCount = useMemo(() => Object.keys(state.tasks).length, [state.tasks]);

  // first visit with an empty slate gets the tour; anything else doesn't.
  // The beat of delay lets the app render behind it, so the tour visibly
  // introduces a real product instead of a blank screen.
  useEffect(() => {
    if (authError) return;
    try {
      if (localStorage.getItem(INTRO_SEEN_KEY)) return;
      if (localStorage.getItem("kairo-guest-v1")) return;
    } catch {}
    const t = setTimeout(() => {
      setIntro(true);
      track("guest-intro-shown");
    }, 500);
    return () => clearTimeout(t);
  }, [authError]);

  const closeIntro = (thenCapture: boolean) => {
    try {
      localStorage.setItem(INTRO_SEEN_KEY, "1");
    } catch {}
    setIntro(false);
    if (thenCapture) {
      track("guest-intro-capture");
      setOmnibar(true);
    }
  };

  // the invitation: at five tasks, then again every few more. The pause lets
  // the capture panel finish closing before the invitation slides in.
  useEffect(() => {
    if (taskCount < NUDGE_AFTER || state.omnibarOpen || state.editingId || intro) return;
    let lastNudgedAt = 0;
    try {
      lastNudgedAt = Number(localStorage.getItem(NUDGE_AT_KEY)) || 0;
    } catch {}
    if (lastNudgedAt !== 0 && taskCount < lastNudgedAt + RENUDGE_EVERY) return;
    const t = setTimeout(() => {
      setNudge(true);
      track("guest-signup-nudge", { tasks: taskCount });
      try {
        localStorage.setItem(NUDGE_AT_KEY, String(taskCount));
      } catch {}
    }, 700);
    return () => clearTimeout(t);
  }, [taskCount, state.omnibarOpen, state.editingId, intro]);

  return (
    <>
      {errorShown && (
        <div className="fixed inset-x-0 top-3 z-[70] mx-auto w-[min(94%,30rem)]">
          <div className="anim-pop flex items-start gap-3 rounded-2xl border border-clay/40 bg-card px-5 py-3.5 text-sm shadow-lg">
            <span className="min-w-0 flex-1">
              Sign-in didn&apos;t go through. Your tasks here are untouched, try again whenever
              you&apos;re ready.
            </span>
            <button
              onClick={() => setErrorShown(false)}
              aria-label="Dismiss"
              className="shrink-0 font-semibold text-ink-faint hover:text-ink"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {intro && (
        <Modal onClose={() => closeIntro(false)}>
          <div className="p-6 text-center">
            <Icon3d name="sparkle" size={44} className="mx-auto" />
            <h2 className="font-display mt-3 text-2xl tracking-tight">This is Kairo. Try it.</h2>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-ink-soft">
              No account needed, your tasks live in this browser until you want them everywhere.
            </p>
            <div className="mt-5 space-y-2.5 text-left">
              {[
                { icon: "feather", title: "Say it messy", body: "One sentence, even several things at once. Kairo files it into real tasks." },
                { icon: "sun", title: "Pick 3 that matter", body: "Today holds what you chose for today. Never the whole pile." },
                { icon: "sunrise", title: "Mornings forgive", body: "Yesterday's leftovers come back once, gently. Nothing ever turns red." },
              ].map((f) => (
                <div key={f.title} className="flex items-start gap-3 rounded-2xl border border-line bg-paper-deep/40 p-3.5">
                  <Icon3d name={f.icon} size={26} className="mt-0.5 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold">{f.title}</div>
                    <div className="text-[13px] leading-5 text-ink-soft">{f.body}</div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => closeIntro(true)}
              autoFocus
              className="mt-5 w-full rounded-full bg-sun px-5 py-3 text-sm font-semibold text-on-accent shadow-lg shadow-sun/25 transition-transform active:scale-[0.99]"
            >
              Capture your first thought
            </button>
            <button
              onClick={() => closeIntro(false)}
              className="mt-2 w-full rounded-full px-5 py-2 text-sm font-medium text-ink-faint hover:text-ink"
            >
              Just look around
            </button>
          </div>
        </Modal>
      )}

      {nudge && (
        <Modal onClose={() => setNudge(false)}>
          <div className="p-6 text-center">
            <Icon3d name="party" size={44} className="mx-auto" />
            <h2 className="font-display mt-3 text-2xl tracking-tight">
              {taskCount} tasks. You&apos;re really doing this.
            </h2>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-ink-soft">
              Right now they live only in this browser. Sign in free and they come with you,
              synced to every device, with AI capture, reminders and sharing switched on.
            </p>
            <a
              href="/api/auth/google"
              data-track="guest-signin"
              className="mt-5 flex w-full items-center justify-center gap-3 rounded-full bg-sun py-2.5 pl-2.5 pr-6 text-sm font-semibold text-on-accent shadow-lg shadow-sun/25 transition-transform active:scale-[0.99]"
            >
              <GoogleBadge size={30} /> Continue with Google, keep my tasks
            </a>
            <button
              onClick={() => setNudge(false)}
              className="mt-2 w-full rounded-full px-5 py-2 text-sm font-medium text-ink-faint hover:text-ink"
            >
              Not yet
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
