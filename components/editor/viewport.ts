"use client";

import { useSyncExternalStore } from "react";

/**
 * Facts about the screen the floating pieces need. Kept apart from the editor
 * code so the app shell can ask them without loading an editor.
 */

const noopSubscribe = () => () => {};

/** How far the on-screen keyboard has pushed up from the bottom, in px. */
export function useKeyboardInset(): number {
  return useSyncExternalStore(
    (cb) => {
      const vv = window.visualViewport;
      vv?.addEventListener("resize", cb);
      vv?.addEventListener("scroll", cb);
      window.addEventListener("resize", cb);
      return () => {
        vv?.removeEventListener("resize", cb);
        vv?.removeEventListener("scroll", cb);
        window.removeEventListener("resize", cb);
      };
    },
    () => {
      const vv = window.visualViewport;
      return vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
    },
    () => 0
  );
}

export function useCoarsePointer(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.matchMedia("(pointer: coarse)").matches,
    () => false
  );
}
