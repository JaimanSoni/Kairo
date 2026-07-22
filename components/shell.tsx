"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { hiddenListIds, useApp } from "./store";
import { Omnibar } from "./omnibar";
import { TaskEditor } from "./task-editor";
import { FocusOverlay } from "./focus";
import { ThemeToggle } from "./theme";
import { IconBook, IconCalendar, IconInbox, IconPlus, IconSun, IconX, Kbd, Modal } from "./ui";

const NAV = [
  { href: "/today", label: "Today", icon: IconSun, key: "1" },
  { href: "/upcoming", label: "Upcoming", icon: IconCalendar, key: "2" },
  { href: "/lists", label: "Lists", icon: IconInbox, key: "3" },
  { href: "/log", label: "Log", icon: IconBook, key: "4" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { state, setOmnibar } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);

  const inboxCount = useMemo(() => {
    const hidden = hiddenListIds(state);
    return Object.values(state.tasks).filter(
      (t) => t.status === "inbox" && !(t.listId && hidden.has(t.listId))
    ).length;
  }, [state]);

  // app-wide keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "n" || e.key === "c") {
        e.preventDefault();
        setOmnibar(true);
      }
      const nav = NAV.find((n) => n.key === e.key);
      if (nav) router.push(nav.href);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router, setOmnibar]);

  const editingTask = state.editingId ? state.tasks[state.editingId] : null;

  return (
    <div className="flex min-h-dvh w-full">
      {/* sidebar — desktop */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-paper-deep/40 px-4 py-6 md:flex">
        <Link href="/today" className="flex items-center gap-2 px-2 text-lg font-bold tracking-tight">
          <span className="text-sun text-xl leading-none">✱</span> kairo
        </Link>

        <button
          onClick={() => setOmnibar(true)}
          className="mt-6 flex items-center justify-between rounded-xl border-2 border-ink bg-sun px-3.5 py-2.5 text-sm font-bold shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5"
        >
          <span className="flex items-center gap-2">
            <IconPlus size={15} /> Capture
          </span>
          <Kbd>N</Kbd>
        </button>

        <nav className="mt-6 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
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
          <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
            <Avatar name={state.user.name} picture={state.user.picture} size={8} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{state.user.name}</div>
              <form action="/api/auth/signout" method="POST">
                <button className="text-xs text-ink-faint hover:text-ink" type="submit">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </aside>

      {/* main */}
      <main className="min-w-0 flex-1">
        {/* top bar — mobile only */}
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper/90 px-4 pb-2 pt-[max(0.6rem,env(safe-area-inset-top))] backdrop-blur md:hidden">
          <Link href="/today" className="flex items-center gap-1.5 text-base font-bold tracking-tight">
            <span className="text-sun text-lg leading-none">✱</span> kairo
          </Link>
          <button onClick={() => setProfileOpen(true)} aria-label="Profile and settings">
            <Avatar name={state.user.name} picture={state.user.picture} size={8} />
          </button>
        </div>
        {children}
      </main>

      {/* bottom nav — mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-line bg-card/95 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
        {NAV.slice(0, 2).map(({ href, label, icon: Icon }) => (
          <MobileTab key={href} href={href} label={label} Icon={Icon} active={pathname.startsWith(href)} />
        ))}
        <button
          onClick={() => setOmnibar(true)}
          aria-label="Capture"
          className="grid size-12 -translate-y-3 place-items-center rounded-full border-2 border-ink bg-sun shadow-[3px_3px_0_0_var(--color-ink)]"
        >
          <IconPlus size={20} />
        </button>
        {NAV.slice(2).map(({ href, label, icon: Icon }) => (
          <MobileTab key={href} href={href} label={label} Icon={Icon} active={pathname.startsWith(href)} />
        ))}
      </nav>

      {/* overlays */}
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

      {/* toast */}
      {state.toast && (
        <div className="anim-pop fixed bottom-20 left-1/2 z-50 -translate-x-1/2 md:bottom-8">
          <div className="flex items-center gap-3 rounded-full border border-line bg-ink px-5 py-2.5 text-sm text-paper shadow-lg">
            {state.toast.message}
            {state.toast.action && (
              <button
                onClick={state.toast.action.run}
                className="font-bold text-sun underline-offset-2 hover:underline"
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
  const cls = size === 12 ? "size-12 text-lg" : "size-8 text-sm";
  return picture ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={picture} alt="" className={`${cls} rounded-full`} referrerPolicy="no-referrer" />
  ) : (
    <span className={`grid ${cls} place-items-center rounded-full bg-sun-soft font-bold text-sun-deep`}>
      {name.charAt(0).toUpperCase()}
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
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-faint hover:bg-paper-deep" aria-label="Close">
            <IconX />
          </button>
        </div>

        <div className="mt-6">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Appearance
          </div>
          <ThemeToggle />
        </div>

        <form action="/api/auth/signout" method="POST" className="mt-6 border-t border-line pt-4">
          <button
            type="submit"
            className="w-full rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-semibold text-clay transition-colors hover:border-clay hover:bg-clay-soft"
          >
            Sign out
          </button>
        </form>
      </div>
    </Modal>
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
      className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium ${
        active ? "text-sun-deep" : "text-ink-faint"
      }`}
    >
      <Icon size={18} />
      {label}
    </Link>
  );
}
