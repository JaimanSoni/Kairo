"use client";

import { useEffect, useMemo, useState } from "react";
import type { List } from "@/lib/types";
import { byOrder, hiddenListIds, useApp } from "./store";
import { TaskItem } from "./task-item";
import { AddRow } from "./today-view";
import { PinModal, type PinMode } from "./pin-modal";
import { ShareListModal } from "./share-modal";
import { Icon3d, ListMark, LIST_ICONS } from "./img3d";
import { EmptyState, IconPlus, IconTrash, IconX } from "./ui";

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

  const inbox = all
    .filter((t) => t.status === "inbox" && !(t.listId && hidden.has(t.listId)))
    .sort(byOrder);
  const someday = all
    .filter(
      (t) => t.status === "someday" && !(t.listId && hidden.has(t.listId)),
    )
    .sort(byOrder);

  const submitCreate = async () => {
    if (!newName.trim()) return;
    await createList(newName.trim(), newEmoji);
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
              title={allFolded ? "Expand every section" : "Collapse every section"}
              className="flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-2 text-xs font-medium text-ink-soft hover:border-ink-faint hover:text-ink"
            >
              <Chevron open={!allFolded} />
              {allFolded ? "Expand all" : "Collapse all"}
            </button>
          )}
          {state.lists.length > 1 && (
            <button
              onClick={() => setReordering((v) => !v)}
              aria-pressed={reordering}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
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
              className="flex items-center gap-1.5 rounded-full border border-line bg-card px-4 py-2 text-sm font-semibold hover:border-sun hover:text-sun-deep"
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
              placeholder="List name — Work, Home, Errands…"
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

      {/* reorder mode — compact rows, move up/down; works on touch, unlike drag */}
      {reordering && (
        <div className="anim-rise">
          <p className="mb-3 text-xs text-ink-soft">
            Move your lists into the order you want. Inbox and Someday stay put.
          </p>
          <ul className="overflow-hidden rounded-2xl border border-line bg-card">
            {state.lists.map((list, i) => (
              <li
                key={list.id}
                className={`flex items-center gap-3 px-3 py-2.5 ${i > 0 ? "border-t border-line" : ""}`}
              >
                <ListMark value={list.emoji} size={22} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{list.name}</span>
                <span className="flex shrink-0 gap-1">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`Move ${list.name} up`}
                    className="grid size-9 place-items-center rounded-lg border border-line text-ink-soft transition-colors hover:border-sun hover:text-sun-deep disabled:opacity-30 disabled:hover:border-line disabled:hover:text-ink-soft"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === state.lists.length - 1}
                    aria-label={`Move ${list.name} down`}
                    className="grid size-9 place-items-center rounded-lg border border-line text-ink-soft transition-colors hover:border-sun hover:text-sun-deep disabled:opacity-30 disabled:hover:border-line disabled:hover:text-ink-soft"
                  >
                    ↓
                  </button>
                </span>
              </li>
            ))}
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
        hint="Freshly captured, undecided. Triage when you plan — not when you capture."
        folded={collapsed.includes("inbox")}
        onToggleFold={() => toggleFold("inbox")}
      >
        {inbox.map((t) => (
          <TaskItem key={t.id} task={t} context="backlog" />
        ))}
        <AddRow placeholder="Capture something…" plannedFor={null} />
      </Section>
      )}

      {/* user lists */}
      {!reordering && state.lists.map((list) => {
        const isHidden = hidden.has(list.id);
        const isOwner = list.role === "owner";
        const tasks = isHidden
          ? []
          : all
              .filter((t) => t.listId === list.id && t.status !== "done")
              .sort(byOrder);
        return (
          <Section
            key={list.id}
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
            onLockAction={(mode) => setPinTarget({ list, mode })}
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
                <LockGlyph /> Locked — tap to unlock
              </button>
            ) : (
              <>
                {tasks.map((t) => (
                  <TaskItem key={t.id} task={t} context="backlog" />
                ))}
                <AddRow
                  placeholder={`Add to ${list.name}…`}
                  plannedFor={null}
                  listId={list.id}
                />
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
          someday.map((t) => <TaskItem key={t.id} task={t} context="backlog" />)
        ) : (
          <EmptyState
            icon="moon"
            title="Nothing parked"
            body="Someday holds ideas you're not ready for — a kindness, not a graveyard."
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
}: {
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
    <section className={`group/section ${folded ? "mb-3" : "mb-8"}`}>
      <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1.5">
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
            className={`min-w-0 max-w-full truncate text-lg font-bold ${onRename ? "cursor-pointer hover:text-sun-deep" : ""}`}
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
          <span className="shrink-0 text-ink-faint" title="PIN-protected list">
            <LockGlyph />
          </span>
        )}
        {count !== null && (
          <span className="text-sm text-ink-faint">{count}</span>
        )}

        {peopleCount > 0 && (
          <span
            className="shrink-0 rounded-md bg-sky-soft px-1.5 py-0.5 text-[11px] font-medium text-sky"
            title="Shared list"
          >
            👥 {peopleCount}
          </span>
        )}
        {onLockAction && (
          <span className="ml-auto flex flex-wrap items-center justify-end gap-1 opacity-0 transition-opacity group-hover/section:opacity-100 pointer-coarse:opacity-100 max-md:opacity-100">
            {onShare && (
              <IconTextBtn
                onClick={onShare}
                title={canManage ? "Share this list" : "See who's on this list"}
              >
                👥 {canManage ? "Share" : "Shared"}
              </IconTextBtn>
            )}
            {!locked && canManage && (
              <IconTextBtn
                onClick={() => onLockAction("set")}
                title="Lock this list with a PIN"
              >
                <LockGlyph /> Lock
              </IconTextBtn>
            )}
            {locked && !lockedHidden && (
              <>
                {onRelock && (
                  <IconTextBtn
                    onClick={onRelock}
                    title="Hide this list again now"
                  >
                    <LockGlyph /> Relock
                  </IconTextBtn>
                )}
                {canManage && (
                  <>
                    <IconTextBtn
                      onClick={() => onLockAction("change")}
                      title="Change PIN"
                    >
                      <LockGlyph /> PIN
                    </IconTextBtn>
                    <IconTextBtn
                      onClick={() => onLockAction("remove")}
                      title="Remove the lock"
                    >
                      <LockGlyph open /> Remove
                    </IconTextBtn>
                  </>
                )}
              </>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="p-1.5 text-ink-faint hover:text-clay"
                aria-label="Delete list"
              >
                <IconTrash size={14} />
              </button>
            )}
          </span>
        )}
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

function IconTextBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center gap-1 rounded-full border border-line bg-card px-2.5 py-1 text-xs font-medium text-ink-soft hover:border-ink-faint hover:text-ink"
    >
      {children}
    </button>
  );
}
