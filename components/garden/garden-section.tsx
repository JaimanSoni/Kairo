"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { gardenStore } from "@/lib/habits-client";
import { CommunityPage } from "./community";
import { GardenHome } from "./home";
import { PlantPage } from "./plant-page";
import { SeedsPage } from "./seeds";
import { useGarden } from "./use-garden";

/** Where an old garden address lives now. */
export function habitsPathFor(pathname: string, search = ""): string {
  const slug = /^\/garden\/([^/]+)\/?$/.exec(pathname)?.[1] ?? null;
  if (slug === "seeds") return `/habits/ideas${search.replace(/([?&])plant=/, "$1start=")}`;
  if (slug === "community") return `/habits/community${search}`;
  if (slug && /^[a-f0-9]{24}$/.test(slug)) return `/habits/${slug}`;
  return "/habits";
}

/** The habits routes: /habits, /habits/ideas, /habits/community, /habits/:id. */
export default function GardenSection() {
  const pathname = usePathname();
  const { status } = useGarden();

  const old = pathname === "/garden" || pathname.startsWith("/garden/");
  const slug = /^\/habits\/([^/]+)\/?$/.exec(pathname)?.[1] ?? null;
  const known = slug === null || slug === "ideas" || slug === "community" || /^[a-f0-9]{24}$/.test(slug);
  const stray = !old && (!known || (slug === null && pathname !== "/habits" && pathname !== "/habits/"));

  useEffect(() => {
    // an old garden link, followed inside the app, lands on the same page under its new name
    if (old) window.history.replaceState(null, "", habitsPathFor(pathname, window.location.search));
    else if (stray) window.history.replaceState(null, "", "/habits");
  }, [old, stray, pathname]);

  const habitName = slug && status === "ready" ? (gardenStore.get(slug)?.name ?? null) : null;
  useEffect(() => {
    const titles: Record<string, string> = { ideas: "Ideas", community: "Leaderboards" };
    const page = habitName ?? (slug ? titles[slug] : null);
    document.title = `${page ? `${page} · ` : ""}Habits · Kairo`;
  }, [slug, habitName]);

  if (old) return null;
  if (slug === "ideas") return <SeedsPage />;
  if (slug === "community") {
    return status === "ready" ? (
      <CommunityPage />
    ) : (
      <div className="mx-auto w-full max-w-3xl px-4 pb-32 pt-6 sm:px-6">
        <div className="mt-10 h-24 animate-pulse rounded-2xl bg-paper-deep" />
      </div>
    );
  }
  if (slug && /^[a-f0-9]{24}$/.test(slug)) return <PlantPage id={slug} />;
  return <GardenHome />;
}

