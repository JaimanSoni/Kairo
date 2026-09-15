"use client";

import { useState } from "react";
import {
  HABIT_NAME_MAX,
  PALETTE,
  scheduleLabel,
  SEED_CATEGORIES,
  SEEDS,
  SPECIES,
  WEEKDAY_SHORT,
  type HabitColor,
  type HabitSchedule,
  type HabitView,
  type Seed,
  type SeedCategory,
  type SpeciesId,
} from "@/lib/habits-shared";
import { JOURNAL_SHOWN } from "@/lib/types";
import { gardenApi, gardenStore } from "@/lib/habits-client";
import { track } from "@/lib/analytics-client";
import { useApp } from "../store";
import { IconPlus, IconX, Modal } from "../ui";
import { navigateApp } from "../app-views";
import { HabitMark } from "./bits";
import { DeleteHabitDialog } from "./delete-habit";
import { IconArrowLeft } from "./icons";
import { Plant } from "./plants";
import { plotOf, useGarden } from "./use-garden";

export const SWATCH: Record<HabitColor, string> = {
  sun: "#0c9384",
  amber: "#d8a03e",
  rose: "#d96354",
  lilac: "#8d7bd4",
  sky: "#4e93c9",
  moss: "#4ca75b",
};

/** A habit of your own gets a look without being asked; each new one a different one. */
const LOOKS: [SpeciesId, HabitColor][] = [
  ["sunflower", "sun"],
  ["tulip", "rose"],
  ["lavender", "lilac"],
  ["monstera", "sky"],
  ["cactus", "amber"],
  ["bonsai", "moss"],
  ["cherry", "rose"],
  ["lemon", "amber"],
];

const POPULAR = ["water", "walk", "read", "meditate", "workout", "sleep", "stretch", "gratitude"];

/** The ideas on offer: the journal's waits for the journal to be shown again. */
const IDEAS = SEEDS.filter((s) => s.id !== "journal" || JOURNAL_SHOWN);

/** What an idea asks for, in a few words. */
export function ideaLine(s: Pick<Seed, "target" | "unit" | "schedule">): string {
  return s.target > 1 ? `${s.target} ${s.unit || "times"} a day` : scheduleLabel(s.schedule);
}

type Draft = {
  name: string;
  species: SpeciesId;
  color: HabitColor;
  schedule: HabitSchedule;
  target: number;
  unit: string;
  reminder: string;
  why: string;
};

function draftFrom(seed: Seed | null, habit: HabitView | null, look: [SpeciesId, HabitColor]): Draft {
  const src = habit ?? seed;
  return {
    name: src?.name ?? "",
    species: src?.species ?? look[0],
    color: src?.color ?? look[1],
    schedule: src?.schedule ?? { kind: "daily" },
    target: src?.target ?? 1,
    unit: src?.unit ?? "",
    reminder: habit?.reminder ?? "",
    why: src?.why ?? "",
  };
}

/**
 * Starting a habit, or changing one. A new habit starts from the ideas: tap
 * one, or type your own. Then only three things are asked: its name, how
 * often, and whether to be reminded. Everything else waits under More options.
 */
export function PlantSheet({
  seed = null,
  habit = null,
  name,
  onClose,
}: {
  seed?: Seed | null;
  habit?: HabitView | null;
  /** Opens straight on a habit of your own, with this name filled in. */
  name?: string;
  onClose: () => void;
}) {
  const { state, showToast } = useApp();
  const { habits } = useGarden();
  const [look] = useState(() => LOOKS[habits.length % LOOKS.length]);
  const [step, setStep] = useState<"pick" | "details">(habit || seed || name !== undefined ? "details" : "pick");
  const [picked, setPicked] = useState<Seed | null>(seed);
  const [d, setD] = useState<Draft>(() => ({ ...draftFrom(seed, habit, look), ...(name ? { name } : {}) }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const editing = Boolean(habit);
  const cameFromPick = !habit && !seed && name === undefined;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const rulesChanged = editing && habit && (JSON.stringify(habit.schedule) !== JSON.stringify(d.schedule) || habit.target !== d.target);

  const choose = (s: Seed | null, typed = "") => {
    setPicked(s);
    setD({ ...draftFrom(s, null, look), ...(s ? {} : { name: typed }) });
    setError(null);
    setStep("details");
  };

  const submit = async () => {
    const clean = d.name.replace(/\s+/g, " ").trim();
    if (!clean) {
      setError("Give the habit a name.");
      return;
    }
    setBusy(true);
    setError(null);
    const body = {
      name: clean,
      species: d.species,
      color: d.color,
      schedule: d.schedule,
      target: d.target,
      unit: d.target > 1 ? d.unit : "",
      reminder: d.reminder || null,
      why: d.why,
    };
    const r = habit ? await gardenApi.update(habit.id, body) : await gardenApi.plant({ ...body, seedId: picked?.id ?? null });
    setBusy(false);
    if (!r.ok) {
      setError(r.kind === "offline" ? "You're offline. Try again when you're back." : r.kind === "invalid" ? r.message : "That didn't save. Try again.");
      return;
    }
    gardenStore.put(r.data.habit);
    if (habit) {
      showToast({ message: `${r.data.habit.name} is updated.` });
      onClose();
      return;
    }
    track("habit-plant", { seed: picked?.id ?? "custom" });
    showToast({ message: `${r.data.habit.name} is on your list. Mark it done today to get started.` });
    onClose();
    navigateApp("/habits");
  };

  if (step === "pick") {
    return (
      <Modal onClose={onClose} anchor="top">
        <div className="p-5" data-habit-sheet="pick">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl leading-tight">New habit</h2>
              <p className="mt-1 text-sm text-ink-soft">Tap one to start, or type your own.</p>
            </div>
            <CloseButton onClose={onClose} />
          </div>
          <IdeaPicker className="mt-4" onPick={(s) => choose(s)} onCustom={(typed) => choose(null, typed)} />
        </div>
      </Modal>
    );
  }

  const preview = { species: d.species, color: d.color };
  return (
    <Modal onClose={onClose} anchor="top">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        data-habit-sheet="details"
      >
        <div className="p-5 pb-3">
          <div className="flex items-center justify-between gap-3">
            {cameFromPick ? (
              <button
                type="button"
                onClick={() => setStep("pick")}
                className="-ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-medium text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink"
              >
                <IconArrowLeft size={14} /> Ideas
              </button>
            ) : (
              <h2 className="font-display text-2xl leading-tight">{editing ? "Edit habit" : "New habit"}</h2>
            )}
            <CloseButton onClose={onClose} />
          </div>

          <div className="mt-4 flex items-center gap-3">
            <HabitMark habit={preview} stage={habit ? Math.max(3, plotOf(habit, state.today).stage) : 4} size={52} />
            <input
              autoFocus={!picked && !habit}
              value={d.name}
              maxLength={HABIT_NAME_MAX}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Name your habit"
              enterKeyHint="done"
              className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 text-lg font-medium outline-none placeholder:font-normal placeholder:text-ink-faint focus:border-sun"
              aria-label="Habit name"
            />
          </div>
          {picked && !editing && <p className="mt-2 text-xs text-ink-faint">{picked.hint}. Change anything you like.</p>}

          <Field label="How often">
            <OftenPicker value={d.schedule} onChange={(s) => set("schedule", s)} />
          </Field>

          {d.target > 1 && (
            <Field label="Goal each day">
              <TargetInput target={d.target} unit={d.unit} onTarget={(n) => set("target", n)} onUnit={(u) => set("unit", u)} />
            </Field>
          )}

          <Field label="Remind me">
            <ReminderPicker value={d.reminder} onChange={(t) => set("reminder", t)} />
          </Field>

          <details className="group mt-5 rounded-xl border border-line" data-more>
            <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-sm font-medium text-ink-soft [&::-webkit-details-marker]:hidden">
              More options
              <span className="text-xs font-normal text-ink-faint group-open:hidden">Goal, why, look</span>
              <span className="hidden text-xs font-normal text-ink-faint group-open:inline">Hide</span>
            </summary>
            <div className="space-y-4 border-t border-line px-3 pb-3 pt-3">
              {d.target === 1 && (
                <div>
                  <span className="text-xs font-semibold text-ink-soft">More than once a day?</span>
                  <p className="text-[11px] text-ink-faint">For things you count, like 8 glasses of water.</p>
                  <div className="mt-1.5">
                    <TargetInput target={d.target} unit={d.unit} onTarget={(n) => set("target", n)} onUnit={(u) => set("unit", u)} />
                  </div>
                </div>
              )}
              <label className="block">
                <span className="text-xs font-semibold text-ink-soft">Why it matters to you</span>
                <input
                  value={d.why}
                  maxLength={140}
                  onChange={(e) => set("why", e.target.value)}
                  placeholder="I'm the kind of person who…"
                  className="mt-1 h-10 w-full rounded-lg border border-line bg-paper px-3 text-sm outline-none focus:border-sun"
                />
              </label>
              <div>
                <span className="text-xs font-semibold text-ink-soft">Plant and colour</span>
                <div className="mt-1.5 grid grid-cols-6 gap-1" role="group" aria-label="Plant">
                  {SPECIES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => set("species", s.id)}
                      aria-pressed={d.species === s.id}
                      aria-label={s.label}
                      title={s.label}
                      className={`grid place-items-center rounded-lg border py-1 transition-colors ${d.species === s.id ? "border-sun bg-sun-soft" : "border-line bg-paper hover:border-sun/50"}`}
                    >
                      <Plant species={s.id} stage={5} size={30} sway={false} ground="none" fit="tight" />
                    </button>
                  ))}
                </div>
                <div className="mt-2.5 flex items-center gap-2" role="group" aria-label="Colour">
                  {PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => set("color", c)}
                      aria-label={c}
                      aria-pressed={d.color === c}
                      className={`size-6 rounded-full transition-transform ${d.color === c ? "scale-110 ring-2 ring-ink ring-offset-2 ring-offset-card" : ""}`}
                      style={{ background: SWATCH[c] }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </details>

          {editing && habit && (
            <button type="button" onClick={() => setDeleting(true)} className="mt-4 text-sm font-medium text-clay hover:underline" data-sheet-delete>
              Delete habit
            </button>
          )}

          {rulesChanged && (
            <p className="mt-3 rounded-xl bg-sun-soft px-3 py-2 text-xs text-sun-deep">New rules re-count the current streak under them. Your history and best streak stay.</p>
          )}
          {error && (
            <p role="alert" className="mt-3 rounded-xl bg-clay-soft px-3 py-2 text-sm text-clay">
              {error}
            </p>
          )}
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-line bg-card px-5 py-3">
          <button type="button" onClick={onClose} className="h-10 rounded-full px-4 text-sm font-semibold text-ink-soft hover:bg-paper-deep">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !d.name.trim()}
            onClick={() => {
              // the one moment a reminder is chosen is the moment to ask for notifications
              if (d.reminder && typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission().catch(() => {});
            }}
            className="flex h-10 min-w-36 items-center justify-center gap-1.5 rounded-full bg-sun px-5 text-sm font-semibold text-on-accent shadow-sm transition-colors hover:bg-sun-deep disabled:opacity-50"
          >
            {busy ? "Saving…" : editing ? "Save changes" : "Start habit"}
          </button>
        </div>
      </form>
      {deleting && habit && (
        <DeleteHabitDialog
          habit={habit}
          onClose={() => setDeleting(false)}
          onDone={() => {
            setDeleting(false);
            onClose();
            navigateApp("/habits");
          }}
        />
      )}
    </Modal>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" onClick={onClose} aria-label="Close" className="-mr-1.5 grid size-8 shrink-0 place-items-center rounded-full text-ink-faint transition-colors hover:bg-paper-deep hover:text-ink">
      <IconX size={16} />
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="mt-5">
      <legend className="mb-2 text-xs font-semibold text-ink-soft">{label}</legend>
      {children}
    </fieldset>
  );
}

/** A choice among a few: one row of pills that wraps on a phone. */
function Pill({ on, onClick, children, label }: { on: boolean; onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      onClick={onClick}
      className={`h-9 rounded-full border px-3.5 text-sm font-medium transition-colors ${on ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink-soft hover:border-ink-faint hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

/**
 * The ideas to start from, and a box to type your own. Popular ones first;
 * typing searches every idea and offers the typed name as a habit of its own.
 */
export function IdeaPicker({ onPick, onCustom, className = "" }: { onPick: (s: Seed) => void; onCustom: (name: string) => void; className?: string }) {
  const { habits } = useGarden();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"popular" | SeedCategory>("popular");
  const taken = new Set(habits.map((h) => h.seedId).filter(Boolean));
  const query = q.replace(/\s+/g, " ").trim();
  const lower = query.toLowerCase();
  const exact = IDEAS.find((s) => s.name.toLowerCase() === lower);
  const shown = lower
    ? IDEAS.filter((s) => s.name.toLowerCase().includes(lower) || s.hint.toLowerCase().includes(lower))
    : cat === "popular"
      ? POPULAR.map((id) => IDEAS.find((s) => s.id === id)).filter((s): s is Seed => Boolean(s))
      : IDEAS.filter((s) => s.category === cat);
  const cats = SEED_CATEGORIES.filter((c) => IDEAS.some((s) => s.category === c.id));

  return (
    <div className={className} data-idea-picker>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || !query) return;
          e.preventDefault();
          if (exact && !taken.has(exact.id)) onPick(exact);
          else onCustom(query);
        }}
        maxLength={HABIT_NAME_MAX}
        placeholder="Type a habit, like “Floss”"
        enterKeyHint="go"
        aria-label="Type a habit"
        className="h-11 w-full rounded-xl border border-line bg-paper px-3 text-[15px] outline-none placeholder:text-ink-faint focus:border-sun"
      />

      {query ? (
        <button
          type="button"
          onClick={() => onCustom(query)}
          className="mt-2 flex w-full items-center gap-3 rounded-xl border border-dashed border-sun/50 bg-sun-soft/40 px-3 py-2.5 text-left transition-colors hover:bg-sun-soft"
          data-create-custom
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sun text-on-accent">
            <IconPlus size={16} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink">Create “{query}”</span>
            <span className="block text-xs text-ink-faint">Your own habit</span>
          </span>
        </button>
      ) : (
        <div className="no-scrollbar -mx-5 mt-3 flex gap-1.5 overflow-x-auto px-5" role="group" aria-label="Kinds of habit">
          {[{ id: "popular" as const, label: "Popular" }, ...cats].map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={cat === c.id}
              onClick={() => setCat(c.id)}
              className={`h-8 shrink-0 rounded-full px-3 text-xs font-semibold transition-colors ${cat === c.id ? "bg-ink text-paper" : "bg-paper-deep text-ink-soft hover:text-ink"}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {shown.length > 0 && (
        <>
          {query && <div className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">Ideas</div>}
          <ul className={`grid grid-cols-1 gap-1.5 sm:grid-cols-2 ${query ? "" : "mt-3"}`}>
            {shown.map((s) => {
              const on = taken.has(s.id);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={on}
                    onClick={() => onPick(s)}
                    data-idea={s.id}
                    className="flex w-full items-center gap-3 rounded-xl border border-line bg-card px-2.5 py-2 text-left transition-colors hover:border-sun/50 hover:bg-sun-soft/30 disabled:cursor-default disabled:opacity-55 disabled:hover:border-line disabled:hover:bg-card"
                  >
                    <HabitMark habit={s} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{s.name}</span>
                      <span className="block truncate text-xs text-ink-faint">{on ? "Already on your list" : ideaLine(s)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

type Often = "daily" | "weekdays" | "weekly" | "days";

function oftenOf(s: HabitSchedule): Often {
  if (s.kind === "daily") return "daily";
  if (s.kind === "weekly") return "weekly";
  return s.days.join() === "1,2,3,4,5" ? "weekdays" : "days";
}

/** How often, as four plain choices; the two that need a number or days show them underneath. */
function OftenPicker({ value, onChange }: { value: HabitSchedule; onChange: (s: HabitSchedule) => void }) {
  const [mode, setMode] = useState<Often>(() => oftenOf(value));
  const pick = (m: Often) => {
    setMode(m);
    if (m === "daily") onChange({ kind: "daily" });
    else if (m === "weekdays") onChange({ kind: "days", days: [1, 2, 3, 4, 5] });
    else if (m === "weekly") onChange({ kind: "weekly", times: value.kind === "weekly" ? value.times : 3 });
    else onChange({ kind: "days", days: value.kind === "days" ? value.days : [1, 3, 5] });
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        <Pill on={mode === "daily"} onClick={() => pick("daily")}>
          Every day
        </Pill>
        <Pill on={mode === "weekdays"} onClick={() => pick("weekdays")}>
          Weekdays
        </Pill>
        <Pill on={mode === "weekly"} onClick={() => pick("weekly")}>
          Times a week
        </Pill>
        <Pill on={mode === "days"} onClick={() => pick("days")}>
          Pick days
        </Pill>
      </div>
      {mode === "weekly" && value.kind === "weekly" && (
        <div className="mt-2.5 flex items-center gap-2 text-sm text-ink-soft">
          <Stepper value={value.times} min={1} max={6} onChange={(n) => onChange({ kind: "weekly", times: n })} label="times a week" />
          <span>{value.times === 1 ? "time" : "times"} a week, on any days</span>
        </div>
      )}
      {mode === "days" && value.kind === "days" && (
        <div className="mt-2.5 grid grid-cols-7 gap-1">
          {[1, 2, 3, 4, 5, 6, 0].map((day) => {
            const on = value.days.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                aria-label={WEEKDAY_SHORT[day]}
                onClick={() => {
                  const days = on ? value.days.filter((x) => x !== day) : [...value.days, day].sort((a, b) => a - b);
                  if (days.length > 0) onChange({ kind: "days", days });
                }}
                className={`h-9 rounded-lg text-xs font-semibold transition-colors ${on ? "bg-sun text-on-accent" : "border border-line bg-paper text-ink-soft hover:border-sun/50"}`}
              >
                {WEEKDAY_SHORT[day].slice(0, 2)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-paper">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Fewer ${label}`} className="grid size-9 place-items-center rounded-full text-lg text-ink-soft hover:bg-paper-deep disabled:opacity-30">
        −
      </button>
      <span className="min-w-8 text-center text-sm font-semibold tabular-nums text-ink" aria-live="polite">
        {value}
      </span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`More ${label}`} className="grid size-9 place-items-center rounded-full text-lg text-ink-soft hover:bg-paper-deep disabled:opacity-30">
        +
      </button>
    </span>
  );
}

function TargetInput({ target, unit, onTarget, onUnit }: { target: number; unit: string; onTarget: (n: number) => void; onUnit: (u: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Stepper value={target} min={1} max={50} onChange={onTarget} label="times each day" />
      {target > 1 ? (
        <input
          value={unit}
          maxLength={16}
          onChange={(e) => onUnit(e.target.value)}
          placeholder="times"
          aria-label="Unit"
          className="h-9 w-28 rounded-lg border border-line bg-paper px-2.5 text-sm outline-none focus:border-sun"
        />
      ) : (
        <span className="text-sm text-ink-faint">time a day</span>
      )}
    </div>
  );
}

const MORNING = "08:00";
const EVENING = "20:00";

function timeLabel(t: string): string {
  const [h, m] = t.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** Whether to be reminded, and when: two usual times, or your own. */
function ReminderPicker({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  const [own, setOwn] = useState(() => Boolean(value) && value !== MORNING && value !== EVENING);
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        <Pill
          on={!value}
          onClick={() => {
            setOwn(false);
            onChange("");
          }}
        >
          No reminder
        </Pill>
        <Pill
          on={!own && value === MORNING}
          onClick={() => {
            setOwn(false);
            onChange(MORNING);
          }}
          label={`Morning, ${timeLabel(MORNING)}`}
        >
          Morning
        </Pill>
        <Pill
          on={!own && value === EVENING}
          onClick={() => {
            setOwn(false);
            onChange(EVENING);
          }}
          label={`Evening, ${timeLabel(EVENING)}`}
        >
          Evening
        </Pill>
        <Pill
          on={own}
          onClick={() => {
            setOwn(true);
            if (!value) onChange("07:00");
          }}
        >
          Pick a time
        </Pill>
      </div>
      {own ? (
        <input
          type="time"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Reminder time"
          className="mt-2.5 block h-10 w-40 rounded-lg border border-line bg-paper px-2.5 text-sm outline-none focus:border-sun"
        />
      ) : null}
      {value && <p className="mt-2 text-xs text-ink-faint">A reminder at {timeLabel(value)} on days it&apos;s due, unless it&apos;s already done.</p>}
    </div>
  );
}
