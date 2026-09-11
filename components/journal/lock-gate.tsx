"use client";

import { useState } from "react";
import { journalApi } from "@/lib/journal-client";
import { PinPad, MIN_PIN } from "../pin-pad";
import { Icon3d } from "../img3d";

/**
 * The journal's front door when it has a PIN. Sits in the page rather than
 * over the whole app: the rest of Kairo stays usable, only the diary is shut.
 */
export function JournalLockGate({ onUnlocked }: { onUnlocked: () => void }) {
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    if (pin.length < MIN_PIN || busy) return;
    setBusy(true);
    const r = await journalApi.unlock(pin);
    setBusy(false);
    if (r.ok) {
      onUnlocked();
      return;
    }
    setPin("");
    setShake(true);
    try {
      navigator.vibrate?.([40, 30, 40]);
    } catch {}
    setTimeout(() => setShake(false), 450);
    setMessage(
      r.kind === "offline"
        ? "You're offline. The journal opens once you're back."
        : r.kind === "invalid" && r.message !== "Wrong PIN"
          ? r.message
          : null
    );
  };

  return (
    <div className="anim-rise mx-auto flex max-w-sm flex-col items-center px-6 pb-32 pt-16 text-center">
      <Icon3d name="lock" size={64} />
      <h1 className="font-display mt-3 text-3xl">Your journal is locked</h1>
      <p className="mt-1 text-sm text-ink-soft">Enter your journal PIN to open it.</p>
      <PinPad pin={pin} onPinChange={setPin} onSubmit={submit} busy={busy} shake={shake} />
      {message && <p className="mt-4 text-sm text-clay">{message}</p>}
    </div>
  );
}
