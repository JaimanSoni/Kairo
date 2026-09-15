"use client";

import { useRef, useState } from "react";
import { notesStore } from "@/lib/notes-client";
import type { NoteMeta } from "@/lib/notes-shared";
import { navigateApp } from "../app-views";
import { IconPlus, IconStar } from "../ui";
import { useCoarsePointer } from "../editor/viewport";
import { titleOf, useNoteActions, type NoteActions } from "./actions";
import { notesUi, useTreeTick, useUiTick } from "./ui-state";
import { MoveDialog } from "./dialogs";
import { GlyphCopy, GlyphLink, GlyphMoveTo, GlyphPencil, GlyphTrash } from "./glyphs";
import { PageIcon } from "./pickers";

/**
 * The page tree: favorites, then every page, nested. Rows drag onto each other
 * to reorder (the top or bottom edge of a row) or to nest (its middle). A
 * branch remembers whether it was open.
 */


type Zone = "before" | "inside" | "after";

/** The page being dragged. One pointer, one drag: module state is enough. */
let dragging: string | null = null;

type RowContext = {
  activeId: string | null;
  actions: NoteActions;
  touch: boolean;
  drop: { id: string; zone: Zone } | null;
  setDrop: (d: { id: string; zone: Zone } | null) => void;
  menu: string | null;
  setMenu: (id: string | null) => void;
  renaming: string | null;
  setRenaming: (id: string | null) => void;
  setMoving: (id: string | null) => void;
  onNavigate?: () => void;
};

const effectiveParent = (page: NoteMeta) => (page.parentId && notesStore.get(page.parentId) ? page.parentId : null);

export function PageTree({ activeId, onNavigate }: { activeId: string | null; onNavigate?: () => void }) {
  useTreeTick();
  useUiTick();
  const actions = useNoteActions();
  const touch = useCoarsePointer();
  const [drop, setDrop] = useState<{ id: string; zone: Zone } | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);

  const favorites = notesStore
    .all()
    .filter((p) => p.favorite)
    .sort((a, b) => titleOf(a).localeCompare(titleOf(b)));
  const roots = notesStore.children(null);
  const ctx: RowContext = { activeId, actions, touch, drop, setDrop, menu, setMenu, renaming, setRenaming, setMoving, onNavigate };

  return (
    <div className="space-y-4">
      {favorites.length > 0 && (
        <section aria-label="Favorites">
          <SectionLabel>Favorites</SectionLabel>
          <ul role="tree" aria-label="Favorite pages">
            {favorites.map((p) => (
              <FlatRow key={`fav-${p.id}`} page={p} ctx={ctx} />
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Pages">
        <div
          className="group flex items-center justify-between"
          onDragOver={(e) => {
            if (!dragging) return;
            e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            const id = dragging;
            dragging = null;
            setDrop(null);
            if (id) void actions.move(id, null, null);
          }}
        >
          <SectionLabel>Pages</SectionLabel>
          <button
            type="button"
            onClick={() => {
              void actions.create();
              onNavigate?.();
            }}
            aria-label="New page"
            className={`mr-1 grid size-6 place-items-center rounded-md text-ink-faint transition-opacity hover:bg-paper-deep hover:text-ink ${touch ? "" : "opacity-0 group-hover:opacity-100"}`}
          >
            <IconPlus size={13} />
          </button>
        </div>
        {roots.length === 0 ? (
          <button
            type="button"
            onClick={() => {
              void actions.create();
              onNavigate?.();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink-faint hover:bg-card/70 hover:text-ink-soft"
          >
            <IconPlus size={13} /> Add a page
          </button>
        ) : (
          <ul role="tree" aria-label="All pages">
            {roots.map((p) => (
              <Row key={p.id} page={p} depth={0} ctx={ctx} />
            ))}
          </ul>
        )}
      </section>

      {moving && <MoveDialog id={moving} onClose={() => setMoving(null)} />}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-faint">{children}</div>;
}

function Row({ page, depth, ctx }: { page: NoteMeta; depth: number; ctx: RowContext }) {
  const kids = notesStore.children(page.id);
  const open = notesUi.isOpen(page.id);
  const zone = ctx.drop?.id === page.id ? ctx.drop.zone : null;

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!dragging || dragging === page.id || notesStore.subtreeIds(dragging).has(page.id)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const r = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - r.top;
    const next: Zone = y < r.height * 0.28 ? "before" : y > r.height * 0.72 ? "after" : "inside";
    if (zone !== next) ctx.setDrop({ id: page.id, zone: next });
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const id = dragging;
    const where = zone;
    dragging = null;
    ctx.setDrop(null);
    if (!id || id === page.id || !where) return;
    const parent = effectiveParent(page);
    if (where === "inside") {
      void ctx.actions.move(id, page.id, null);
    } else if (where === "before") {
      void ctx.actions.move(id, parent, page.id);
    } else {
      const siblings = notesStore.children(parent).filter((s) => s.id !== id);
      const at = siblings.findIndex((s) => s.id === page.id);
      void ctx.actions.move(id, parent, siblings[at + 1]?.id ?? null);
    }
  };

  return (
    <li role="treeitem" aria-expanded={open} aria-selected={ctx.activeId === page.id} aria-label={titleOf(page)}>
      <RowBody page={page} depth={depth} ctx={ctx} hasKids={kids.length > 0} open={open} zone={zone} onDragOver={onDragOver} onDrop={onDrop} />
      {open &&
        (kids.length > 0 ? (
          <ul role="group">
            {kids.map((k) => (
              <Row key={k.id} page={k} depth={depth + 1} ctx={ctx} />
            ))}
          </ul>
        ) : (
          <div className="py-1 text-xs text-ink-faint" style={{ paddingLeft: 30 + (depth + 1) * 14 }}>
            No pages inside
          </div>
        ))}
    </li>
  );
}

/** A favorite: the same row, without its branch. */
function FlatRow({ page, ctx }: { page: NoteMeta; ctx: RowContext }) {
  return (
    <li role="treeitem" aria-selected={ctx.activeId === page.id} aria-label={titleOf(page)}>
      <RowBody page={page} depth={0} ctx={ctx} hasKids={false} open={false} zone={null} flat />
    </li>
  );
}

function RowBody({
  page,
  depth,
  ctx,
  hasKids,
  open,
  zone,
  onDragOver,
  onDrop,
  flat,
}: {
  page: NoteMeta;
  depth: number;
  ctx: RowContext;
  hasKids: boolean;
  open: boolean;
  zone: Zone | null;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
  flat?: boolean;
}) {
  const active = ctx.activeId === page.id;
  const title = titleOf(page);
  const menuOpen = ctx.menu === (flat ? `fav-${page.id}` : page.id);
  const renaming = !flat && ctx.renaming === page.id;
  const [draft, setDraft] = useState(page.title);
  const committed = useRef(false);

  const commit = () => {
    if (committed.current) return;
    committed.current = true;
    ctx.setRenaming(null);
    if (draft.trim() !== page.title) void ctx.actions.setMeta(page.id, { title: draft });
  };

  return (
    <div
      draggable={!renaming && !ctx.touch}
      onDragStart={(e) => {
        dragging = page.id;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", title);
      }}
      onDragEnd={() => {
        dragging = null;
        ctx.setDrop(null);
      }}
      onDragOver={onDragOver}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null) && zone) ctx.setDrop(null);
      }}
      onDrop={onDrop}
      className={`group relative flex h-8 items-center gap-0.5 rounded-lg pr-1 text-sm transition-colors ${
        active ? "bg-card font-medium text-ink shadow-sm" : "text-ink-soft hover:bg-card/70"
      } ${zone === "inside" ? "bg-sun-soft/60 ring-2 ring-sun/50" : ""}`}
      style={{ paddingLeft: 2 + depth * 14 }}
    >
      {zone === "before" && <span className="pointer-events-none absolute inset-x-2 -top-px h-0.5 rounded-full bg-sun" />}
      {zone === "after" && <span className="pointer-events-none absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-sun" />}

      {!flat && (
        <button
          type="button"
          onClick={() => notesUi.toggle(page.id)}
          aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
          className={`grid size-5 shrink-0 place-items-center rounded text-ink-faint transition-colors hover:bg-paper-deep hover:text-ink ${
            hasKids || open ? "" : "opacity-40"
          }`}
        >
          <svg width="8" height="8" viewBox="0 0 8 8" className={`transition-transform ${open ? "rotate-90" : ""}`} aria-hidden>
            <path d="M2.5 1l3 3-3 3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      <span className={`grid w-6 shrink-0 place-items-center ${flat ? "ml-1" : ""}`} aria-hidden>
        <PageIcon icon={page.icon} size={18} />
      </span>

      {renaming ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              committed.current = true;
              ctx.setRenaming(null);
            }
          }}
          maxLength={200}
          aria-label="Page title"
          className="h-6 min-w-0 flex-1 rounded-md border border-sun bg-paper px-1.5 text-sm outline-none"
        />
      ) : (
        <a
          href={`/notes/${page.id}`}
          onClick={(e) => {
            e.preventDefault();
            navigateApp(`/notes/${page.id}`);
            ctx.onNavigate?.();
          }}
          onDoubleClick={() => {
            if (flat) return;
            setDraft(page.title);
            committed.current = false;
            ctx.setRenaming(page.id);
          }}
          className={`min-w-0 flex-1 truncate py-1 pl-1 ${page.title ? "" : "text-ink-faint"}`}
        >
          {title}
        </a>
      )}

      {!renaming && (
        <span className={`flex shrink-0 items-center transition-opacity ${ctx.touch || menuOpen ? "" : "opacity-0 focus-within:opacity-100 group-hover:opacity-100"}`}>
          <button
            type="button"
            onClick={() => ctx.setMenu(menuOpen ? null : flat ? `fav-${page.id}` : page.id)}
            aria-label={`More actions for ${title}`}
            aria-expanded={menuOpen}
            className="grid size-6 place-items-center rounded-md text-ink-faint hover:bg-paper-deep hover:text-ink"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <circle cx="3" cy="8" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="13" cy="8" r="1.5" />
            </svg>
          </button>
          {!flat && (
            <button
              type="button"
              onClick={() => {
                void ctx.actions.create({ parentId: page.id });
                ctx.onNavigate?.();
              }}
              aria-label={`Add a page inside ${title}`}
              className="grid size-6 place-items-center rounded-md text-ink-faint hover:bg-paper-deep hover:text-ink"
            >
              <IconPlus size={12} />
            </button>
          )}
        </span>
      )}

      {menuOpen && (
        <RowMenu
          page={page}
          ctx={ctx}
          onRename={
            flat
              ? undefined
              : () => {
                  setDraft(page.title);
                  committed.current = false;
                  ctx.setRenaming(page.id);
                }
          }
        />
      )}
    </div>
  );
}

function RowMenu({ page, ctx, onRename }: { page: NoteMeta; ctx: RowContext; onRename?: () => void }) {
  const close = () => ctx.setMenu(null);
  const item = (label: string, icon: React.ReactNode, run: () => void, danger = false) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        close();
        run();
      }}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
        danger ? "text-clay hover:bg-clay-soft" : "text-ink-soft hover:bg-paper-deep hover:text-ink"
      }`}
    >
      <span className="grid w-4 place-items-center" aria-hidden>
        {icon}
      </span>
      {label}
    </button>
  );

  return (
    <>
      <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={close} />
      <div role="menu" className="anim-pop absolute right-0 top-8 z-50 w-52 rounded-xl border border-line bg-card p-1 shadow-2xl shadow-ink/10">
        {item(page.favorite ? "Remove from favorites" : "Add to favorites", <IconStar size={14} filled={page.favorite} />, () =>
          void ctx.actions.toggleFavorite(page.id)
        )}
        {onRename && item("Rename", <GlyphPencil size={14} />, onRename)}
        {item("Duplicate", <GlyphCopy size={14} />, () => void ctx.actions.duplicate(page.id))}
        {item("Move to…", <GlyphMoveTo size={14} />, () => ctx.setMoving(page.id))}
        {item("Copy link", <GlyphLink size={14} />, () => void ctx.actions.copyLink(page.id))}
        <div className="my-1 h-px bg-line" />
        {item("Move to trash", <GlyphTrash size={14} />, () => void ctx.actions.trash(page.id), true)}
      </div>
    </>
  );
}
