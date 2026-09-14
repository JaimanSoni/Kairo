"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { TodayView } from "./today-view";
import { CalendarSection } from "./calendar-section";
import { ListsView } from "./lists-view";
import { LogView } from "./log-view";
import dynamic from "next/dynamic";

/**
 * The journal loads on first visit, not with the app. Its editor is the
 * heaviest thing Kairo ships, and someone opening Today to tick off a task
 * should not download a word processor to do it.
 */
const JournalSection = dynamic(() => import("./journal/journal-section"), {
  ssr: false,
  loading: () => (
    <div className="mx-auto w-full max-w-2xl px-5 pb-32 pt-10 sm:px-8">
      <div className="h-9 w-40 animate-pulse rounded-xl bg-paper-deep" />
      <div className="mt-6 h-40 animate-pulse rounded-3xl bg-paper-deep" />
    </div>
  ),
});

/** Notes load on first visit too, for the same reason. */
const NotesSection = dynamic(() => import("./notes/notes-section"), {
  ssr: false,
  loading: () => (
    <div className="mx-auto w-full max-w-3xl px-5 pb-32 pt-10 sm:px-8">
      <div className="h-9 w-32 animate-pulse rounded-xl bg-paper-deep" />
      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="h-32 animate-pulse rounded-2xl bg-paper-deep" />
        <div className="h-32 animate-pulse rounded-2xl bg-paper-deep" />
        <div className="h-32 animate-pulse rounded-2xl bg-paper-deep" />
      </div>
    </div>
  ),
});

/** The garden brings its own art and animation; it loads when it's visited. */
const GardenSection = dynamic(() => import("./garden/garden-section"), {
  ssr: false,
  loading: () => (
    <div className="mx-auto w-full max-w-5xl px-4 pb-32 pt-6 sm:px-6">
      <div className="h-10 w-40 animate-pulse rounded-xl bg-paper-deep" />
      <div className="mt-5 h-96 animate-pulse rounded-[1.75rem] bg-paper-deep" />
    </div>
  ),
});

/**
 * The app views behind one client switch.
 *
 * Every piece of data these views need already lives in the client store, so
 * moving between them should cost nothing — yet a router navigation paid a
 * full server round trip per click, because the authed layout makes every
 * route dynamic. Instead, the nav pushes history state and this component
 * swaps views off the pathname: the URL, back button and deep links all
 * behave exactly as before, and the switch is a render, not a request.
 *
 * Hard loads still enter through the real routes, so nothing about auth,
 * metadata or the PWA changes.
 */

const TITLES: Record<string, string> = {
  "/today": "Today · Kairo",
  "/calendar": "Calendar · Kairo",
  "/lists": "Lists · Kairo",
  "/log": "Log · Kairo",
  "/journal": "Journal · Kairo",
  "/notes": "Notes · Kairo",
  "/garden": "Garden · Kairo",
};

/** Swap the view without a server round trip. */
export function navigateApp(href: string) {
  window.history.pushState(null, "", href);
  window.scrollTo(0, 0);
}

export function AppViews() {
  const pathname = usePathname();

  // pushState skips the metadata system, so the tab title follows by hand
  useEffect(() => {
    // an open note names the tab after itself, once it has loaded
    if (/^\/notes\/[a-f0-9]{24}/.test(pathname)) return;
    // the garden names its own pages
    if (pathname.startsWith("/garden")) return;
    const title =
      TITLES[pathname] ??
      (pathname.startsWith("/journal/") ? TITLES["/journal"] : pathname.startsWith("/notes/") ? TITLES["/notes"] : undefined);
    if (title) document.title = title;
  }, [pathname]);

  if (pathname.startsWith("/calendar")) return <CalendarSection />;
  if (pathname.startsWith("/lists")) return <ListsView />;
  if (pathname.startsWith("/log")) return <LogView />;
  if (pathname.startsWith("/journal")) return <JournalSection />;
  if (pathname.startsWith("/notes")) return <NotesSection />;
  if (pathname === "/garden" || pathname.startsWith("/garden/")) return <GardenSection />;
  return <TodayView />;
}
