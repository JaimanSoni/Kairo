"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ARTICLES, CATEGORIES } from "@/lib/support/content";

const OPEN_EVENT = "kairo:support-search";

/** Any button anywhere can open the overlay by dispatching this event. */
export function openSupportSearch() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

type Hit = {
  slug: string;
  title: string;
  summary: string;
  category: string;
  /** Best matching section, when the match came from the body. */
  sectionHeading?: string;
  sectionId?: string;
  score: number;
};

/** Flattened, lowercased index built once per session. */
const INDEX = ARTICLES.map((a) => ({
  slug: a.slug,
  title: a.title,
  summary: a.summary,
  category: CATEGORIES.find((c) => c.id === a.categoryId)?.name ?? "",
  lcTitle: a.title.toLowerCase(),
  lcSummary: a.summary.toLowerCase(),
  keywords: a.keywords.map((k) => k.toLowerCase()),
  sections: a.sections.map((s) => ({
    id: s.id,
    heading: s.heading,
    lcHeading: s.heading.toLowerCase(),
    lcBody: s.blocks
      .map((b) => {
        switch (b.t) {
          case "p":
          case "note":
          case "tip":
          case "warn":
            return b.text;
          case "ul":
          case "ol":
            return b.items.join(" ");
          case "keys":
            return b.rows.map((r) => `${r.k} ${r.d}`).join(" ");
          case "table":
            return [...b.head, ...b.rows.flat()].join(" ");
        }
      })
      .join(" ")
      .toLowerCase(),
  })),
}));

function search(query: string): Hit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);

  const hits: Hit[] = [];
  for (const doc of INDEX) {
    let score = 0;
    let sectionHeading: string | undefined;
    let sectionId: string | undefined;

    for (const term of terms) {
      let termScore = 0;
      if (doc.lcTitle.startsWith(term)) termScore += 12;
      else if (doc.lcTitle.includes(term)) termScore += 8;
      if (doc.keywords.some((k) => k.includes(term))) termScore += 6;
      if (doc.lcSummary.includes(term)) termScore += 3;

      for (const s of doc.sections) {
        if (s.lcHeading.includes(term)) {
          termScore += 4;
          if (!sectionHeading) {
            sectionHeading = s.heading;
            sectionId = s.id;
          }
        } else if (s.lcBody.includes(term)) {
          termScore += 1;
          if (!sectionHeading) {
            sectionHeading = s.heading;
            sectionId = s.id;
          }
        }
      }
      // every term must land somewhere — keeps multi-word queries precise
      if (termScore === 0) {
        score = 0;
        break;
      }
      score += termScore;
    }

    if (score > 0) {
      hits.push({
        slug: doc.slug,
        title: doc.title,
        summary: doc.summary,
        category: doc.category,
        sectionHeading,
        sectionId,
        score,
      });
    }
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, 8);
}

export function SupportSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const hits = useMemo(() => search(q), [q]);
  const popular = useMemo(
    () => ARTICLES.filter((a) => POPULAR.includes(a.slug)).slice(0, 5),
    []
  );

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setSel(0);
  }, []);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "/" && !typing) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  if (!open) return null;

  const rows = q.trim()
    ? hits.map((h) => ({
        href: h.sectionId ? `/support/${h.slug}#${h.sectionId}` : `/support/${h.slug}`,
        title: h.title,
        sub: h.sectionHeading ?? h.summary,
        meta: h.category,
      }))
    : popular.map((a) => ({
        href: `/support/${a.slug}`,
        title: a.title,
        sub: a.summary,
        meta: CATEGORIES.find((c) => c.id === a.categoryId)?.name ?? "",
      }));

  const go = (href: string) => {
    close();
    router.push(href);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-center bg-ink/25 backdrop-blur-sm sm:items-start sm:p-4 sm:pt-[10vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {/* full-screen sheet on phones, floating panel from sm up */}
      <div className="anim-pop flex h-dvh w-full flex-col overflow-hidden border-line bg-card sm:h-auto sm:max-w-xl sm:rounded-2xl sm:border sm:shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3.5 pt-[max(0.875rem,env(safe-area-inset-top))] sm:pt-3.5">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-ink-faint">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(rows.length - 1, s + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(0, s - 1));
              } else if (e.key === "Enter" && rows[sel]) {
                go(rows[sel].href);
              }
            }}
            placeholder="Search help…"
            className="w-full bg-transparent text-base outline-none placeholder:text-ink-faint"
            autoFocus
          />
          <kbd className="hidden rounded border border-line bg-paper-deep px-1.5 py-0.5 font-mono text-[10px] text-ink-faint sm:block">
            esc
          </kbd>
          <button
            onClick={close}
            aria-label="Close search"
            className="shrink-0 rounded-lg p-1 text-ink-faint hover:bg-paper-deep sm:hidden"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div
          ref={listRef}
          className="flex-1 overflow-y-auto overscroll-contain p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:max-h-[55vh] sm:flex-none sm:pb-2"
        >
          {!q.trim() && (
            <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
              Popular
            </div>
          )}
          {rows.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-ink-faint">
              Nothing matches “{q}”. Try a simpler word, or{" "}
              <button onClick={() => go("/support/contact")} className="underline">
                get in touch
              </button>
              .
            </p>
          )}
          {rows.map((row, i) => (
            <button
              key={row.href}
              data-i={i}
              onClick={() => go(row.href)}
              onMouseEnter={() => setSel(i)}
              className={`block w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
                sel === i ? "bg-sun-soft" : ""
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm font-medium text-ink">{row.title}</span>
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-ink-faint">
                  {row.meta}
                </span>
              </div>
              <div className="truncate text-xs text-ink-soft">{row.sub}</div>
            </button>
          ))}
        </div>

        <div className="hidden items-center gap-3 border-t border-line px-4 py-2.5 text-[11px] text-ink-faint sm:flex">
          <span>
            <Kbd>↑↓</Kbd> navigate
          </span>
          <span>
            <Kbd>enter</Kbd> open
          </span>
          <span>
            <Kbd>/</Kbd> search anywhere
          </span>
        </div>
      </div>
    </div>
  );
}

const POPULAR = [
  "capture",
  "notifications",
  "sharing-lists",
  "locks",
  "focus-timer",
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-paper-deep px-1 py-0.5 font-mono text-[10px]">
      {children}
    </kbd>
  );
}

/** Search trigger. `full` is the big hero input; otherwise a header control
 *  that collapses to an icon-only button on small screens. */
export function SearchTrigger({ full }: { full?: boolean }) {
  if (full) {
    return (
      <button
        onClick={() => openSupportSearch()}
        className="flex w-full items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3.5 text-left text-ink-faint shadow-sm transition-colors hover:border-ink-faint/60"
      >
        <SearchGlyph size={18} />
        <span className="flex-1 text-[15px]">Search help</span>
        <kbd className="rounded border border-line bg-paper-deep px-1.5 py-0.5 font-mono text-[10px]">
          /
        </kbd>
      </button>
    );
  }

  return (
    <button
      onClick={() => openSupportSearch()}
      aria-label="Search help"
      className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-card p-2 text-xs text-ink-faint transition-colors hover:border-ink-faint/60 sm:px-3 sm:py-1.5"
    >
      <SearchGlyph size={14} />
      <span className="hidden sm:inline">Search help</span>
      <kbd className="hidden rounded border border-line bg-paper-deep px-1.5 py-0.5 font-mono text-[10px] sm:block">
        /
      </kbd>
    </button>
  );
}

function SearchGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className="shrink-0">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
