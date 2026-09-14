"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { notesApi, notesStore } from "@/lib/notes-client";
import type { NoteMeta, NoteSearchHit, TrashItem } from "@/lib/notes-shared";
import { TRASH_DAYS } from "@/lib/notes-shared";
import { navigateApp } from "../app-views";
import { useApp } from "../store";
import { IconX, Kbd, Modal } from "../ui";
import { titleOf, useNoteActions } from "./actions";
import { ago, pathOf } from "./format";
import { useTreeTick } from "./ui-state";

/* ------------------------------------------------------------------ move */

export function MoveDialog({ id, onClose }: { id: string; onClose: () => void }) {
  useTreeTick();
  const actions = useNoteActions();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const page = notesStore.get(id);
  const query = q.trim().toLowerCase();

  const options = useMemo(() => {
    const blocked = notesStore.subtreeIds(id);
    const pages = notesStore
      .all()
      .filter((p) => !blocked.has(p.id) && (!query || titleOf(p).toLowerCase().includes(query)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 40);
    const top = page?.parentId && (!query || "top level".includes(query)) ? [null] : [];
    return [...top, ...pages] as (NoteMeta | null)[];
  }, [id, page?.parentId, query]);

  const choose = (target: NoteMeta | null) => {
    onClose();
    void actions.move(id, target?.id ?? null, null);
  };

  return (
    <Modal onClose={onClose} anchor="top">
      <div className="p-3">
        <div className="flex items-center gap-2 border-b border-line px-2 pb-3">
          <span className="shrink-0 text-sm text-ink-faint">Move “{titleOf(page)}” to</span>
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(options.length - 1, s + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(0, s - 1));
              } else if (e.key === "Enter" && options[sel] !== undefined) {
                choose(options[sel]);
              }
            }}
            placeholder="Search pages"
            aria-label="Search pages to move into"
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-faint"
          />
        </div>
        <div className="no-scrollbar max-h-[50dvh] overflow-y-auto pt-2">
          {options.length === 0 && <p className="px-3 py-6 text-center text-sm text-ink-faint">No page matches “{q}”.</p>}
          {options.map((p, i) => (
            <button
              key={p?.id ?? "top"}
              type="button"
              onMouseEnter={() => setSel(i)}
              onClick={() => choose(p)}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left ${sel === i ? "bg-sun-soft" : ""}`}
            >
              <span className="w-5 shrink-0 text-center" aria-hidden>
                {p ? p.icon ?? "📄" : "⤒"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{p ? titleOf(p) : "Top level"}</span>
                {p && pathOf(p.id) && <span className="block truncate text-xs text-ink-faint">{pathOf(p.id)}</span>}
              </span>
              {p?.id === page?.parentId && <span className="shrink-0 text-xs text-ink-faint">here now</span>}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

/* ----------------------------------------------------------------- trash */

export function TrashDialog({ onClose }: { onClose: () => void }) {
  const { showToast } = useApp();
  const actions = useNoteActions();
  const [items, setItems] = useState<TrashItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    notesApi.trashList().then((r) => {
      if (cancelled) return;
      if (r.ok) setItems(r.data.items);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const shown = (items ?? []).filter((i) => !q.trim() || titleOf(i).toLowerCase().includes(q.trim().toLowerCase()));

  const forget = async (id: string) => {
    setConfirm(null);
    const r = await notesApi.deleteForever(id);
    if (!r.ok) {
      showToast({ message: "Couldn't delete that page." });
      return;
    }
    setItems((prev) => prev?.filter((i) => i.id !== id) ?? null);
  };

  const emptyAll = async () => {
    setConfirm(null);
    const r = await notesApi.emptyTrash();
    if (!r.ok) {
      showToast({ message: "Couldn't empty the trash." });
      return;
    }
    setItems([]);
    showToast({ message: r.data.deleted === 1 ? "Deleted 1 page for good." : `Deleted ${r.data.deleted} pages for good.` });
  };

  return (
    <Modal onClose={onClose} anchor="top">
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold">Trash</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-ink-faint hover:bg-paper-deep">
            <IconX />
          </button>
        </div>
        <p className="mt-0.5 text-xs text-ink-faint">Pages stay here for {TRASH_DAYS} days, then they&apos;re gone for good.</p>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the trash"
          aria-label="Search the trash"
          className="mt-3 h-9 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-sun"
        />
        <div className="no-scrollbar mt-2 max-h-[50dvh] overflow-y-auto">
          {items === null ? (
            <p className="px-2 py-6 text-center text-sm text-ink-faint">{failed ? "Couldn't load the trash. Check your connection." : "Loading…"}</p>
          ) : shown.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-ink-faint">{items.length ? `Nothing in the trash matches “${q}”.` : "The trash is empty."}</p>
          ) : (
            <ul className="space-y-1">
              {shown.map((item) => (
                <li key={item.id} className="group flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-paper-deep/60">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigateApp(`/notes/${item.id}`);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    <span className="w-5 shrink-0 text-center" aria-hidden>
                      {item.icon ?? "📄"}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{titleOf(item)}</span>
                      <span className="block truncate text-xs text-ink-faint">
                        {[item.parentTitle ? `in ${item.parentTitle}` : null, item.pages > 1 ? `${item.pages} pages` : null, ago(item.trashedAt)]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </button>
                  {confirm === item.id ? (
                    <span className="flex shrink-0 items-center gap-1">
                      <button type="button" onClick={() => void forget(item.id)} className="rounded-full bg-clay px-2.5 py-1 text-xs font-semibold text-white">
                        Delete forever
                      </button>
                      <button type="button" onClick={() => setConfirm(null)} className="rounded-full px-2 py-1 text-xs text-ink-soft">
                        Keep
                      </button>
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={async () => {
                          if (await actions.restore(item.id)) setItems((prev) => prev?.filter((i) => i.id !== item.id) ?? null);
                        }}
                        className="rounded-full border border-line bg-card px-2.5 py-1 text-xs font-medium text-ink-soft hover:border-sun hover:text-sun-deep"
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirm(item.id)}
                        aria-label={`Delete ${titleOf(item)} forever`}
                        className="rounded-full px-2 py-1 text-xs text-ink-faint hover:text-clay"
                      >
                        🗑
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        {items && items.length > 0 && (
          <div className="mt-3 flex items-center justify-end gap-2 border-t border-line pt-3">
            {confirm === "__all" ? (
              <>
                <span className="text-xs text-ink-soft">Delete everything here for good?</span>
                <button type="button" onClick={() => void emptyAll()} className="rounded-full bg-clay px-3 py-1.5 text-xs font-semibold text-white">
                  Empty trash
                </button>
                <button type="button" onClick={() => setConfirm(null)} className="rounded-full px-2 py-1.5 text-xs text-ink-soft">
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirm("__all")} className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-clay hover:text-clay">
                Empty trash
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------ quick find */

type FindItem =
  | { kind: "page"; page: NoteMeta }
  | { kind: "hit"; hit: NoteSearchHit }
  | { kind: "new"; title: string };

/**
 * Find a page by its title instantly, from the tree, and by its words a
 * moment later, from the server. Enter on nothing found makes the page.
 */
export function QuickFind({ onClose }: { onClose: () => void }) {
  useTreeTick();
  const actions = useNoteActions();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [hits, setHits] = useState<{ q: string; results: NoteSearchHit[] }>({ q: "", results: [] });
  const listRef = useRef<HTMLDivElement>(null);
  const query = q.trim();

  useEffect(() => {
    if (query.length < 2) return;
    const timer = setTimeout(() => {
      notesApi.search(query).then((r) => {
        if (r.ok) setHits({ q: query, results: r.data.results });
      });
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  const items = useMemo<FindItem[]>(() => {
    const lower = query.toLowerCase();
    const pages = notesStore
      .all()
      .filter((p) => !lower || titleOf(p).toLowerCase().includes(lower))
      .sort((a, b) => {
        if (lower) {
          const d = Number(titleOf(b).toLowerCase().startsWith(lower)) - Number(titleOf(a).toLowerCase().startsWith(lower));
          if (d) return d;
        }
        return b.updatedAt.localeCompare(a.updatedAt);
      })
      .slice(0, lower ? 8 : 10)
      .map((page) => ({ kind: "page" as const, page }));
    const seen = new Set(pages.map((p) => p.page.id));
    const words =
      hits.q === query && query.length >= 2
        ? hits.results.filter((h) => !seen.has(h.id)).slice(0, 8).map((hit) => ({ kind: "hit" as const, hit }))
        : [];
    return [...pages, ...words, ...(query ? [{ kind: "new" as const, title: query }] : [])];
  }, [query, hits]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  const run = (item: FindItem) => {
    onClose();
    if (item.kind === "page") navigateApp(`/notes/${item.page.id}`);
    else if (item.kind === "hit") navigateApp(`/notes/${item.hit.id}`);
    else void actions.create({ title: item.title });
  };

  return (
    <Modal onClose={onClose} anchor="top">
      <div className="p-3">
        <div className="flex items-center gap-2.5 border-b border-line px-2 pb-3">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-ink-faint" aria-hidden>
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(items.length - 1, s + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(0, s - 1));
              } else if (e.key === "Enter" && items[sel]) {
                e.preventDefault();
                run(items[sel]);
              }
            }}
            placeholder="Search your notes"
            aria-label="Search your notes"
            className="w-full bg-transparent text-base outline-none placeholder:text-ink-faint"
          />
          <Kbd>esc</Kbd>
        </div>
        <div ref={listRef} className="no-scrollbar max-h-[50dvh] overflow-y-auto pt-2">
          {!query && items.length === 0 && <p className="px-3 py-6 text-center text-sm text-ink-faint">No pages yet. Type a title to make one.</p>}
          {items.map((item, idx) => {
            const label =
              idx === 0 && item.kind === "page"
                ? query
                  ? "Titles"
                  : "Recently edited"
                : item.kind === "hit" && items[idx - 1]?.kind !== "hit"
                  ? "In the words"
                  : null;
            return (
              <div key={item.kind === "page" ? item.page.id : item.kind === "hit" ? `hit-${item.hit.id}` : "new"}>
                {label && <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">{label}</div>}
                <button
                  type="button"
                  data-idx={idx}
                  onMouseEnter={() => setSel(idx)}
                  onClick={() => run(item)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left ${sel === idx ? "bg-sun-soft" : ""}`}
                >
                  {item.kind === "new" ? (
                    <>
                      <span className="w-5 shrink-0 text-center text-sun" aria-hidden>
                        +
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        New page “<b>{item.title}</b>”
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="w-5 shrink-0 text-center" aria-hidden>
                        {(item.kind === "page" ? item.page.icon : item.hit.icon) ?? "📄"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{titleOf(item.kind === "page" ? item.page : item.hit)}</span>
                        <span className="block truncate text-xs text-ink-faint">
                          {item.kind === "hit" ? item.hit.snippet : pathOf(item.page.id) || ago(item.page.updatedAt)}
                        </span>
                      </span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
