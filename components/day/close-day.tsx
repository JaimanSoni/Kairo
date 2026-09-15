"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { docToText, EMPTY_DOC, previewOf } from "@/lib/doc-model";
import { journalApi, journalCache, pendingDraftDates } from "@/lib/journal-client";
import { MOODS, type JournalEntry, type Mood } from "@/lib/journal-shared";
import { gardenStore } from "@/lib/habits-client";
import { track } from "@/lib/analytics-client";
import { navigateApp } from "../app-views";
import { Icon3d } from "../img3d";
import { useApp } from "../store";
import { IconArrowRight } from "../ui";
import { habitsOn } from "./day-data";
import { WeatherPicker } from "./weather";

type Load =
  | { status: "loading" }
  | { status: "ready"; entry: JournalEntry | null }
  | { status: "locked" }
  | { status: "offline" };

const subscribeMinute = (cb: () => void) => {
  const id = setInterval(cb, 60_000);
  return () => clearInterval(id);
};
const hourNow = () => new Date().getHours();

/** Evening starts here: the card that closes the day shows itself from then on. */
export const EVENING_HOUR = 17;

/** The browser's hour, and -1 while the page is still coming from the server. */
export function useHour(): number {
  return useSyncExternalStore(subscribeMinute, hourNow, () => -1);
}

/**
 * The end of a day, on Today: how it felt, what got done and watered, and a
 * way into the journal to write it down. It shows in the evening, once the
 * day is won, or as soon as today already has a page, and never asks twice:
 * the weather picked here is the weather on the journal page.
 */
export function CloseTheDay({
  today,
  doneCount,
  dayWon,
  share,
}: {
  today: string;
  doneCount: number;
  dayWon: boolean;
  /** The way to share a won day, when there's something to share. */
  share?: React.ReactNode;
}) {
  const { state, showToast } = useApp();
  const userId = state.user.id;
  const hour = useHour();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [mood, setMood] = useState<Mood | null>(null);
  const [saving, setSaving] = useState(false);
  useSyncExternalStore(gardenStore.subscribe, gardenStore.snapshot, () => 0);

  useEffect(() => {
    let cancelled = false;
    journalApi.get(today).then((r) => {
      if (cancelled) return;
      if (r.ok) {
        setLoad({ status: "ready", entry: r.data.entry });
        setMood(r.data.entry?.mood ?? null);
      } else {
        setLoad({ status: r.kind === "locked" ? "locked" : "offline" });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [today]);

  const entry = load.status === "ready" ? load.entry : null;
  const hasPage = Boolean(entry && (entry.words > 0 || entry.mood));
  const evening = hour >= EVENING_HOUR;
  if (hour < 0 || load.status === "loading" || !(evening || dayWon || hasPage)) return null;

  const writeHref = `/journal/${today}`;

  const pick = async (m: Mood) => {
    if (saving || load.status !== "ready") return;
    // unsaved writing on this device wins: the page itself takes the weather, so nothing is overwritten
    if (pendingDraftDates(userId).includes(today)) {
      navigateApp(writeHref);
      return;
    }
    const before = mood;
    setMood(m);
    setSaving(true);
    let current = load.entry;
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await journalApi.save(today, {
        title: current?.title ?? "",
        doc: current?.doc ?? EMPTY_DOC,
        mood: m,
        baseVersion: current?.version ?? 0,
      });
      if (r.ok) {
        setLoad({ status: "ready", entry: r.data.entry });
        if (r.data.entry) journalCache.put(today, r.data.entry, previewOf(docToText(r.data.entry.doc)));
        track("today-weather", { mood: m });
        setSaving(false);
        return;
      }
      if (r.kind === "conflict" && attempt === 0) {
        // written on another device a moment ago: keep its words, add the weather
        current = r.current;
        continue;
      }
      setMood(before);
      setSaving(false);
      if (r.kind === "locked") setLoad({ status: "locked" });
      showToast({ message: r.kind === "offline" ? "You're offline, so the weather didn't save." : "Couldn't save today's weather." });
      return;
    }
    setMood(before);
    setSaving(false);
  };

  const { watered, waiting } = state.user.spaces.garden ? habitsOn(today, today) : { watered: [], waiting: [] };
  const plants = watered.length + waiting.length;
  const parts: string[] = [];
  if (doneCount > 0) parts.push(`finished ${doneCount} ${doneCount === 1 ? "thing" : "things"}`);
  if (plants > 0) parts.push(`watered ${watered.length} of ${plants} ${plants === 1 ? "plant" : "plants"}`);
  if (entry && entry.words > 0) parts.push(`wrote ${entry.words.toLocaleString()} ${entry.words === 1 ? "word" : "words"}`);
  const summary =
    parts.length === 0
      ? "A quiet one. Those count too."
      : `You ${parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`}.`;
  const chosen = mood ? MOODS[mood - 1] : null;

  return (
    <section aria-label="Close the day" data-close-day className="anim-rise mt-8 overflow-hidden rounded-3xl border border-line bg-card">
      <div className="px-5 pb-4 pt-5">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
          <Icon3d name="moon" size={18} />
          {evening ? "Tonight" : "So far today"}
        </div>
        <h2 className="font-display mt-1.5 text-2xl">{chosen ? `A ${chosen.label.toLowerCase()} day.` : "How did today feel?"}</h2>
        {load.status === "ready" ? (
          <div className="mt-3">
            <WeatherPicker mood={mood} onPick={(m) => void pick(m)} disabled={saving} labels />
          </div>
        ) : load.status === "locked" ? (
          <p className="mt-1 text-sm text-ink-faint">Your journal is locked. Open it to write about today.</p>
        ) : (
          <p className="mt-1 text-sm text-ink-faint">You look offline. The weather can wait.</p>
        )}
      </div>
      <div className="flex flex-col gap-3 border-t border-line bg-paper/60 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <p className="min-w-0 flex-1 text-sm text-ink-soft">{summary}</p>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {share}
          <a
            href={writeHref}
            onClick={(e) => {
              e.preventDefault();
              navigateApp(load.status === "locked" ? "/journal" : writeHref);
            }}
            data-track="today-write"
            className="flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-xs font-semibold text-paper transition-transform hover:-translate-y-0.5"
          >
            {entry && entry.words > 0 ? "Keep writing" : "Write about today"} <IconArrowRight size={13} />
          </a>
        </div>
      </div>
    </section>
  );
}
