"use client";

import { useState } from "react";
import { useApp } from "./store";
import { PinPad, MIN_PIN } from "./pin-pad";
import { Modal } from "./ui";
import { Icon3d } from "./img3d";
import { Mark } from "./mark";

/**
 * Full-screen gate shown while the app is locked. Covers everything
 * (z-index above modals and the focus overlay) until the PIN verifies.
 */
export function AppLockGate() {
  const { state, unlockApp } = useApp();
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!state.appLocked) return null;

  const submit = async () => {
    if (pin.length < MIN_PIN || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/applock/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        unlockApp();
        return;
      }
    } catch {}
    setShake(true);
    setPin("");
    try {
      navigator.vibrate?.([40, 30, 40]);
    } catch {}
    setTimeout(() => setShake(false), 450);
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-paper px-6">
      <Icon3d name="lock" size={64} />
      <h1 className="font-display mt-3 text-3xl">Kairo is locked</h1>
      <p className="mt-1 text-sm text-ink-soft">Enter your PIN, {state.user.name.split(" ")[0]}.</p>

      <PinPad pin={pin} onPinChange={setPin} onSubmit={submit} busy={busy} shake={shake} />

      {/* other signed-in accounts stay reachable without unlocking this one */}
      {state.accounts.filter((a) => a.id !== state.user.id).length > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {state.accounts
            .filter((a) => a.id !== state.user.id)
            .map((a) => (
              <button
                key={a.id}
                onClick={async () => {
                  try {
                    const res = await fetch("/api/auth/switch", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ userId: a.id }),
                    });
                    if (res.ok) {
                      // leaving the locked account ends any unlocked session
                      // it may still have had in this tab
                      try {
                        sessionStorage.removeItem(`kairo-applock:${state.user.id}`);
                      } catch {}
                      window.location.assign("/today");
                    }
                  } catch {}
                }}
                className="flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-ink-faint"
              >
                {a.picture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.picture} alt="" className="size-5 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <span className="grid size-5 place-items-center rounded-full bg-sun-soft text-[10px] font-bold text-sun-deep">
                    {a.name.charAt(0).toUpperCase()}
                  </span>
                )}
                {a.name.split(" ")[0]}
              </button>
            ))}
        </div>
      )}

      <form action="/api/auth/signout" method="POST" className="mt-8">
        <button type="submit" className="text-xs text-ink-faint hover:text-ink">
          Sign out instead
        </button>
      </form>
    </div>
  );
}

export type AppLockMode = "set" | "change" | "remove";

const HEADINGS: Record<AppLockMode, string> = {
  set: "Set an app PIN",
  change: "Change app PIN",
  remove: "Enter PIN to remove the lock",
};

/** Setup / change / remove flow for the app-wide PIN. */
export function AppLockModal({ mode, onClose }: { mode: AppLockMode; onClose: () => void }) {
  const { setAppLockEnabled, showToast } = useApp();
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

  const heading = step === 0 ? "Enter current PIN" : step === 2 ? "Confirm the PIN" : HEADINGS[mode];

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
        const res = await fetch("/api/applock", {
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
        setAppLockEnabled(true);
        showToast({ message: "🔒 App lock is on, find “Lock now” in your profile" });
        onClose();
      } else if (mode === "remove") {
        const res = await fetch("/api/applock", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        });
        if (!res.ok) {
          fail();
          return;
        }
        setAppLockEnabled(false);
        showToast({ message: "🔓 App lock removed" });
        onClose();
      }
    } catch {
      showToast({ message: "You're offline, or we are. Nothing was lost." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="flex flex-col items-center p-6">
        <Mark size={30} className="text-sun" />
        <h2 className="font-display mt-1 text-2xl">App lock</h2>
        <p className="mt-1 text-sm font-medium text-ink-soft">{heading}</p>
        {mode === "set" && step === 1 && (
          <p className="mt-0.5 text-xs text-ink-faint">
            4–8 digits. Kairo will ask for it in every new browser session.
          </p>
        )}

        <PinPad pin={pin} onPinChange={setPin} onSubmit={submit} busy={busy} shake={shake} />

        <button onClick={onClose} className="mt-5 text-xs text-ink-faint hover:text-ink">
          Cancel
        </button>
      </div>
    </Modal>
  );
}
