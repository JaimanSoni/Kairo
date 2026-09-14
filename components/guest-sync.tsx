"use client";

import { useEffect, useRef } from "react";
import type { Task } from "@/lib/types";
import { track } from "@/lib/analytics-client";
import { GUEST_STORAGE_KEY, useApp } from "./store";

const SYNCING_KEY = "kairo-guest-syncing";
const SYNCED_IDS_KEY = "kairo-guest-synced-ids";

/**
 * The bridge a guest walks across when they sign in.
 *
 * Mounted only in the signed-in app shell. If the browser still holds a guest
 * world (tasks made on "/" before the account existed), every task is posted
 * into the account, guest list names are matched to real lists by name, and
 * only what arrived is cleared from the local copy — a task that failed to
 * send waits for the next visit rather than vanishing.
 *
 * Every tab in a browser shares the claim (localStorage, not sessionStorage),
 * and the ids already carried over are remembered, so a guest tab left open
 * that saves its world again can't make the same tasks arrive twice.
 */
export function GuestSync() {
  const { state, refreshData, showToast } = useApp();
  const ran = useRef(false);
  // the ran guard makes this effect single-shot, so depending on state.lists
  // costs nothing — it only matters on the first run, right after mount
  const lists = state.lists;
  const locked = state.appLocked;

  useEffect(() => {
    // behind an app lock nothing can be saved; the page reloads once unlocked
    if (locked || ran.current) return;
    ran.current = true;

    let saved: { tasks?: Task[]; lists?: unknown; created?: number } | null = null;
    let already = new Set<string>();
    try {
      const raw = localStorage.getItem(GUEST_STORAGE_KEY);
      if (!raw) return;
      // two tabs signing in at once must not both sync; the first one claims it
      const claim = Number(localStorage.getItem(SYNCING_KEY) ?? 0);
      if (claim && Date.now() - claim < 2 * 60_000) return;
      localStorage.setItem(SYNCING_KEY, String(Date.now()));
      saved = JSON.parse(raw);
      already = new Set(JSON.parse(localStorage.getItem(SYNCED_IDS_KEY) ?? "[]") as string[]);
    } catch {
      return;
    }

    const all = (Array.isArray(saved?.tasks) ? saved.tasks : []).filter((t) => t && typeof t.title === "string" && t.title.trim());
    const tasks = all.filter((t) => !already.has(t.id)).slice(0, 200);
    if (tasks.length === 0) {
      try {
        localStorage.removeItem(GUEST_STORAGE_KEY);
        localStorage.removeItem(SYNCING_KEY);
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

      const arrived = new Set<string>();
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
              // a task finished last Tuesday was finished last Tuesday, not today
              ...(t.status === "done" && t.completedAt ? { completedAt: t.completedAt } : {}),
            }),
          });
          if (res.ok) arrived.add(t.id);
        } catch {
          /* one lost task must not abandon the rest */
        }
      }

      try {
        const remaining = all.filter((t) => !arrived.has(t.id) && !already.has(t.id));
        if (remaining.length === 0) {
          localStorage.removeItem(GUEST_STORAGE_KEY);
          localStorage.removeItem("kairo-guest-nudged-at");
        } else {
          localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify({ ...saved, tasks: remaining }));
        }
        localStorage.setItem(SYNCED_IDS_KEY, JSON.stringify([...already, ...arrived].slice(-500)));
        localStorage.removeItem(SYNCING_KEY);
      } catch {}

      if (arrived.size > 0) {
        track("guest-sync", { count: arrived.size });
        await refreshData();
        showToast({
          message: `✨ ${arrived.size === 1 ? "Your task" : `Your ${arrived.size} tasks`} came with you. Welcome in.`,
        });
      } else if (tasks.length > 0) {
        showToast({ message: "Your guest tasks couldn't come across just now. They're kept, and will try again next visit." });
      }
    })();
  }, [refreshData, showToast, lists, locked]);

  return null;
}
