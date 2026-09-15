import type { SpeciesId } from "@/lib/habits-shared";
import { IconFlame } from "../garden/icons";
import { Plant } from "../garden/plants";

/**
 * Demos for what came after the planner: habits that get stronger, and notes.
 * Like the others, drawn in markup and CSS, looping quietly.
 */

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div role="img" aria-label={label} className="glass overflow-hidden rounded-[1.75rem] p-4 shadow-xl shadow-ink/5 sm:p-5">
      {children}
    </div>
  );
}

const HABITS: { name: string; species: SpeciesId; tint: string; schedule: string; streak: number; strength: number; level: string }[] = [
  { name: "Read 10 pages", species: "apple", tint: "#4ca75b", schedule: "Every day", streak: 41, strength: 88, level: "Rooted" },
  { name: "Morning walk", species: "sunflower", tint: "#d8a03e", schedule: "Weekdays", streak: 12, strength: 54, level: "Growing strong" },
  { name: "Drink water", species: "lotus", tint: "#4e93c9", schedule: "8 glasses a day", streak: 5, strength: 21, level: "Taking root" },
];

/** Habits: each row fills its strength bar, and the check lands. */
export function HabitsDemo() {
  return (
    <Frame label="Three habits, each with a streak and a strength bar filling up as it's marked done">
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="font-display text-xl">Habits</span>
        <span className="rounded-full bg-moss-soft px-2.5 py-1 text-[11px] font-semibold text-moss">3 of 3 done today</span>
      </div>
      <ul className="space-y-2">
        {HABITS.map((h, i) => (
          <li key={h.name} className="flex items-center gap-3 rounded-2xl bg-card/85 px-3 py-2.5">
            <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl" style={{ background: `color-mix(in srgb, ${h.tint} 13%, transparent)` }}>
              <Plant species={h.species} stage={h.strength > 70 ? 5 : h.strength > 40 ? 4 : 3} size={34} sway={false} ground="none" fit="tight" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{h.name}</span>
              <span className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-faint">
                {h.schedule}
                <span className="flex items-center gap-0.5 text-clay">
                  <IconFlame size={11} /> {h.streak}
                </span>
              </span>
              <span className="mt-1.5 flex items-center gap-2">
                <span className="h-1 w-24 overflow-hidden rounded-full bg-paper-deep">
                  <span className="lp-fill block h-full rounded-full bg-moss" style={{ width: `${h.strength}%`, animationDelay: `${0.4 + i * 0.5}s` }} />
                </span>
                <span className="text-[10px] tabular-nums text-ink-faint">
                  {h.strength}% · {h.level}
                </span>
              </span>
            </span>
            <span className="lp-check grid size-9 shrink-0 place-items-center rounded-full border-2 border-sun/60 text-white" style={{ animationDelay: `${0.9 + i * 0.5}s` }} aria-hidden>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </li>
        ))}
      </ul>
    </Frame>
  );
}

/** Notes: a page writes itself, with a checklist ticking and a heading. */
export function NotesDemo() {
  return (
    <Frame label="A note page with a title, a checklist ticking itself off, and a paragraph">
      <div className="rounded-2xl bg-card/90 p-4 sm:p-5">
        <div className="flex items-center gap-2 text-[11px] text-ink-faint">
          <span className="rounded-md bg-paper-deep px-1.5 py-0.5">Trips</span>
          <span aria-hidden>/</span>
          <span>Goa in December</span>
        </div>
        <h3 className="font-display mt-3 text-2xl leading-tight">Goa in December</h3>
        <p className="mt-2 text-[13px] leading-6 text-ink-soft">Four days, two beaches, one very good fish curry. Everything we need, in one place.</p>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Before we go</p>
        <ul className="mt-2 space-y-1.5">
          {["Book the train", "Sunscreen and hats", "Ask Priya about the cafe"].map((t, i) => (
            <li key={t} className="flex items-center gap-2.5 text-[13px]">
              <span className="lp-box grid size-4 shrink-0 place-items-center rounded border-2 border-ink-faint/50 text-white" style={{ animationDelay: `${0.8 + i * 0.7}s` }} aria-hidden>
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                  <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="lp-strike" style={{ animationDelay: `${0.8 + i * 0.7}s` }}>
                {t}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-line px-3 py-2 text-[12px] text-ink-faint">
          <span className="rounded bg-paper-deep px-1.5 font-mono text-[11px]">/</span>
          <span className="lp-type overflow-hidden whitespace-nowrap">What I finished today</span>
        </div>
      </div>
    </Frame>
  );
}
