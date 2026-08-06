"use client";

import { useEffect, useRef } from "react";
import type { Task } from "@/lib/types";
import { track } from "@/lib/analytics-client";
import { GUEST_STORAGE_KEY, useApp } from "./store";

/**
 * The bridge a guest walks across when they sign in.
 *
 * Mounted only in the signed-in app shell. If the browser still holds a guest
 * world (tasks made on "/" before the account existed), every task is posted
 * into the account, guest list names are matched to real lists by name, and
 * the local copy is cleared so it can never sync twice.
 */
export function GuestSync() {
  const { state, refreshData, showToast } = useApp();
  const ran = useRef(false);
  // the ran guard makes this effect single-shot, so depending on state.lists
  // costs nothing — it only matters on the first run, right after mount
  const lists = state.lists;

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    let saved: { tasks?: Task[] } | null = null;
    try {
      const raw = localStorage.getItem(GUEST_STORAGE_KEY);
      if (!raw) return;
      // two tabs signing in at once must not both sync; the first one claims it
      if (sessionStorage.getItem("kairo-guest-syncing")) return;
      sessionStorage.setItem("kairo-guest-syncing", "1");
      saved = JSON.parse(raw) as { tasks?: Task[] };
    } catch {
      return;
    }

    const tasks = (Array.isArray(saved?.tasks) ? saved.tasks : [])
      .filter((t) => t && typeof t.title === "string" && t.title.trim())
      .slice(0, 200);
    if (tasks.length === 0) {
      try {
        localStorage.removeItem(GUEST_STORAGE_KEY);
        sessionStorage.removeItem("kairo-guest-syncing");
      } catch {}
      return;
    }

    void (async () => {
      // guest lists are known by name only; match them to this account's
      const guestListNames: Record<string, string> = {
        "guest-list-personal": "personal",
        "guest-list-work": "work",
      };
      const realListId = (guestListId: string | null): string | null => {
        if (!guestListId) return null;
        const wanted = guestListNames[guestListId];
        if (!wanted) return null;
        return lists.find((l) => l.name.trim().toLowerCase() === wanted)?.id ?? null;
      };

      let synced = 0;
      for (const t of tasks) {
        try {
          const res = await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: t.title,
              note: t.note ?? "",
              status: t.status ?? "inbox",
              plannedFor: t.plannedFor ?? null,
              plannedTime: t.plannedTime ?? null,
              dueDate: t.dueDate ?? null,
              spotlight: t.spotlight === true,
              listId: realListId(t.listId ?? null),
              estimateMin: t.estimateMin ?? null,
              order: t.order,
              repeat: t.repeat ?? null,
              subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
            }),
          });
          if (res.ok) synced++;
        } catch {
          /* one lost task must not abandon the rest */
        }
      }

      try {
        localStorage.removeItem(GUEST_STORAGE_KEY);
        localStorage.removeItem("kairo-guest-nudged-at");
        sessionStorage.removeItem("kairo-guest-syncing");
      } catch {}

      if (synced > 0) {
        track("guest-sync", { count: synced });
        await refreshData();
        showToast({
          message: `✨ ${synced === 1 ? "Your task" : `Your ${synced} tasks`} came with you. Welcome in.`,
        });
      }
    })();
  }, [refreshData, showToast, lists]);

  return null;
}
