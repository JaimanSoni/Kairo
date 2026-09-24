"use client";

/**
 * The offer to move dictation onto the device, made at the one moment it
 * means anything: just after somebody dictated something and watched the
 * browser have a go at it.
 *
 * It is not in a settings page nobody opens, and it is not a banner that
 * greets people who have never spoken to the app. It appears once they have
 * used the thing it improves, it says what it costs in megabytes before
 * anyone agrees to spend them, and it goes away for good if they say no.
 */

import { useEffect, useState } from "react";
import { MODELS, mightUseWebGPU, sizeLabel, suggestedTier } from "@/lib/dictation/models";
import { readSettings, writeSettings } from "@/lib/dictation/engine";

const HIDDEN_KEY = "kairo-dictation-offer";

export function useDictationOffer(lastEngine: "device" | "browser" | null, onDevice: boolean) {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    queueMicrotask(() => {
      try {
        setAllowed(localStorage.getItem(HIDDEN_KEY) !== "no");
      } catch {
        setAllowed(true);
      }
    });
  }, []);
  return allowed && lastEngine === "browser" && !onDevice;
}

export function DictationOffer({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  const tier = suggestedTier();
  const spec = MODELS[tier];
  const [gpu, setGpu] = useState(true);
  useEffect(() => {
    queueMicrotask(() => setGpu(mightUseWebGPU()));
  }, []);

  const yes = () => {
    writeSettings({ ...readSettings(), on: true, tier });
    try {
      localStorage.setItem(HIDDEN_KEY, "yes");
    } catch {
      /* it still works this session */
    }
    onYes();
  };

  const no = () => {
    try {
      localStorage.setItem(HIDDEN_KEY, "no");
    } catch {
      /* asked once either way */
    }
    onNo();
  };

  return (
    <div className="mt-2 rounded-xl bg-paper-deep px-3.5 py-3 text-[13px]" data-dictation-offer>
      <div className="font-medium text-ink">Let Kairo do the listening</div>
      <p className="mt-0.5 leading-5 text-ink-soft">
        That was your browser, which sends what you say to its maker. Kairo can listen here instead: better with names and
        accents, works with no signal, and nothing ever leaves this device.
        {!gpu && " It will be slower on this one, which has no graphics acceleration."}
      </p>
      <div className="mt-2.5 flex items-center gap-2">
        <button onClick={yes} className="rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-paper" data-dictation-offer-yes>
          Set it up &middot; {sizeLabel(spec.webgpu.bytes)} once
        </button>
        <button onClick={no} className="rounded-full px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-paper" data-dictation-offer-no>
          No thanks
        </button>
      </div>
    </div>
  );
}
