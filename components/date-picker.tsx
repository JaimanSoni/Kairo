"use client";

import { useState } from "react";
import { addDays, nextWeekday, parseDateStr, toDateStr } from "@/lib/dates";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * Custom calendar. Monday-first grid, past days disabled,
 * quick-picks for the common cases.
 */
export function DatePicker({
  value,
  onChange,
  today,
  allowClear = true,
  clearLabel = "No day",
}: {
  value: string | null;
  onChange: (date: string | null) => void;
  today: string;
  allowClear?: boolean;
  clearLabel?: string;
}) {
  const [view, setView] = useState(() => (value && value >= today ? value : today).slice(0, 7));
  const [vy, vm] = view.split("-").map(Number);

  const firstOfMonth = new Date(vy, vm - 1, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(vy, vm, 0).getDate();

  const moveMonth = (delta: number) => {
    const d = new Date(vy, vm - 1 + delta, 1);
    setView(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const todayMonth = today.slice(0, 7);
  const canGoBack = view > todayMonth;

  const cells: (string | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      toDateStr(new Date(vy, vm - 1, i + 1))
    ),
  ];

  const quicks: { label: string; date: string | null }[] = [
    { label: "Today", date: today },
    { label: "Tomorrow", date: addDays(today, 1) },
    { label: "Next Mon", date: nextWeekday(1, today) },
    ...(allowClear ? [{ label: clearLabel, date: null }] : []),
  ];

  return (
    <div className="w-full max-w-[300px]">
      {/* quick picks */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {quicks.map((q) => (
          <button
            key={q.label}
            onClick={() => onChange(q.date)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              value === q.date
                ? "border-sun bg-sun-soft text-sun-deep"
                : "border-line bg-card text-ink-soft hover:border-ink-faint"
            }`}
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* month header */}
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={() => moveMonth(-1)}
          disabled={!canGoBack}
          aria-label="Previous month"
          className="grid size-8 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-paper-deep disabled:opacity-25"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-sm font-bold">
          {MONTHS[vm - 1]} <span className="text-ink-faint">{vy}</span>
        </span>
        <button
          onClick={() => moveMonth(1)}
          aria-label="Next month"
          className="grid size-8 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-paper-deep"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* grid */}
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {DOW.map((d, i) => (
          <span key={i} className="pb-1 text-[10px] font-semibold uppercase text-ink-faint">
            {d}
          </span>
        ))}
        {cells.map((date, i) => {
          if (!date) return <span key={`b${i}`} />;
          const past = date < today;
          const selected = date === value;
          const isToday = date === today;
          const weekend = [6, 0].includes(parseDateStr(date).getDay());
          return (
            <button
              key={date}
              disabled={past}
              onClick={() => onChange(date)}
              className={`mx-auto grid size-9 place-items-center rounded-full text-[13px] tabular-nums transition-colors ${
                selected
                  ? "bg-sun font-bold text-on-accent shadow-sm"
                  : past
                    ? "text-ink-faint/40"
                    : isToday
                      ? "font-bold text-sun-deep ring-1 ring-sun/50 hover:bg-sun-soft"
                      : `hover:bg-paper-deep ${weekend ? "text-ink-soft" : "text-ink"}`
              }`}
            >
              {Number(date.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
