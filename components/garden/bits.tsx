"use client";

import { type HabitColor, type HabitView } from "@/lib/habits-shared";
import { navigateApp } from "../app-views";
import { IconArrowLeft } from "./icons";
import { Plant } from "./plants";

/** The habit colours, as the tile tints and accents they become. */
export const HABIT_TINT: Record<HabitColor, string> = {
  sun: "#0c9384",
  amber: "#d8a03e",
  rose: "#d96354",
  lilac: "#8d7bd4",
  sky: "#4e93c9",
  moss: "#4ca75b",
};

/** What marking yesterday would save. A weekly habit's last week may need more than one day. */
export function rescueText(habit: HabitView, keeps: number): string {
  if (habit.schedule.kind === "weekly") {
    return `Last week isn't met yet. Mark Sunday done if you did it, and your ${keeps}-week streak carries on.`;
  }
  return `Not marked yesterday. If you did it, mark it now and your ${keeps}-day streak carries on.`;
}

/**
 * A habit's mark: its own plant, on a tile tinted with its colour, grown as
 * far as the habit is rooted. Every habit already has a face, and it's the
 * one growing.
 */
export function HabitMark({ habit, stage = 4, size = 40, className = "" }: { habit: Pick<HabitView, "species" | "color">; stage?: number; size?: number; className?: string }) {
  const tint = HABIT_TINT[habit.color] ?? HABIT_TINT.sun;
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-xl ${className}`}
      style={{ width: size, height: size, background: `color-mix(in srgb, ${tint} 13%, transparent)` }}
      aria-hidden
    >
      <Plant species={habit.species} stage={Math.max(1, Math.min(5, stage))} size={size * 0.78} sway={false} ground="none" fit="tight" />
    </span>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        navigateApp(href);
      }}
      className="-ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-medium text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink"
    >
      <IconArrowLeft size={14} /> {label}
    </a>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">{children}</h2>
      {action}
    </div>
  );
}

/** A quiet pill: the same outline button Lists and Notes use in their headers. */
export function PillLink({ href, icon, children, primary = false }: { href: string; icon?: React.ReactNode; children: React.ReactNode; primary?: boolean }) {
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        navigateApp(href);
      }}
      className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors ${
        primary ? "bg-ink text-paper hover:bg-ink/90" : "border border-line bg-card text-ink-soft hover:border-ink-faint hover:text-ink"
      }`}
    >
      {icon}
      {children}
    </a>
  );
}

export function Avatar({ animal, size = 32, className = "" }: { animal: string; size?: number; className?: string }) {
  const n = /^[1-6]$/.test(animal) ? animal : "1";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/avatars/avatar-${n}.png`} alt="" width={size} height={size} className={`shrink-0 rounded-full bg-paper-deep object-cover ${className}`} style={{ width: size, height: size }} />
  );
}

export function Stat({ value, label, icon }: { value: React.ReactNode; label: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-card px-4 py-3">
      <div className="flex items-center gap-1.5 text-ink-faint">
        {icon}
        <span className="text-[11px] font-medium">{label}</span>
      </div>
      <div className="font-display mt-1 text-[1.65rem] leading-none text-ink">{value}</div>
    </div>
  );
}

/** A switch, for settings that are on or off. */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${checked ? "bg-sun" : "bg-line"}`}
    >
      <span className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-card shadow-sm transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`} />
    </button>
  );
}

const MEDAL = ["#d9a520", "#9aa7ad", "#c07b4a"];

/** A rank on a board: the top three wear a quiet medal colour, the rest are just numbers. */
export function RankBadge({ rank }: { rank: number }) {
  const medal = rank <= 3 ? MEDAL[rank - 1] : null;
  return (
    <span
      className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums ${medal ? "text-white" : "text-ink-faint"}`}
      style={medal ? { background: medal } : undefined}
    >
      {rank}
    </span>
  );
}
