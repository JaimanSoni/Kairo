"use client";

import { useState } from "react";
import { ANIMALS, cleanGardenerName, type Gardener } from "@/lib/habits-shared";
import { gardenApi, gardenStore } from "@/lib/habits-client";
import { track } from "@/lib/analytics-client";
import { Modal } from "../../ui";
import { Avatar } from "../bits";

/**
 * Claiming a plot in Kairo City: a name and an animal, and a plain word about
 * what joining shows. The same public profile the leaderboards use.
 */
export function JoinCity({ onClose, onJoined }: { onClose: () => void; onJoined: () => void }) {
  const known = gardenStore.gardener();
  const [name, setName] = useState(known?.name ?? "");
  const [animal, setAnimal] = useState<Gardener["animal"]>(known?.animal ?? "1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!cleanGardenerName(name)) {
      setError("A name is 2 to 24 letters, numbers or spaces.");
      return;
    }
    setBusy(true);
    setError(null);
    const r = await gardenApi.setProfile({ name, animal, public: true });
    setBusy(false);
    if (!r.ok) {
      setError(r.kind === "invalid" ? r.message : "That didn't save. Try again.");
      return;
    }
    gardenStore.setGardener(r.data.gardener);
    track("city-join");
    onJoined();
  };

  return (
    <Modal onClose={onClose} anchor="top" above>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="p-5"
        data-join-city
      >
        <h2 className="font-display text-2xl leading-tight">Claim your plot</h2>
        <p className="mt-1.5 text-sm text-ink-soft">
          Your garden gets a plot on the street, under a name and an animal you choose. Visitors see your plants, your level and the names of habits started from Ideas.
          Never your email, your photo, or habits you wrote yourself.
        </p>
        <label className="mt-4 block">
          <span className="text-xs font-semibold text-ink-soft">Name on your gate</span>
          <input
            value={name}
            maxLength={24}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            placeholder="Sunny Fern"
            aria-label="Name on your gate"
            className="mt-1 h-11 w-full rounded-xl border border-line bg-paper px-3 text-[15px] outline-none focus:border-sun"
          />
        </label>
        <fieldset className="mt-4">
          <legend className="text-xs font-semibold text-ink-soft">Your animal</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {ANIMALS.map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={animal === a}
                aria-label={`Animal ${a}`}
                onClick={() => setAnimal(a)}
                className={`rounded-full p-0.5 transition-all ${animal === a ? "ring-2 ring-sun ring-offset-2 ring-offset-card" : "opacity-60 hover:opacity-100"}`}
              >
                <Avatar animal={a} size={42} />
              </button>
            ))}
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="mt-3 text-sm text-clay">
            {error}
          </p>
        )}
        <p className="mt-4 text-xs text-ink-faint">You can hide your garden again any time, from Leaderboards.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-full px-4 text-sm font-semibold text-ink-soft hover:bg-paper-deep">
            Not now
          </button>
          <button type="submit" disabled={busy} className="h-10 rounded-full bg-sun px-5 text-sm font-semibold text-on-accent hover:bg-sun-deep disabled:opacity-60">
            {busy ? "Claiming…" : "Claim my plot"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
