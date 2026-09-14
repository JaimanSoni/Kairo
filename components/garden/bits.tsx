"use client";

import type { HabitView } from "@/lib/habits-shared";
import { navigateApp } from "../app-views";

/** What watering yesterday would save. A weekly habit's last week may need more than one day. */
export function rescueText(habit: HabitView, keeps: number): string {
  if (habit.schedule.kind === "weekly") {
    return `Last week isn't kept yet, and yesterday still counts toward it. Water Sunday to help save your ${keeps}-week streak.`;
  }
  return `${habit.name} wasn't watered yesterday. Water it now and your ${keeps}-day streak lives on.`;
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        navigateApp(href);
      }}
      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-medium text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink"
    >
      <span aria-hidden>←</span> {label}
    </a>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">{children}</h2>
      {action}
    </div>
  );
}

export function Avatar({ animal, size = 32, className = "" }: { animal: string; size?: number; className?: string }) {
  const n = /^[1-6]$/.test(animal) ? animal : "1";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/avatars/avatar-${n}.png`} alt="" width={size} height={size} className={`shrink-0 rounded-full bg-paper-deep object-cover ${className}`} style={{ width: size, height: size }} />
  );
}

export function Stat({ value, label, tone = "" }: { value: React.ReactNode; label: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card px-3 py-2.5">
      <div className={`font-display text-2xl leading-none ${tone}`}>{value}</div>
      <div className="mt-1 text-[11px] font-medium text-ink-faint">{label}</div>
    </div>
  );
}
