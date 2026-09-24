"use client";

/**
 * The one line under the capture box while it is listening.
 *
 * Dictation has four things it can be doing and each of them deserves a
 * different sentence, because the wait means something different each time.
 * Fetching a model is a one-off minute that will never happen again, and
 * saying so is what stops it feeling like the app has hung.
 */

import { sizeLabel } from "@/lib/dictation/models";
import type { Phase } from "./use-dictation";

export function DictationLine({
  phase,
  progress,
  onDevice,
}: {
  phase: Phase;
  progress: { loaded: number; total: number } | null;
  onDevice: boolean;
}) {
  if (phase === "fetching" || phase === "warming") {
    const done = progress && progress.total > 0 ? Math.min(99, Math.floor((progress.loaded / progress.total) * 100)) : null;
    return (
      <span className="flex items-center gap-2 text-ink-soft" data-dictation-status="fetching">
        <span className="h-1 w-24 overflow-hidden rounded-full bg-paper-deep" aria-hidden>
          <span className="block h-full rounded-full bg-moss transition-[width] duration-300" style={{ width: `${done ?? 6}%` }} />
        </span>
        <span>
          {done === null
            ? "Getting dictation ready…"
            : `Getting dictation ready, ${done}%${progress ? ` of ${sizeLabel(progress.total)}` : ""} — once, then it works offline`}
        </span>
      </span>
    );
  }

  if (phase === "thinking") {
    return (
      <span className="text-ink-soft" data-dictation-status="thinking">
        Writing that down…
      </span>
    );
  }

  return (
    <span className="text-ink-soft" data-dictation-status="listening">
      Listening. Say it the way you&apos;d say it to a friend.
      {onDevice && <span className="ml-1.5 text-ink-faint">Stays on this device.</span>}
    </span>
  );
}
