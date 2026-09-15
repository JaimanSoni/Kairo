"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { List } from "@/lib/types";
import { byOrder, hiddenListIds, useApp } from "./store";
import { TaskItem } from "./task-item";
import { AddRow } from "./today-view";
import { PinModal, type PinMode } from "./pin-modal";
import { ShareListModal } from "./share-modal";
import { Icon3d, ListMark, LIST_ICONS } from "./img3d";
import { EmptyState, IconDots, IconPlus, IconTrash, IconX } from "./ui";

export function ListsView() {
  const {
    state,
    createList,
    renameList,
    reorderLists,
    deleteList,
    setListUnlocked,
    showToast,
  } = useApp();
  const all = useMemo(() => Object.values(state.tasks), [state.tasks]);
  const hidden = useMemo(() => hiddenListIds(state), [state]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("list-folder");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [pinTarget, setPinTarget] = useState<{
    list: List;
    mode: PinMode;
  } | null>(null);
  const [shareTarget, setShareTarget] = useState<List | null>(null);
  const [reordering, setReordering] = useState(false);
  const [collapsed, setCollapsed] = useState<string[]>([]);

  /* which sections are folded away — remembered per account, on this device */
  const collapsedKey = `kairo-collapsed:${state.user.id}`;
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(collapsedKey);
        if (raw) {
          const ids = (JSON.parse(raw) as unknown[]).filter(
            (x): x is string => typeof x === "string"
          );
          if (ids.length) setCollapsed(ids);
        }
      } catch {}
    });
  }, [collapsedKey]);

  /*
   * Opening one list from elsewhere (search): "#list-<id>" when the page
   * loads, or an event when it's already open. The list unfolds, scrolls
   * into view and glows for a moment so the eye lands on it.
   */
  useEffect(() => {
    const show = (id: string) => {
      queueMicrotask(() => {
        setCollapsed((c) => (c.includes(id) ? c.filter((x) => x !== id) : c));
        requestAnimationFrame(() => {
          const el = document.getElementById(`list-${id}`);
          if (!el) return;
          el.scrollIntoView({ block: "start", behavior: "smooth" });
          el.animate(
            [{ boxShadow: "0 0 0 3px color-mix(in srgb, var(--color-sun) 45%, transparent)" }, { boxShadow: "0 0 0 3px transparent" }],
            { duration: 1800, easing: "ease-out" }
          );
        });
      });
    };
    const fromHash = /^#list-(.+)$/.exec(window.location.hash);
    if (fromHash) show(decodeURIComponent(fromHash[1]));
    const onShow = (e: Event) => show(String((e as CustomEvent<string>).detail));
    window.addEventListener("kairo:show-list", onShow);
    return () => window.removeEventListener("kairo:show-list", onShow);
  }, []);

  const setFolded = (ids: string[]) => {
    setCollapsed(ids);
    try {
      localStorage.setItem(collapsedKey, JSON.stringify(ids));
    } catch {}
  };

  const toggleFold = (id: string) =>
    setFolded(collapsed.includes(id) ? collapsed.filter((x) => x !== id) : [...collapsed, id]);

  const allSectionIds = ["inbox", ...state.lists.map((l) => l.id), "someday"];
  const allFolded = allSectionIds.every((id) => collapsed.includes(id));

  const move = (index: number, delta: number) => {
    const ids = state.lists.map((l) => l.id);
    const to = index + delta;
    if (to < 0 || to >= ids.length) return;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    try {
      navigator.vibrate?.(6);
    } catch {}
    reorderLists(ids);
  };

  /* ---- drag to reorder: pointer events, so it works on touch as well ---- */

  const rowsRef = useRef<HTMLUListElement>(null);
  const dragRef = useRef<{ from: number; to: number; startY: number } | null>(null);
  const stepRef = useRef(64); // row height + gap, measured on grab
  const [drag, setDrag] = useState<{ from: number; to: number; dy: number; step: number } | null>(
    null
  );

  /**
   * While reordering on touch: stop the page from scrolling or pull-to-
   * refreshing under the drag. `touch-action` alone isn't enough on Android —
   * a non-passive touchmove listener is what actually holds the gesture.
   */
  useEffect(() => {
    if (!reordering) return;
    const body = document.body;
    const prevOverscroll = body.style.overscrollBehaviorY;
    body.style.overscrollBehaviorY = "contain";

    const onTouchMove = (e: TouchEvent) => {
      if (dragRef.current && e.cancelable) e.preventDefault();
    };
    document.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      body.style.overscrollBehaviorY = prevOverscroll;
      document.removeEventListener("touchmove", onTouchMove);
    };
  }, [reordering]);

  const startDrag = (e: React.PointerEvent<HTMLButtonElement>, i: number) => {
    const rows = rowsRef.current;
    if (rows && rows.children.length > 1) {
      const a = rows.children[0].getBoundingClientRect();
      const b = rows.children[1].getBoundingClientRect();
      stepRef.current = b.top - a.top;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { from: i, to: i, startY: e.clientY };
    setDrag({ from: i, to: i, dy: 0, step: stepRef.current || 64 });
    try {
      navigator.vibrate?.(8);
    } catch {}
  };

  const moveDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d) return;
    e.preventDefault();
    const dy = e.clientY - d.startY;
    const to = Math.max(
      0,
      Math.min(state.lists.length - 1, d.from + Math.round(dy / (stepRef.current || 64)))
    );
    if (to !== d.to) {
      d.to = to;
      try {
        navigator.vibrate?.(4);
      } catch {}
    }
    setDrag((prev) => ({ from: d.from, to, dy, step: prev?.step ?? 64 }));
  };

  const endDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (d.to === d.from) return;
    const ids = state.lists.map((l) => l.id);
    const [moved] = ids.splice(d.from, 1);
    ids.splice(d.to, 0, moved);
    try {
      navigator.vibrate?.(6);
    } catch {}
    reorderLists(ids);
  };

  /** How far a row slides while another one is being dragged over it. */
  const shiftFor = (i: number) => {
    if (!drag) return 0;
    const step = drag.step;
    if (i === drag.from) return drag.dy;
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return -step;
    if (drag.from > drag.to && i < drag.from && i >= drag.to) return step;
    return 0;
  };

  const inbox = all
    .filter((t) => t.status === "inbox" && !(t.listId && hidden.has(t.listId)))
    .sort(byOrder);
  const someday = all
    .filter(
      (t) => t.status === "someday" && !(t.listId && hidden.has(t.listId)),
    )
    .sort(byOrder);

  const submitCreate = () => {
    if (!newName.trim()) return;
    // no await: the store puts the list on screen immediately and swaps in
    // the server's id when it arrives — waiting here just froze this form
    void createList(newName.trim(), newEmoji);
    setNewName("");
    setNewEmoji("list-folder");
    setCreating(false);
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-32 pt-8 sm:px-6">
      <header className="anim-rise mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-4xl">Lists</h1>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {!reordering && allSectionIds.length > 1 && (
            <button
              onClick={() => setFolded(allFolded ? [] : allSectionIds)}
              data-tip={allFolded ? "Expand every section" : "Collapse every section"}
              className="flex h-9 items-center gap-1.5 rounded-full border border-line bg-card px-3.5 text-xs font-medium text-ink-soft hover:border-ink-faint hover:text-ink"
            >
              <Chevron open={!allFolded} />
              {allFolded ? "Expand all" : "Collapse all"}
            </button>
          )}
          {state.lists.length > 1 && (
            <button
              onClick={() => setReordering((v) => !v)}
              aria-pressed={reordering}
              className={`flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-colors ${
                reordering
                  ? "border-sun bg-sun-soft text-sun-deep"
                  : "border-line bg-card text-ink-soft hover:border-ink-faint hover:text-ink"
              }`}
            >
              <ReorderGlyph />
              {reordering ? "Done" : "Reorder"}
            </button>
          )}
          {!reordering && (
            <button
              onClick={() => setCreating(true)}
              className="flex h-9 items-center gap-1.5 rounded-full border border-line bg-card px-3.5 text-xs font-semibold hover:border-sun hover:text-sun-deep"
            >
              <IconPlus size={14} /> New list
            </button>
          )}
        </div>
      </header>

      {creating && (
        <div className="anim-pop mb-6 rounded-2xl border border-line bg-card p-4">
          <div className="flex flex-wrap gap-1.5">
            {LIST_ICONS.map((key) => (
              <button
                key={key}
                onClick={() => setNewEmoji(key)}
                aria-label={key.replace("list-", "")}
                className={`rounded-xl p-1.5 transition-all ${
                  newEmoji === key
                    ? "bg-sun-soft ring-2 ring-sun"
                    : "hover:bg-paper-deep"
                }`}
              >
                <Icon3d name={key} size={30} />
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitCreate()}
              placeholder="List name, Work, Home, Errands…"
              className="flex-1 rounded-xl border border-line bg-paper px-3 py-2 text-base outline-none focus:border-sun sm:text-sm"
              autoFocus
            />
            <button
              onClick={submitCreate}
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper"
            >
              Create
            </button>
            <button
              onClick={() => setCreating(false)}
              className="p-2 text-ink-faint"
              aria-label="Cancel"
            >
              <IconX />
            </button>
          </div>
        </div>
      )}

      {/* reorder mode — drag by the grip (pointer events, so touch works too),
          or use the arrows for keyboard and precision */}
      {reordering && (
        <div className="anim-rise">
          <p className="mb-3 text-xs text-ink-soft">
            Drag by the <span className="font-medium text-ink">grip on the left</span>, or use the
            arrows. Inbox and Someday stay put.
          </p>
          <ul ref={rowsRef} className="space-y-2">
            {state.lists.map((list, i) => {
              const dragging = drag?.from === i;
              return (
                <li
                  key={list.id}
                  style={{ transform: `translate3d(0, ${shiftFor(i)}px, 0)` }}
                  className={`flex h-14 select-none items-center gap-2.5 overflow-hidden rounded-xl border bg-card pr-2.5 ${
                    dragging
                      ? "z-10 border-sun shadow-lg shadow-sun/15"
                      : "border-line transition-transform duration-150"
                  }`}
                >
                  {/* full-height rail: a big, obvious target for a thumb */}
                  <button
                    onPointerDown={(e) => startDrag(e, i)}
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onContextMenu={(e) => e.preventDefault()}
                    aria-label={`Drag ${list.name} to reorder`}
                    className={`flex h-full w-11 shrink-0 cursor-grab touch-none items-center justify-center border-r transition-colors active:cursor-grabbing ${
                      dragging
                        ? "border-sun/40 bg-sun-soft text-sun-deep"
                        : "border-line bg-paper-deep/50 text-ink-faint hover:text-ink"
                    }`}
                  >
                    <GripGlyph />
                  </button>
                  <ListMark value={list.emoji} size={22} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{list.name}</span>
                  <span className="flex shrink-0 gap-1">
                    <button
                      onClick={() => move(i, -1)}
                      disabled={i === 0 || drag !== null}
                      aria-label={`Move ${list.name} up`}
                      className="grid size-8 place-items-center rounded-lg border border-line text-ink-soft transition-colors hover:border-sun hover:text-sun-deep disabled:opacity-30 disabled:hover:border-line disabled:hover:text-ink-soft"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      disabled={i === state.lists.length - 1 || drag !== null}
                      aria-label={`Move ${list.name} down`}
                      className="grid size-8 place-items-center rounded-lg border border-line text-ink-soft transition-colors hover:border-sun hover:text-sun-deep disabled:opacity-30 disabled:hover:border-line disabled:hover:text-ink-soft"
                    >
                      ↓
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
          <button
            onClick={() => setReordering(false)}
            className="mt-4 w-full rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-paper"
          >
            Done reordering
          </button>
        </div>
      )}

      {/* Inbox */}
      {!reordering && (
      <Section
        mark={<Icon3d name="inbox" size={24} />}
        name="Inbox"
        count={inbox.length}
        hint="Freshly captured, undecided. Triage when you plan, not when you capture."
        folded={collapsed.includes("inbox")}
        onToggleFold={() => toggleFold("inbox")}
      >
        {inbox.map((t) => (
          <TaskItem key={t.clientId ?? t.id} task={t} context="backlog" />
        ))}
        <AddRow placeholder="Capture something…" plannedFor={null} />
      </Section>
      )}

      {/* user lists */}
      {!reordering && state.lists.map((list) => {
        const isHidden = hidden.has(list.id);
        // a pending list is real on screen but its id is not: management and
        // adding wait the moment it takes the server to answer
        const isOwner = list.role === "owner" && !list.pending;
        const tasks = isHidden
          ? []
          : all
              .filter((t) => t.listId === list.id && t.status !== "done")
              .sort(byOrder);
        return (
          <Section
            key={list.id}
            anchor={`list-${list.id}`}
            mark={<ListMark value={list.emoji} size={24} />}
            name={list.name}
            count={isHidden ? null : tasks.length}
            locked={list.locked}
            lockedHidden={isHidden}
            canManage={isOwner}
            peopleCount={list.memberCount > 0 || !isOwner ? list.memberCount + 1 : 0}
            onShare={isHidden ? undefined : () => setShareTarget(list)}
            onRename={
              isHidden || !isOwner
                ? undefined
                : (name) => renameList(list.id, name, list.emoji)
            }
            onDelete={isHidden || !isOwner ? undefined : () => setConfirmDelete(list.id)}
            onLockAction={list.pending ? undefined : (mode) => setPinTarget({ list, mode })}
            folded={collapsed.includes(list.id)}
            onToggleFold={() => toggleFold(list.id)}
            onRelock={
              list.locked && !isHidden
                ? () => {
                    setListUnlocked(list.id, false);
                    showToast({ message: `🔒 ${list.name} locked again` });
                  }
                : undefined
            }
          >
            {isHidden ? (
              <button
                onClick={() => setPinTarget({ list, mode: "unlock" })}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-paper-deep/40 px-4 py-6 text-sm text-ink-soft transition-colors hover:border-sun hover:text-sun-deep"
              >
                <Icon3d name="lock" size={22} /> Locked. Tap to unlock
              </button>
            ) : (
              <>
                {tasks.map((t) => (
                  <TaskItem key={t.clientId ?? t.id} task={t} context="backlog" />
                ))}
                {list.pending ? (
                  <div className="mt-2 rounded-xl border border-dashed border-line/80 px-3.5 py-2.5 text-xs text-ink-faint">
                    Setting up…
                  </div>
                ) : (
                  <AddRow
                    placeholder={`Add to ${list.name}…`}
                    plannedFor={null}
                    listId={list.id}
                  />
                )}
                {confirmDelete === list.id && (
                  <div className="anim-pop mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-clay/50 bg-clay-soft px-4 py-3 text-sm">
                    <span className="min-w-0 break-words">
                      Delete “{list.name}”? Its tasks move to the inbox.
                    </span>
                    <span className="flex gap-2">
                      <button
                        onClick={() => {
                          deleteList(list.id);
                          setConfirmDelete(null);
                        }}
                        className="flex items-center gap-1 rounded-full bg-clay px-3 py-1 text-xs font-semibold text-on-accent"
                      >
                        <IconTrash size={12} /> Delete
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="rounded-full border border-line bg-card px-3 py-1 text-xs"
                      >
                        Keep
                      </button>
                    </span>
                  </div>
                )}
              </>
            )}
          </Section>
        );
      })}

      {/* Someday */}
      {!reordering && (
      <Section
        mark={<Icon3d name="moon" size={24} />}
        name="Someday"
        count={someday.length}
        hint="Parked without guilt. Visit when you're curious, not because you must."
        folded={collapsed.includes("someday")}
        onToggleFold={() => toggleFold("someday")}
      >
        {someday.length > 0 ? (
          someday.map((t) => <TaskItem key={t.clientId ?? t.id} task={t} context="backlog" />)
        ) : (
          <EmptyState
            icon="moon"
            title="Nothing parked"
            body="Someday holds ideas you're not ready for. A kindness, not a graveyard."
          />
        )}
      </Section>
      )}

      {pinTarget && (
        <PinModal
          list={pinTarget.list}
          mode={pinTarget.mode}
          onClose={() => setPinTarget(null)}
        />
      )}
      {shareTarget && (
        <ShareListModal
          list={state.lists.find((l) => l.id === shareTarget.id) ?? shareTarget}
          onClose={() => setShareTarget(null)}
        />
      )}
    </div>
  );
}

function LockGlyph({ open }: { open?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect
        x="3"
        y="7"
        width="10"
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {open ? (
        <path
          d="M5.5 7V4.5a2.5 2.5 0 014.9-.7"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M5.5 7V4.5a2.5 2.5 0 015 0V7"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      )}
      <circle cx="8" cy="10.5" r="1.2" fill="currentColor" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      className={`transition-transform ${open ? "" : "-rotate-90"}`}
      aria-hidden
    >
      <path d="M3.5 6L8 10.5 12.5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GripGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx="6" cy="4" r="1.3" />
      <circle cx="10" cy="4" r="1.3" />
      <circle cx="6" cy="8" r="1.3" />
      <circle cx="10" cy="8" r="1.3" />
      <circle cx="6" cy="12" r="1.3" />
      <circle cx="10" cy="12" r="1.3" />
    </svg>
  );
}

function ReorderGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function Section({
  mark,
  name: sectionName,
  count,
  hint,
  children,
  onRename,
  onDelete,
  locked,
  lockedHidden,
  onLockAction,
  onRelock,
  canManage = true,
  peopleCount = 0,
  onShare,
  folded = false,
  onToggleFold,
  anchor,
}: {
  /** The section's id on the page, so it can be scrolled to. */
  anchor?: string;
  mark: React.ReactNode;
  name: string;
  count: number | null;
  hint?: string;
  children: React.ReactNode;
  onRename?: (name: string) => void;
  onDelete?: () => void;
  locked?: boolean;
  lockedHidden?: boolean;
  onLockAction?: (mode: PinMode) => void;
  onRelock?: () => void;
  canManage?: boolean;
  peopleCount?: number;
  onShare?: () => void;
  folded?: boolean;
  onToggleFold?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  return (
    <section id={anchor} className={`group/section scroll-mt-20 rounded-2xl ${folded ? "mb-4 sm:mb-3" : "mb-12 sm:mb-10"}`}>
      <div className="mb-2 flex min-h-9 items-center gap-x-2">
        {onToggleFold && (
          <button
            onClick={onToggleFold}
            aria-expanded={!folded}
            aria-label={folded ? `Show ${sectionName}` : `Hide ${sectionName}`}
            className="-ml-1 grid size-6 shrink-0 place-items-center rounded-md text-ink-faint transition-colors hover:bg-paper-deep hover:text-ink"
          >
            <Chevron open={!folded} />
          </button>
        )}
        <span className="shrink-0">{mark}</span>
        {editing && onRename ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) {
                onRename(name.trim());
                setEditing(false);
              }
              if (e.key === "Escape") setEditing(false);
            }}
            onBlur={() => setEditing(false)}
            className="w-40 rounded-lg border border-line bg-paper px-2 py-1 text-lg font-bold outline-none focus:border-sun"
            autoFocus
          />
        ) : (
          <h2
            className={`min-w-0 flex-1 truncate text-lg font-bold ${onRename ? "cursor-pointer hover:text-sun-deep" : ""}`}
            onClick={() => {
              if (!onRename) return;
              setName(sectionName);
              setEditing(true);
            }}
            title={onRename ? "Click to rename" : undefined}
          >
            {sectionName}
          </h2>
        )}
        {locked && (
          <span className="shrink-0 text-ink-faint" data-tip="PIN-protected list">
            <LockGlyph />
          </span>
        )}
        {count !== null && (
          <span className="ml-auto shrink-0 text-sm tabular-nums text-ink-faint">{count}</span>
        )}

        {peopleCount > 0 && (
          <span
            className="shrink-0 rounded-md bg-sky-soft px-1.5 py-0.5 text-[11px] font-medium text-sky"
            data-tip="Shared list"
          >
            👥 {peopleCount}
          </span>
        )}
        {/* the slot is always here, so a row with no actions (Inbox, Someday)
            still leaves the count in the same column as every other row */}
        <span className="grid w-8 shrink-0 place-items-center">
          {onLockAction && (
          <SectionMenu
            canManage={canManage}
            locked={locked}
            lockedHidden={lockedHidden}
            onShare={onShare}
            onLockAction={onLockAction}
            onRelock={onRelock}
            onDelete={onDelete}
          />
          )}
        </span>
      </div>
      {!folded && (
        <>
          {hint && <p className="mb-3 text-xs text-ink-soft">{hint}</p>}
          <div className="space-y-2">{children}</div>
        </>
      )}
    </section>
  );
}

/**
 * A list action. Below `sm` the label collapses and only the symbol shows, so
 * share/lock/delete stay on one line beside the list name on a phone; from
 * `sm` up there's room for words. `title` doubles as the accessible name,
 * which is what carries the meaning once the text is hidden.
 *
 * `keepLabel` opts out — used where two actions would otherwise collapse to
 * the same glyph.
 */
/**
 * All of a list's actions behind one dots button. Three cramped icon pills
 * per row read as noise on a phone and gave no clue what they did; a menu
 * says the words, and leaves the row with a single control to align.
 */
function SectionMenu({
  canManage,
  locked,
  lockedHidden,
  onShare,
  onLockAction,
  onRelock,
  onDelete,
}: {
  canManage: boolean;
  locked?: boolean;
  lockedHidden?: boolean;
  onShare?: () => void;
  onLockAction: (mode: PinMode) => void;
  onRelock?: () => void;
  onDelete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const run = (fn?: () => void) => () => {
    setOpen(false);
    fn?.();
  };

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={(e) => {
          // flip upward when the bottom of the screen is too close
          setUp(window.innerHeight - e.currentTarget.getBoundingClientRect().bottom < 380);
          setOpen((v) => !v);
        }}
        aria-label="List actions"
        aria-expanded={open}
        data-tip="More"
        className={`grid size-8 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-paper-deep hover:text-ink ${
          open ? "bg-paper-deep text-ink" : ""
        }`}
      >
        <IconDots size={16} />
      </button>

      {open && (
        <div className={`anim-pop absolute right-0 z-30 w-52 rounded-xl border border-line bg-card p-1.5 shadow-lg ${up ? "bottom-9" : "top-9"}`}>
          {onShare && (
            <SectionMenuBtn onClick={run(onShare)} icon={<span aria-hidden>👥</span>}>
              {canManage ? "Share this list" : "See who's on it"}
            </SectionMenuBtn>
          )}
          {!locked && canManage && (
            <SectionMenuBtn onClick={run(() => onLockAction("set"))} icon={<LockGlyph />}>
              Lock with a PIN
            </SectionMenuBtn>
          )}
          {locked && !lockedHidden && (
            <>
              {onRelock && (
                <SectionMenuBtn onClick={run(onRelock)} icon={<LockGlyph />}>
                  Hide it again now
                </SectionMenuBtn>
              )}
              {canManage && (
                <>
                  <SectionMenuBtn onClick={run(() => onLockAction("change"))} icon={<LockGlyph />}>
                    Change the PIN
                  </SectionMenuBtn>
                  <SectionMenuBtn
                    onClick={run(() => onLockAction("remove"))}
                    icon={<LockGlyph open />}
                  >
                    Remove the lock
                  </SectionMenuBtn>
                </>
              )}
            </>
          )}
          {onDelete && (
            <>
              <div className="my-1 border-t border-line" />
              <SectionMenuBtn
                onClick={run(onDelete)}
                icon={<IconTrash size={14} />}
                tone="danger"
              >
                Delete list
              </SectionMenuBtn>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SectionMenuBtn({
  children,
  icon,
  onClick,
  tone,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
  tone?: "danger";
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
        tone === "danger" ? "text-clay hover:bg-clay-soft" : "hover:bg-paper-deep"
      }`}
    >
      <span className="grid w-4 shrink-0 place-items-center">{icon}</span>
      {children}
    </button>
  );
}
