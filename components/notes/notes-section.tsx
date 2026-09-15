"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { notesStore } from "@/lib/notes-client";
import { useApp } from "../store";
import { EmptyState } from "../ui";
import { GoogleBadge } from "../guest-mode";
import { navigateApp } from "../app-views";
import { useNoteActions } from "./actions";
import { QuickFind, TrashDialog } from "./dialogs";
import { NotesHome } from "./home";
import { NotePageView } from "./note-page";
import { PageTree } from "./tree";
import { notesUi, useTreeTick, useUiTick } from "./ui-state";
import { GlyphPanel, GlyphPencil, GlyphSearch, GlyphTrash } from "./glyphs";
import { IconPlus } from "../ui";

/**
 * /notes is the home; /notes/<id> is a page. On a wide screen the page tree
 * sits beside both, the way a notebook's contents sit beside its pages.
 *
 * The page view is keyed by id, so moving to another page unmounts this one —
 * which is what flushes its last save — before the next begins loading.
 */
/** Whether the side panel has room. On a phone it isn't mounted at all, not merely hidden. */
function useWide(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(min-width: 768px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 768px)").matches,
    () => false
  );
}

export default function NotesSection() {
  const pathname = usePathname();
  const { state } = useApp();
  useUiTick();
  const wide = useWide();
  const [finding, setFinding] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);

  const match = /^\/notes\/([a-f0-9]{24})\/?$/.exec(pathname);
  const id = match ? match[1] : null;
  const stray = !id && pathname !== "/notes" && pathname !== "/notes/";
  const guest = Boolean(state.user.guest);

  useEffect(() => {
    if (stray) window.history.replaceState(null, "", "/notes");
  }, [stray]);

  useEffect(() => {
    if (guest) return;
    notesUi.init(state.user.id);
    void notesStore.ensureLoaded();
  }, [guest, state.user.id]);

  // Ctrl/⌘+P finds a page, Ctrl/⌘+\ hides or shows the page panel
  useEffect(() => {
    if (guest) return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.altKey) return;
      if (e.key.toLowerCase() === "p" && !e.shiftKey) {
        e.preventDefault();
        setFinding(true);
      } else if (e.key === "\\") {
        e.preventDefault();
        notesUi.setPanel(!notesUi.panelOpen());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [guest]);

  if (guest) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pb-32 pt-8 sm:px-6">
        <header className="anim-rise mb-6">
          <h1 className="font-display text-4xl">Notes</h1>
          <p className="mt-1 text-sm text-ink-soft">Pages inside pages, written your way.</p>
        </header>
        <EmptyState
          icon="feather"
          title="Keep notes that grow with you"
          body="Plans, lists, meeting notes, a page for every project — with toggles, tables, links between pages and Kairo tasks right inside them. Notes live in your account, not in this browser, so they start when you sign in."
        >
          <a
            href="/api/auth/google"
            data-track="guest-signin"
            className="mt-3 flex items-center gap-2 rounded-full bg-ink py-1.5 pl-1.5 pr-4 text-sm font-semibold text-paper transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <GoogleBadge size={24} /> Sign in to start writing
          </a>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh">
      {wide && notesUi.panelOpen() && <NotesPanel activeId={id} onFind={() => setFinding(true)} onTrash={() => setTrashOpen(true)} />}
      <div className="min-w-0 flex-1">
        {id ? (
          <NotePageView key={id} id={id} onFind={() => setFinding(true)} />
        ) : (
          <NotesHome onFind={() => setFinding(true)} onTrash={() => setTrashOpen(true)} />
        )}
      </div>
      {finding && <QuickFind onClose={() => setFinding(false)} />}
      {trashOpen && <TrashDialog onClose={() => setTrashOpen(false)} />}
    </div>
  );
}

function NotesPanel({ activeId, onFind, onTrash }: { activeId: string | null; onFind: () => void; onTrash: () => void }) {
  useTreeTick();
  const actions = useNoteActions();
  const status = notesStore.status();

  const iconButton = "grid size-7 place-items-center rounded-md text-ink-faint transition-colors hover:bg-card hover:text-ink";

  return (
    <aside aria-label="Pages" className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-paper-deep/25 md:flex">
      <div className="flex items-center gap-0.5 px-3 pb-1 pt-4">
        <button
          type="button"
          onClick={() => navigateApp("/notes")}
          className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1 text-left text-sm font-bold ${activeId ? "text-ink-soft hover:bg-card" : "text-ink"}`}
        >
          Notes
        </button>
        <button type="button" onClick={onFind} aria-label="Search notes" title="Search (Ctrl+P)" className={iconButton}>
          <GlyphSearch size={14} />
        </button>
        <button type="button" onClick={() => void actions.create()} aria-label="New page" title="New page" className={iconButton}>
          <GlyphPencil size={14} />
        </button>
        <button type="button" onClick={() => notesUi.setPanel(false)} aria-label="Hide the page panel" title="Hide (Ctrl+\)" className={iconButton}>
          <GlyphPanel size={14} />
        </button>
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-4 pt-2">
        {status === "ready" ? (
          <PageTree activeId={activeId} />
        ) : status === "error" ? (
          <div className="px-2 py-4 text-sm text-ink-faint">
            Couldn&apos;t load your pages.
            <button type="button" onClick={() => void notesStore.reload()} className="ml-1 font-semibold text-sun-deep underline underline-offset-2">
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-2 px-2 pt-2">
            {[70, 55, 80, 45].map((w) => (
              <div key={w} className="h-5 animate-pulse rounded-md bg-paper-deep" style={{ width: `${w}%` }} />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-0.5 border-t border-line p-2">
        <button
          type="button"
          onClick={() => void actions.create()}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-ink-soft transition-colors hover:bg-card hover:text-ink"
        >
          <span className="grid w-5 place-items-center" aria-hidden>
            <IconPlus size={13} />
          </span>
          New page
        </button>
        <button
          type="button"
          onClick={onTrash}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-ink-soft transition-colors hover:bg-card hover:text-ink"
        >
          <span className="grid w-5 place-items-center" aria-hidden>
            <GlyphTrash size={14} />
          </span>
          Trash
        </button>
      </div>
    </aside>
  );
}
