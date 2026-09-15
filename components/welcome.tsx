"use client";

import { useState } from "react";
import { track } from "@/lib/analytics-client";
import { JOURNAL_SHOWN, type SpacePrefs } from "@/lib/types";
import { Icon3d } from "./img3d";
import { useApp } from "./store";
import { IconArrowRight, Modal } from "./ui";

/**
 * The first thing a new account sees: what Kairo can hold, and a choice of
 * which parts to keep. Planning is always there; habits, the journal and
 * notes can each be left out, and brought back from Settings any time. It is
 * the answer to "that's a lot of features": you only get the ones you asked for.
 */

export const SPACE_CHOICES: { key: keyof SpacePrefs; title: string; body: string; icon: string }[] = [
  { key: "garden" as const, title: "Build habits", body: "Mark small habits done each day, and watch them get stronger.", icon: "list-growth" },
  { key: "journal" as const, title: "Keep a journal", body: "A page for each day, and the weather inside it.", icon: "book" },
  { key: "notes" as const, title: "Take notes", body: "Pages inside pages, for plans, ideas and everything else.", icon: "pencil" },
].filter((c) => c.key !== "journal" || JOURNAL_SHOWN);

export function PlaceToggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${checked ? "bg-sun" : "bg-line"}`}
    >
      <span className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : ""}`} />
    </button>
  );
}

export function Welcome() {
  const { state, setSpaces, setOmnibar } = useApp();
  const [prefs, setPrefs] = useState<SpacePrefs>(state.user.spaces);
  const [saving, setSaving] = useState(false);
  const first = state.user.name?.split(" ")[0];

  const start = async () => {
    if (saving) return;
    setSaving(true);
    const ok = await setSpaces(prefs, { welcomed: true });
    track("welcome-done", { garden: prefs.garden, journal: prefs.journal, notes: prefs.notes });
    setSaving(false);
    if (ok) setOmnibar(true);
  };

  return (
    <Modal onClose={() => void start()} wide>
      <div className="p-6 sm:p-8" data-welcome>
        <Icon3d name="sunrise" size={56} />
        <h2 className="font-display mt-3 text-3xl">{first ? `Welcome to Kairo, ${first}` : "Welcome to Kairo"}</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
          A calm place for your days. Planning is always here; pick what else you&apos;d like Kairo to hold. You can change this any time in Settings.
        </p>

        <ul className="mt-6 space-y-2">
          <li className="flex items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3">
            <Icon3d name="sun" size={32} className="shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Plan my days</span>
              <span className="block text-xs text-ink-faint">Today, Calendar, Lists and the Log. Always on.</span>
            </span>
            <span className="shrink-0 rounded-full bg-sun-soft px-2.5 py-1 text-[11px] font-semibold text-sun-deep">Included</span>
          </li>
          {SPACE_CHOICES.map((c) => (
            <li key={c.key}>
              <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${prefs[c.key] ? "border-sun/40 bg-card" : "border-line bg-paper"}`}>
                <Icon3d name={c.icon} size={32} className={`shrink-0 transition-opacity ${prefs[c.key] ? "" : "opacity-50"}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{c.title}</span>
                  <span className="block text-xs text-ink-faint">{c.body}</span>
                </span>
                <PlaceToggle checked={prefs[c.key]} onChange={(v) => setPrefs((p) => ({ ...p, [c.key]: v }))} label={c.title} />
              </label>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex items-center justify-between gap-3">
          <p className="text-xs text-ink-faint">Next: tell Kairo what&apos;s on your mind.</p>
          <button
            type="button"
            onClick={() => void start()}
            disabled={saving}
            className="flex h-10 items-center gap-1.5 rounded-full bg-ink px-5 text-sm font-semibold text-paper transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          >
            Start my day <IconArrowRight size={14} />
          </button>
        </div>
      </div>
    </Modal>
  );
}
