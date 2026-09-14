"use client";

import { useSyncExternalStore } from "react";
import { notesStore, readExpanded, writeExpanded } from "@/lib/notes-client";

/**
 * What the notes screens remember about how you left them: which branches of
 * the tree were open, and whether the page panel was showing. Per person, per
 * device, and never worth a round trip.
 */

const ui = { userId: "", expanded: new Set<string>(), panel: true, tick: 0 };
const listeners = new Set<() => void>();
const PANEL_KEY = "kairo-notes-panel";

function emit() {
  ui.tick++;
  for (const l of listeners) l();
}

export const notesUi = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  snapshot: () => ui.tick,

  /** Loads this person's remembered state once; called from an effect, never during render. */
  init(userId: string) {
    if (ui.userId === userId) return;
    ui.userId = userId;
    ui.expanded = readExpanded(userId);
    try {
      ui.panel = localStorage.getItem(PANEL_KEY) !== "0";
    } catch {
      ui.panel = true;
    }
    emit();
  },

  isOpen: (id: string) => ui.expanded.has(id),

  toggle(id: string) {
    if (ui.expanded.has(id)) ui.expanded.delete(id);
    else ui.expanded.add(id);
    if (ui.userId) writeExpanded(ui.userId, ui.expanded);
    emit();
  },

  expand(...ids: (string | null | undefined)[]) {
    let changed = false;
    for (const id of ids) {
      if (id && !ui.expanded.has(id)) {
        ui.expanded.add(id);
        changed = true;
      }
    }
    if (!changed) return;
    if (ui.userId) writeExpanded(ui.userId, ui.expanded);
    emit();
  },

  panelOpen: () => ui.panel,

  setPanel(open: boolean) {
    ui.panel = open;
    try {
      localStorage.setItem(PANEL_KEY, open ? "1" : "0");
    } catch {
      /* remembered for this session only */
    }
    emit();
  },
};

/** Re-renders when the page tree changes. */
export const useTreeTick = () => useSyncExternalStore(notesStore.subscribe, notesStore.snapshot, () => 0);
/** Re-renders when open branches or the panel change. */
export const useUiTick = () => useSyncExternalStore(notesUi.subscribe, notesUi.snapshot, () => 0);
