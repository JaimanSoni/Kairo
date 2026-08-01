"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { hiddenListIds, useApp } from "./store";
import { navigateApp } from "./app-views";
import { animalAvatar } from "@/lib/avatars";
import { upgradeHref, useCan } from "./entitlements";
import { registerServiceWorker } from "@/lib/push-client";
import { playNotify } from "@/lib/sound";
import { Omnibar } from "./omnibar";
import { TaskEditor } from "./task-editor";
import { FocusOverlay } from "./focus";
import { AppLockGate, AppLockModal, type AppLockMode } from "./app-lock";
import { CommandPalette } from "./command-palette";
import { ThemeToggle } from "./theme";
import { CoffeeButton, CoffeeNudge } from "./coffee";
import { SubscriptionSettings } from "./subscription-settings";
import { ShareKairoRow } from "./share-kairo";
import { Mark } from "./mark";
import { IconBook, IconCalendar, IconInbox, IconPlus, IconSun, IconX, Kbd, Modal } from "./ui";

const NAV = [
  { href: "/today", label: "Today", icon: IconSun, key: "1" },
  { href: "/calendar", label: "Calendar", icon: IconCalendar, key: "2" },
  { href: "/lists", label: "Lists", icon: IconInbox, key: "3" },
  { href: "/log", label: "Log", icon: IconBook, key: "4" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { state, setOmnibar } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const inboxCount = useMemo(() => {
    const hidden = hiddenListIds(state);
    return Object.values(state.tasks).filter(
      (t) => t.status === "inbox" && !(t.listId && hidden.has(t.listId))
    ).length;
  }, [state]);

  // service worker for web push (timer-end notifications)
  useEffect(() => {
    registerServiceWorker();
  }, []);

  // when a push arrives while a tab is open, play the in-app chime
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      if ((e.data as { type?: string })?.type === "kairo-push") playNotify();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  // app-wide keyboard shortcuts (dead while the app-lock gate is up)
  const appLocked = state.appLocked;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (appLocked) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }

      const target = e.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "n" || e.key === "c") {
        e.preventDefault();
        setOmnibar(true);
      }
      const nav = NAV.find((n) => n.key === e.key);
      if (nav) navigateApp(nav.href);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router, setOmnibar, appLocked]);

  const editingTask = state.editingId ? state.tasks[state.editingId] : null;

  /* The morning sweep only renders on Today, so it only blocks there. */
  const sweepPending = useMemo(
    () =>
      !state.sweepDismissed &&
      pathname.startsWith("/today") &&
      Object.values(state.tasks).some(
        (t) => t.status === "planned" && t.plannedFor && t.plannedFor < state.today
      ),
    [state.tasks, state.sweepDismissed, state.today, pathname]
  );

  /* Anything the coffee nudge should wait behind rather than interrupt. */
  const somethingOnScreen =
    paletteOpen ||
    profileOpen ||
    state.omnibarOpen ||
    state.appLocked ||
    Boolean(editingTask) ||
    Boolean(state.focus) ||
    sweepPending;

  return (
    <div className="flex min-h-dvh w-full">
      {/* sidebar — desktop */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-paper-deep/40 px-4 py-6 md:flex">
        <Link href="/today" className="flex items-center gap-2 px-2 text-lg font-bold tracking-tight">
          <Mark size={20} className="text-sun" /> kairo
        </Link>

        <button
          onClick={() => setOmnibar(true)}
          className="mt-6 flex items-center justify-between rounded-xl bg-sun px-3.5 py-2.5 text-sm font-bold text-on-accent shadow-lg shadow-sun/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-sun/30"
        >
          <span className="flex items-center gap-2">
            <IconPlus size={15} /> Capture
          </span>
          <Kbd>N</Kbd>
        </button>

        <button
          onClick={() => setPaletteOpen(true)}
          className="mt-2 flex items-center justify-between rounded-xl border border-line bg-card/60 px-3.5 py-2 text-sm text-ink-faint transition-colors hover:border-ink-faint hover:text-ink-soft"
        >
          <span className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Search
          </span>
          <Kbd>⌘K</Kbd>
        </button>

        <WorkingOn className="mt-4" />

        <nav className="mt-6 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={(e) => {
                  // a view swap, not a server round trip; the href stays for
                  // middle-click, copy-link and everything else a real link does
                  e.preventDefault();
                  navigateApp(href);
                }}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-card text-ink shadow-sm" : "text-ink-soft hover:bg-card/60"
                }`}
              >
                <Icon size={16} className={active ? "text-sun-deep" : ""} />
                {label}
                {href === "/lists" && inboxCount > 0 && (
                  <span className="ml-auto rounded-full bg-paper-deep px-2 py-0.5 text-xs text-ink-soft">
                    {inboxCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3">
          <ThemeToggle />
          {/* opens the full settings sheet — notifications, app lock, accounts */}
          <button
            onClick={() => setProfileOpen(true)}
            className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-card/60"
          >
            <Avatar name={state.user.name} picture={state.user.picture} size={8} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{state.user.name}</span>
              <span className="block text-xs text-ink-faint">Settings &amp; accounts</span>
            </span>
            <span className="shrink-0 text-ink-faint" aria-hidden>
              →
            </span>
          </button>
        </div>
      </aside>

      {/* main */}
      <main className="min-w-0 flex-1">
        {/* top bar — mobile only */}
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper/90 px-4 pb-2 pt-[max(0.6rem,env(safe-area-inset-top))] backdrop-blur md:hidden">
          <Link href="/today" className="flex items-center gap-1.5 text-base font-bold tracking-tight">
            <Mark size={17} className="text-sun" /> kairo
          </Link>
          <span className="flex items-center gap-3">
            <button
              onClick={() => setPaletteOpen(true)}
              aria-label="Search"
              data-tip="Search"
              data-tip-side="bottom"
              className="grid size-8 place-items-center rounded-full text-ink-soft hover:bg-paper-deep"
            >
              <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <button
              onClick={() => setProfileOpen(true)}
              aria-label="Profile and settings"
              data-tip="Profile and settings"
              data-tip-side="bottom"
            >
              <Avatar name={state.user.name} picture={state.user.picture} size={8} />
            </button>
          </span>
        </div>

        {/* on a phone the sidebar isn't there to hold it */}
        <WorkingOn className="mx-4 mt-2 md:hidden" />

        {children}
      </main>

      {/* bottom nav — mobile: strict 5-column grid keeps the + dead center */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 items-center border-t border-line bg-card/95 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
        {NAV.slice(0, 2).map(({ href, label, icon: Icon }) => (
          <MobileTab key={href} href={href} label={label} Icon={Icon} active={pathname.startsWith(href)} />
        ))}
        <div className="flex justify-center">
          <button
            onClick={() => setOmnibar(true)}
            aria-label="Capture, AI sorts the details"
            className="grid size-12 -translate-y-3 place-items-center rounded-full bg-gradient-to-br from-sun to-sky text-on-accent shadow-lg shadow-sun/35 transition-transform active:scale-95"
          >
            {/* sparkle — capture is AI-assisted */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2c.7 5.2 4.8 9.3 10 10-5.2.7-9.3 4.8-10 10-.7-5.2-4.8-9.3-10-10 5.2-.7 9.3-4.8 10-10z" />
            </svg>
          </button>
        </div>
        {NAV.slice(2).map(({ href, label, icon: Icon }) => (
          <MobileTab key={href} href={href} label={label} Icon={Icon} active={pathname.startsWith(href)} />
        ))}
      </nav>

      {/* overlays */}
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      {state.omnibarOpen && <Omnibar />}
      {editingTask && <TaskEditor key={editingTask.id} task={editingTask} />}
      {profileOpen && (
        <ProfileSheet
          name={state.user.name}
          email={state.user.email}
          picture={state.user.picture}
          onClose={() => setProfileOpen(false)}
        />
      )}
      <FocusOverlay />
      <AppLockGate />
      {!state.user.isPaying && <CoffeeNudge busy={somethingOnScreen} today={state.today} />}

      {/* toast */}
      {state.toast && (
        <div className="anim-pop fixed bottom-20 left-1/2 z-50 w-max max-w-[92vw] -translate-x-1/2 md:bottom-8">
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-ink px-5 py-2.5 text-sm text-paper shadow-lg">
            {state.toast.message}
            {state.toast.action && (
              <button
                onClick={state.toast.action.run}
                className="font-bold text-sun-soft underline underline-offset-2"
              >
                {state.toast.action.label}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Avatar({ name, picture, size }: { name: string; picture?: string; size: 8 | 12 }) {
  const cls = size === 12 ? "size-12" : "size-8";
  return picture ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={picture} alt="" className={`${cls} rounded-full`} referrerPolicy="no-referrer" />
  ) : (
    <span className={`grid ${cls} place-items-center overflow-hidden rounded-full bg-sun-soft`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={animalAvatar(name)} alt="" className="size-full object-contain p-[5%]" />
    </span>
  );
}

function ProfileSheet({
  name,
  email,
  picture,
  onClose,
}: {
  name: string;
  email: string;
  picture?: string;
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center gap-3">
          <Avatar name={name} picture={picture} size={12} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-bold">{name}</div>
            <div className="truncate text-sm text-ink-soft">{email}</div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-faint hover:bg-paper-deep" aria-label="Close" data-tip="Close">
            <IconX />
          </button>
        </div>

        <div className="mt-6">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Appearance
          </div>
          <ThemeToggle />
        </div>

        <NotificationSettings />

        <AppLockSettings />

        <SubscriptionSettings />

        <AccountSwitcher />

        <Link
          href="/support"
          className="mt-6 flex items-center justify-between rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:border-sun hover:text-sun-deep"
        >
          Help &amp; guides
          <span aria-hidden>→</span>
        </Link>

        <ShareKairoRow />

        <AdminLink />

        <CoffeeRow />

        <form action="/api/auth/signout" method="POST" className="mt-6 border-t border-line pt-4">
          <button
            type="submit"
            className="w-full rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-semibold text-clay transition-colors hover:border-clay hover:bg-clay-soft"
          >
            Sign out of this account
          </button>
        </form>

        {/* "/" redirects to /today once you're signed in, so this is the only
            way back to the landing page without signing out */}
        <div className="mt-4 text-center">
          <Link
            href="/home"
            onClick={onClose}
            className="text-xs text-ink-faint underline-offset-2 transition-colors hover:text-ink-soft hover:underline"
          >
            View the home page
          </Link>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Only rendered for admins — but this is convenience, not security. The
 * /admin segment authorises every request server-side, so hand-typing the URL
 * gets a 404 for anyone else.
 */
function AdminLink() {
  const { state } = useApp();
  if (!state.user.isAdmin) return null;
  return (
    <Link
      href="/admin/dashboard"
      className="mt-3 flex w-full items-center justify-between rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:border-sun hover:text-sun-deep"
    >
      <span className="flex items-center gap-2">
        <span className="rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-paper">
          admin
        </span>
        Dashboard
      </span>
      <span aria-hidden>→</span>
    </Link>
  );
}

/** The tip jar, hidden from anyone who already pays for Kairo. */
/**
 * What you're working on, from anywhere.
 *
 * The state was previously invisible the moment you left the page holding the
 * task, which made starting one pointless — you had to remember what you'd
 * started. This is the thread back to it.
 */
function WorkingOn({ className = "" }: { className?: string }) {
  const { state, setEditing, toggleStarted } = useApp();
  const task = useMemo(
    () => Object.values(state.tasks).find((t) => t.startedAt && t.status !== "done"),
    [state.tasks]
  );
  if (!task) return null;

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border border-sky/40 bg-sky-soft/50 px-3 py-2 ${className}`}
    >
      <span className="anim-pulse shrink-0 text-sky" aria-hidden>
        ●
      </span>
      <button
        onClick={() => setEditing(task.id)}
        className="min-w-0 flex-1 text-left"
        data-tip="Open this task"
      >
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-sky">
          Working on
        </span>
        <span className="block truncate text-xs font-medium text-ink">{task.title}</span>
      </button>
      <button
        onClick={() => toggleStarted(task.id)}
        aria-label="Stop working on this"
        data-tip="Stop working on this"
        className="grid size-6 shrink-0 place-items-center rounded-full text-sky transition-colors hover:bg-sky hover:text-on-accent"
      >
        <svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
          <rect x="2.5" y="2.5" width="7" height="7" rx="1.5" />
        </svg>
      </button>
    </div>
  );
}

function CoffeeRow() {
  const { state } = useApp();
  if (state.user.isPaying) return null;
  return <CoffeeButton variant="row" />;
}

function NotificationSettings() {
  const [status, setStatus] = useState<"loading" | "enabled" | "disabled" | "denied" | "unsupported" | "insecure">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("@/lib/push-client").then(async ({ pushPermission, pushEnabled }) => {
      const insecure = typeof window !== "undefined" && window.isSecureContext === false;
      const perm = pushPermission();
      const next = insecure
        ? ("insecure" as const)
        : perm === "unsupported"
          ? ("unsupported" as const)
          : perm === "denied"
            ? ("denied" as const)
            : (await pushEnabled())
              ? ("enabled" as const)
              : ("disabled" as const);
      if (!cancelled) setStatus(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const { enablePush, disablePush } = await import("@/lib/push-client");
    if (status === "enabled") {
      await disablePush();
      setStatus("disabled");
    } else {
      const result = await enablePush();
      if (result.status === "enabled") setStatus("enabled");
      else if (result.status === "denied") setStatus("denied");
      else if (result.status === "insecure") setStatus("insecure");
      else if (result.status === "unsupported") setStatus("unsupported");
      else {
        setStatus("disabled");
        setError(`Couldn't enable: ${result.detail}`);
      }
    }
    setBusy(false);
  };

  return (
    <div className="mt-6">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
        Notifications
      </div>
      {status === "insecure" ? (
        <p className="text-sm text-ink-faint">
          Push needs a secure connection (HTTPS or localhost). Opening Kairo via a LAN IP like
          192.168.x.x can&apos;t receive notifications, use it on this machine at localhost, or host it
          with HTTPS.
        </p>
      ) : status === "unsupported" ? (
        <p className="text-sm text-ink-faint">
          This browser doesn&apos;t support push notifications. On iPhone, install Kairo to the home
          screen first (Share → Add to Home Screen), then enable from inside the installed app.
        </p>
      ) : status === "denied" ? (
        <p className="text-sm text-ink-faint">
          Blocked, allow notifications for this site in your browser settings (tap the lock icon
          in the address bar), then try again.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-ink-soft">Get notified when a focus timer ends.</p>
            <button
              onClick={toggle}
              disabled={status === "loading" || busy}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                status === "enabled"
                  ? "bg-sun-soft text-sun-deep"
                  : "border border-line bg-card text-ink-soft hover:border-sun hover:text-sun-deep"
              }`}
            >
              {busy ? "…" : status === "enabled" ? "On ✓" : "Enable"}
            </button>
          </div>
          {status === "enabled" && (
            <button
              onClick={async () => {
                const res = await fetch("/api/push/test", { method: "POST" });
                setError(res.ok ? null : "Test send failed, check the server logs");
              }}
              className="mt-2 text-xs font-medium text-ink-faint underline hover:text-ink"
            >
              Send a test notification
            </button>
          )}
          {error && (
            <p className="mt-2 text-xs text-clay">{error}</p>
          )}
        </>
      )}
    </div>
  );
}

function AppLockSettings() {
  const { state, lockApp } = useApp();
  const can = useCan();
  const [modal, setModal] = useState<AppLockMode | null>(null);
  const enabled = state.user.appLockEnabled;
  // An existing lock stays fully usable after a downgrade — including removing
  // it. Only setting a new one is gated, which is also how the API behaves.
  const canSetUp = can("app-lock");

  return (
    <div className="mt-6">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
        App lock
      </div>
      {enabled ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-ink-soft">PIN lock is on.</p>
          <span className="flex flex-wrap gap-1.5">
            <button
              onClick={lockApp}
              className="rounded-full bg-sun-soft px-4 py-1.5 text-xs font-semibold text-sun-deep"
            >
              🔒 Lock now
            </button>
            <button
              onClick={() => setModal("change")}
              className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-ink-faint"
            >
              Change PIN
            </button>
            <button
              onClick={() => setModal("remove")}
              className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-clay hover:text-clay"
            >
              Remove
            </button>
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-ink-soft">
            Lock Kairo behind a numeric PIN.
            {!canSetUp && (
              <span className="block text-xs text-ink-faint">
                Locking individual lists stays available on every plan.
              </span>
            )}
          </p>
          {canSetUp ? (
            <button
              onClick={() => setModal("set")}
              className="shrink-0 rounded-full border border-line bg-card px-4 py-1.5 text-xs font-semibold text-ink-soft hover:border-sun hover:text-sun-deep"
            >
              Set up
            </button>
          ) : (
            <Link
              href={upgradeHref("app-lock")}
              className="shrink-0 rounded-full border border-sun/50 bg-sun-soft px-4 py-1.5 text-xs font-semibold text-sun-deep"
            >
              Upgrade
            </Link>
          )}
        </div>
      )}
      {modal && <AppLockModal mode={modal} onClose={() => setModal(null)} />}
    </div>
  );
}

function AccountSwitcher() {
  const { state } = useApp();
  const can = useCan();
  const canMultiAccount = can("multi-account");
  const [busy, setBusy] = useState<string | null>(null);

  const switchTo = async (userId: string) => {
    if (busy) return;
    setBusy(userId);
    try {
      const res = await fetch("/api/auth/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        // full reload: the new account's data, lock state, and theme apply cleanly
        window.location.assign("/today");
        return;
      }
    } catch {}
    setBusy(null);
  };

  return (
    <div className="mt-6">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
        Accounts
      </div>
      <div className="space-y-1.5">
        {state.accounts.map((a) => {
          const current = a.id === state.user.id;
          return (
            <button
              key={a.id}
              onClick={() => !current && switchTo(a.id)}
              disabled={current || busy !== null}
              className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors ${
                current
                  ? "border-sun/50 bg-sun-soft/50"
                  : "border-line bg-card hover:border-ink-faint"
              }`}
            >
              <Avatar name={a.name} picture={a.picture} size={8} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{a.name}</span>
                <span className="block truncate text-xs text-ink-faint">{a.email}</span>
              </span>
              {current ? (
                <span className="shrink-0 text-xs font-semibold text-sun-deep">✓ current</span>
              ) : (
                <span className="shrink-0 text-xs font-medium text-ink-faint">
                  {busy === a.id ? "…" : "Switch"}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {/* Still offered when the plan doesn't include it, but it goes to the
          upgrade page instead of the sign-in flow — a control that vanishes is
          harder to understand than one that explains itself. The sign-in
          callback refuses the second account regardless. */}
      <a
        href={canMultiAccount ? "/api/auth/google" : upgradeHref("multi-account")}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line px-3 py-2 text-center text-sm font-medium text-ink-soft transition-colors hover:border-sun hover:text-sun-deep"
      >
        + Add another account
        {!canMultiAccount && (
          <span className="rounded-full bg-sun-soft px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sun-deep">
            Upgrade
          </span>
        )}
      </a>
    </div>
  );
}

function MobileTab({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: (p: { size?: number; className?: string }) => React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={(e) => {
        e.preventDefault();
        navigateApp(href);
      }}
      className={`flex flex-col items-center gap-0.5 py-1 text-[10px] font-medium ${
        active ? "text-sun-deep" : "text-ink-faint"
      }`}
    >
      <Icon size={18} />
      {label}
    </Link>
  );
}
