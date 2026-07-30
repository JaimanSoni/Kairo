"use client";

import { useState } from "react";
import type { List } from "@/lib/types";
import { useApp } from "./store";
import { ListMark } from "./img3d";
import { PinPad, MIN_PIN } from "./pin-pad";
import { Modal } from "./ui";

export type PinMode = "set" | "change" | "unlock" | "remove";

const HEADINGS: Record<PinMode, string> = {
  set: "Set a PIN",
  change: "Change PIN",
  unlock: "Enter PIN",
  remove: "Enter PIN to remove lock",
};

/**
 * Phone-style numeric PIN pad for locking/unlocking lists.
 * PINs are verified server-side; unlocks last for this browser session.
 */
export function PinModal({ list, mode, onClose }: { list: List; mode: PinMode; onClose: () => void }) {
  const { setListUnlocked, showToast, upsertList } = useApp();
  // set/change flow: step 0 = current pin (change only), step 1 = new pin, step 2 = confirm
  const [step, setStep] = useState(mode === "change" ? 0 : mode === "set" ? 1 : -1);
  const [pin, setPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);

  const fail = () => {
    setShake(true);
    setPin("");
    try {
      navigator.vibrate?.([40, 30, 40]);
    } catch {}
    setTimeout(() => setShake(false), 450);
  };

  const heading =
    step === 0
      ? "Enter current PIN"
      : step === 2
        ? "Confirm the PIN"
        : HEADINGS[mode];

  const subtitle =
    mode === "set" && step === 1
      ? "4–8 digits. Tasks in this list hide everywhere until unlocked."
      : mode === "unlock"
        ? "Unlocks for this session only."
        : undefined;

  const submit = async () => {
    if (pin.length < MIN_PIN || busy) return;

    if (step === 0) {
      setCurrentPin(pin);
      setPin("");
      setStep(1);
      return;
    }
    if (step === 1) {
      setFirstPin(pin);
      setPin("");
      setStep(2);
      return;
    }
    if (step === 2 && pin !== firstPin) {
      setFirstPin("");
      setStep(1);
      fail();
      showToast({ message: "Those didn't match. One more time, slowly." });
      return;
    }

    setBusy(true);
    try {
      if (step === 2) {
        const res = await fetch(`/api/lists/${list.id}/lock`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin, ...(mode === "change" ? { currentPin } : {}) }),
        });
        if (!res.ok) {
          if (res.status === 403) {
            setStep(0);
            setCurrentPin("");
            setFirstPin("");
            fail();
            return;
          }
          throw new Error();
        }
        await applyListUpdate(res);
        setListUnlocked(list.id, false); // freshly locked lists start hidden
        showToast({ message: `🔒 ${list.name} locked` });
        onClose();
      } else if (mode === "unlock") {
        const res = await fetch(`/api/lists/${list.id}/unlock`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        });
        if (!res.ok) {
          fail();
          return;
        }
        setListUnlocked(list.id, true);
        onClose();
      } else if (mode === "remove") {
        const res = await fetch(`/api/lists/${list.id}/lock`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        });
        if (!res.ok) {
          fail();
          return;
        }
        await applyListUpdate(res);
        setListUnlocked(list.id, false);
        showToast({ message: `🔓 Lock removed from ${list.name}` });
        onClose();
      }
    } catch {
      showToast({ message: "You're offline, or we are. Nothing was lost." });
    } finally {
      setBusy(false);
    }
  };

  const applyListUpdate = async (res: Response) => {
    const { list: updated } = (await res.json()) as { list: List };
    upsertList(updated);
  };

  return (
    <Modal onClose={onClose}>
      <div className="flex flex-col items-center p-6">
        <ListMark value={list.emoji} size={44} />
        <h2 className="font-display mt-1 text-2xl">{list.name}</h2>
        <p className="mt-1 text-sm font-medium text-ink-soft">{heading}</p>
        {subtitle && <p className="mt-0.5 text-xs text-ink-faint">{subtitle}</p>}

        <PinPad pin={pin} onPinChange={setPin} onSubmit={submit} busy={busy} shake={shake} />

        <button onClick={onClose} className="mt-5 text-xs text-ink-faint hover:text-ink">
          Cancel
        </button>
      </div>
    </Modal>
  );
}
