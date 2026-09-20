"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { hiddenListIds, useApp } from "./store";
import { navigateApp } from "./app-views";
import { upgradeHref, useCan } from "./entitlements";
import { animalAvatar } from "@/lib/avatars";
import { track } from "@/lib/analytics-client";
import { registerServiceWorker, syncPushSubscription } from "@/lib/push-client";
import { playNotify } from "@/lib/sound";
import { Omnibar } from "./omnibar";
import { QuickCreate } from "./quick-create";
import { TaskEditor } from "./task-editor";
import { FocusOverlay } from "./focus";
import { PermissionAsk } from "./permission-ask";
import { AppLockGate } from "./app-lock";
import { CommandPalette } from "./command-palette";
import { ThemeToggle } from "./theme";
import { CoffeeNudge } from "./coffee";
import { Mark } from "./mark";
import { IconPlus, Kbd } from "./ui";
import { gardenStore } from "@/lib/habits-client";
import { numberedPages, SPACES, TODAY, visibleSpaces, type NavItem } from "./places";
import { Welcome } from "./welcome";

const inItem = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);
const spaceOf = (pathname: string) => SPACES.find((s) => s.items.some((i) => inItem(pathname, i.href))) ?? null;

/** Where a space's tab goes: the page of it last open on this device, or its first. */
function spaceHref(space: (typeof SPACES)[number]): string {
  try {
    const last = localStorage.getItem(`kairo-space:${space.id}`);
    if (last && space.items.some((i) => i.href === last)) return last;
  } catch {
    // no storage, no memory: the space's first page
  }
  return space.items[0].href;
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { state, setOmnibar } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  // the account menu, opened from the phone's top bar or the foot of the sidebar
  const [menu, setMenu] = useState<"top" | "side" | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const guest = Boolean(state.user.guest);
  const prefs = state.user.spaces;
  const spaces = useMemo(() => visibleSpaces(prefs), [prefs]);

  const inboxCount = useMemo(() => {
    const hidden = hiddenListIds(state);
    return Object.values(state.tasks).filter(
      (t) => t.status === "inbox" && !(t.listId && hidden.has(t.listId))
    ).length;
  }, [state]);

  useEffect(() => {
    const space = spaceOf(pathname);
    const item = space?.items.find((i) => inItem(pathname, i.href));
    if (!space || !item || space.items.length < 2) return;
    try {
      localStorage.setItem(`kairo-space:${space.id}`, item.href);
    } catch {
      // a private window forgets, which is fine
    }
  }, [pathname]);

  // service worker for web push; and each time the app opens, this device makes sure the server can still reach it
  useEffect(() => {
    void registerServiceWorker().then(() => syncPushSubscription());
  }, []);

  // The admin's browser opts itself out of every tracker, first-party and
  // third-party alike. The flag deliberately outlives sign-out: the same
  // machine browsing the landing page later is still the team.
  const isAdmin = state.user.isAdmin;
  useEffect(() => {
    if (!isAdmin) return;
    try {
      localStorage.setItem("kairo-notrack", "1");
    } catch {
      // private mode without storage just falls back to the server-side guard
    }
  }, [isAdmin]);

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
  const today = state.today;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (appLocked) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        // tracked out here: state updaters must stay pure, React re-invokes
        // them and every re-invocation was another counted event
        track("search-open");
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
      // J goes straight to today's page, the way N goes straight to capture (while the journal is kept)
      if (e.key === "j" && prefs.journal) {
        e.preventDefault();
        navigateApp(`/journal/${today}`);
        return;
      }
      // numbers follow the sidebar, so a hidden place leaves no gap
      const nav = numberedPages(prefs).find((n) => n.key === e.key);
      if (nav) navigateApp(nav.href);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router, setOmnibar, appLocked, today, prefs]);

  const editingTask = state.editingId ? state.tasks[state.editingId] : null;

  /* Anything the coffee nudge should wait behind rather than interrupt. */
  const somethingOnScreen =
    paletteOpen ||
    menu !== null ||
    state.omnibarOpen ||
    state.appLocked ||
    Boolean(editingTask) ||
    Boolean(state.focus);

  return (
    <div className="flex min-h-dvh w-full">
      {/* sidebar — desktop */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-paper-deep/40 px-4 py-6 md:flex">
        <Link href="/today" className="flex items-center gap-2 px-2 text-lg font-bold tracking-tight">
          <Mark size={20} className="text-sun" /> kairo
        </Link>

        <button
          onClick={() => setOmnibar(true)}
          data-track="capture-open"
          className="mt-6 flex items-center justify-between rounded-xl bg-sun px-3.5 py-2.5 text-sm font-bold text-on-accent shadow-lg shadow-sun/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-sun/30"
        >
          <span className="flex items-center gap-2">
            <IconPlus size={15} /> Capture
          </span>
          <Kbd>N</Kbd>
        </button>

        <button
          onClick={() => setPaletteOpen(true)}
          data-track="search-open"
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

        <nav className="mt-6" aria-label="Kairo">
          <SideLink item={TODAY} pathname={pathname} />
          {navBlocks(spaces).map((block) => (
            <div
              key={block.key}
              className={block.label ? "mt-4" : "mx-0 mt-4 border-t border-line/70 pt-3"}
              role="group"
              aria-labelledby={block.label ? `space-${block.key}` : undefined}
              aria-label={block.label ? undefined : block.items.map((i) => i.label).join(", ")}
            >
              {/* a place with several pages gets a heading; places of one page sit together under a rule */}
              {block.label && (
                <div id={`space-${block.key}`} className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                  {block.label}
                </div>
              )}
              <div className="space-y-0.5">
                {block.items.map((item) => (
                  <SideLink key={item.href} item={item} pathname={pathname}>
                    {item.href === "/lists" && inboxCount > 0 && (
                      <span className="ml-auto rounded-full bg-paper-deep px-2 py-0.5 text-xs text-ink-soft">{inboxCount}</span>
                    )}
                    {item.href === "/habits" && <GardenDot inline />}
                  </SideLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto space-y-3">
          <ThemeToggle />
          {guest ? (
            /* a guest's bottom corner sells the one thing they can't do yet */
            <div className="rounded-2xl border border-sun/40 bg-sun-soft/40 p-3">
              <p className="text-xs leading-5 text-ink-soft">
                Your tasks live in this browser. Sign in and they follow you everywhere.
              </p>
              <a
                href="/api/auth/google"
                data-track="guest-signin"
                className="mt-2.5 flex items-center justify-center gap-2 rounded-full bg-ink py-1.5 pl-1.5 pr-4 text-sm font-semibold text-paper transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <GoogleChip size={24} /> Sign in free
              </a>
              <Link href="/support" className="mt-2 flex items-center justify-center gap-1.5 text-xs font-medium text-ink-soft hover:text-ink" data-help-link>
                Help &amp; guides
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-1">
            {/* the account menu: Settings, help, other accounts, sign out */}
            <button
              onClick={() => setMenu((m) => (m === "side" ? null : "side"))}
              aria-haspopup="menu"
              aria-expanded={menu === "side"}
              className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-card/60 ${menu === "side" || pathname === "/settings" ? "bg-card shadow-sm" : ""}`}
              data-account-button
            >
              <Avatar name={state.user.name} picture={state.user.picture} size={8} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{state.user.name}</span>
                <span className="block truncate text-xs text-ink-faint">Settings</span>
              </span>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0 text-ink-faint" aria-hidden>
                <path d="M4.5 10l3.5-3.5 3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <HelpLink className="size-10 rounded-xl text-ink-faint hover:bg-card/60 hover:text-ink" />
            </div>
          )}
        </div>
      </aside>

      {/* main */}
      <main className="min-w-0 flex-1">
        {/* top bar — mobile only */}
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper/90 px-4 pb-2 pt-[max(0.6rem,env(safe-area-inset-top))] backdrop-blur md:hidden">
          <Link href="/today" className="flex items-center gap-1.5 text-base font-bold tracking-tight">
            <Mark size={17} className="text-sun" /> kairo
          </Link>
          <span className="flex items-center gap-2">
            <button
              onClick={() => setPaletteOpen(true)}
              aria-label="Search"
              data-track="search-open"
              data-tip="Search"
              data-tip-side="bottom"
              className="grid size-8 place-items-center rounded-full text-ink-soft hover:bg-paper-deep"
            >
              <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <HelpLink className="size-8 rounded-full text-ink-soft hover:bg-paper-deep" />
            {guest ? (
              <a
                href="/api/auth/google"
                data-track="guest-signin"
                className="flex items-center gap-1.5 rounded-full bg-ink py-1 pl-1 pr-3 text-xs font-semibold text-paper"
              >
                <GoogleChip size={20} /> Sign in
              </a>
            ) : (
              <button
                onClick={() => setMenu((m) => (m === "top" ? null : "top"))}
                aria-label="Profile and settings"
                aria-haspopup="menu"
                aria-expanded={menu === "top"}
                data-tip="Profile and settings"
                data-tip-side="bottom"
              >
                <Avatar name={state.user.name} picture={state.user.picture} size={8} />
              </button>
            )}
          </span>
        </div>

        {/* on a phone the sidebar isn't there to hold it */}
        <WorkingOn className="mx-4 mt-2 md:hidden" />
        <SpaceSwitch pathname={pathname} spaces={spaces} />

        {children}
      </main>

      {/* bottom nav — mobile: strict 5-column grid keeps the + dead center */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 items-center border-t border-line bg-card/95 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
        <MobileTab href={TODAY.href} label={TODAY.label} Icon={TODAY.icon} active={inItem(pathname, TODAY.href) || pathname === "/"} />
        <SpaceTab space={spaces[0]} pathname={pathname} />
        <div className="flex justify-center">
          <button
            onClick={() => setOmnibar(true)}
            aria-label="Capture, AI sorts the details"
            data-track="capture-open"
            className="grid size-12 -translate-y-3 place-items-center rounded-full bg-gradient-to-br from-sun to-sky text-on-accent shadow-lg shadow-sun/35 transition-transform active:scale-95"
          >
            {/* sparkle — capture is AI-assisted */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2c.7 5.2 4.8 9.3 10 10-5.2.7-9.3 4.8-10 10-.7-5.2-4.8-9.3-10-10 5.2-.7 9.3-4.8 10-10z" />
            </svg>
          </button>
        </div>
        {/* two places sit right of Capture; a hidden one leaves its cell empty, so Capture stays centred */}
        {[spaces[1], spaces[2]].map((space, i) =>
          space ? (
            <SpaceTab key={space.id} space={space} pathname={pathname}>
              {space.id === "grow" && <GardenDot />}
            </SpaceTab>
          ) : (
            <span key={`empty-${i}`} aria-hidden />
          )
        )}
      </nav>

      {/* the plus in the corner: a new task or a new note, from anywhere */}
      <QuickCreate />

      {/* overlays */}
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      {state.omnibarOpen && <Omnibar />}
      {editingTask && <TaskEditor key={editingTask.id} task={editingTask} />}
      {menu && !guest && <AccountMenu placement={menu} onClose={() => setMenu(null)} />}
      <FocusOverlay />
      <AppLockGate />
      <PermissionAsk />
      {!state.user.isPaying && !guest && <CoffeeNudge busy={somethingOnScreen || Boolean(state.user.welcome)} today={state.today} />}
      {state.user.welcome && !guest && !state.appLocked && <Welcome />}

      {/* toast — above the focus pill when there is one, never over it */}
      {state.toast && (
        <div
          className={`anim-pop fixed left-1/2 z-[70] w-max max-w-[92vw] -translate-x-1/2 ${
            state.focus?.minimized ? "bottom-[9rem] md:bottom-[5.25rem]" : "bottom-20 md:bottom-8"
          }`}
        >
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

/** Help & guides, as a question mark: beside you on a phone, at the foot of the sidebar on a computer. */
function HelpLink({ className }: { className: string }) {
  return (
    <Link href="/support" aria-label="Help and guides" data-tip="Help and guides" data-tip-side="bottom" data-help-link className={`grid shrink-0 place-items-center transition-colors ${className}`}>
      <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6.25 6.25a1.8 1.8 0 0 1 3.5.55c0 1.2-1.75 1.5-1.75 2.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="8" cy="11.6" r="0.85" fill="currentColor" />
      </svg>
    </Link>
  );
}

/**
 * The account menu: who you are, the way to Settings and to help, your other
 * accounts one tap away, and signing out. Everything else lives on the
 * Settings page, where it has room to explain itself.
 */
function AccountMenu({ placement, onClose }: { placement: "top" | "side"; onClose: () => void }) {
  const { state, lockApp } = useApp();
  const can = useCan();
  const canMultiAccount = can("multi-account");
  const [busy, setBusy] = useState<string | null>(null);
  const others = state.accounts.filter((a) => a.id !== state.user.id);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const switchTo = async (userId: string) => {
    if (busy) return;
    setBusy(userId);
    try {
      const res = await fetch("/api/auth/switch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
      if (res.ok) {
        // leaving an account ends its unlocked session, so switching back to a locked one asks for its PIN again
        try {
          sessionStorage.removeItem(`kairo-applock:${state.user.id}`);
        } catch {}
        window.location.assign("/today");
        return;
      }
    } catch {}
    setBusy(null);
  };

  const item = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-ink transition-colors hover:bg-paper-deep";
  return (
    <>
      <button type="button" aria-label="Close the menu" tabIndex={-1} onClick={onClose} className="fixed inset-0 z-[55] cursor-default" />
      <div
        role="menu"
        aria-label="Account"
        className={`anim-pop fixed z-[56] w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-line bg-card p-1.5 shadow-2xl shadow-ink/15 ${
          placement === "top" ? "right-3 top-[calc(max(0.6rem,env(safe-area-inset-top))+2.9rem)]" : "bottom-[5.25rem] left-4"
        }`}
        data-account-menu
      >
        <div className="flex items-center gap-3 px-3 pb-3 pt-2.5">
          <Avatar name={state.user.name} picture={state.user.picture} size={12} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{state.user.name}</span>
            <span className="block truncate text-xs text-ink-faint">{state.user.email}</span>
          </span>
        </div>
        <div className="border-t border-line pt-1.5">
          <Link
            href="/settings"
            role="menuitem"
            onClick={(e) => {
              e.preventDefault();
              onClose();
              navigateApp("/settings");
            }}
            className={item}
            data-menu-settings
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-ink-soft" aria-hidden>
              <path d="M2 4h5.5M10.5 4H14M2 8h2.5M7.5 8H14M2 12h7.5M12.5 12H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="9" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="6" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="11" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            Settings
          </Link>
          <Link href="/support" role="menuitem" onClick={onClose} className={item}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-ink-soft" aria-hidden>
              <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
              <path d="M6.25 6.25a1.8 1.8 0 0 1 3.5.55c0 1.2-1.75 1.5-1.75 2.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="8" cy="11.6" r="0.85" fill="currentColor" />
            </svg>
            Help &amp; guides
          </Link>
          {state.user.appLockEnabled && (
            <button type="button" role="menuitem" onClick={() => {
              onClose();
              lockApp();
            }} className={item}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-ink-soft" aria-hidden>
                <path d="M4.5 7V5.25a3.5 3.5 0 0 1 7 0V7M3.25 7h9.5v6.75h-9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Lock Kairo now
            </button>
          )}
        </div>
{/* every account you are signed into, and the way to add one: switching was two
            screens deep in Settings, which is a long walk for something done daily */}
        <div className="mt-1.5 border-t border-line pt-1.5" data-menu-accounts>
          <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">{others.length > 0 ? "Switch account" : "Accounts"}</p>
          {others.map((a) => (
            <button key={a.id} type="button" role="menuitem" disabled={busy !== null} onClick={() => void switchTo(a.id)} className={`${item} disabled:opacity-60`} data-menu-switch={a.id}>
              <Avatar name={a.name} picture={a.picture} size={8} />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{a.name}</span>
                <span className="block truncate text-xs font-normal text-ink-faint">{busy === a.id ? "Switching…" : a.email}</span>
              </span>
            </button>
          ))}
          <a href={canMultiAccount ? "/api/auth/google" : upgradeHref("multi-account")} role="menuitem" className={item} data-menu-add-account>
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-dashed border-ink-faint/60 text-base leading-none text-ink-faint" aria-hidden>
              +
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate">Add another account</span>
              <span className="block truncate text-xs font-normal text-ink-faint">{others.length > 0 ? "Work, personal, anything" : "Keep work and personal apart"}</span>
            </span>
            {!canMultiAccount && <span className="shrink-0 rounded-full bg-sun-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sun-deep">Upgrade</span>}
          </a>
        </div>
        <form action="/api/auth/signout" method="POST" className="mt-1.5 border-t border-line pt-1.5">
          <button type="submit" role="menuitem" className={`${item} text-clay hover:bg-clay-soft`}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M6.5 13.75H3.25v-11.5H6.5M10.5 11l3-3-3-3M13.25 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Sign out
          </button>
        </form>
      </div>
    </>
  );
}

/** Google's mark on its required white chip, small enough for a pill button. */
function GoogleChip({ size = 24 }: { size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-white shadow-sm"
      style={{ width: size, height: size }}
    >
      <svg width={Math.round(size * 0.58)} height={Math.round(size * 0.58)} viewBox="0 0 48 48" aria-hidden>
        <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C40.9 35.5 44 30.2 44 24c0-1.3-.1-2.6-.4-3.9z" />
      </svg>
    </span>
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

/**
 * What you're working on, from anywhere.
 *
 * The state was previously invisible the moment you left the page holding the
 * task, which made starting one pointless — you had to remember what you'd
 * started. This is the thread back to it.
 */
function WorkingOn({ className = "" }: { className?: string }) {
  const { state, setEditing, toggleStarted } = useApp();
  // never a task inside a list that's locked right now: its title would sit on every screen
  const task = useMemo(() => {
    const hidden = hiddenListIds(state);
    return Object.values(state.tasks).find((t) => t.startedAt && t.status !== "done" && !(t.listId && hidden.has(t.listId)));
  }, [state]);
  // the focus pill already says what’s being worked on, with its clock: this would say it twice
  if (!task || state.focus) return null;

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

/** A page in the sidebar. */
/**
 * The sidebar's blocks: a place with several pages keeps its heading, and
 * neighbouring places of one page (Notes, Habits) share one block, so they
 * don't each float alone with a gap of their own.
 */
function navBlocks(spaces: ReturnType<typeof visibleSpaces>): { key: string; label?: string; items: NavItem[] }[] {
  const blocks: { key: string; label?: string; items: NavItem[] }[] = [];
  for (const space of spaces) {
    const last = blocks[blocks.length - 1];
    if (space.items.length > 1) blocks.push({ key: space.id, label: space.label, items: space.items });
    else if (last && !last.label) last.items.push(...space.items);
    else blocks.push({ key: space.id, items: [...space.items] });
  }
  return blocks;
}

function SideLink({ item, pathname, children }: { item: NavItem; pathname: string; children?: React.ReactNode }) {
  const active = inItem(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={(e) => {
        // a view swap, not a server round trip; the href stays for
        // middle-click, copy-link and everything else a real link does
        e.preventDefault();
        navigateApp(item.href);
      }}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
        active ? "bg-card text-ink shadow-sm" : "text-ink-soft hover:bg-card/60"
      }`}
    >
      <Icon size={16} className={active ? "text-sun-deep" : ""} />
      {item.label}
      {children}
    </Link>
  );
}

/** A space on the phone's bottom bar: it opens the page of the space you were last on. */
function SpaceTab({ space, pathname, children }: { space: (typeof SPACES)[number]; pathname: string; children?: React.ReactNode }) {
  const active = space.items.some((i) => inItem(pathname, i.href));
  // a space down to one page is named, and drawn, as that page
  const Icon = space.items.length === 1 ? space.items[0].icon : space.icon;
  const label = space.items.length === 1 ? space.items[0].label : space.label;
  return (
    <Link
      href={space.items[0].href}
      onClick={(e) => {
        e.preventDefault();
        // tapped from elsewhere: back to where you were in it; tapped again deep inside: up to that page's top
        const here = space.items.find((i) => inItem(pathname, i.href));
        const to = here ? here.href : spaceHref(space);
        if (to !== pathname) navigateApp(to);
      }}
      aria-current={active ? "page" : undefined}
      data-space={space.id}
      className={`relative flex flex-col items-center gap-0.5 py-1 text-[10px] font-medium ${active ? "text-sun-deep" : "text-ink-faint"}`}
    >
      <span className="relative">
        <Icon size={18} />
        {children}
      </span>
      {label}
    </Link>
  );
}

/**
 * The pages of a space, as a switch across the top of a phone screen: the
 * bottom bar has one tab per space, so this is how Calendar reaches Lists.
 * Only on a space's own pages, never inside a note or a journal day.
 */
function SpaceSwitch({ pathname, spaces }: { pathname: string; spaces: typeof SPACES }) {
  const space = spaces.find((s) => s.items.length > 1 && s.items.some((i) => pathname === i.href || pathname === `${i.href}/`));
  if (!space) return null;
  return (
    <div className="px-4 pt-3 md:hidden">
      <div role="tablist" aria-label={space.label} className="flex rounded-full border border-line bg-paper-deep p-0.5">
        {space.items.map((item) => {
          const active = inItem(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              role="tab"
              aria-selected={active}
              onClick={(e) => {
                e.preventDefault();
                if (!active) navigateApp(item.href);
              }}
              className={`flex-1 rounded-full py-1.5 text-center text-xs font-semibold transition-colors ${
                active ? "bg-card text-ink shadow-sm" : "text-ink-faint hover:text-ink-soft"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/**
 * A dot on the Habits icon while a habit is still to do today. It shows
 * only once habits have loaded (Today's strip or a visit does that), so the
 * shell never fetches anything for it.
 */
function GardenDot({ inline = false }: { inline?: boolean }) {
  useSyncExternalStore(gardenStore.subscribe, gardenStore.snapshot, () => 0);
  const { state } = useApp();
  if (state.user.guest || gardenStore.status() !== "ready") return null;
  const waiting = gardenStore.habits().some((h) => {
    const lv = gardenStore.live(h, state.today);
    return lv.dueToday && !lv.todayDone;
  });
  if (!waiting) return null;
  return inline ? (
    <span className="ml-auto size-2 rounded-full bg-sun" aria-label="habits still to do today" />
  ) : (
    <span className="absolute -right-1 -top-0.5 size-2 rounded-full bg-sun ring-2 ring-card" aria-hidden />
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
