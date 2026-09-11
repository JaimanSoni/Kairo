"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isRealDate } from "@/lib/journal-shared";
import { useApp } from "../store";
import { EmptyState } from "../ui";
import { GoogleBadge } from "../guest-mode";
import { JournalHome } from "./journal-home";
import { JournalEditor } from "./journal-editor";

/**
 * /journal is the calendar; /journal/2026-09-11 is that day's page.
 *
 * The editor is keyed by day, so stepping to yesterday unmounts today's page —
 * which is what flushes its last save — before yesterday's begins loading.
 */
export default function JournalSection() {
  const pathname = usePathname();
  const { state } = useApp();

  const match = /^\/journal\/(\d{4}-\d{2}-\d{2})\/?$/.exec(pathname);
  const date = match && isRealDate(match[1]) ? match[1] : null;
  const stray = !date && pathname !== "/journal" && pathname !== "/journal/";

  // a mistyped day in the address bar lands on the calendar, not a blank page
  useEffect(() => {
    if (stray) window.history.replaceState(null, "", "/journal");
  }, [stray]);

  if (state.user.guest) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pb-32 pt-8 sm:px-6">
        <header className="anim-rise mb-6">
          <h1 className="font-display text-4xl">Journal</h1>
          <p className="mt-1 text-sm text-ink-soft">A page a day, written your way.</p>
        </header>
        <EmptyState
          icon="feather"
          title="Keep a journal"
          body="Write about your day in a page that remembers what you finished, knows the weather inside, and can have a PIN of its own. A journal lives in your account, not in this browser, so it starts when you sign in."
        >
          <a
            href="/api/auth/google"
            data-track="guest-signin"
            className="mt-3 flex items-center gap-2 rounded-full bg-ink py-1.5 pl-1.5 pr-4 text-sm font-semibold text-paper transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <GoogleBadge size={24} /> Sign in to start writing
          </a>
        </EmptyState>
      </div>
    );
  }

  if (date) return <JournalEditor key={date} date={date} />;
  return <JournalHome />;
}
