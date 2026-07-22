"use client";

import { useState } from "react";
import type { List } from "@/lib/types";
import { useApp } from "./store";
import { ListMark } from "./img3d";
import { Modal } from "./ui";

const MIN_PIN = 4;
const MAX_PIN = 8;

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
      showToast({ message: "PINs didn't match — try again" });
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
      showToast({ message: "Couldn't reach the server — try again" });
    } finally {
      setBusy(false);
    }
  };

  const applyListUpdate = async (res: Response) => {
    const { list: updated } = (await res.json()) as { list: List };
    upsertList(updated);
  };

  const press = (d: string) => {
    if (pin.length >= MAX_PIN) return;
    try {
      navigator.vibrate?.(5);
    } catch {}
    setPin((p) => p + d);
  };

  return (
    <Modal onClose={onClose}>
      <div className="flex flex-col items-center p-6">
        <ListMark value={list.emoji} size={44} />
        <h2 className="font-display mt-1 text-2xl">{list.name}</h2>
        <p className="mt-1 text-sm font-medium text-ink-soft">{heading}</p>
        {subtitle && <p className="mt-0.5 text-xs text-ink-faint">{subtitle}</p>}

        {/* dots */}
        <div className={`mt-5 flex h-4 items-center gap-2.5 ${shake ? "anim-shake" : ""}`}>
          {Array.from({ length: Math.max(pin.length, MIN_PIN) }, (_, i) => (
            <span
              key={i}
              className={`size-3 rounded-full transition-colors ${
                i < pin.length ? "bg-ink" : "border-2 border-ink-faint"
              }`}
            />
          ))}
        </div>

        {/* keypad */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <KeyBtn key={d} onClick={() => press(d)}>
              {d}
            </KeyBtn>
          ))}
          <KeyBtn onClick={() => setPin((p) => p.slice(0, -1))} subtle>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M7.5 4h8A1.5 1.5 0 0117 5.5v9a1.5 1.5 0 01-1.5 1.5h-8L3 10l4.5-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M10 8l4 4M14 8l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </KeyBtn>
          <KeyBtn onClick={() => press("0")}>0</KeyBtn>
          <button
            onClick={submit}
            disabled={pin.length < MIN_PIN || busy}
            aria-label="Confirm"
            className="grid size-16 place-items-center rounded-full bg-ink text-paper transition-all active:scale-95 disabled:opacity-20"
          >
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
              <path d="M3 8.5l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <button onClick={onClose} className="mt-5 text-xs text-ink-faint hover:text-ink">
          Cancel
        </button>
      </div>
    </Modal>
  );
}

function KeyBtn({
  children,
  onClick,
  subtle,
}: {
  children: React.ReactNode;
  onClick: () => void;
  subtle?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`grid size-16 place-items-center rounded-full text-xl font-semibold transition-all active:scale-95 ${
        subtle ? "text-ink-soft hover:bg-paper-deep" : "bg-paper-deep text-ink hover:bg-line"
      }`}
    >
      {children}
    </button>
  );
}
