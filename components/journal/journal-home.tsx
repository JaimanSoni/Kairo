"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { friendlyDay } from "@/lib/dates";
import { track } from "@/lib/analytics-client";
import {
  longDate,
  MOODS,
  moodOf,
  type JournalSummary,
  type Mood,
} from "@/lib/journal-shared";
import { journalApi, journalCache, pendingDraftDates } from "@/lib/journal-client";
import type { SearchHit } from "@/lib/journal";
import { useApp } from "../store";
import { navigateApp } from "../app-views";
import { useMonthSwipe } from "../calendar-view";
import { PinPad, MIN_PIN } from "../pin-pad";
import { Icon3d } from "../img3d";
import { Modal } from "../ui";
import { JournalLockGate } from "./lock-gate";
import { promptFor } from "./prompts";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const monthOf = (date: string) => date.slice(0, 7);

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function lastDayOf(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
}

/** Monday-first cells for a month; null pads the weeks at either end. */
function monthCells(month: string): (string | null)[] {
  const [y, m] = month.split("-").map(Number);
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const days = new Date(y, m, 0).getDate();
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) cells.push(`${month}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}

/** A mood's colour as a dot — Radiant alone gets the whole spectrum. */
function MoodDot({ mood, size = 6 }: { mood: Mood | null; size?: number }) {
  const m = moodOf(mood);
  return (
    <span
      className="block shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: !m
          ? "var(--color-ink-faint)"
          : m.value === 5
            ? "conic-gradient(#d96354, #d8a03e, #4ca75b, #4e93c9, #8d7bd4, #c960a5, #d96354)"
            : m.color,
      }}
    />
  );
}

function highlightMatch(text: string, q: string): React.ReactNode {
  const needle = q.trim();
  if (!needle) return text;
  const parts = text.split(new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"));
  return parts.map((p, i) =>
    p.toLowerCase() === needle.toLowerCase() ? (
      <mark key={i} className="rounded px-0.5 text-ink" style={{ background: "var(--hl-amber)" }}>
        {p}
      </mark>
    ) : (
      p
    )
  );
}

/* --------------------------------------------------------------- the home */

export function JournalHome() {
  const { state } = useApp();
  const today = state.today;
  const userId = state.user.id;
  const thisMonth = monthOf(today);

  const [month, setMonth] = useState(thisMonth);
  const [status, setStatus] = useState<"loading" | "ready" | "locked" | "offline">("loading");
  const [hasPin, setHasPin] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [reload, setReload] = useState(0);

  useSyncExternalStore(journalCache.subscribe, journalCache.snapshot, journalCache.snapshot);
  const cache = journalCache.get();

  // the first load brings the totals and memories along with this month
  useEffect(() => {
    let cancelled = false;
    journalApi.range(`${thisMonth}-01`, today, today).then((r) => {
      if (cancelled) return;
      if (r.ok) {
        journalCache.loadMonth(thisMonth, r.data.entries);
        journalCache.setHome(r.data.stats, r.data.memories);
        setStatus("ready");
      } else if (r.kind === "locked") {
        journalCache.reset();
        setStatus("locked");
      } else {
        setStatus(journalCache.get().months.has(thisMonth) ? "ready" : "offline");
      }
    });
    journalApi.lockStatus().then((r) => {
      if (!cancelled && r.ok) setHasPin(r.data.hasPin);
    });
    track("journal-open");
    return () => {
      cancelled = true;
    };
  }, [thisMonth, today, reload]);

  // other months load as they're visited, and are shown from memory if seen before
  useEffect(() => {
    if (status !== "ready" || month === thisMonth) return;
    let cancelled = false;
    const to = lastDayOf(month) < today ? lastDayOf(month) : today;
    journalApi.range(`${month}-01`, to).then((r) => {
      if (cancelled) return;
      if (r.ok) journalCache.loadMonth(month, r.data.entries);
      else if (r.kind === "locked") setStatus("locked");
    });
    return () => {
      cancelled = true;
    };
  }, [month, thisMonth, today, status]);

  // search waits for a pause in typing; an empty box is the calendar again
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    let cancelled = false;
    const t = setTimeout(() => {
      setSearching(true);
      journalApi.search(q).then((r) => {
        if (cancelled) return;
        setSearching(false);
        if (r.ok) setResults(r.data.results);
        else if (r.kind === "locked") setStatus("locked");
        else setResults([]);
      });
    }, 260);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const entries = useMemo(
    () => [...cache.days.values()].filter((e) => e.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date)),
    // the cache mutates in place; its tick is what says it changed
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cache.tick, month]
  );

  const unsynced = useMemo(
    () => (status === "ready" ? pendingDraftDates(userId) : []),
    // re-read whenever the cache moves — a successful save clears a draft
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, userId, cache.tick]
  );

  if (status === "locked") {
    return (
      <JournalLockGate
        onUnlocked={() => {
          setStatus("loading");
          setReload((n) => n + 1);
        }}
      />
    );
  }

  const todayEntry = cache.days.get(today) ?? null;
  const stats = cache.stats;
  const memories = cache.memories;
  const searchMode = query.trim().length > 0;

  const lockNow = async () => {
    const r = await journalApi.lockNow();
    if (r.ok) {
      journalCache.reset();
      setStatus("locked");
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-32 pt-8 sm:px-6">
      <header className="anim-rise mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">Journal</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {stats && stats.entries > 0 ? (
              <>
                <b className="text-ink">{stats.entries.toLocaleString()}</b> {stats.entries === 1 ? "page" : "pages"}
                {stats.wordsThisYear > 0 && (
                  <>
                    {" "}· <b className="text-ink">{stats.wordsThisYear.toLocaleString()}</b> words this year
                  </>
                )}
              </>
            ) : (
              "A page a day, written your way."
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {hasPin && (
            <button
              onClick={lockNow}
              aria-label="Lock journal now"
              data-tip="Lock now"
              className="grid size-9 place-items-center rounded-full text-ink-soft transition-colors hover:bg-card hover:text-ink"
            >
              🔒
            </button>
          )}
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Journal settings"
            data-tip="Journal settings"
            className="grid size-9 place-items-center rounded-full text-ink-soft transition-colors hover:bg-card hover:text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <circle cx="3" cy="8" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="13" cy="8" r="1.5" />
            </svg>
          </button>
        </div>
      </header>

      {unsynced.length > 0 && (
        <div className="anim-rise mb-4 rounded-2xl border border-[#d8a03e]/40 bg-card px-4 py-3 text-sm">
          <span className="text-ink-soft">
            {unsynced.length === 1 ? "A page" : `${unsynced.length} pages`} written on this device {unsynced.length === 1 ? "hasn't" : "haven't"} synced yet:{" "}
          </span>
          {unsynced.slice(0, 4).map((d, i) => (
            <button key={d} onClick={() => navigateApp(`/journal/${d}`)} className="font-semibold text-sun-deep underline-offset-2 hover:underline">
              {i > 0 && ", "}
              {friendlyDay(d, today)}
            </button>
          ))}
        </div>
      )}

      <TodayCard entry={todayEntry} today={today} loading={status === "loading"} />

      {/* search */}
      <div className="relative mt-5">
        <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!e.target.value.trim()) setResults(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setQuery("");
              setResults(null);
            }
          }}
          placeholder="Search your journal"
          aria-label="Search your journal"
          className="w-full rounded-2xl border border-line bg-card/70 py-2.5 pl-10 pr-10 text-sm outline-none transition-colors placeholder:text-ink-faint focus:border-sun"
        />
        {searchMode && (
          <button
            onClick={() => {
              setQuery("");
              setResults(null);
            }}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-ink-faint hover:bg-paper-deep"
          >
            ×
          </button>
        )}
      </div>

      {searchMode ? (
        <SearchResults results={results} query={query} searching={searching} today={today} />
      ) : (
        <>
          <MonthCalendar
            month={month}
            thisMonth={thisMonth}
            today={today}
            days={cache.days}
            onMonth={setMonth}
          />

          {memories && (memories.yearsAgo.length > 0 || memories.monthAgo || memories.weekAgo) && month === thisMonth && (
            <Memories memories={memories} today={today} />
          )}

          <section className="mt-8">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-ink-faint">
              {month === thisMonth ? "This month" : `${MONTHS[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`}
            </h2>
            {entries.length === 0 ? (
              status === "offline" ? (
                <p className="rounded-2xl border border-dashed border-line px-5 py-8 text-center text-sm text-ink-faint">
                  You look offline. Your journal shows up once you&apos;re back.
                </p>
              ) : (
                <p className="rounded-2xl border border-dashed border-line px-5 py-8 text-center text-sm text-ink-faint">
                  {month === thisMonth
                    ? "Nothing written this month yet. Any day is a fine day to start."
                    : "Nothing written this month."}
                </p>
              )
            ) : (
              <div className="space-y-2">
                {entries.map((e) => (
                  <EntryRow key={e.date} entry={e} today={today} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {settingsOpen && (
        <JournalSettings
          hasPin={hasPin}
          onClose={() => setSettingsOpen(false)}
          onPinChanged={(v) => setHasPin(v)}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- today */

function TodayCard({ entry, today, loading }: { entry: JournalSummary | null; today: string; loading: boolean }) {
  const [weekday, rest] = longDate(today).split(", ");
  const dayMonth = rest.split(" ").slice(0, 2).join(" ");
  const mood = moodOf(entry?.mood);

  return (
    <button
      onClick={() => navigateApp(`/journal/${today}`)}
      className="anim-rise group relative block w-full overflow-hidden rounded-3xl border border-line bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-sun/50 hover:shadow-lg sm:p-6"
    >
      {/* the day's weather, as light across the card */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full opacity-25 blur-3xl transition-opacity group-hover:opacity-40"
        style={{ background: mood?.color ?? "var(--color-sun)" }}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-sun-deep">
            {weekday}
            <span className="rounded-full bg-sun-soft px-2 py-0.5 text-[10px] tracking-[0.1em]">Today</span>
          </div>
          <div className="font-display mt-1 text-3xl">{dayMonth}</div>
        </div>
        {mood ? <span className="text-3xl">{mood.emoji}</span> : <Icon3d name="feather" size={44} className="opacity-90" />}
      </div>

      <div className="relative mt-4 min-h-[2.75rem]">
        {loading ? (
          <div className="space-y-2">
            <div className="h-3.5 w-11/12 animate-pulse rounded-full bg-paper-deep" />
            <div className="h-3.5 w-2/3 animate-pulse rounded-full bg-paper-deep" />
          </div>
        ) : entry ? (
          <>
            {entry.title && <div className="font-display text-lg leading-snug">{entry.title}</div>}
            <p className="line-clamp-2 text-sm leading-relaxed text-ink-soft">{entry.preview || "A page with a feeling and no words yet."}</p>
          </>
        ) : (
          <p className="font-display text-lg italic leading-snug text-ink-soft">{promptFor(today)}</p>
        )}
      </div>

      <div className="relative mt-4 flex items-center justify-between">
        <span className="text-xs text-ink-faint">{entry ? `${entry.words.toLocaleString()} ${entry.words === 1 ? "word" : "words"}` : "A blank page"}</span>
        <span className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-paper transition-transform group-hover:translate-x-0.5">
          {entry ? "Keep writing" : "Start today's page"} <span aria-hidden>→</span>
        </span>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------- calendar */

function MonthCalendar({
  month,
  thisMonth,
  today,
  days,
  onMonth,
}: {
  month: string;
  thisMonth: string;
  today: string;
  days: Map<string, JournalSummary>;
  onMonth: (m: string) => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const atNewest = month >= thisMonth;

  const go = useCallback(
    (delta: number) => {
      const next = shiftMonth(month, delta);
      if (next > thisMonth) return;
      onMonth(next);
    },
    [month, thisMonth, onMonth]
  );
  useMonthSwipe(frame, trackRef, go);

  const [y, m] = month.split("-").map(Number);
  const cells = monthCells(month);
  const written = cells.filter((d) => d && days.has(d)).length;

  return (
    <section className="mt-6 rounded-3xl border border-line bg-card/60 p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <button onClick={() => go(-1)} aria-label="Previous month" className="grid size-8 place-items-center rounded-full text-ink-soft hover:bg-paper-deep">
          ‹
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="font-display text-xl">
            {MONTHS[m - 1]} <span className="text-ink-faint">{y}</span>
          </div>
          <div className="text-[11px] text-ink-faint">
            {written === 0 ? "No pages" : `${written} ${written === 1 ? "page" : "pages"}`}
          </div>
        </div>
        <button
          onClick={() => go(1)}
          disabled={atNewest}
          aria-label="Next month"
          className="grid size-8 place-items-center rounded-full text-ink-soft hover:bg-paper-deep disabled:opacity-30 disabled:hover:bg-transparent"
        >
          ›
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
        {DOW.map((d) => (
          <div key={d} className="py-1">
            {d.slice(0, 1)}
            <span className="hidden sm:inline">{d.slice(1)}</span>
          </div>
        ))}
      </div>

      <div ref={frame} className="overflow-hidden">
        <div ref={trackRef} className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {cells.map((d, i) => {
            if (!d) return <div key={`pad-${i}`} className="aspect-square" />;
            const entry = days.get(d);
            const future = d > today;
            const isToday = d === today;
            const mood = moodOf(entry?.mood);
            const tint = entry ? (mood ? mood.color : "var(--color-sun)") : null;
            return (
              <button
                key={d}
                disabled={future}
                onClick={() => navigateApp(`/journal/${d}`)}
                aria-label={`${longDate(d)}${entry ? `, ${entry.words} words${mood ? `, ${mood.label}` : ""}` : ", nothing written"}`}
                title={entry ? entry.title || entry.preview.slice(0, 80) || longDate(d) : future ? undefined : "Write about this day"}
                className={`group relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition-all ${
                  future
                    ? "cursor-default text-ink-faint/40"
                    : entry
                      ? "font-semibold text-ink hover:-translate-y-0.5 hover:shadow-md"
                      : "text-ink-soft hover:bg-paper-deep"
                } ${isToday && !tint ? "ring-2 ring-sun ring-offset-1 ring-offset-card" : ""}`}
                style={
                  tint
                    ? {
                        background: `color-mix(in srgb, ${tint} 20%, var(--color-card))`,
                        // a written day's edge is a shadow, which paints over a ring class, so today's ring joins it
                        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tint} 38%, transparent)${
                          isToday ? ", 0 0 0 1px var(--color-card), 0 0 0 3px var(--color-sun)" : ""
                        }`,
                      }
                    : undefined
                }
              >
                <span>{Number(d.slice(8))}</span>
                {entry ? (
                  <span className="absolute bottom-1.5 flex items-center gap-0.5">
                    <MoodDot mood={entry.mood} size={5} />
                  </span>
                ) : (
                  !future && (
                    <span className="absolute bottom-0.5 text-[10px] leading-none text-ink-faint opacity-0 transition-opacity group-hover:opacity-100" aria-hidden>
                      +
                    </span>
                  )
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-ink-faint">
        {MOODS.map((mo) => (
          <span key={mo.value} className="flex items-center gap-1">
            <MoodDot mood={mo.value} size={6} /> {mo.label}
          </span>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- memories */

function Memories({ memories, today }: { memories: NonNullable<ReturnType<typeof journalCache.get>["memories"]>; today: string }) {
  const cards: { label: string; entry: JournalSummary }[] = [];
  for (const e of memories.yearsAgo) {
    const years = Number(today.slice(0, 4)) - Number(e.date.slice(0, 4));
    cards.push({ label: years === 1 ? "A year ago today" : `${years} years ago today`, entry: e });
  }
  if (memories.monthAgo) cards.push({ label: "A month ago", entry: memories.monthAgo });
  if (memories.weekAgo) cards.push({ label: "A week ago", entry: memories.weekAgo });

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-ink-faint">On this day</h2>
      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {cards.map(({ label, entry }) => {
          const mood = moodOf(entry.mood);
          return (
            <button
              key={entry.date}
              onClick={() => navigateApp(`/journal/${entry.date}`)}
              className="w-64 shrink-0 snap-start rounded-2xl border border-line bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-sun/50 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-sun-deep">{label}</span>
                {mood && <span>{mood.emoji}</span>}
              </div>
              <div className="mt-1 text-xs text-ink-faint">{longDate(entry.date)}</div>
              <p className="font-display mt-2 line-clamp-3 text-[15px] italic leading-snug text-ink-soft">
                {entry.title ? `${entry.title}. ` : ""}
                {entry.preview}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ list rows */

function EntryRow({ entry, today }: { entry: JournalSummary; today: string }) {
  const mood = moodOf(entry.mood);
  const [weekday] = longDate(entry.date).split(",");
  return (
    <button
      onClick={() => navigateApp(`/journal/${entry.date}`)}
      className="flex w-full items-start gap-3.5 rounded-2xl border border-line/70 bg-card/70 px-4 py-3 text-left transition-all hover:border-sun/40 hover:bg-card"
    >
      <div className="w-10 shrink-0 text-center">
        <div className="font-display text-2xl leading-none">{Number(entry.date.slice(8))}</div>
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">{weekday.slice(0, 3)}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{entry.title || friendlyDay(entry.date, today)}</span>
          {mood && <span className="shrink-0 text-sm" title={mood.label}>{mood.emoji}</span>}
        </div>
        <p className="mt-0.5 line-clamp-2 text-sm leading-relaxed text-ink-soft">{entry.preview || "A feeling, no words."}</p>
      </div>
      <span className="shrink-0 pt-0.5 text-[11px] text-ink-faint">{entry.words.toLocaleString()}w</span>
    </button>
  );
}

function SearchResults({ results, query, searching, today }: { results: SearchHit[] | null; query: string; searching: boolean; today: string }) {
  if (results === null || (searching && results.length === 0)) {
    return <p className="py-10 text-center text-sm text-ink-faint">Looking through your pages…</p>;
  }
  if (results.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-ink-faint">
        Nothing mentions &ldquo;{query.trim()}&rdquo;.
      </p>
    );
  }
  return (
    <section className="mt-5">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-ink-faint">
        {results.length === 50 ? "50+" : results.length} {results.length === 1 ? "page" : "pages"}
      </h2>
      <div className="space-y-2">
        {results.map((r) => {
          const mood = moodOf(r.mood);
          return (
            <button
              key={r.date}
              onClick={() => navigateApp(`/journal/${r.date}`)}
              className="block w-full rounded-2xl border border-line/70 bg-card/70 px-4 py-3 text-left transition-colors hover:border-sun/40 hover:bg-card"
            >
              <div className="flex items-center gap-2 text-xs text-ink-faint">
                <span className="font-semibold text-ink-soft">{friendlyDay(r.date, today)}</span>
                <span>{longDate(r.date)}</span>
                {mood && <span className="ml-auto">{mood.emoji}</span>}
              </div>
              {r.title && <div className="mt-1 text-sm font-semibold">{highlightMatch(r.title, query)}</div>}
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{highlightMatch(r.snippet, query)}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- settings */

type PinFlow = null | "set" | "change" | "remove";

function JournalSettings({
  hasPin,
  onClose,
  onPinChanged,
}: {
  hasPin: boolean;
  onClose: () => void;
  onPinChanged: (hasPin: boolean) => void;
}) {
  const { showToast } = useApp();
  const [flow, setFlow] = useState<PinFlow>(null);

  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        {flow ? (
          <PinFlowView
            flow={flow}
            onDone={(nowHasPin) => {
              onPinChanged(nowHasPin);
              setFlow(null);
              showToast({ message: nowHasPin ? "Journal PIN saved." : "Journal PIN removed." });
            }}
            onCancel={() => setFlow(null)}
          />
        ) : (
          <>
            <h2 className="font-display text-2xl">Journal settings</h2>

            <div className="mt-6">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Privacy</div>
              <div className="rounded-2xl border border-line bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Journal PIN</div>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
                      {hasPin
                        ? "On. Your pages aren't sent to this browser until the PIN is entered."
                        : "A PIN just for the journal, separate from the app lock. Pages stay on the server until it's entered."}
                    </p>
                  </div>
                  {!hasPin && (
                    <button onClick={() => setFlow("set")} className="shrink-0 rounded-full border border-line bg-card px-4 py-1.5 text-xs font-semibold text-ink-soft hover:border-sun hover:text-sun-deep">
                      Set up
                    </button>
                  )}
                </div>
                {hasPin && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => setFlow("change")} className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-ink-faint">
                      Change PIN
                    </button>
                    <button onClick={() => setFlow("remove")} className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-clay hover:text-clay">
                      Remove
                    </button>
                  </div>
                )}
              </div>
              <p className="mt-2 px-1 text-xs leading-relaxed text-ink-faint">
                Journal pages are never sent to Kairo&apos;s AI. Assistants connected to Kairo can only reach them if you tick <b>Include journal</b> on their key.
              </p>
            </div>

            <div className="mt-6">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Your words</div>
              <button
                type="button"
                onClick={() => {
                  track("journal-export");
                  // a download, not a page: the response is an attachment, so the app stays put
                  window.location.assign("/api/journal/export");
                }}
                className="flex w-full items-center justify-between rounded-2xl border border-line bg-card p-4 text-left transition-colors hover:border-sun"
              >
                <span>
                  <span className="block text-sm font-semibold">Download your journal</span>
                  <span className="block text-xs text-ink-soft">Every page, as one Markdown file that opens anywhere.</span>
                </span>
                <span className="text-ink-faint" aria-hidden>
                  ↓
                </span>
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function PinFlowView({
  flow,
  onDone,
  onCancel,
}: {
  flow: Exclude<PinFlow, null>;
  onDone: (hasPin: boolean) => void;
  onCancel: () => void;
}) {
  // set: new → confirm · change: current → new → confirm · remove: current
  const [step, setStep] = useState<"current" | "new" | "confirm">(flow === "set" ? "new" : "current");
  const [pin, setPin] = useState("");
  const [current, setCurrent] = useState("");
  const [first, setFirst] = useState("");
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fail = (msg: string | null) => {
    setPin("");
    setShake(true);
    setMessage(msg);
    setTimeout(() => setShake(false), 450);
  };

  const submit = async () => {
    if (pin.length < MIN_PIN || busy) return;

    if (step === "current") {
      if (flow === "remove") {
        setBusy(true);
        const r = await journalApi.removePin(pin);
        setBusy(false);
        if (r.ok) onDone(false);
        else fail(r.kind === "invalid" && r.message !== "Wrong PIN" ? r.message : "That's not the current PIN.");
        return;
      }
      setCurrent(pin);
      setPin("");
      setStep("new");
      return;
    }
    if (step === "new") {
      setFirst(pin);
      setPin("");
      setStep("confirm");
      setMessage(null);
      return;
    }
    if (pin !== first) {
      setStep("new");
      setFirst("");
      fail("Those didn't match. Try once more.");
      return;
    }
    setBusy(true);
    const r = await journalApi.setPin(pin, flow === "change" ? current : undefined);
    setBusy(false);
    if (r.ok) {
      onDone(true);
      return;
    }
    // a wrong current PIN only shows up at the very end; start the change over
    if (flow === "change") {
      setStep("current");
      setCurrent("");
      setFirst("");
    }
    fail(r.kind === "invalid" ? r.message : "Couldn't save the PIN.");
  };

  const heading =
    step === "current" ? "Enter your current PIN" : step === "new" ? (flow === "change" ? "Choose a new PIN" : "Choose a journal PIN") : "Once more, to be sure";

  return (
    <div className="flex flex-col items-center text-center">
      <Icon3d name="lock" size={52} />
      <h2 className="font-display mt-2 text-2xl">{heading}</h2>
      <p className="mt-1 text-sm text-ink-soft">
        {step === "new" ? "4–8 digits. There's no way to recover it, so pick one you'll remember." : " "}
      </p>
      <PinPad pin={pin} onPinChange={setPin} onSubmit={submit} busy={busy} shake={shake} />
      {message && <p className="mt-3 text-sm text-clay">{message}</p>}
      <button onClick={onCancel} className="mt-4 text-sm text-ink-faint underline-offset-2 hover:underline">
        Cancel
      </button>
    </div>
  );
}
