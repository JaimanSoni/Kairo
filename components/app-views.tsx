"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { TodayView } from "./today-view";
import { CalendarSection } from "./calendar-section";
import { ListsView } from "./lists-view";
import { LogView } from "./log-view";

/**
 * The four app views behind one client switch.
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
    const title = TITLES[pathname];
    if (title) document.title = title;
  }, [pathname]);

  if (pathname.startsWith("/calendar")) return <CalendarSection />;
  if (pathname.startsWith("/lists")) return <ListsView />;
  if (pathname.startsWith("/log")) return <LogView />;
  return <TodayView />;
}
