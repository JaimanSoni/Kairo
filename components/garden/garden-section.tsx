"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { gardenStore } from "@/lib/habits-client";
import { useApp } from "../store";
import { GoogleBadge } from "../guest-mode";
import { navigateApp } from "../app-views";
import { CommunityPage } from "./community";
import { GardenHome } from "./home";
import { PlantPage } from "./plant-page";
import { Plant } from "./plants";
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
  const { state } = useApp();
  const { status } = useGarden();
  const guest = Boolean(state.user.guest);

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
  if (guest) return <GuestHabits />;
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

function GuestHabits() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-32 pt-8 sm:px-6">
      <header className="anim-rise mb-6">
        <h1 className="font-display text-4xl">Habits</h1>
        <p className="mt-1 text-sm text-ink-soft">Small things, done most days, until they happen on their own.</p>
      </header>
      <section className="overflow-hidden rounded-2xl border border-line bg-card">
        <div className="flex items-end justify-center gap-1 bg-moss-soft/60 pt-5">
          <Plant species="tulip" stage={3} size={64} phase={0} ground="none" fit="snug" />
          <Plant species="apple" stage={5} size={90} phase={1} ground="none" fit="snug" />
          <Plant species="sunflower" stage={4} size={72} phase={2} ground="none" fit="snug" />
        </div>
        <div className="p-5">
          <h2 className="font-display text-2xl">Build habits you can see</h2>
          <p className="mt-1 max-w-md text-sm text-ink-soft">
            Mark a habit done on the days you do it. Kairo counts your streak, shows how strong the habit is getting, and grows a plant for it as it takes root.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a
              href="/api/auth/google"
              data-track="guest-signin"
              className="flex items-center gap-2 rounded-full bg-ink py-1.5 pl-1.5 pr-4 text-sm font-semibold text-paper transition-colors hover:bg-ink/90"
            >
              <GoogleBadge size={24} /> Sign in to start a habit
            </a>
            <button type="button" onClick={() => navigateApp("/today")} className="text-xs font-semibold text-ink-soft underline-offset-2 hover:underline">
              Back to Today
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
