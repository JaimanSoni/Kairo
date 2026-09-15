"use client";

import Link from "next/link";
import type { JournalSummary } from "@/lib/journal-shared";
import { navigateApp } from "../app-views";
import { IconJournal } from "../ui";
import type { JournalAccess } from "./day-data";
import { WeatherIcon } from "./weather";

/**
 * A day's journal page, from anywhere a day is shown: its weather, title and
 * first words, or a way to write it. Nothing for days still to come, and
 * nothing but the lock when the journal is locked.
 */
export function DayJournal({
  date,
  today,
  summary,
  access,
  className = "",
}: {
  date: string;
  today: string;
  summary: JournalSummary | null;
  access: JournalAccess;
  className?: string;
}) {
  if (date > today || access === "off" || access === "loading" || access === "error") return null;
  const href = `/journal/${date}`;
  const go = (e: React.MouseEvent) => {
    e.preventDefault();
    navigateApp(href);
  };

  return (
    <section className={className} aria-label="Journal">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">Journal</div>
      {access === "locked" ? (
        <Link href="/journal" onClick={(e) => { e.preventDefault(); navigateApp("/journal"); }} className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-xs text-ink-faint hover:text-ink-soft">
          <IconJournal size={13} /> Your journal is locked
        </Link>
      ) : summary ? (
        <Link href={href} onClick={go} data-day-page={date} className="block rounded-xl border border-line bg-card px-3 py-2.5 transition-colors hover:border-ink-faint/50">
          <span className="flex items-center gap-2 text-sm font-medium">
            {summary.mood && <WeatherIcon mood={summary.mood} size={15} />}
            <span className="min-w-0 flex-1 truncate">{summary.title || (date === today ? "Today's page" : "A page")}</span>
            <span className="shrink-0 text-[11px] font-normal text-ink-faint">
              {summary.words} {summary.words === 1 ? "word" : "words"}
            </span>
          </span>
          {summary.preview && <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-ink-soft">{summary.preview}</span>}
        </Link>
      ) : (
        <Link href={href} onClick={go} data-day-page={date} className="flex items-center gap-2 rounded-xl border border-dashed border-line px-3 py-2 text-xs text-ink-faint transition-colors hover:border-sun/50 hover:text-sun-deep">
          <IconJournal size={13} /> {date === today ? "Write today's page" : "Write about this day"}
        </Link>
      )}
    </section>
  );
}
