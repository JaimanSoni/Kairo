"use client";

import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { SlashItem, SlashStore } from "./slash";

/** The floating "insert a block" list, drawn by React from the slash store. */
export function SlashMenu({ store, label = "Insert a block" }: { store: SlashStore; label?: string }) {
  const s = useSyncExternalStore(store.subscribe, store.get, store.get);
  const ref = useRef<HTMLDivElement>(null);

  // Placed by writing to the node, not by state: the position is a fact about
  // the DOM, and routing it through a render would draw the menu once in the
  // wrong place before correcting itself.
  useLayoutEffect(() => {
    const el = ref.current;
    const rect = s.rect?.();
    if (!el || !rect) return;
    const vv = window.visualViewport;
    const bottom = vv ? vv.height + vv.offsetTop : window.innerHeight;
    const h = el.offsetHeight;
    const w = el.offsetWidth;
    let top = rect.bottom + 8;
    if (top + h > bottom - 8) top = Math.max(8, rect.top - h - 8);
    const left = Math.max(8, Math.min(rect.left - 12, window.innerWidth - w - 8));
    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
    el.style.visibility = "visible";
    el.querySelector<HTMLElement>(`[data-index="${s.index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [s]);

  if (!s.open || s.hidden) return null;

  // groups in the order their first item appears, so each editor decides the order
  const groups: { g: string; items: SlashItem[] }[] = [];
  for (const item of s.items) {
    const found = groups.find((x) => x.g === item.group);
    if (found) found.items.push(item);
    else groups.push({ g: item.group, items: [item] });
  }
  let n = -1;

  return createPortal(
    <div
      ref={ref}
      role="listbox"
      aria-label={label}
      style={{ position: "fixed", top: 0, left: 0, visibility: "hidden" }}
      className="nt-float anim-pop no-scrollbar z-[80] max-h-[min(22rem,60vh)] w-72 overflow-y-auto rounded-2xl border border-line bg-card/95 p-1.5 shadow-2xl shadow-ink/10 backdrop-blur"
      onMouseDown={(e) => e.preventDefault() /* keep the caret in the page */}
    >
      {s.items.length === 0 ? (
        <p className="px-3 py-3 text-sm text-ink-faint">No blocks match &ldquo;{s.query}&rdquo;</p>
      ) : (
        groups.map(({ g, items }) => (
          <div key={g} className="mb-1 last:mb-0">
            <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-faint">{g}</div>
            {items.map((item) => {
              n++;
              const i = n;
              const active = i === s.index;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  data-index={i}
                  onMouseEnter={() => store.set({ index: i })}
                  onClick={() => s.pick?.(item)}
                  className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${
                    active ? "bg-sun-soft" : "hover:bg-paper-deep"
                  }`}
                >
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-lg border text-sm font-semibold ${
                      active ? "border-sun/40 bg-card text-sun-deep" : "border-line bg-paper text-ink-soft"
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{item.title}</span>
                    <span className="block truncate text-xs text-ink-faint">{item.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ))
      )}
    </div>,
    document.body
  );
}
