"use client";

import { useEffect, useState } from "react";
import type { List, Task } from "@/lib/types";
import { useApp } from "./store";
import { track } from "@/lib/analytics-client";
import { ListMark } from "./img3d";
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

/**
 * People on a task — the calendar-invite model. One live task: everyone on it
 * sees the same thing, edits sync, and anyone finishing it finishes it for
 * all. The roster and the invite input mirror the list modal above so the
 * two kinds of sharing feel like one feature.
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
  const [people, setPeople] = useState<MemberInfo[] | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOwner = task.ownerId === state.user.id;

  const loadPeople = async () => {
    try {
      const res = await fetch(`/api/tasks/${task.id}/share`);
      if (res.ok) setPeople(((await res.json()) as { people: MemberInfo[] }).people);
    } catch {}
  };

  useEffect(() => {
    queueMicrotask(loadPeople);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  const add = async () => {
    const target = email.trim();
    if (!target || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(String(data.error ?? "Couldn't add them"));
      } else {
        setEmail("");
        track("task-share-live");
        showToast({ message: `👥 ${data.person.name || data.person.email} is on it too` });
        loadPeople();
        refreshData();
      }
    } catch {
      setError("Couldn't reach the server");
    }
    setBusy(false);
  };

  const remove = async (memberId: string) => {
    const leavingSelf = memberId === state.user.id;
    try {
      const res = await fetch(`/api/tasks/${task.id}/share`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      if (!res.ok) return;
      if (leavingSelf) {
        showToast({ message: "You left the task" });
        onClose();
      } else {
        loadPeople();
      }
      refreshData();
    } catch {}
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

        {/* roster */}
        <div className="mt-4 space-y-2">
          {people === null ? (
            <p className="text-sm text-ink-faint">Loading people…</p>
          ) : (
            people.map((m) => (
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
                ) : isOwner || m.id === state.user.id ? (
                  <button
                    onClick={() => remove(m.id)}
                    className="shrink-0 text-xs font-medium text-ink-faint hover:text-clay"
                  >
                    {m.id === state.user.id ? "Leave" : "Remove"}
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>

        {/* invite — anyone on the task can add people, like calendar guests */}
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
              {busy ? "…" : "Add"}
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-clay">{error}</p>}
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
