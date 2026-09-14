"use client";

import { useMemo } from "react";
import type { JNode } from "@/lib/doc-model";
import { notesApi, notesStore } from "@/lib/notes-client";
import type { NoteMeta, NoteMetaPatch, NotePage } from "@/lib/notes-shared";
import { track } from "@/lib/analytics-client";
import { navigateApp } from "../app-views";
import { useApp } from "../store";
import { notesUi } from "./ui-state";

/**
 * Everything you can do to a page from anywhere — the tree, the page menu, the
 * home, the palette — in one place, so an action behaves the same wherever it
 * was started: the tree updates at once, the server confirms, and a failure
 * puts things back and says so.
 */

export const metaOf = (p: NotePage): NoteMeta => ({
  id: p.id,
  parentId: p.parentId,
  rank: p.rank,
  title: p.title,
  icon: p.icon,
  cover: p.cover,
  favorite: p.favorite,
  fullWidth: p.fullWidth,
  smallText: p.smallText,
  font: p.font,
  locked: p.locked,
  words: p.words,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

export const titleOf = (p: { title: string } | null | undefined) => (p?.title ? p.title : "Untitled");

/** The page open in the address bar, if any. */
export function openPageId(): string | null {
  const m = /^\/notes\/([a-f0-9]{24})\/?$/.exec(window.location.pathname);
  return m ? m[1] : null;
}

export function useNoteActions() {
  const { showToast } = useApp();

  return useMemo(() => {
    const restore = async (id: string) => {
      const r = await notesApi.restore(id);
      if (!r.ok) {
        showToast({ message: r.kind === "offline" ? "You're offline. Try again when you're back." : "Couldn't restore that page." });
        return false;
      }
      notesStore.upsert(...r.data.pages);
      const root = r.data.pages.find((p) => p.id === id);
      showToast({ message: `Restored “${titleOf(root)}”.` });
      return true;
    };

    return {
      async create(opts: {
        parentId?: string | null;
        afterId?: string | null;
        title?: string;
        icon?: string | null;
        doc?: JNode;
        open?: boolean;
      } = {}): Promise<NotePage | null> {
        const r = await notesApi.create({
          parentId: opts.parentId ?? null,
          afterId: opts.afterId ?? null,
          title: opts.title ?? "",
          icon: opts.icon ?? null,
          ...(opts.doc ? { doc: opts.doc } : {}),
        });
        if (!r.ok) {
          showToast({
            message:
              r.kind === "offline"
                ? "You're offline, so a new page can't be made just now."
                : r.kind === "invalid" || r.kind === "conflict"
                  ? r.message
                  : "Couldn't make a new page.",
          });
          return null;
        }
        notesStore.upsert(metaOf(r.data.page));
        notesUi.expand(opts.parentId);
        track("note-create");
        if (opts.open !== false) navigateApp(`/notes/${r.data.page.id}`);
        return r.data.page;
      },

      async trash(id: string) {
        const meta = notesStore.get(id);
        const ids = notesStore.subtreeIds(id);
        const snapshot = [...ids].map((i) => notesStore.get(i)).filter((p): p is NoteMeta => p !== null);
        const open = openPageId();
        notesStore.remove(ids);
        if (open && ids.has(open)) {
          navigateApp(meta?.parentId && notesStore.get(meta.parentId) ? `/notes/${meta.parentId}` : "/notes");
        }
        const r = await notesApi.trash(id);
        if (!r.ok) {
          notesStore.upsert(...snapshot);
          showToast({ message: r.kind === "offline" ? "You're offline, so that page stays for now." : "Couldn't move that page to the trash." });
          return;
        }
        track("note-trash");
        const extra = ids.size > 1 ? ` and ${ids.size - 1} inside it` : "";
        showToast({
          message: `Moved “${titleOf(meta)}”${extra} to the trash.`,
          action: { label: "Undo", run: () => void restore(id) },
        });
      },

      restore,

      async duplicate(id: string) {
        const r = await notesApi.duplicate(id);
        if (!r.ok) {
          showToast({ message: r.kind === "invalid" ? r.message : "Couldn't duplicate that page." });
          return;
        }
        notesStore.upsert(...r.data.pages);
        navigateApp(`/notes/${r.data.page.id}`);
        showToast({ message: "Duplicated." });
      },

      async setMeta(id: string, patch: NoteMetaPatch) {
        const before = notesStore.get(id);
        if (!before) return false;
        notesStore.patchLocal(id, patch);
        const r = await notesApi.patch(id, patch);
        if (r.ok) {
          notesStore.upsert(r.data.page);
          return true;
        }
        const undo: Partial<NoteMeta> = {};
        for (const key of Object.keys(patch) as (keyof NoteMetaPatch)[]) {
          (undo as Record<string, unknown>)[key] = before[key];
        }
        notesStore.patchLocal(id, undo);
        showToast({
          message:
            r.kind === "offline"
              ? "You're offline, so that change didn't stick."
              : r.kind === "locked" || r.kind === "invalid" || r.kind === "conflict"
                ? r.message
                : "Couldn't change that page.",
        });
        return false;
      },

      async toggleFavorite(id: string) {
        const meta = notesStore.get(id);
        if (!meta) return;
        const next = !meta.favorite;
        notesStore.patchLocal(id, { favorite: next });
        const r = await notesApi.patch(id, { favorite: next });
        if (!r.ok) {
          notesStore.patchLocal(id, { favorite: !next });
          showToast({ message: "Couldn't change favorites just now." });
        }
      },

      /** Moves a page under a parent (null: the top level), before a sibling or last. */
      async move(id: string, parentId: string | null, beforeId: string | null) {
        const meta = notesStore.get(id);
        if (!meta) return;
        if (parentId && notesStore.subtreeIds(id).has(parentId)) {
          showToast({ message: "A page can't go inside itself." });
          return;
        }
        const siblings = notesStore.children(parentId).filter((s) => s.id !== id);
        const at = beforeId ? siblings.findIndex((s) => s.id === beforeId) : -1;
        const rank =
          at < 0
            ? (siblings[siblings.length - 1]?.rank ?? 0) + 1024
            : at === 0
              ? siblings[0].rank - 1024
              : (siblings[at - 1].rank + siblings[at].rank) / 2;
        notesStore.patchLocal(id, { parentId, rank });
        notesUi.expand(parentId);
        const r = await notesApi.move(id, { parentId, beforeId: at < 0 ? null : beforeId });
        if (!r.ok) {
          notesStore.patchLocal(id, { parentId: meta.parentId, rank: meta.rank });
          showToast({ message: r.kind === "invalid" || r.kind === "conflict" ? r.message : "Couldn't move that page." });
          return;
        }
        notesStore.upsert(r.data.page);
        // a crowded shelf may have been renumbered on the server; take its word for the order
        void notesStore.reload();
      },

      async copyLink(id: string) {
        try {
          await navigator.clipboard.writeText(`${window.location.origin}/notes/${id}`);
          showToast({ message: "Link copied. It opens for you, signed in." });
        } catch {
          showToast({ message: "Couldn't copy the link here." });
        }
      },
    };
  }, [showToast]);
}

export type NoteActions = ReturnType<typeof useNoteActions>;
