"use client";

/**
 * Dictation arrives before it is wanted.
 *
 * Speaking to Kairo is not a setting somebody goes looking for, it is how the
 * app is meant to be used -- so the model is fetched quietly the first time
 * someone opens Kairo, and by the time they tap the microphone it is already
 * there. Nobody is asked, because "would you like 79MB of speech recognition"
 * is not a question anyone can answer usefully.
 *
 * Three things make that safe rather than rude:
 *
 *   - It waits for the app to be idle. Not on first paint, not while the
 *     day is still loading -- after, when the browser has nothing better to
 *     do and the fetch competes with nothing.
 *   - It reads the signals the device already gives. Data Saver on, or a
 *     connection reporting itself as 2g, means somebody is counting their
 *     megabytes, and this waits for a better moment rather than spending
 *     them. That is not asking; it is listening to an answer already given.
 *   - It is one fetch, ever, per device, and Settings can undo it.
 */

import { useEffect } from "react";
import { canRecord } from "@/lib/dictation/audio";
import { alreadyFetched, prepare, readSettings } from "@/lib/dictation/engine";

type Connection = { saveData?: boolean; effectiveType?: string };

/** Somebody counting their data, as far as the browser will say. */
function sparingData(): boolean {
  const c = (navigator as Navigator & { connection?: Connection }).connection;
  if (!c) return false;
  if (c.saveData) return true;
  return c.effectiveType === "slow-2g" || c.effectiveType === "2g";
}

/** After the page has settled, or after a moment if the browser won't say. */
function whenIdle(run: () => void): () => void {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(run, { timeout: 8000 });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(run, 4000);
  return () => window.clearTimeout(id);
}

export function DictationPreload() {
  useEffect(() => {
    let dropped = false;
    const cancel = whenIdle(() => {
      void (async () => {
        if (dropped) return;
        if (!canRecord()) return;
        // turned off deliberately in Settings: leave it off
        if (!readSettings().on) return;
        if (sparingData()) return;
        // already here: let the first tap load it from the cache rather than
        // holding a few hundred megabytes for someone who may never speak
        if (await alreadyFetched(readSettings().tier)) return;
        if (dropped) return;
        try {
          await prepare(readSettings().tier);
        } catch {
          // no model today: the microphone still works through the browser
        }
      })();
    });
    return () => {
      dropped = true;
      cancel();
    };
  }, []);

  return null;
}
