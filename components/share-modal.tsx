"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AccountInfo, List, Task } from "@/lib/types";
import { personById, useApp } from "./store";
import { track } from "@/lib/analytics-client";
import { ListMark } from "./img3d";
import { PersonAvatar } from "./person-avatar";
import { Modal } from "./ui";

type MemberInfo = { id: string; name: string; email: string; picture?: string; role: "owner" | "member" };

/** Manage who a list is shared with. Members see the roster and can leave. */
export function ShareListModal({ list, onClose }: { list: List; onClose: () => void }) {
  const { state, showToast, upsertList, refreshData } = useApp();
  const [members, setMembers] = useState<MemberInfo[] | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOwner = list.role === "owner";

  const loadMembers = async () => {
    try {
      const res = await fetch(`/api/lists/${list.id}/share`);
      if (res.ok) setMembers(((await res.json()) as { members: MemberInfo[] }).members);
    } catch {}
  };

  useEffect(() => {
    queueMicrotask(loadMembers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.id]);

  const add = async () => {
    const target = email.trim();
    if (!target || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/lists/${list.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(String(data.error ?? "Couldn't share"));
      } else {
        setEmail("");
        upsertList(data.list as List);
        track("list-share");
        showToast({ message: `👥 Shared with ${data.member.name || data.member.email}` });
        loadMembers();
      }
    } catch {
      setError("Couldn't reach the server");
    }
    setBusy(false);
  };

  const remove = async (memberId: string) => {
    const leavingSelf = memberId === state.user.id;
    try {
      const res = await fetch(`/api/lists/${list.id}/share`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      if (!res.ok) return;
      if (leavingSelf) {
        showToast({ message: `Left “${list.name}”` });
        onClose();
        refreshData();
      } else {
        loadMembers();
        refreshData();
      }
    } catch {}
  };

  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center gap-2.5">
          <ListMark value={list.emoji} size={30} />
          <h2 className="font-display min-w-0 flex-1 truncate text-2xl">{list.name}</h2>
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          {isOwner ? "Share this list, you'll both see and edit its tasks." : "Shared with you."}
        </p>
        {list.locked && (
          <p className="mt-2 rounded-xl bg-sun-soft px-3 py-2 text-xs text-sun-deep">
            🔒 This list is locked, everyone needs the same PIN to open it.
          </p>
        )}

        {/* roster */}
        <div className="mt-4 space-y-2">
          {members === null ? (
            <p className="text-sm text-ink-faint">Loading people…</p>
          ) : (
            members.map((m) => (
              <div key={m.id} className="flex items-center gap-2.5 rounded-xl border border-line bg-paper px-3 py-2">
                {m.picture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.picture} alt="" className="size-7 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <span className="grid size-7 place-items-center rounded-full bg-sun-soft text-xs font-bold text-sun-deep">
                    {(m.name || m.email).charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {m.name || m.email}
                    {m.id === state.user.id && <span className="text-ink-faint"> (you)</span>}
                  </div>
                  <div className="truncate text-xs text-ink-faint">{m.email}</div>
                </div>
                {m.role === "owner" ? (
                  <span className="shrink-0 rounded-md bg-paper-deep px-2 py-0.5 text-[10px] font-semibold uppercase text-ink-soft">
                    owner
                  </span>
                ) : isOwner ? (
                  <button
                    onClick={() => remove(m.id)}
                    className="shrink-0 text-xs font-medium text-ink-faint hover:text-clay"
                  >
                    Remove
                  </button>
                ) : m.id === state.user.id ? (
                  <button
                    onClick={() => remove(m.id)}
                    className="shrink-0 text-xs font-medium text-ink-faint hover:text-clay"
                  >
                    Leave
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>

        {/* invite */}
        {isOwner && (
          <div className="mt-4">
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
                placeholder="their@email.com"
                className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-2 text-base outline-none focus:border-sun sm:text-sm"
              />
              <button
                onClick={add}
                disabled={busy || !email.trim()}
                className="shrink-0 rounded-full bg-sun px-4 py-2 text-sm font-semibold text-on-accent shadow-lg shadow-sun/25 disabled:opacity-40"
              >
                {busy ? "…" : "Share"}
              </button>
            </div>
            {error && <p className="mt-2 text-xs text-clay">{error}</p>}
            <p className="mt-2 text-xs text-ink-faint">
              No account needed, the invite email signs them straight in.
            </p>
          </div>
        )}

        <div className="mt-5 flex justify-end border-t border-line pt-4">
          <button
            onClick={onClose}
            className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper hover:opacity-90"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** A pending add: shown in the roster the instant it's requested. */
type PendingAdd = { email: string; name?: string; picture?: string };

/**
 * People on a task — the calendar-invite model. One live task: everyone on it
 * sees the same thing, edits sync, and anyone finishing it finishes it for
 * all.
 *
 * The sheet is built to feel instant. The roster renders from the store on
 * the very first frame (the server fetch only reconciles, it never gates
 * paint), people you already share with are one tap away instead of an email
 * to type, typing filters them live, and an added person appears immediately
 * with an "inviting" shimmer rather than after the round trip.
 */
export function ShareTaskModal({
  task,
  onClose,
  onSendCopy,
}: {
  task: Task;
  onClose: () => void;
  /** Switches to the send-a-copy flow, for handoffs rather than collaboration. */
  onSendCopy: () => void;
}) {
  const { state, showToast, refreshData } = useApp();
  const [server, setServer] = useState<MemberInfo[] | null>(null);
  const [pending, setPending] = useState<PendingAdd[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isOwner = task.ownerId === state.user.id;

  // the store's copy of the task, so a successful add is reflected here the
  // moment refreshData lands, not only when the roster refetch does
  const live = state.tasks[task.id] ?? task;

  /** Server truth once it arrives; until then, assembled from the store. */
  const roster: MemberInfo[] = useMemo(() => {
    if (server) return server;
    return [live.ownerId, ...live.memberIds]
      .map((id) => {
        const p = personById(state, id);
        return p ? { ...p, role: id === live.ownerId ? ("owner" as const) : ("member" as const) } : null;
      })
      .filter((p): p is MemberInfo => p !== null);
  }, [server, live.ownerId, live.memberIds, state]);

  const loadPeople = async () => {
    try {
      const res = await fetch(`/api/tasks/${task.id}/share`);
      if (res.ok) setServer(((await res.json()) as { people: MemberInfo[] }).people);
    } catch {}
  };

  useEffect(() => {
    queueMicrotask(loadPeople);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  // an add that has already landed in the roster no longer needs its shimmer
  const rosterEmails = new Set(roster.map((r) => r.email.toLowerCase()));
  const visiblePending = pending.filter((p) => !rosterEmails.has(p.email));

  /** People you share with who aren't on this task yet: the one-tap pool. */
  const candidates = useMemo(() => {
    const onTask = new Set([live.ownerId, ...live.memberIds]);
    const pendingEmails = new Set(pending.map((p) => p.email));
    return state.people.filter(
      (p) => !onTask.has(p.id) && p.id !== state.user.id && !pendingEmails.has(p.email.toLowerCase())
    );
  }, [state.people, state.user.id, live.ownerId, live.memberIds, pending]);

  const q = query.trim().toLowerCase();
  const suggestions = q
    ? candidates
        .filter((p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
        .slice(0, 5)
    : [];
  const quickAdd = q ? [] : candidates.slice(0, 4);

  const add = async (email: string, known?: AccountInfo) => {
    const target = email.trim().toLowerCase();
    if (!target) return;
    if (!target.includes("@")) {
      setError("Type their email, or pick a person below");
      return;
    }
    setQuery("");
    setError(null);
    setPending((prev) => [...prev, { email: target, name: known?.name, picture: known?.picture }]);
    inputRef.current?.focus();
    try {
      const res = await fetch(`/api/tasks/${task.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(String(data.error ?? "Couldn't add them"));
      track("task-share-live");
      showToast({ message: `👥 ${data.person.name || data.person.email} is on it too` });
      // roster first, then the shimmer row retires — the person never blinks out
      await loadPeople();
      refreshData();
      setPending((prev) => prev.filter((p) => p.email !== target));
    } catch (err) {
      setPending((prev) => prev.filter((p) => p.email !== target));
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    }
  };

  const submitTyped = () => {
    if (suggestions.length > 0 && !query.includes("@")) void add(suggestions[0].email, suggestions[0]);
    else void add(query);
  };

  const remove = async (memberId: string) => {
    const leavingSelf = memberId === state.user.id;
    // optimistic: the row leaves now, the server confirms behind it
    setServer((prev) => (prev ? prev.filter((m) => m.id !== memberId) : prev));
    try {
      const res = await fetch(`/api/tasks/${task.id}/share`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      if (!res.ok) {
        loadPeople();
        return;
      }
      if (leavingSelf) {
        showToast({ message: "You left the task" });
        onClose();
      }
      refreshData();
    } catch {
      loadPeople();
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        <h2 className="font-display text-2xl">People on this task</h2>
        <p className="mt-1 truncate text-sm text-ink-soft">“{task.title}”</p>
        <p className="mt-2 text-xs text-ink-faint">
          Like a calendar invite: everyone here sees the same task, and when anyone finishes it,
          it&apos;s done for everyone.
        </p>

        {/* roster — painted from the store immediately, reconciled quietly */}
        <div className="mt-4 space-y-2">
          {roster.map((m, i) => (
            <div
              key={m.id}
              className="anim-rise flex items-center gap-2.5 rounded-xl border border-line bg-paper px-3 py-2"
              style={{ animationDelay: `${Math.min(i, 5) * 40}ms` }}
            >
              <PersonAvatar name={m.name || m.email} picture={m.picture} size={28} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {m.name || m.email}
                  {m.id === state.user.id && <span className="text-ink-faint"> (you)</span>}
                </div>
                <div className="truncate text-xs text-ink-faint">{m.email}</div>
              </div>
              {m.role === "owner" ? (
                <span className="shrink-0 rounded-md bg-paper-deep px-2 py-0.5 text-[10px] font-semibold uppercase text-ink-soft">
                  owner
                </span>
              ) : isOwner || m.id === state.user.id ? (
                <button
                  onClick={() => remove(m.id)}
                  className="shrink-0 text-xs font-medium text-ink-faint hover:text-clay"
                >
                  {m.id === state.user.id ? "Leave" : "Remove"}
                </button>
              ) : null}
            </div>
          ))}

          {visiblePending.map((p) => (
            <div
              key={p.email}
              className="anim-pop flex items-center gap-2.5 rounded-xl border border-sun/30 bg-sun-soft/30 px-3 py-2"
            >
              <span className="anim-pulse">
                <PersonAvatar name={p.name || p.email} picture={p.picture} size={28} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{p.name || p.email}</div>
                <div className="truncate text-xs text-sun-deep">Inviting…</div>
              </div>
            </div>
          ))}
        </div>

        {/* invite — anyone on the task can add people, like calendar guests */}
        <div className="mt-4">
          <div className="relative">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) submitTyped();
                }}
                placeholder={candidates.length > 0 ? "A name, or any email" : "their@email.com"}
                autoFocus
                className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-2 text-base outline-none focus:border-sun sm:text-sm"
              />
              <button
                onClick={submitTyped}
                disabled={!query.trim()}
                className="shrink-0 rounded-full bg-sun px-4 py-2 text-sm font-semibold text-on-accent shadow-lg shadow-sun/25 disabled:opacity-40"
              >
                Add
              </button>
            </div>

            {suggestions.length > 0 && (
              <div className="anim-pop absolute inset-x-0 top-full z-10 mt-1.5 overflow-hidden rounded-xl border border-line bg-card shadow-lg">
                {suggestions.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => void add(p.email, p)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-paper-deep"
                  >
                    <PersonAvatar name={p.name} picture={p.picture} size={26} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.name || p.email}</span>
                      <span className="block truncate text-xs text-ink-faint">{p.email}</span>
                    </span>
                    <span className="shrink-0 text-xs font-medium text-sun-deep">Add</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {error && <p className="mt-2 text-xs text-clay">{error}</p>}

          {quickAdd.length > 0 && (
            <div className="mt-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                One tap to add
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {quickAdd.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => void add(p.email, p)}
                    className="flex items-center gap-1.5 rounded-full border border-line bg-card py-1 pl-1 pr-3 text-xs font-medium text-ink-soft transition-colors hover:border-sun hover:text-sun-deep"
                  >
                    <PersonAvatar name={p.name || p.email} picture={p.picture} size={20} />
                    {p.name.split(" ")[0] || p.email}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="mt-2 text-xs text-ink-faint">
            No account needed, the invite email signs them straight in.
          </p>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
          <button
            onClick={onSendCopy}
            className="text-xs font-medium text-ink-faint underline underline-offset-2 hover:text-ink-soft"
          >
            Send a copy instead
          </button>
          <button
            onClick={onClose}
            className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper hover:opacity-90"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Send a copy of a task to someone's inbox — a handoff, not a live share. */
export function SendTaskModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const { showToast } = useApp();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const target = email.trim();
    if (!target || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(String(data.error ?? "Couldn't send"));
        setBusy(false);
        return;
      }
      track("task-send");
      showToast({ message: `📤 Sent to ${data.to}` });
      onClose();
    } catch {
      setError("Couldn't reach the server");
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        <h2 className="font-display text-2xl">Send a copy</h2>
        <p className="mt-1 truncate text-sm text-ink-soft">“{task.title}”</p>
        <p className="mt-2 text-xs text-ink-faint">
          A copy lands in their inbox with your name on it, they plan it their way.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="their@email.com"
            autoFocus
            className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-2 text-base outline-none focus:border-sun sm:text-sm"
          />
          <button
            onClick={send}
            disabled={busy || !email.trim()}
            className="shrink-0 rounded-full bg-sun px-4 py-2 text-sm font-semibold text-on-accent shadow-lg shadow-sun/25 disabled:opacity-40"
          >
            {busy ? "…" : "Send"}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-clay">{error}</p>}
      </div>
    </Modal>
  );
}
