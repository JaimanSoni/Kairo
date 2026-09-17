"use client";

import type { JNode } from "./doc-model";
import type {
  NoteMeta,
  NoteMetaPatch,
  NotePage,
  NoteRef,
  NoteSearchHit,
  TrashItem,
} from "./notes-shared";

/**
 * The browser's side of notes: calls to the API, drafts kept on the device,
 * and one store for the page tree, so the sidebar, the home, the palette and
 * an open page never disagree about what a page is called or where it lives.
 *
 * Calls answer with a tagged result rather than throwing, as the journal's do.
 */

export type NoteFail =
  | { ok: false; kind: "conflict"; current: NotePage | null; message: string }
  | { ok: false; kind: "missing" }
  | { ok: false; kind: "trashed"; message: string }
  | { ok: false; kind: "locked"; message: string }
  | { ok: false; kind: "offline" }
  | { ok: false; kind: "invalid"; message: string }
  | { ok: false; kind: "error"; message: string };

export type NoteResult<T> = { ok: true; data: T } | NoteFail;

async function call<T>(url: string, init?: RequestInit): Promise<NoteResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
      // a save fired as the tab closes must still reach the server
      keepalive:
        (init?.method === "PUT" || init?.method === "PATCH") && typeof init.body === "string" && init.body.length < 60_000,
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
  const message = typeof body.error === "string" ? body.error : "Something went wrong.";
  if (res.status === 404) return { ok: false, kind: "missing" };
  if (res.status === 410) return { ok: false, kind: "trashed", message };
  if (res.status === 423) return { ok: false, kind: "locked", message };
  if (res.status === 409) {
    return { ok: false, kind: "conflict", current: (body.current as NotePage | null) ?? null, message };
  }
  if (res.status === 400 || res.status === 403 || res.status === 413 || res.status === 429) {
    return { ok: false, kind: "invalid", message };
  }
  return { ok: false, kind: "error", message };
}

export type SavedBody = NoteMeta & { version: number };

export const notesApi = {
  tree: () => call<{ pages: NoteMeta[] }>("/api/notes"),

  create: (input: { parentId?: string | null; afterId?: string | null; title?: string; icon?: string | null; cover?: string | null; doc?: JNode }) =>
    call<{ page: NotePage }>("/api/notes", { method: "POST", body: JSON.stringify(input) }),

  get: (id: string) => call<{ page: NotePage; backlinks: NoteRef[] }>(`/api/notes/${id}`),

  saveDoc: (id: string, body: { doc: JNode; baseVersion: number; allowEmpty: boolean }) =>
    call<{ page: SavedBody }>(`/api/notes/${id}`, { method: "PUT", body: JSON.stringify(body) }),

  patch: (id: string, patch: NoteMetaPatch) =>
    call<{ page: NoteMeta }>(`/api/notes/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),

  /** Publishes one page to the web, or takes it back down. */
  setShared: (id: string, shared: boolean) => call<{ page: NoteMeta }>(`/api/notes/${id}`, { method: "PATCH", body: JSON.stringify({ shared }) }),

  trash: (id: string) => call<{ trashed: string[] }>(`/api/notes/${id}`, { method: "DELETE" }),

  deleteForever: (id: string) => call<{ deleted: number }>(`/api/notes/${id}?forever=1`, { method: "DELETE" }),

  move: (id: string, target: { parentId: string | null; beforeId: string | null }) =>
    call<{ page: NoteMeta }>(`/api/notes/${id}/move`, { method: "POST", body: JSON.stringify(target) }),

  duplicate: (id: string) => call<{ page: NotePage; pages: NoteMeta[] }>(`/api/notes/${id}/duplicate`, { method: "POST" }),

  restore: (id: string) => call<{ pages: NoteMeta[] }>(`/api/notes/${id}/restore`, { method: "POST" }),

  trashList: () => call<{ items: TrashItem[] }>("/api/notes/trash"),

  emptyTrash: () => call<{ deleted: number }>("/api/notes/trash", { method: "DELETE" }),

  search: (q: string) => call<{ results: NoteSearchHit[] }>(`/api/notes/search?q=${encodeURIComponent(q)}`),
};

/* ---------------------------------------------------------------- drafts */

/**
 * What is typed lands here before it goes anywhere near the network, exactly
 * as in the journal. It is removed only once the server confirms the version.
 */
export type NoteDraft = {
  doc: JNode;
  /** The server version this draft was edited on top of. */
  baseVersion: number;
  savedAt: number;
};

const draftKey = (userId: string, id: string) => `kairo-note-draft:${userId}:${id}`;

export function readNoteDraft(userId: string, id: string): NoteDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(userId, id));
    if (!raw) return null;
    const d = JSON.parse(raw) as NoteDraft;
    return d && typeof d.baseVersion === "number" && d.doc?.type === "doc" ? d : null;
  } catch {
    return null;
  }
}

export function writeNoteDraft(userId: string, id: string, draft: NoteDraft): void {
  try {
    localStorage.setItem(draftKey(userId, id), JSON.stringify(draft));
  } catch {
    // a full or disabled store just means no safety net on this device
  }
}

export function clearNoteDraft(userId: string, id: string): void {
  try {
    localStorage.removeItem(draftKey(userId, id));
  } catch {
    /* nothing to clear */
  }
}

/* ----------------------------------------------------------------- store */

type TreeState = {
  status: "idle" | "loading" | "ready" | "error";
  pages: Map<string, NoteMeta>;
  /** Bumped on every change so subscribers re-render. */
  tick: number;
};

const tree: TreeState = { status: "idle", pages: new Map(), tick: 0 };
const listeners = new Set<() => void>();
let childCache: { tick: number; index: Map<string | null, NoteMeta[]> } | null = null;

function emit() {
  tree.tick++;
  for (const l of listeners) l();
}

function childIndex(): Map<string | null, NoteMeta[]> {
  if (childCache?.tick === tree.tick) return childCache.index;
  const index = new Map<string | null, NoteMeta[]>();
  for (const p of tree.pages.values()) {
    // a page whose parent isn't in the tree (trashed, or not loaded) shows at the top
    const key = p.parentId && tree.pages.has(p.parentId) ? p.parentId : null;
    const list = index.get(key) ?? [];
    list.push(p);
    index.set(key, list);
  }
  for (const list of index.values()) list.sort((a, b) => a.rank - b.rank || a.createdAt.localeCompare(b.createdAt));
  childCache = { tick: tree.tick, index };
  return index;
}

let loading: Promise<void> | null = null;

export const notesStore = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  snapshot: () => tree.tick,
  status: () => tree.status,
  get: (id: string | null | undefined) => (id ? tree.pages.get(id) ?? null : null),
  all: () => [...tree.pages.values()],
  children: (parentId: string | null) => childIndex().get(parentId) ?? [],
  hasChildren: (id: string) => (childIndex().get(id)?.length ?? 0) > 0,

  /** Parents from the top down to (not including) the page. */
  ancestors(id: string): NoteMeta[] {
    const out: NoteMeta[] = [];
    const seen = new Set<string>([id]);
    let at = tree.pages.get(id)?.parentId ? tree.pages.get(tree.pages.get(id)!.parentId!) : undefined;
    while (at && !seen.has(at.id)) {
      out.unshift(at);
      seen.add(at.id);
      at = at.parentId ? tree.pages.get(at.parentId) : undefined;
    }
    return out;
  },

  /** A page and everything beneath it, for "can't move into itself" and trashing. */
  subtreeIds(id: string): Set<string> {
    const out = new Set<string>([id]);
    const queue = [id];
    while (queue.length) {
      for (const child of childIndex().get(queue.shift()!) ?? []) {
        if (!out.has(child.id)) {
          out.add(child.id);
          queue.push(child.id);
        }
      }
    }
    return out;
  },

  ensureLoaded(): Promise<void> {
    if (tree.status === "ready") return Promise.resolve();
    return notesStore.reload();
  },

  reload(): Promise<void> {
    loading ??= (async () => {
      if (tree.status !== "ready") {
        tree.status = "loading";
        emit();
      }
      const r = await notesApi.tree();
      if (r.ok) {
        tree.pages = new Map(r.data.pages.map((p) => [p.id, p]));
        tree.status = "ready";
      } else if (tree.status !== "ready") {
        tree.status = "error";
      }
      emit();
    })().finally(() => {
      loading = null;
    });
    return loading;
  },

  upsert(...pages: NoteMeta[]) {
    for (const p of pages) tree.pages.set(p.id, { ...tree.pages.get(p.id), ...p });
    emit();
  },

  /** A local change the server will confirm — the tree reflects typing at once. */
  patchLocal(id: string, patch: Partial<NoteMeta>) {
    const current = tree.pages.get(id);
    if (!current) return;
    tree.pages.set(id, { ...current, ...patch });
    emit();
  },

  remove(ids: Iterable<string>) {
    for (const id of ids) tree.pages.delete(id);
    emit();
  },

  /** Signing out or switching accounts forgets the tree. */
  reset() {
    tree.pages.clear();
    tree.status = "idle";
    emit();
  },
};

/* ------------------------------------------------------------ ui memory */

/** Which branches are open, per person and per device. */
export function readExpanded(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(`kairo-notes-open:${userId}`);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function writeExpanded(userId: string, open: Set<string>): void {
  try {
    localStorage.setItem(`kairo-notes-open:${userId}`, JSON.stringify([...open].slice(-500)));
  } catch {
    /* forgetting which branches were open is harmless */
  }
}
