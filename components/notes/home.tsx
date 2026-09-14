"use client";

import { notesStore } from "@/lib/notes-client";
import { coverCss } from "@/lib/notes-shared";
import { navigateApp } from "../app-views";
import { IconPlus } from "../ui";
import { titleOf, useNoteActions } from "./actions";
import { ago, pathOf } from "./format";
import { TEMPLATES } from "./templates";
import { PageTree } from "./tree";
import { useTreeTick } from "./ui-state";

/**
 * The notes home: what you were last working on, what you starred, and a way
 * in for a blank page. On a phone — where there's no side panel — it is also
 * the whole tree.
 */
export function NotesHome({ onFind, onTrash }: { onFind: () => void; onTrash: () => void }) {
  useTreeTick();
  const actions = useNoteActions();
  const status = notesStore.status();
  const pages = notesStore.all();
  const recent = [...pages].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);
  const favorites = pages.filter((p) => p.favorite).sort((a, b) => titleOf(a).localeCompare(titleOf(b)));

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-40 pt-8 sm:px-8">
      <header className="anim-rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">Notes</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {status === "ready" && pages.length > 0
              ? `${pages.length} ${pages.length === 1 ? "page" : "pages"} · pages inside pages, written your way`
              : "Pages inside pages, written your way."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onFind}
            className="flex items-center gap-2 rounded-full border border-line bg-card px-3.5 py-2 text-sm text-ink-soft transition-colors hover:border-ink-faint"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Search
          </button>
          <button
            type="button"
            onClick={() => void actions.create()}
            className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper transition-transform hover:-translate-y-0.5"
          >
            <IconPlus size={14} /> New page
          </button>
        </div>
      </header>

      {status === "loading" || status === "idle" ? (
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-paper-deep" />
          ))}
        </div>
      ) : status === "error" ? (
        <div className="mt-10 text-center">
          <p className="text-sm text-ink-soft">Couldn&apos;t load your pages. Check your connection.</p>
          <button type="button" onClick={() => void notesStore.reload()} className="mt-3 rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-paper">
            Try again
          </button>
        </div>
      ) : pages.length === 0 ? (
        <section className="anim-rise mt-10 overflow-hidden rounded-3xl border border-line bg-card">
          <div className="h-24" style={{ background: coverCss("aurora") ?? undefined }} />
          <div className="px-6 pb-6">
            <div className="-mt-8 text-6xl" aria-hidden>
              🗒️
            </div>
            <h2 className="font-display mt-3 text-2xl">Your first page</h2>
            <p className="mt-1 max-w-lg text-sm text-ink-soft">
              A page can be anything — a plan, a list, a recipe, a place for everything about one project. Pages go inside pages, so your notes grow into a shape that fits you.
            </p>
            <button
              type="button"
              onClick={() => void actions.create()}
              className="mt-4 flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper"
            >
              <IconPlus size={14} /> Start with a blank page
            </button>
            <Templates onPick={(t) => void actions.create({ title: t.title, icon: t.icon, doc: t.doc })} />
          </div>
        </section>
      ) : (
        <>
          <section className="mt-8">
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">Recently edited</h2>
            <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
              {recent.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => navigateApp(`/notes/${p.id}`)}
                  className="group flex h-36 w-44 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-line bg-card text-left transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-ink/5 sm:w-auto"
                >
                  <div className="h-12 w-full shrink-0" style={{ background: coverCss(p.cover) ?? "var(--color-paper-deep)" }} />
                  <div className="-mt-5 px-3.5 text-[1.9rem] leading-none" aria-hidden>
                    {p.icon ?? "📄"}
                  </div>
                  <div className="mt-2 truncate px-3.5 text-sm font-semibold">{titleOf(p)}</div>
                  <div className="mt-auto truncate px-3.5 pb-3 text-xs text-ink-faint">{[pathOf(p.id), ago(p.updatedAt)].filter(Boolean).join(" · ")}</div>
                </button>
              ))}
            </div>
          </section>

          {favorites.length > 0 && (
            <section className="mt-8 hidden md:block">
              <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">Favorites</h2>
              <div className="flex flex-wrap gap-2">
                {favorites.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => navigateApp(`/notes/${p.id}`)}
                    className="flex items-center gap-2 rounded-full border border-line bg-card px-3.5 py-1.5 text-sm text-ink-soft transition-colors hover:border-sun hover:text-sun-deep"
                  >
                    <span aria-hidden>{p.icon ?? "📄"}</span>
                    {titleOf(p)}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* a phone has no side panel, so the tree lives here */}
          <section className="mt-8 rounded-2xl border border-line bg-card/60 p-2 md:hidden">
            <PageTree activeId={null} />
            <button
              type="button"
              onClick={onTrash}
              className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-ink-faint hover:bg-card hover:text-ink-soft"
            >
              🗑 Trash
            </button>
          </section>

          <section className="mt-8">
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">Start from a template</h2>
            <Templates onPick={(t) => void actions.create({ title: t.title, icon: t.icon, doc: t.doc })} />
          </section>
        </>
      )}
    </div>
  );
}

function Templates({ onPick }: { onPick: (t: (typeof TEMPLATES)[number]) => void }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {TEMPLATES.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onPick(t)}
          className="flex items-start gap-2.5 rounded-2xl border border-line bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:border-sun/50"
        >
          <span className="text-xl leading-none" aria-hidden>
            {t.icon}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{t.name}</span>
            <span className="mt-0.5 block text-xs leading-snug text-ink-faint">{t.hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
