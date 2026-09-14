"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useApp } from "../store";
import { GoogleBadge } from "../guest-mode";
import { navigateApp } from "../app-views";
import { BasketPage } from "./basket";
import { CommunityPage } from "./community";
import { GardenHome } from "./home";
import { PlantPage } from "./plant-page";
import { Plant } from "./plants";
import { GardenScene } from "./scene";
import { SeedsPage } from "./seeds";
import { useGarden } from "./use-garden";

/** The garden's routes: /garden, /garden/seeds, /garden/community, /garden/basket, /garden/:id. */
export default function GardenSection() {
  const pathname = usePathname();
  const { state } = useApp();
  const { status } = useGarden();
  const guest = Boolean(state.user.guest);

  const slug = /^\/garden\/([^/]+)\/?$/.exec(pathname)?.[1] ?? null;
  const known = slug === null || slug === "seeds" || slug === "community" || slug === "basket" || /^[a-f0-9]{24}$/.test(slug);
  const stray = !known || (slug === null && pathname !== "/garden" && pathname !== "/garden/");

  useEffect(() => {
    if (stray) window.history.replaceState(null, "", "/garden");
  }, [stray]);

  useEffect(() => {
    const titles: Record<string, string> = { seeds: "Seeds", community: "Community", basket: "Basket" };
    if (slug && /^[a-f0-9]{24}$/.test(slug)) return;
    document.title = `${slug ? `${titles[slug] ?? "Garden"} · ` : ""}Garden · Kairo`;
  }, [slug]);

  if (guest) return <GuestGarden />;
  if (slug === "seeds") return <SeedsPage />;
  if (slug === "basket") return <BasketPage />;
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

function GuestGarden() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-32 pt-6 sm:px-6">
      <header className="anim-rise mb-4">
        <h1 className="font-display text-4xl">Garden</h1>
        <p className="mt-1 text-sm text-ink-soft">Every habit is a seed. Keep it and it grows.</p>
      </header>
      <GardenScene weather="clear" thriving={3}>
        <div className="relative flex flex-col items-center px-6 pb-8 pt-2 text-center">
          <div className="flex items-end">
            <Plant species="tulip" stage={3} size={78} phase={0} />
            <Plant species="apple" stage={6} size={110} ripe={2} phase={1} />
            <Plant species="sunflower" stage={5} size={90} phase={2} />
          </div>
          <h2 className="font-display mt-1 text-2xl text-white [text-shadow:0_2px_6px_rgba(0,0,0,0.25)]">Grow habits you can see</h2>
          <p className="mt-1 max-w-sm text-sm text-white/90 [text-shadow:0_1px_3px_rgba(0,0,0,0.3)]">
            Plant a seed for each habit, water it on the days you keep it, and watch it bloom and bear fruit. Streaks, dew drops and leaderboards included.
          </p>
          <a
            href="/api/auth/google"
            data-track="guest-signin"
            className="mt-4 flex items-center gap-2 rounded-full bg-white py-1.5 pl-1.5 pr-4 text-sm font-semibold text-ink shadow-lg transition-all hover:-translate-y-0.5"
          >
            <GoogleBadge size={24} /> Sign in to plant your garden
          </a>
          <button type="button" onClick={() => navigateApp("/today")} className="mt-2 text-xs font-semibold text-white/85 underline-offset-2 hover:underline">
            Back to Today
          </button>
        </div>
      </GardenScene>
    </div>
  );
}
