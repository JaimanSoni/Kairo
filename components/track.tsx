"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics-client";

/**
 * The two ambient trackers, mounted once in the root layout:
 *
 * - A page view per pathname change. Works for hard loads and for the app's
 *   pushState navigation alike, because both move usePathname.
 * - Click delegation for `data-track`: any element can declare
 *   `data-track="share-bestie-open"` and be counted, server components
 *   included, no client wrapper needed.
 */
export function PageTracker() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (pathname === last.current) return;
    last.current = pathname;
    track("page_view");
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.("[data-track]");
      const name = el instanceof HTMLElement ? el.dataset.track : undefined;
      if (name) track(name);
    };
    document.addEventListener("click", onClick, { capture: true, passive: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
