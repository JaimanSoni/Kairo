"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type List, type UserProfile, ALL_SPACES } from "@/lib/types";
import { FEATURE_KEYS } from "@/lib/features";
import { track } from "@/lib/analytics-client";
import { AppProvider, GUEST_CAP_EVENT, GUEST_STORAGE_KEY, GUEST_TASK_CAP, useApp } from "./store";
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
  spaces: ALL_SPACES,
};

/** Starter lists so filing ("#personal") works before any setup. */
const GUEST_LISTS: List[] = [
  { id: "guest-list-personal", name: "Personal", emoji: "🌱", order: 1, locked: false, role: "owner", memberCount: 0 },
  { id: "guest-list-work", name: "Work", emoji: "💼", order: 2, locked: false, role: "owner", memberCount: 0 },
];

/**
 * Task counts that earn an invitation to sign in. Nothing about which of
 * these has fired is written down: the set lives for the life of the tab,
 * and anything already passed when the page loaded counts as spent. A
 * stored counter would drift out of step with the tasks and start asking
 * twice, which is exactly the kind of nagging this app exists to avoid.
 */
const NUDGE_AT = [1, 3, 7, 10];

/**
 * One voice per milestone. Asking the same way four times is nagging; the
 * ask has to earn its place by saying something new each time, and the last
 * one is a warning rather than an invitation.
 */
const NUDGE_COPY: Record<number, { title: string; body: string }> = {
  1: {
    title: "That's one off your mind.",
    body: "It lives in this browser for now. Sign in free and it follows you to every device, with AI capture, reminders and sharing switched on.",
  },
  3: {
    title: "Three down. This is the habit.",
    body: "Signing in takes a moment and keeps all of them: synced everywhere, backed up, and safe from a cleared browser.",
  },
  7: {
    title: "Seven tasks in.",
    body: "You're three away from the guest limit. Sign in free to keep going without a ceiling, and everything you've written comes with you.",
  },
  10: {
    title: "That's your tenth task.",
    body: "Ten is the guest limit, and letting some go doesn't make room for more. Sign in free for unlimited tasks, AI capture, sync, reminders and sharing.",
  },
};

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
  const { state } = useApp();
  const [nudge, setNudge] = useState<number | null>(null);
  const [capOpen, setCapOpen] = useState(false);
  const [errorShown, setErrorShown] = useState(Boolean(authError));
  /** Milestones already spent. Populated on mount from what is already there. */
  const spent = useRef<Set<number> | null>(null);

  const taskCount = useMemo(() => Object.keys(state.tasks).length, [state.tasks]);

  // one line in the ledger per guest: fired on every visit, counted as
  // unique browsers server-side, so no client-side dedup state is needed
  useEffect(() => {
    track("guest-visit");
  }, []);

  // the hard gate: any blocked creation fires this event from the store, so
  // the modal appears exactly when someone runs into the wall — no counters,
  // no flags, nothing stored that could drift out of sync
  useEffect(() => {
    const onCap = () => {
      setCapOpen(true);
      track("guest-cap-hit");
    };
    window.addEventListener(GUEST_CAP_EVENT, onCap);
    return () => window.removeEventListener(GUEST_CAP_EVENT, onCap);
  }, []);

  /**
   * The invitation, at 1, 3, 7 and 10 tasks. A milestone the visitor was
   * already past when they arrived is treated as spent, so a returning guest
   * is never asked about ground they covered yesterday. The pause lets the
   * capture panel finish closing before the invitation slides in.
   */
  useEffect(() => {
    if (spent.current === null) {
      // read the saved slate, not the store: the store hydrates in its own
      // effect, so on this first pass it still reports an empty day and
      // every milestone would look unspent to a returning guest
      let already = 0;
      try {
        const raw = localStorage.getItem(GUEST_STORAGE_KEY);
        const saved = raw ? (JSON.parse(raw) as { tasks?: unknown[] }) : null;
        already = Array.isArray(saved?.tasks) ? saved.tasks.length : 0;
      } catch {
        /* an unreadable slate is a fresh one */
      }
      spent.current = new Set(NUDGE_AT.filter((n) => n <= already));
    }
    if (state.omnibarOpen || state.editingId || capOpen) return;
    const due = NUDGE_AT.find((n) => taskCount >= n && !spent.current?.has(n));
    if (due === undefined) return;
    const t = setTimeout(() => {
      spent.current?.add(due);
      setNudge(due);
      track("guest-signup-nudge", { tasks: due });
    }, 700);
    return () => clearTimeout(t);
  }, [taskCount, state.omnibarOpen, state.editingId, capOpen]);

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

      {capOpen && (
        <Modal onClose={() => setCapOpen(false)}>
          <div className="p-6 text-center">
            <Icon3d name="lock" size={44} className="mx-auto" />
            <h2 className="font-display mt-3 text-2xl tracking-tight">
              That was your {GUEST_TASK_CAP}th task.
            </h2>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-ink-soft">
              The guest slate covers {GUEST_TASK_CAP} tasks, and letting some go doesn&apos;t mint
              new ones. Sign in free and everything opens up: unlimited tasks, AI capture, sync
              on every device, reminders and sharing. Everything you made comes with you.
            </p>
            <a
              href="/api/auth/google"
              data-track="guest-signin"
              className="mt-5 flex w-full items-center justify-center gap-3 rounded-full bg-sun py-2.5 pl-2.5 pr-6 text-sm font-semibold text-on-accent shadow-lg shadow-sun/25 transition-transform active:scale-[0.99]"
            >
              <GoogleBadge size={30} /> Continue with Google, keep my tasks
            </a>
            <button
              onClick={() => setCapOpen(false)}
              className="mt-2 w-full rounded-full px-5 py-2 text-sm font-medium text-ink-faint hover:text-ink"
            >
              Keep browsing
            </button>
          </div>
        </Modal>
      )}

      {nudge !== null && !capOpen && (
        <Modal onClose={() => setNudge(null)}>
          <div className="p-6 text-center">
            <Icon3d name={nudge >= GUEST_TASK_CAP ? "lock" : "party"} size={44} className="mx-auto" />
            <h2 className="font-display mt-3 text-2xl tracking-tight">{NUDGE_COPY[nudge].title}</h2>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-ink-soft">
              {NUDGE_COPY[nudge].body}
            </p>
            <a
              href="/api/auth/google"
              data-track="guest-signin"
              className="mt-5 flex w-full items-center justify-center gap-3 rounded-full bg-sun py-2.5 pl-2.5 pr-6 text-sm font-semibold text-on-accent shadow-lg shadow-sun/25 transition-transform active:scale-[0.99]"
            >
              <GoogleBadge size={30} /> Continue with Google, keep my tasks
            </a>
            <button
              onClick={() => setNudge(null)}
              className="mt-2 w-full rounded-full px-5 py-2 text-sm font-medium text-ink-faint hover:text-ink"
            >
              {nudge >= GUEST_TASK_CAP ? "Keep browsing" : "Not yet"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
