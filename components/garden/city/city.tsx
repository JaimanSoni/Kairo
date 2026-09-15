"use client";

import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { gardenApi, gardenStore } from "@/lib/habits-client";
import { GARDEN_LEVELS, type City, type CityGarden, type CityScope } from "@/lib/habits-shared";
import { track } from "@/lib/analytics-client";
import { useApp } from "../../store";
import { IconX } from "../../ui";
import { useClock, useReducedMotion } from "../fx";
import { phaseOf } from "../scene";
import { Balloon, hillsTile, LampPost, skylineTile, StreetTree, type CityPhase } from "./decor";
import { CityLot, IconSun, SHOWCASE, type StreetItem } from "./lot";
import { GardenVisit } from "./visit";
import { JoinCity } from "./join";
import { InviteSheet } from "./invite";

/**
 * Kairo City, full screen: a street of real gardens under a skyline, one
 * plot beside the next, to walk along and step into. It opens at ?city=open
 * (and a garden at &visit=<id>), so Back walks out the way it came in, and a
 * link straight to it works for anyone, signed in or not.
 */

const withParams = (set: Record<string, string | null>) => {
  const url = new URL(window.location.href);
  for (const [k, v] of Object.entries(set)) {
    if (v === null) url.searchParams.delete(k);
    else url.searchParams.set(k, v);
  }
  return `${url.pathname}${url.search}${url.hash}`;
};

type CityState = { kairoCity?: boolean; kairoVisit?: boolean } | null;

/** Walks into the city: a history entry of its own, so Back walks out. */
function showCity() {
  track("city-open");
  window.history.pushState({ kairoCity: true }, "", withParams({ city: "open", visit: null }));
}

function hideCity() {
  const state = window.history.state as CityState;
  if (state?.kairoVisit) window.history.go(-2);
  else if (state?.kairoCity) window.history.back();
  else window.history.replaceState(null, "", withParams({ city: null, visit: null }));
}

function openVisit(id: string) {
  window.history.pushState({ kairoCity: true, kairoVisit: true }, "", withParams({ city: "open", visit: id }));
}

function closeVisit() {
  if ((window.history.state as CityState)?.kairoVisit) window.history.back();
  else window.history.replaceState({ kairoCity: true }, "", withParams({ visit: null }));
}

export function useCityView() {
  const params = useSearchParams();
  const open = params.get("city") === "open";
  const visit = open ? params.get("visit") : null;
  const asked = params.get("street");
  const street: CityScope | null = asked === "friends" || asked === "neighbours" || asked === "top" ? asked : null;
  return { open, visit, street, show: showCity, hide: hideCity, openVisit, closeVisit };
}

const noop = () => () => {};

const SCOPES: { id: CityScope; label: string }[] = [
  { id: "neighbours", label: "Neighbours" },
  { id: "friends", label: "Friends" },
  { id: "top", label: "Top gardens" },
];

const SKY: Record<CityPhase, string> = {
  night: "linear-gradient(180deg, #060e22 0%, #122445 50%, #25406a 100%)",
  dawn: "linear-gradient(180deg, #6d80d4 0%, #e6a7b0 55%, #ffd49c 100%)",
  day: "linear-gradient(180deg, #3aa1ea 0%, #8ad0f6 55%, #d8f2fb 100%)",
  golden: "linear-gradient(180deg, #e46f55 0%, #f5a65f 50%, #ffe09b 100%)",
  dusk: "linear-gradient(180deg, #211f5e 0%, #684b95 50%, #ec8b6e 100%)",
};

export function KairoCity({ onClose }: { onClose: () => void }) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const { state, showToast } = useApp();
  const guest = Boolean(state.user.guest);
  const { visit, street: askedStreet } = useCityView();
  const minute = useClock();
  const phase = phaseOf(minute) as CityPhase;
  const dark = phase === "night" || phase === "dusk";
  const still = useReducedMotion();
  const [scope, setScope] = useState<CityScope>(guest ? "top" : (askedStreet ?? "neighbours"));
  // what the server said for a street, kept with the street it was for
  const [loaded, setLoaded] = useState<{ scope: CityScope; key: number; city: City | null } | null>(null);
  const [reload, setReload] = useState(0);
  const [joining, setJoining] = useState(false);
  const [fetched, setFetched] = useState<CityGarden | null>(null);
  // cheers left during this walk, over whatever the street loaded with
  const [cheered, setCheered] = useState<Record<string, CityGarden["cheers"]>>({});
  // a plot saved for a friend, open in its sheet
  const [inviting, setInviting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // friends who claimed a saved plot since last time: told once, kept for this walk
  const [arrivals, setArrivals] = useState<string[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const panned = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    void gardenApi.city(scope).then((r) => {
      // news of a friend moving in is told only once, so it's kept even from an answer that came too late for the street
      if (r.ok && r.data.invites?.arrived.length) setArrivals((known) => [...new Set([...known, ...r.data.invites!.arrived])]);
      if (!alive) return;
      setLoaded({ scope, key: reload, city: r.ok ? r.data : null });
    });
    return () => {
      alive = false;
    };
  }, [scope, reload]);

  const current = loaded?.scope === scope ? loaded : null;
  const failed = Boolean(current && !current.city && current.key === reload);
  const city = current?.city
    ? { ...current.city, gardens: current.city.gardens.map((g) => (cheered[g.id] ? { ...g, cheers: cheered[g.id] } : g)) }
    : null;

  // Escape walks out: out of a garden first, then out of the city
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || joining || inviting) return;
      e.stopImmediatePropagation();
      if (visit) closeVisit();
      else onClose();
    };
    document.addEventListener("keydown", onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prev;
      cancelAnimationFrame(frame.current);
    };
  }, [onClose, visit, joining, inviting]);

  const street: StreetItem[] = [];
  if (city) {
    if (city.scope === "top") street.push({ kind: "garden", garden: SHOWCASE });
    const me = city.gardens.find((g) => g.me);
    const joined = Boolean(city.me?.joined);
    // beside your garden: the plots you've saved for friends, then one more to save
    const nextDoor: StreetItem[] = joined ? [...(city.invites?.open ?? []).map((code) => ({ kind: "free" as const, claim: "reserved" as const, code })), { kind: "free", claim: "invite" }] : [];
    let placed = false;
    city.gardens.forEach((g, i) => {
      // the garden just ahead of yours says by how much
      const next = city.gardens[i + 1];
      const ahead = me && next?.me && g.score > me.score ? g.score - me.score : undefined;
      street.push({ kind: "garden", garden: g, ahead });
      if (g.me && city.scope !== "top") {
        street.push(...nextDoor);
        placed = true;
      }
    });
    if (!placed) street.push(...nextDoor);
    const claim = guest ? "signin" : joined ? "invite" : city.me ? "join" : null;
    if (!joined && claim && city.scope === "top") street.push({ kind: "free", claim });
    while (street.length < 5) street.push({ kind: "free", claim });
  }

  // the camera: arrive at the start of the street and glide to your plot
  const arrived = current?.city ?? null;
  useEffect(() => {
    const el = scroller.current;
    if (!el || !arrived) return;
    const key = `${arrived.scope}:${arrived.gardens.length}:${arrived.me?.joined}`;
    if (panned.current === key) return;
    panned.current = key;
    const mine = el.querySelector<HTMLElement>("[data-me]");
    el.scrollLeft = 0;
    if (!mine) return;
    const target = mine.offsetLeft + mine.offsetWidth / 2 - el.clientWidth / 2;
    const t = setTimeout(() => el.scrollTo({ left: target, behavior: still ? "auto" : "smooth" }), 350);
    return () => clearTimeout(t);
  }, [arrived, still]);

  // a garden asked for in the address: from the street when it's on it, from the server when it isn't
  const onStreet = visit ? (visit === "showcase" ? SHOWCASE : (city?.gardens.find((g) => g.id === visit) ?? null)) : null;
  const needFetch = Boolean(visit && !onStreet && current);
  useEffect(() => {
    if (!needFetch || !visit) return;
    let alive = true;
    void gardenApi.visit(visit).then((r) => {
      if (!alive) return;
      if (r.ok) setFetched(r.data.garden);
      else {
        showToast({ message: "That garden isn't in the city any more." });
        closeVisit();
      }
    });
    return () => {
      alive = false;
    };
  }, [needFetch, visit, showToast]);
  const fromServer = fetched && fetched.id === visit ? { ...fetched, cheers: cheered[fetched.id] ?? fetched.cheers } : null;
  const visited = onStreet ?? fromServer;

  if (!mounted) return null;

  const me = city?.me ?? null;
  const lead = city && me ? rivalLine(city, me) : null;

  const onScroll = () => {
    const el = scroller.current;
    const r = root.current;
    if (!el || !r) return;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => r.style.setProperty("--sx", String(el.scrollLeft)));
  };

  const nudge = (dir: 1 | -1) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * Math.min(420, el.clientWidth * 0.8), behavior: "smooth" });
  };

  const share = async () => {
    const url = me?.joined ? `${window.location.origin}/g/${me.id}` : `${window.location.origin}/?city=open`;
    const text = me?.joined ? `My garden in Kairo City is a Level ${me.level} ${GARDEN_LEVELS[me.level - 1].name}. Can your habits grow a better one?` : "Kairo City: a city of gardens grown by real habits.";
    track("city-share", { mine: Boolean(me?.joined) });
    try {
      if (navigator.share) {
        await navigator.share({ title: "Kairo City", text, url });
        return;
      }
    } catch {
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast({ message: "Link copied. Send it to someone." });
    } catch {
      showToast({ message: url });
    }
  };

  const saveForFriend = async () => {
    if (saving) return;
    setSaving(true);
    const r = await gardenApi.invite();
    setSaving(false);
    if (!r.ok) {
      showToast({ message: r.kind === "invalid" ? r.message : "That plot couldn't be saved just now." });
      return;
    }
    track("city-invite-create");
    setInviting(r.data.code);
    setReload((n) => n + 1);
  };

  const openItem = (item: StreetItem) => {
    if (drag.current?.moved) return;
    if (item.kind === "garden") {
      openVisit(item.garden.id);
      track("city-visit", { mine: item.garden.me });
    } else if (item.claim === "signin") {
      window.location.assign("/api/auth/google");
    } else if (item.claim === "join") setJoining(true);
    else if (item.claim === "invite") void saveForFriend();
    else if (item.claim === "reserved") setInviting(item.code);
  };

  return createPortal(
    <div
      ref={root}
      className="city-root gd-immersive fixed inset-0 z-[60] overflow-hidden"
      style={{ background: SKY[phase] }}
      role="dialog"
      aria-modal
      aria-label="Kairo City"
      data-city
      data-phase={phase}
    >
      {/* the sky: stars or sun, and balloons over the rooftops */}
      {dark &&
        Array.from({ length: 60 }, (_, i) => (
          <span
            key={i}
            className="gd-star absolute rounded-full bg-white"
            style={{ left: `${(i * 53) % 100}%`, top: `${(i * 29) % 45}%`, width: i % 7 === 0 ? 3 : 2, height: i % 7 === 0 ? 3 : 2, animationDelay: `${(i % 9) * 0.35}s` }}
            aria-hidden
          />
        ))}
      <div className="absolute right-[12%] top-[9%]" aria-hidden>
        {dark ? (
          <div className="size-14 rounded-full bg-[#f4f1de] shadow-[0_0_60px_18px_rgba(244,241,222,0.3)]" />
        ) : (
          <div className="relative grid place-items-center">
            <span className="gd-rays absolute size-56 rounded-full" />
            <span className="relative size-20 rounded-full bg-[radial-gradient(circle_at_40%_38%,#fff6c4,#ffd35c_55%,#ffb938)] shadow-[0_0_70px_24px_rgba(255,211,92,0.55)]" />
          </div>
        )}
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="gd-balloon absolute" style={{ left: `${14 + i * 31}%`, top: `${13 + (i % 2) * 11}%`, width: 34 - i * 6, height: 48 - i * 8, animationDelay: `${-i * 4}s`, animationDuration: `${16 + i * 5}s` }} aria-hidden>
          <Balloon colors={[["#ff6b6b", "#ffd166"], ["#0c9384", "#8fe3d3"], ["#8d7bd4", "#ffc6e0"]][i] as [string, string]} />
        </div>
      ))}
      {Array.from({ length: dark ? 2 : 4 }, (_, i) => (
        <div key={i} className="gd-cloud absolute" style={{ top: `${6 + ((i * 17) % 30)}%`, animationDuration: `${90 + i * 25}s`, animationDelay: `${-i * 23}s` }} aria-hidden>
          <svg width={140 + (i % 2) * 60} viewBox="0 0 120 44">
            <path d="M20 40 C 4 40, 2 22, 18 20 C 18 6, 40 2, 48 14 C 56 2, 82 4, 84 20 C 102 16, 118 30, 104 40 Z" fill={dark ? "#33466b" : "#ffffff"} opacity={dark ? 0.5 : 0.9} />
          </svg>
        </div>
      ))}

      {/* depth: the skyline and hills slide slower than the street */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-[calc(var(--road)+var(--lot-h)*0.42)] h-[min(34vh,300px)]"
        style={{ backgroundImage: skylineTile(phase), backgroundRepeat: "repeat-x", backgroundSize: "auto 100%", backgroundPositionX: "calc(var(--sx, 0) * -0.18px)", backgroundPositionY: "bottom" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-[calc(var(--road)+var(--lot-h)*0.2)] h-[min(18vh,150px)]"
        style={{ backgroundImage: hillsTile(phase), backgroundRepeat: "repeat-x", backgroundSize: "900px 100%", backgroundPositionX: "calc(var(--sx, 0) * -0.42px)" }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[calc(var(--road)+var(--lot-h)*0.3)]" style={{ background: dark ? "#2a4a3c" : phase === "golden" ? "#86ae5e" : "#6fb863" }} aria-hidden />

      {/* the street */}
      <div
        ref={scroller}
        onScroll={onScroll}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") return;
          drag.current = { x: e.clientX, left: scroller.current?.scrollLeft ?? 0, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          const el = scroller.current;
          if (!d || !el) return;
          const dx = e.clientX - d.x;
          if (Math.abs(dx) > 5) d.moved = true;
          if (d.moved) el.scrollLeft = d.left - dx;
        }}
        onPointerUp={() => {
          // a drag isn't a tap: forget it just after the click it would have caused
          setTimeout(() => (drag.current = null), 0);
        }}
        onPointerLeave={() => (drag.current = null)}
        className="no-scrollbar absolute inset-0 overflow-x-auto overflow-y-hidden"
        data-street
      >
        <div className="relative flex h-full w-max items-end gap-0 px-[max(1rem,calc(50vw-var(--lot-w)/2))] pb-[calc(var(--road)*0.62)]">
          {/* the road under everything */}
          <div className="city-road pointer-events-none absolute inset-x-0 bottom-0 h-[var(--road)]" aria-hidden>
            <div className="absolute inset-x-0 top-0 h-[34%] bg-[#d9d4c7]" style={{ backgroundImage: "repeating-linear-gradient(90deg, rgba(0,0,0,0.08) 0 1px, transparent 1px 46px)" }} />
            <div className="absolute inset-x-0 top-[34%] h-1.5 bg-[#b5ae9f]" />
            <div className={`absolute inset-x-0 bottom-0 top-[calc(34%+6px)] ${dark ? "bg-[#2b2f36]" : "bg-[#4a4f57]"}`}>
              <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2" style={{ backgroundImage: "repeating-linear-gradient(90deg, #f4d35e 0 36px, transparent 36px 72px)" }} />
            </div>
          </div>
          {!city && !failed && (
            <div className="mb-[10vh] flex items-center gap-3 rounded-full bg-black/35 px-5 py-3 text-sm font-semibold text-white backdrop-blur" role="status">
              <span className="size-3 animate-pulse rounded-full bg-white" /> Walking into the city…
            </div>
          )}
          {failed && (
            <button type="button" onClick={() => setReload((n) => n + 1)} className="mb-[10vh] rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#1c2624] shadow-lg">
              The city didn&apos;t load. Try again
            </button>
          )}
          {street.map((item, i) => (
            <Fragment key={item.kind === "garden" ? item.garden.id : `free-${i}`}>
              {i > 0 && (
                <div className="relative mx-1 flex h-[calc(var(--lot-h)*0.62)] w-[clamp(30px,5vw,56px)] shrink-0 items-end sm:mx-3" aria-hidden>
                  {i % 2 ? <LampPost lit={dark} /> : <div className="h-[80%] w-full"><StreetTree phase={phase} variant={i % 4} /></div>}
                </div>
              )}
              <CityLot item={item} phase={phase} onOpen={() => openItem(item)} />
            </Fragment>
          ))}
        </div>
      </div>

      {/* a car along the road now and then */}
      {!still && (
        <div className="city-car pointer-events-none absolute bottom-[calc(var(--road)*0.12)] h-[calc(var(--road)*0.34)]" aria-hidden>
          <svg className="h-full w-auto" viewBox="0 0 80 34">
            <rect x="4" y="12" width="72" height="14" rx="6" fill="#ff6b6b" />
            <path d="M18 12 L26 2 L54 2 L62 12 Z" fill="#ff8787" />
            <rect x="28" y="4" width="11" height="8" rx="1" fill="#cfe8ff" />
            <rect x="42" y="4" width="11" height="8" rx="1" fill="#cfe8ff" />
            <circle cx="20" cy="27" r="6" fill="#222" />
            <circle cx="60" cy="27" r="6" fill="#222" />
            {dark && <circle cx="77" cy="18" r="3" fill="#fff3b0" />}
          </svg>
        </div>
      )}

      {/* the way around: where you are, the streets, the way out */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-40 bg-gradient-to-b from-[#07142a]/45 to-transparent" aria-hidden />
      <header className="absolute inset-x-0 top-0 z-40 grid grid-cols-[1fr_auto] items-start gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:grid-cols-[1fr_auto_1fr] sm:px-8 sm:pt-6">
        <div className="min-w-0">
          <h2 className="font-display text-3xl leading-none text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.35)] sm:text-4xl">Kairo City</h2>
          <p className="mt-1.5 text-sm font-medium text-white/90 [text-shadow:0_1px_4px_rgba(0,0,0,0.4)]" data-city-summary>
            {city
              ? guest
                ? `${city.total.toLocaleString()} ${city.total === 1 ? "garden" : "gardens"}, grown by real habits`
                : me?.joined && me.rank
                  ? `Your garden is #${me.rank} of ${city.total.toLocaleString()}`
                  : `${city.total.toLocaleString()} ${city.total === 1 ? "garden" : "gardens"} in the city`
              : " "}
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 sm:col-start-3 sm:order-3">
          <button type="button" onClick={() => void share()} className="gd-hud flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5" data-city-share>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M8 10V2M8 2 5 5M8 2l3 3M3 9v4h10V9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Share
          </button>
          <button type="button" onClick={onClose} aria-label="Leave the city" className="gd-hud grid size-10 place-items-center rounded-full text-white transition-transform hover:scale-105" data-close-city>
            <IconX size={18} />
          </button>
        </div>
        {!guest && (
          <nav className="gd-hud col-span-2 flex gap-1 rounded-full p-1 sm:order-2 sm:col-span-1" aria-label="Streets">
            {SCOPES.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={scope === s.id}
                onClick={() => {
                  panned.current = null;
                  setScope(s.id);
                }}
                className={`h-8 flex-1 rounded-full px-3 text-xs font-semibold transition-colors sm:flex-none ${scope === s.id ? "bg-white text-[#1c2624]" : "text-white hover:bg-white/15"}`}
              >
                {s.label}
              </button>
            ))}
          </nav>
        )}
      </header>

      {/* what to do next, above the street */}
      <div className="absolute inset-x-0 top-[calc(max(1rem,env(safe-area-inset-top))+7.5rem)] z-30 flex justify-center px-4 sm:top-[6.5rem]">
        {guest ? (
          <a
            href="/api/auth/google"
            data-track="city-signin"
            className="flex items-center gap-2 rounded-full bg-white py-2 pl-2 pr-5 text-sm font-semibold text-[#1c2624] shadow-xl transition-transform hover:-translate-y-0.5"
          >
            <span className="grid size-7 place-items-center rounded-full bg-sun text-on-accent">
              <IconSun size={16} />
            </span>
            Sign in and plant your own garden here
          </a>
        ) : me && !me.joined ? (
          <button type="button" onClick={() => setJoining(true)} className="flex items-center gap-2 rounded-full bg-white py-2 pl-2 pr-5 text-sm font-semibold text-[#1c2624] shadow-xl transition-transform hover:-translate-y-0.5" data-claim>
            <span className="grid size-7 place-items-center rounded-full bg-sun text-on-accent">+</span>
            Claim your plot: only you can see your garden until you do
          </button>
        ) : arrivals.length ? (
          <p className="city-invite flex items-center gap-2 rounded-full bg-white py-2 pl-2 pr-2 text-sm font-semibold text-[#1c2624] shadow-xl" data-arrived>
            <span className="grid size-7 place-items-center rounded-full bg-[#ffd166]">
              <IconSun size={16} />
            </span>
            {arrivals.slice(0, 2).join(" and ")}
            {arrivals.length > 2 ? ` and ${arrivals.length - 2} more` : ""} moved into the {arrivals.length === 1 ? "plot" : "plots"} you saved. Leave them a cheer.
            <button type="button" onClick={() => setArrivals([])} aria-label="Dismiss" className="ml-1 grid size-7 place-items-center rounded-full text-ink-faint hover:bg-paper-deep">
              <IconX size={13} />
            </button>
          </p>
        ) : lead ? (
          <p className="gd-hud rounded-full px-4 py-2 text-center text-sm font-semibold text-white" data-rival>
            {lead}
          </p>
        ) : null}
      </div>

      {/* arrows, for a mouse */}
      {city && (
        <>
          <button type="button" onClick={() => nudge(-1)} aria-label="Walk left" className="gd-hud absolute left-3 top-1/2 z-30 hidden size-11 -translate-y-1/2 place-items-center rounded-full text-xl font-bold text-white sm:grid">
            ‹
          </button>
          <button type="button" onClick={() => nudge(1)} aria-label="Walk right" className="gd-hud absolute right-3 top-1/2 z-30 hidden size-11 -translate-y-1/2 place-items-center rounded-full text-xl font-bold text-white sm:grid">
            ›
          </button>
        </>
      )}

      {visited && visit && (
        <GardenVisit
          garden={visited}
          guest={guest}
          canCheer={Boolean(me?.joined)}
          onBack={closeVisit}
          onJoin={() => setJoining(true)}
          onShare={() => void share()}
          onCheered={(cheers) => setCheered((c) => ({ ...c, [visited.id]: cheers }))}
        />
      )}
      {inviting && (
        <InviteSheet
          code={inviting}
          onClose={() => setInviting(null)}
          onCancelled={() => {
            setInviting(null);
            setReload((n) => n + 1);
          }}
        />
      )}
      {joining && (
        <JoinCity
          onClose={() => setJoining(false)}
          onJoined={() => {
            setJoining(false);
            panned.current = null;
            setReload((n) => n + 1);
            showToast({ message: "Your plot is claimed. Welcome to Kairo City." });
          }}
        />
      )}
    </div>,
    document.body
  );
}

/** The one line that makes a street a race you can win: who's just ahead, and by how much. */
function rivalLine(city: City, me: CityGarden): string | null {
  if (!me.joined) return null;
  const i = city.gardens.findIndex((g) => g.me);
  if (i < 0) return null;
  const ahead = city.gardens.slice(0, i).reverse().find((g) => g.score > me.score);
  if (!ahead) return city.gardens.length > 1 ? "You lead this street. Keep your habits going to stay there." : "Tap your garden to walk in";
  const gap = ahead.score - me.score;
  return `${ahead.name}'s garden is ${gap} ${gap === 1 ? "point" : "points"} ahead. Every day you keep a habit closes the gap.`;
}

/** Keeps the store's gardener in step after joining, for the pages behind the city. */
export async function refreshGardener() {
  const r = await gardenApi.profile();
  if (r.ok) gardenStore.setGardener(r.data.gardener);
}
