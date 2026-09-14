"use client";

import { useState } from "react";
import {
  HABIT_NAME_MAX,
  PALETTE,
  scheduleLabel,
  SPECIES,
  stageOf,
  WEEKDAY_SHORT,
  type HabitColor,
  type HabitSchedule,
  type HabitView,
  type Seed,
  type SpeciesId,
} from "@/lib/habits-shared";
import { gardenApi, gardenStore } from "@/lib/habits-client";
import { track } from "@/lib/analytics-client";
import { EmojiPicker } from "../notes/pickers";
import { useApp } from "../store";
import { Modal } from "../ui";
import { navigateApp } from "../app-views";
import { Plant } from "./plants";

export const SWATCH: Record<HabitColor, string> = {
  sun: "#0c9384",
  amber: "#d8a03e",
  rose: "#d96354",
  lilac: "#8d7bd4",
  sky: "#4e93c9",
  moss: "#4ca75b",
};

const QUICK_EMOJI = ["🌱", "💧", "🏃", "📚", "🧘", "💪", "🎯", "🍎", "😴", "✍️", "🎸", "🧹"];

type Draft = {
  name: string;
  emoji: string;
  species: SpeciesId;
  color: HabitColor;
  schedule: HabitSchedule;
  target: number;
  unit: string;
  reminder: string;
  why: string;
};

function draftFrom(seed: Seed | null, habit: HabitView | null): Draft {
  const src = habit ?? seed;
  return {
    name: src?.name ?? "",
    emoji: src?.emoji ?? "🌱",
    species: src?.species ?? "sunflower",
    color: src?.color ?? "sun",
    schedule: src?.schedule ?? { kind: "daily" },
    target: src?.target ?? 1,
    unit: src?.unit ?? "",
    reminder: habit?.reminder ?? "",
    why: src?.why ?? "",
  };
}

/**
 * Planting a seed, or changing one that's growing. A seed from the catalogue
 * arrives filled in; a custom habit starts from a sunflower.
 */
export function PlantSheet({ seed = null, habit = null, onClose }: { seed?: Seed | null; habit?: HabitView | null; onClose: () => void }) {
  const { showToast } = useApp();
  const [d, setD] = useState<Draft>(() => draftFrom(seed, habit));
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = Boolean(habit);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const rulesChanged =
    editing && habit && (JSON.stringify(habit.schedule) !== JSON.stringify(d.schedule) || habit.target !== d.target);

  const submit = async () => {
    const name = d.name.replace(/\s+/g, " ").trim();
    if (!name) {
      setError("Give the habit a name.");
      return;
    }
    setBusy(true);
    setError(null);
    const body = {
      name,
      emoji: d.emoji,
      species: d.species,
      color: d.color,
      schedule: d.schedule,
      target: d.target,
      unit: d.unit,
      reminder: d.reminder || null,
      why: d.why,
    };
    const r = habit ? await gardenApi.update(habit.id, body) : await gardenApi.plant({ ...body, seedId: seed?.id ?? null });
    setBusy(false);
    if (!r.ok) {
      setError(r.kind === "offline" ? "You're offline. Try again when you're back." : r.kind === "invalid" ? r.message : "That didn't save. Try again.");
      return;
    }
    gardenStore.put(r.data.habit);
    if (habit) {
      showToast({ message: `${r.data.habit.emoji} ${r.data.habit.name} is updated.` });
      onClose();
      return;
    }
    track("habit-plant", { seed: seed?.id ?? "custom" });
    showToast({ message: `🌱 ${r.data.habit.name} is planted. Water it today to see it sprout.` });
    onClose();
    navigateApp("/garden");
  };

  return (
    <Modal onClose={onClose} anchor="top">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="p-5"
      >
        <div className="flex items-start gap-4">
          <div className="relative -my-2 shrink-0 rounded-3xl bg-gradient-to-b from-sky-soft to-moss-soft px-1 pt-1">
            <Plant species={d.species} stage={habit ? Math.max(1, stageOf(habit.growth).index) : 5} size={84} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl">{editing ? "Tend this plant" : seed ? `Plant “${seed.name}”` : "Plant your own seed"}</h2>
            <p className="mt-0.5 text-xs text-ink-faint">
              {editing ? "Change how it grows. Its growth and fruit stay." : "Water it on the days you keep the habit, and it grows."}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <span className="text-xs font-semibold text-ink-soft">Habit</span>
          <div className="relative mt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPicking((p) => !p)}
              className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-paper text-2xl"
              aria-label="Choose an emoji"
            >
              {d.emoji}
            </button>
            <input
              autoFocus={!seed && !habit}
              value={d.name}
              maxLength={HABIT_NAME_MAX}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Read 10 pages"
              className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 text-[15px] outline-none focus:border-sun"
              aria-label="Habit name"
            />
            {picking && (
              <EmojiPicker
                className="left-0 top-12"
                onPick={(e) => {
                  set("emoji", e);
                  setPicking(false);
                }}
                onClose={() => setPicking(false)}
              />
            )}
          </div>
          <div className="no-scrollbar mt-2 flex gap-1 overflow-x-auto">
            {QUICK_EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => set("emoji", e)}
                className={`grid size-8 shrink-0 place-items-center rounded-lg text-lg ${d.emoji === e ? "bg-sun-soft ring-1 ring-sun" : "hover:bg-paper-deep"}`}
                aria-label={`Use ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <fieldset className="mt-4">
          <legend className="text-xs font-semibold text-ink-soft">Plant</legend>
          <div className="mt-1 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {SPECIES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => set("species", s.id)}
                aria-pressed={d.species === s.id}
                aria-label={s.label}
                title={`${s.label} — bears ${s.fruit.toLowerCase()}`}
                className={`flex flex-col items-center rounded-xl border pb-1 transition-all ${
                  d.species === s.id ? "border-sun bg-sun-soft" : "border-line bg-paper hover:border-sun/50"
                }`}
              >
                <Plant species={s.id} stage={6} size={46} sway={false} ground="none" ripe={1} />
                <span className="-mt-1 w-full truncate px-0.5 text-center text-[10px] text-ink-soft">{s.label.replace(" tree", "").replace(" blossom", "")}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-xs font-semibold text-ink-soft">How often</legend>
          <ScheduleInput value={d.schedule} onChange={(s) => set("schedule", s)} />
        </fieldset>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <span className="text-xs font-semibold text-ink-soft">Each day</span>
            <div className="mt-1 flex items-center gap-1.5">
              <button type="button" onClick={() => set("target", Math.max(1, d.target - 1))} className="grid size-9 place-items-center rounded-lg border border-line" aria-label="Fewer">
                −
              </button>
              <input
                inputMode="numeric"
                value={d.target}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value.replace(/\D/g, ""), 10);
                  set("target", Number.isFinite(n) ? Math.max(1, Math.min(50, n)) : 1);
                }}
                className="h-9 w-12 rounded-lg border border-line bg-paper text-center outline-none focus:border-sun"
                aria-label="Times each day"
              />
              <button type="button" onClick={() => set("target", Math.min(50, d.target + 1))} className="grid size-9 place-items-center rounded-lg border border-line" aria-label="More">
                +
              </button>
            </div>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-ink-soft">Unit {d.target > 1 ? "" : "(optional)"}</span>
            <input
              value={d.unit}
              maxLength={16}
              onChange={(e) => set("unit", e.target.value)}
              placeholder={d.target > 1 ? "glasses" : "—"}
              className="mt-1 h-9 w-full rounded-lg border border-line bg-paper px-2.5 text-sm outline-none focus:border-sun"
            />
          </label>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-semibold text-ink-soft">Reminder</span>
            <input
              type="time"
              value={d.reminder}
              onChange={(e) => set("reminder", e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-line bg-paper px-2 text-sm outline-none focus:border-sun"
            />
          </label>
          <fieldset>
            <legend className="text-xs font-semibold text-ink-soft">Colour</legend>
            <div className="mt-1 flex h-9 items-center gap-1.5">
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
          </fieldset>
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-semibold text-ink-soft">Why it matters (optional)</span>
          <input
            value={d.why}
            maxLength={140}
            onChange={(e) => set("why", e.target.value)}
            placeholder="I'm the kind of person who…"
            className="mt-1 h-10 w-full rounded-lg border border-line bg-paper px-3 text-sm outline-none focus:border-sun"
          />
        </label>

        {rulesChanged && (
          <p className="mt-3 rounded-xl bg-sun-soft px-3 py-2 text-xs text-sun-deep">
            New rules re-count the current streak under them. Growth, fruit and your best streak stay.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-clay-soft px-3 py-2 text-sm text-clay">
            {error}
          </p>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-paper-deep">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            onClick={() => {
              // the one moment a reminder is chosen is the moment to ask for notifications
              if (d.reminder && typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission().catch(() => {});
            }}
            className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper disabled:opacity-60"
          >
            {busy ? "Saving…" : editing ? "Save" : "🌱 Plant it"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function ScheduleInput({ value, onChange }: { value: HabitSchedule; onChange: (s: HabitSchedule) => void }) {
  const kinds: { id: HabitSchedule["kind"]; label: string }[] = [
    { id: "daily", label: "Every day" },
    { id: "days", label: "On days" },
    { id: "weekly", label: "Times a week" },
  ];
  return (
    <div className="mt-1">
      <div className="inline-flex rounded-full border border-line bg-paper p-0.5">
        {kinds.map((k) => (
          <button
            key={k.id}
            type="button"
            aria-pressed={value.kind === k.id}
            onClick={() =>
              onChange(k.id === "daily" ? { kind: "daily" } : k.id === "days" ? { kind: "days", days: value.kind === "days" ? value.days : [1, 2, 3, 4, 5] } : { kind: "weekly", times: value.kind === "weekly" ? value.times : 3 })
            }
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${value.kind === k.id ? "bg-ink text-paper" : "text-ink-soft"}`}
          >
            {k.label}
          </button>
        ))}
      </div>
      {value.kind === "days" && (
        <div className="mt-2 flex gap-1">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => {
            const on = value.days.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  const days = on ? value.days.filter((x) => x !== d) : [...value.days, d].sort((a, b) => a - b);
                  if (days.length === 0) return;
                  onChange(days.length === 7 ? { kind: "daily" } : { kind: "days", days });
                }}
                className={`h-8 flex-1 rounded-lg text-xs font-semibold ${on ? "bg-sun text-on-accent" : "border border-line bg-paper text-ink-soft"}`}
              >
                {WEEKDAY_SHORT[d].slice(0, 2)}
              </button>
            );
          })}
        </div>
      )}
      {value.kind === "weekly" && (
        <div className="mt-2 flex gap-1">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={value.times === n}
              onClick={() => onChange({ kind: "weekly", times: n })}
              className={`h-8 flex-1 rounded-lg text-xs font-semibold ${value.times === n ? "bg-sun text-on-accent" : "border border-line bg-paper text-ink-soft"}`}
            >
              {n}×
            </button>
          ))}
        </div>
      )}
      <p className="mt-1.5 text-[11px] text-ink-faint">{scheduleLabel(value)}{value.kind === "weekly" ? ", any days you like" : ""}</p>
    </div>
  );
}
