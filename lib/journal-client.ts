"use client";

import type {
  JNode,
  JournalEntry,
  JournalMemories,
  JournalStats,
  JournalSummary,
  Mood,
} from "./journal-shared";
import type { SearchHit } from "./journal";

/**
 * The browser's side of the journal: calls to the API, drafts kept on the
 * device, and one shared cache so the calendar and the editor never disagree
 * about what a day holds.
 *
 * Every call answers with a tagged result rather than throwing. A journal has
 * more ways to not-quite-work than most screens — locked, offline, edited on
 * another device — and each deserves its own sentence, so each gets its own tag.
 */

export type Fail =
  | { ok: false; kind: "locked" }
  | { ok: false; kind: "conflict"; current: JournalEntry | null }
  | { ok: false; kind: "offline" }
  | { ok: false; kind: "invalid"; message: string }
  | { ok: false; kind: "error"; message: string };

export type Result<T> = { ok: true; data: T } | Fail;

async function call<T>(url: string, init?: RequestInit): Promise<Result<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
      // a save fired as the tab closes must still reach the server
      keepalive: init?.method === "PUT" && typeof init.body === "string" && init.body.length < 60_000,
    });
  } catch {
    return { ok: false, kind: "offline" };
  }
  let body: Record<string, unknown> = {};
  try {
    body = await res.json();
  } catch {
    /* an empty or non-JSON body still has a status worth reporting */
  }
  if (res.ok) return { ok: true, data: body as T };
  if (res.status === 423) return { ok: false, kind: "locked" };
  if (res.status === 409) return { ok: false, kind: "conflict", current: (body.current as JournalEntry | null) ?? null };
  const message = typeof body.error === "string" ? body.error : "Something went wrong.";
  if (res.status === 400 || res.status === 403 || res.status === 429) return { ok: false, kind: "invalid", message };
  return { ok: false, kind: "error", message };
}

export type HomeData = { entries: JournalSummary[]; stats?: JournalStats; memories?: JournalMemories };

export const journalApi = {
  range: (from: string, to: string, today?: string) =>
    call<HomeData>(`/api/journal?from=${from}&to=${to}${today ? `&today=${today}` : ""}`),

  get: (date: string) => call<{ entry: JournalEntry | null }>(`/api/journal/${date}`),

  save: (date: string, page: { title: string; doc: JNode; mood: Mood | null; baseVersion: number }) =>
    call<{ entry: JournalEntry | null }>(`/api/journal/${date}`, { method: "PUT", body: JSON.stringify(page) }),

  remove: (date: string, baseVersion: number) =>
    call<{ ok: true }>(`/api/journal/${date}?baseVersion=${baseVersion}`, { method: "DELETE" }),

  search: (q: string) => call<{ results: SearchHit[] }>(`/api/journal/search?q=${encodeURIComponent(q)}`),

  lockStatus: () => call<{ hasPin: boolean; locked: boolean; retryAfter: number }>("/api/journal/lock"),

  unlock: (pin: string) => call<{ locked: false }>("/api/journal/unlock", { method: "POST", body: JSON.stringify({ pin }) }),

  lockNow: () => call<{ locked: true }>("/api/journal/unlock", { method: "DELETE" }),

  setPin: (pin: string, currentPin?: string) =>
    call<{ hasPin: true }>("/api/journal/lock", { method: "POST", body: JSON.stringify({ pin, currentPin }) }),

  removePin: (pin: string) =>
    call<{ hasPin: false }>("/api/journal/lock", { method: "DELETE", body: JSON.stringify({ pin }) }),
};

/* ---------------------------------------------------------------- drafts */

/**
 * What is typed lands here before it goes anywhere near the network.
 *
 * The one unforgivable thing a journal can do is lose words. A crash, a dead
 * battery, a tunnel, a tab closed mid-sentence — the draft is already on the
 * device, and the next visit finishes the save. It is removed only once the
 * server confirms the exact version it holds.
 */
export type Draft = {
  title: string;
  doc: JNode;
  mood: Mood | null;
  /** The server version this draft was edited on top of. */
  baseVersion: number;
  savedAt: number;
};

const draftKey = (userId: string, date: string) => `kairo-journal-draft:${userId}:${date}`;

export function readDraft(userId: string, date: string): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(userId, date));
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    return d && typeof d.baseVersion === "number" && d.doc?.type === "doc" ? d : null;
  } catch {
    return null;
  }
}

export function writeDraft(userId: string, date: string, draft: Draft): void {
  try {
    localStorage.setItem(draftKey(userId, date), JSON.stringify(draft));
  } catch {
    // a full or disabled store just means no safety net on this device
  }
}

export function clearDraft(userId: string, date: string): void {
  try {
    localStorage.removeItem(draftKey(userId, date));
  } catch {
    /* nothing to clear */
  }
}

/** Days with unsaved work still on this device — for "you have unsynced pages". */
export function pendingDraftDates(userId: string): string[] {
  const prefix = `kairo-journal-draft:${userId}:`;
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) out.push(k.slice(prefix.length));
    }
  } catch {
    /* no storage, no drafts */
  }
  return out.sort();
}

/* ----------------------------------------------------------------- cache */

type CacheState = {
  /** Summaries by date, across every month loaded this session. */
  days: Map<string, JournalSummary>;
  /** Months ("2026-09") whose summaries have been fetched. */
  months: Set<string>;
  stats: JournalStats | null;
  memories: JournalMemories | null;
  /** Bumped on every change so subscribers re-render. */
  tick: number;
};

const cache: CacheState = { days: new Map(), months: new Set(), stats: null, memories: null, tick: 0 };
const listeners = new Set<() => void>();

function emit() {
  cache.tick++;
  for (const l of listeners) l();
}

export const journalCache = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  snapshot: () => cache.tick,
  get: () => cache,

  loadMonth(month: string, entries: JournalSummary[]) {
    for (const [date] of cache.days) if (date.startsWith(month)) cache.days.delete(date);
    for (const e of entries) cache.days.set(e.date, e);
    cache.months.add(month);
    emit();
  },

  setHome(stats: JournalStats | undefined, memories: JournalMemories | undefined) {
    if (stats) cache.stats = stats;
    if (memories) cache.memories = memories;
    emit();
  },

  /** The editor saved, or emptied, a page: the calendar learns at once. */
  put(date: string, entry: JournalEntry | null, preview: string) {
    const had = cache.days.has(date);
    if (entry) {
      cache.days.set(date, {
        date,
        title: entry.title,
        mood: entry.mood,
        words: entry.words,
        preview,
        updatedAt: entry.updatedAt,
      });
      if (!had && cache.stats) cache.stats = { ...cache.stats, entries: cache.stats.entries + 1 };
    } else if (had) {
      cache.days.delete(date);
      if (cache.stats) cache.stats = { ...cache.stats, entries: Math.max(0, cache.stats.entries - 1) };
    }
    emit();
  },

  /** Locking, or switching accounts, forgets everything this session learned. */
  reset() {
    cache.days.clear();
    cache.months.clear();
    cache.stats = null;
    cache.memories = null;
    emit();
  },
};
