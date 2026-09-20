"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import type { AccountInfo, List, Subtask, Task, UserProfile, SpacePrefs } from "@/lib/types";
import { addDays, friendlyDay, planEpoch, todayStr } from "@/lib/dates";
import { nextOccurrence } from "@/lib/repeat";
import { cancelPush } from "@/lib/push-client";
import type { ParsedInput } from "@/lib/nlp";
import { avatarChoiceUrl } from "@/lib/avatars";
import { track } from "@/lib/analytics-client";

/* ---------------- state ---------------- */

export type Toast = {
  message: string;
  action?: { label: string; run: () => void };
};

type State = {
  tasks: Record<string, Task>;
  lists: List[];
  user: UserProfile;
  /** All accounts signed in to this browser (for the switcher). */
  accounts: AccountInfo[];
  /** Directory of people on shared lists — resolves assignee ids to name/avatar. */
  people: AccountInfo[];
  today: string;
  toast: Toast | null;
  omnibarOpen: boolean;
  editingId: string | null;
  sweepDismissed: boolean;
  /**
   * The live focus session. `minutes` is the duration this session was
   * started with — the timer's single source of truth, so what you picked is
   * what runs regardless of when the task's estimate write lands. `adopt` is
   * set only by the reload-restore path, and is the one case where a timer
   * saved in localStorage may be resumed instead of started fresh.
   */
  focus: { taskId: string; minimized: boolean; minutes: number | null; adopt: boolean } | null;
  /** List ids unlocked for this browser session. */
  unlockedLists: string[];
  /** App-wide PIN gate. Starts locked when enabled; session unlock lifts it. */
  appLocked: boolean;
};

type Action =
  | { type: "UPSERT_TASK"; task: Task }
  | { type: "REPLACE_TASK"; tempId: string; task: Task }
  | { type: "REMOVE_TASK"; id: string }
  | { type: "UPSERT_LIST"; list: List }
  | { type: "REMOVE_LIST"; id: string }
  | { type: "SET_TOAST"; toast: Toast | null }
  | { type: "SET_OMNIBAR"; open: boolean }
  | { type: "SET_EDITING"; id: string | null }
  | { type: "SET_TODAY"; today: string }
  | { type: "SET_SWEEP_DISMISSED"; dismissed: boolean }
  | { type: "SET_FOCUS"; focus: State["focus"] }
  | { type: "SET_UNLOCKED"; ids: string[] }
  | { type: "SET_APP_LOCKED"; locked: boolean }
  | { type: "SET_APPLOCK_ENABLED"; enabled: boolean }
  | { type: "SET_USER_PICTURE"; picture: string | undefined }
  | { type: "SET_SPACES"; spaces: SpacePrefs; welcome: boolean | undefined }
  | { type: "REPLACE_ALL"; tasks: Task[]; lists: List[]; people: AccountInfo[] }
  | { type: "BULK_UPSERT"; tasks: Task[] };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "UPSERT_TASK":
      return { ...state, tasks: { ...state.tasks, [action.task.id]: action.task } };
    case "REPLACE_TASK": {
      const tasks = { ...state.tasks };
      delete tasks[action.tempId];
      // keep the key the row is rendered under, so React updates it in place
      // instead of throwing the node away and building a new one
      tasks[action.task.id] = { ...action.task, clientId: action.tempId };
      return { ...state, tasks };
    }
    case "REMOVE_TASK": {
      const tasks = { ...state.tasks };
      delete tasks[action.id];
      return { ...state, tasks };
    }
    case "BULK_UPSERT": {
      const tasks = { ...state.tasks };
      for (const t of action.tasks) tasks[t.id] = t;
      return { ...state, tasks };
    }
    case "REPLACE_ALL":
      return {
        ...state,
        tasks: Object.fromEntries(action.tasks.map((t) => [t.id, t])),
        lists: action.lists,
        people: action.people,
        // which locked lists are open is the server's call, made on the same answer
        unlockedLists: openLockedIds(action.lists),
      };
    case "UPSERT_LIST": {
      const exists = state.lists.some((l) => l.id === action.list.id);
      return {
        ...state,
        lists: exists
          ? state.lists.map((l) => (l.id === action.list.id ? action.list : l))
          : [...state.lists, action.list],
      };
    }
    case "REMOVE_LIST":
      return { ...state, lists: state.lists.filter((l) => l.id !== action.id) };
    case "SET_TOAST":
      return { ...state, toast: action.toast };
    case "SET_OMNIBAR":
      return { ...state, omnibarOpen: action.open };
    case "SET_EDITING":
      return { ...state, editingId: action.id };
    case "SET_TODAY":
      return { ...state, today: action.today, sweepDismissed: false };
    case "SET_SWEEP_DISMISSED":
      return { ...state, sweepDismissed: action.dismissed };
    case "SET_FOCUS":
      return { ...state, focus: action.focus };
    case "SET_UNLOCKED":
      return { ...state, unlockedLists: action.ids };
    case "SET_APP_LOCKED":
      return { ...state, appLocked: action.locked };
    case "SET_APPLOCK_ENABLED":
      return {
        ...state,
        user: { ...state.user, appLockEnabled: action.enabled },
        appLocked: action.enabled ? state.appLocked : false,
      };
    case "SET_USER_PICTURE":
      return { ...state, user: { ...state.user, picture: action.picture } };
    case "SET_SPACES":
      return { ...state, user: { ...state.user, spaces: action.spaces, welcome: action.welcome } };
    default:
      return state;
  }
}

/* ---------------- api helpers ---------------- */

/** Where a guest's whole world lives until they sign in. */
export const GUEST_STORAGE_KEY = "kairo-guest-v1";

/**
 * The guest slate covers this many CREATED tasks, ever — deleting one does
 * not mint a fresh slot, or ten tasks becomes infinity via delete-and-redo.
 * The counter lives inside the same saved snapshot as the tasks themselves:
 * it can only be reset by wiping the tasks with it, which is no exploit at
 * all. Hitting the cap fires this event; the sign-in gate listens.
 */
export const GUEST_TASK_CAP = 10;
export const GUEST_CAP_EVENT = "kairo-guest-cap";

let guestCreated = 0;

/** True (and announces it) when the guest has used up their slate. */
export function guestCapReached(): boolean {
  if (!guestMode || guestCreated < GUEST_TASK_CAP) return false;
  window.dispatchEvent(new Event(GUEST_CAP_EVENT));
  return true;
}

/**
 * Guest mode: the same store, but the network is a mirror. Every mutator in
 * this file already builds its optimistic state and only needs the server to
 * echo agreement (plus a real id on creates), so a guest can run the entire
 * app against this emulator while localStorage plays the database.
 */
let guestMode = false;

function guestApi<T>(url: string, options?: RequestInit): T {
  const method = (options?.method ?? "GET").toUpperCase();
  const body: Record<string, unknown> =
    typeof options?.body === "string" ? JSON.parse(options.body) : {};

  if (method === "POST" && url === "/api/tasks") {
    const now = new Date().toISOString();
    const status = (body.status as Task["status"]) ?? "inbox";
    const task: Task = {
      id: `local-${crypto.randomUUID()}`,
      title: String(body.title ?? ""),
      note: String(body.note ?? ""),
      status,
      plannedFor: (body.plannedFor as string | null) ?? null,
      plannedTime: body.plannedFor ? ((body.plannedTime as string | null) ?? null) : null,
      dueDate: (body.dueDate as string | null) ?? null,
      spotlight: body.spotlight === true,
      listId: (body.listId as string | null) ?? null,
      estimateMin: (body.estimateMin as number | null) ?? null,
      order: typeof body.order === "number" ? body.order : Date.now(),
      carryCount: 0,
      repeat: (body.repeat as Task["repeat"]) ?? null,
      reminderAt: (body.reminderAt as number | null) ?? null,
      startedAt: null,
      assigneeId: null,
      instanceOf: (body.instanceOf as string | null) ?? null,
      ownerId: "guest",
      memberIds: [],
      subtasks: Array.isArray(body.subtasks) ? (body.subtasks as Task["subtasks"]) : [],
      completedAt: status === "done" ? now : null,
      createdAt: now,
    };
    return { task } as T;
  }

  if (method === "POST" && url === "/api/lists") {
    const list: List = {
      id: `local-list-${crypto.randomUUID()}`,
      name: String(body.name ?? "List"),
      emoji: String(body.emoji ?? "📌"),
      order: Date.now(),
      locked: false,
      role: "owner",
      memberCount: 0,
    };
    return { list } as T;
  }

  // every other call (PATCH, DELETE, batch, order) only needs a nod
  return {} as T;
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  if (guestMode) return guestApi<T>(url, options);
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

/* ---------------- context ---------------- */

export type SweepAction = "today" | "tomorrow" | "later" | "someday" | "done" | "letgo";

type AppContextValue = {
  state: State;
  /** Optimistically adds a task; resolves to the persisted id (null if save failed). */
  /** `subtasks`: steps the task is born with. They go out with the create itself; adding them a moment later used to race the new id and lose them. */
  addTask: (input: ParsedInput, opts?: { status?: Task["status"]; subtasks?: Subtask[] }) => Promise<string | null>;
  /** Reads the latest version of a task (safe inside async callbacks). */
  getTask: (id: string) => Task | undefined;
  updateTask: (id: string, patch: Partial<Task>) => void;
  /** Marks a task as being worked on now, or stops it. Only one at a time. */
  toggleStarted: (id: string) => void;
  duplicateTask: (id: string) => void;
  /** `on`: the day it was actually done, when that wasn't today (settling yesterday in the morning). */
  completeTask: (id: string, opts?: { on?: string }) => void;
  uncompleteTask: (id: string) => void;
  deleteTask: (id: string, opts?: { silent?: boolean }) => void;
  reorderTasks: (orderedIds: string[]) => void;
  sweep: (decisions: { id: string; action: SweepAction }[]) => void;
  createList: (name: string, emoji: string) => Promise<void>;
  renameList: (id: string, name: string, emoji: string) => void;
  /** Syncs a server-returned list (e.g. lock state changes) into the store. */
  upsertList: (list: List) => void;
  /** Persists this user's preferred list order. */
  reorderLists: (ids: string[]) => void;
  deleteList: (id: string) => void;
  showToast: (toast: Toast) => void;
  setOmnibar: (open: boolean) => void;
  setEditing: (id: string | null) => void;
  dismissSweep: () => void;
  reopenSweep: () => void;
  startFocus: (taskId: string, opts?: { minutes?: number | null; adopt?: boolean; minimized?: boolean }) => void;
  stopFocus: () => void;
  /**
   * Stop working on one task, whether or not this device has its timer.
   * A row calls itself "focusing" from the task's own `startedAt`, which
   * outlives any one device's session, so stopping must clear the task —
   * going only through the session left a task stuck saying "focusing"
   * with nothing that could stop it.
   */
  stopWork: (taskId: string) => void;
  minimizeFocus: (minimized: boolean) => void;
  setListUnlocked: (listId: string, unlocked: boolean) => void;
  lockApp: () => void;
  unlockApp: () => void;
  setAppLockEnabled: (enabled: boolean) => void;
  /** Wears a different face: an animal, or back to the Google photo. */
  setAvatarChoice: (choice: string) => void;
  /** Shows or hides the journal, notes and garden; `welcomed` also answers the first-run welcome. Resolves to whether it saved. */
  setSpaces: (spaces: SpacePrefs, opts?: { welcomed?: boolean }) => Promise<boolean>;
  /** Re-pulls tasks+lists from the server (shared lists change under you). */
  refreshData: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

/* ---------------- derived selectors ---------------- */

export function useTaskList(): Task[] {
  const { state } = useApp();
  return useMemo(() => Object.values(state.tasks), [state.tasks]);
}

export function byOrder(a: Task, b: Task): number {
  return a.order - b.order || a.createdAt.localeCompare(b.createdAt);
}

/** Locked lists the server says this browser has opened. */
function openLockedIds(lists: List[]): string[] {
  return lists.filter((l) => l.locked && l.unlocked).map((l) => l.id);
}

/** Ids of lists whose contents are currently hidden (locked, not unlocked this session). */
export function hiddenListIds(state: { lists: List[]; unlockedLists: string[] }): Set<string> {
  return new Set(
    state.lists.filter((l) => l.locked && !state.unlockedLists.includes(l.id)).map((l) => l.id)
  );
}

/** Lists safe to show/offer right now (unlocked or never locked). */
export function visibleLists(state: { lists: List[]; unlockedLists: string[] }): List[] {
  // pending lists are excluded: their temp id is not a real ObjectId, and a
  // capture filed into one ("#newlist milk") would be rejected by the server
  // and silently destroyed
  return state.lists.filter((l) => !l.pending && (!l.locked || state.unlockedLists.includes(l.id)));
}

/** Resolves an assignee id to a person (checks the directory, then the current user). */
export function personById(
  state: { people: AccountInfo[]; user: UserProfile },
  id: string | null
): AccountInfo | null {
  if (!id) return null;
  if (id === state.user.id) {
    return { id: state.user.id, name: state.user.name, email: state.user.email, picture: state.user.picture };
  }
  return state.people.find((p) => p.id === id) ?? null;
}

/* ---------------- provider ---------------- */

export function AppProvider({
  user,
  accounts,
  initialTasks,
  initialLists,
  initialPeople,
  guest = false,
  children,
}: {
  user: UserProfile;
  accounts: AccountInfo[];
  initialTasks: Task[];
  initialLists: List[];
  initialPeople: AccountInfo[];
  /** Try-mode: no network, localStorage is the database. */
  guest?: boolean;
  children: React.ReactNode;
}) {
  // effects run before any user interaction can call a mutator, so the flag
  // is always set by the time the first api() fires; only one provider is
  // ever mounted, so a module flag is safe
  useEffect(() => {
    guestMode = guest;
  }, [guest]);

  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    tasks: Object.fromEntries(initialTasks.map((t) => [t.id, t])),
    lists: initialLists,
    user,
    accounts,
    people: initialPeople,
    today: todayStr(),
    toast: null,
    omnibarOpen: false,
    editingId: null,
    sweepDismissed: false,
    focus: null,
    // Both are the server's decision, read from signed cookies it set when a
    // PIN was entered. A locked app was sent no data at all; a locked list's
    // tasks weren't sent either.
    unlockedLists: openLockedIds(initialLists),
    appLocked: Boolean(user.appLockEnabled && user.appLocked),
  }));

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((toast: Toast) => {
    dispatch({ type: "SET_TOAST", toast });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => dispatch({ type: "SET_TOAST", toast: null }), 5000);
  }, []);

  const syncError = useCallback(
    (rollback?: () => void) => {
      rollback?.();
      showToast({ message: "Couldn't save that. It's still here. Try again in a moment." });
    },
    [showToast]
  );

  /* guest hydrate: the browser's saved world replaces the empty initial one.
     Runs in an effect (not the reducer init) so SSR and first client render
     agree, which is what keeps hydration from tearing. */
  useEffect(() => {
    if (!guest) return;
    try {
      const raw = localStorage.getItem(GUEST_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { tasks?: Task[]; lists?: List[]; created?: number };
      const tasks = Array.isArray(saved.tasks) ? saved.tasks.filter((t) => t && t.id && t.title) : [];
      const lists = Array.isArray(saved.lists) && saved.lists.length ? saved.lists : stateRef.current.lists;
      // the lifetime tally rides in the same snapshot; the floor of "tasks
      // still present" covers saves from before the tally existed
      guestCreated = Math.max(Number(saved.created) || 0, tasks.length);
      if (tasks.length || saved.lists?.length) {
        dispatch({ type: "REPLACE_ALL", tasks, lists, people: [] });
      }
    } catch {
      /* a corrupt save never blocks a fresh start */
    }
  }, [guest]);

  /* guest persist: every settled change lands in localStorage, debounced */
  useEffect(() => {
    if (!guest) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          GUEST_STORAGE_KEY,
          JSON.stringify({
            tasks: Object.values(state.tasks),
            lists: state.lists,
            created: guestCreated,
          })
        );
      } catch {
        /* storage full or blocked — the session still works in memory */
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [guest, state.tasks, state.lists]);

  /* keep "today" fresh across midnight / tab refocus */
  useEffect(() => {
    const check = () => {
      const now = todayStr();
      if (now !== stateRef.current.today) dispatch({ type: "SET_TODAY", today: now });
    };
    const interval = setInterval(check, 60_000);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", check);
    };
  }, []);


  const addTask = useCallback(
    (input: ParsedInput, opts?: { status?: Task["status"]; subtasks?: Subtask[] }) => {
      if (guestCapReached()) return Promise.resolve(null);
      if (guestMode) guestCreated++;
      const tempId = `temp-${crypto.randomUUID()}`;
      const status = opts?.status ?? (input.plannedFor ? "planned" : "inbox");
      const now = new Date().toISOString();
      const task: Task = {
        id: tempId,
        clientId: tempId,
        title: input.title,
        note: "",
        status,
        plannedFor: input.plannedFor,
        plannedTime: input.plannedTime,
        dueDate: input.dueDate,
        spotlight: input.spotlight,
        listId: input.listId,
        estimateMin: input.estimateMin,
        order: Date.now(),
        carryCount: 0,
        repeat: input.repeat ?? null,
        reminderAt: null,
        startedAt: null,
        assigneeId: null,
        instanceOf: null,
        ownerId: user.id,
        memberIds: [],
        subtasks: opts?.subtasks ?? [],
        completedAt: null,
        createdAt: now,
      };
      dispatch({ type: "UPSERT_TASK", task });

      return api<{ task: Task }>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: task.title,
          status: task.status,
          plannedFor: task.plannedFor,
          plannedTime: task.plannedTime,
          dueDate: task.dueDate,
          spotlight: task.spotlight,
          listId: task.listId,
          estimateMin: task.estimateMin,
          order: task.order,
          repeat: task.repeat,
          ...(task.subtasks.length ? { subtasks: task.subtasks } : {}),
        }),
      })
        .then(({ task: saved }) => {
          dispatch({ type: "REPLACE_TASK", tempId, task: saved });
          return saved.id;
        })
        .catch(() => {
          syncError(() => dispatch({ type: "REMOVE_TASK", id: tempId }));
          return null;
        });
    },
    [syncError, user.id]
  );

  const getTask = useCallback((id: string) => stateRef.current.tasks[id], []);

  const updateTask = useCallback(
    (id: string, patch: Partial<Task>) => {
      const prev = stateRef.current.tasks[id];
      if (!prev) return;
      const next: Task = { ...prev, ...patch };
      if (patch.status === "done" && prev.status !== "done") {
        // the moment it was finished: now, unless it is being logged for an earlier day
        next.completedAt = patch.completedAt ?? new Date().toISOString();
        next.spotlight = false;
      }
      if (patch.status && patch.status !== "done") next.completedAt = null;
      // a time can't outlive its day
      if (patch.plannedFor === null) next.plannedTime = null;
      dispatch({ type: "UPSERT_TASK", task: next });

      if (id.startsWith("temp-")) return; // will be persisted by the pending create

      const body: Record<string, unknown> = {};
      const fields: (keyof Task)[] = [
        "title", "note", "status", "plannedFor", "plannedTime", "dueDate", "spotlight", "listId",
        "estimateMin", "order", "carryCount", "repeat", "reminderAt", "startedAt", "assigneeId", "subtasks",
        "completedAt",
      ];
      for (const f of fields) {
        if (f in patch) body[f] = patch[f];
      }
      api(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(body) }).catch(() =>
        syncError(() => dispatch({ type: "UPSERT_TASK", task: prev }))
      );
    },
    [syncError]
  );

  /**
   * A missed repeating task moves on by itself. The Fresh Start sweep is for
   * one-off plans that deserve a decision; a daily habit missed yesterday
   * has an obvious answer — today — and asking would be nagging. Runs on
   * boot and again whenever the day rolls over.
   */
  useEffect(() => {
    const today = state.today;
    for (const t of Object.values(stateRef.current.tasks)) {
      if (!t.repeat || t.status !== "planned" || !t.plannedFor || t.plannedFor >= today) continue;
      if (t.id.startsWith("temp-")) continue;
      // walk the rule forward to its first occurrence on or after today
      let next = t.plannedFor;
      for (let i = 0; i < 400 && next < today; i++) next = nextOccurrence(t.repeat, next);
      if (next < today) continue; // a rule that never advances must not loop
      updateTask(t.id, { plannedFor: next });
    }
  }, [state.today, updateTask]);

  /**
   * Completing a repeating task logs a finished copy (for Today/Log) and
   * advances the card to its next occurrence — the series is one document.
   */
  /**
   * Starting work on something stops whatever else was running.
   *
   * You can only actually be doing one thing, and a list of six "in progress"
   * tasks is the same lie as a to-do list with sixty items on it — which is
   * the thing this app exists to avoid.
   */
  /**
   * A fresh copy of a task, sitting right under the original.
   *
   * Copies what describes the work — title, note, steps, list, estimate, day,
   * deadline, repeat — and drops what records progress on the original: steps
   * come back unticked, nothing is started or completed. Spotlight is not
   * copied (three is a cap, and a copy silently claiming a slot would break
   * it), and neither is the assignee — duplicating must never hand someone
   * work they didn't agree to.
   */
  const duplicateTask = useCallback(
    (id: string) => {
      const src = stateRef.current.tasks[id];
      if (!src) return;
      if (guestCapReached()) return;
      if (guestMode) guestCreated++;
      const tempId = `temp-${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      const subtasks = src.subtasks.map((st) => ({
        id: crypto.randomUUID(),
        title: st.title,
        done: false,
        plannedFor: st.plannedFor ?? null,
      }));
      const task: Task = {
        ...src,
        id: tempId,
        clientId: tempId,
        status: src.plannedFor ? "planned" : src.status === "done" ? "inbox" : src.status,
        spotlight: false,
        assigneeId: null,
        instanceOf: null,
        // the duplicate is yours alone; sharing never travels with a copy
        ownerId: user.id,
        memberIds: [],
        subtasks,
        // +1 keeps the copy adjacent to the original instead of at the end
        order: src.order + 1,
        startedAt: null,
        reminderAt: null,
        completedAt: null,
        createdAt: now,
      };
      dispatch({ type: "UPSERT_TASK", task });

      api<{ task: Task }>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: task.title,
          note: task.note,
          status: task.status,
          plannedFor: task.plannedFor,
          plannedTime: task.plannedTime,
          dueDate: task.dueDate,
          spotlight: false,
          listId: task.listId,
          estimateMin: task.estimateMin,
          order: task.order,
          repeat: task.repeat,
          subtasks,
        }),
      })
        .then(({ task: saved }) => {
          dispatch({ type: "REPLACE_TASK", tempId, task: saved });
        })
        .catch(() => {
          dispatch({ type: "REMOVE_TASK", id: tempId });
          showToast({ message: "Couldn't duplicate that. Try again." });
        });
    },
    [showToast, user.id]
  );

  /** Starts one task and stops every other — see toggleStarted. */
  const markStarted = useCallback(
    (id: string) => {
      for (const other of Object.values(stateRef.current.tasks)) {
        if (other.id !== id && other.startedAt) updateTask(other.id, { startedAt: null });
      }
      updateTask(id, { startedAt: new Date().toISOString() });
    },
    [updateTask]
  );

  const toggleStarted = useCallback(
    (id: string) => {
      const t = stateRef.current.tasks[id];
      if (!t || t.status === "done") return;

      if (t.startedAt) {
        updateTask(id, { startedAt: null });
        // stopping work stops the clock measuring it
        if (stateRef.current.focus?.taskId === id) dispatch({ type: "SET_FOCUS", focus: null });
        return;
      }
      markStarted(id);
    },
    [updateTask, markStarted]
  );

  const completeTask = useCallback(
    (id: string, opts?: { on?: string }) => {
      const t = stateRef.current.tasks[id];
      if (!t || t.status === "done") return;
      // done on an earlier day: it belongs to that day's wins, not today's. The end of that day stands in for the moment.
      const doneOn = opts?.on && opts.on < stateRef.current.today ? opts.on : null;
      const doneAt = doneOn ? new Date(planEpoch(doneOn, "23:59")).toISOString() : null;

      track("task-complete");
      if (t.reminderAt) cancelPush(`remind-${id}`); // a done task needs no reminder

      if (t.repeat) {
        const today = stateRef.current.today;
        const nowIso = doneAt ?? new Date().toISOString();

        // 1) the finished copy that lands in Done today / the Log. It keeps
        //    today as its planned day so un-completing it brings it back to
        //    Today as a plain task — not into the inbox, and never touching
        //    the series card that has already moved on.
        const tempId = `temp-${crypto.randomUUID()}`;
        const instance: Task = {
          ...t,
          id: tempId,
          repeat: null,
          dueDate: null,
          status: "done",
          spotlight: false,
          plannedFor: doneOn ?? today,
          // the way back: un-completing this copy rejoins the series
          instanceOf: id.startsWith("temp-") ? null : id,
          completedAt: nowIso,
          createdAt: nowIso,
          order: Date.now(),
        };
        dispatch({ type: "UPSERT_TASK", task: instance });
        api<{ task: Task }>("/api/tasks", {
          method: "POST",
          body: JSON.stringify({
            title: instance.title,
            note: instance.note,
            status: "done",
            plannedFor: doneOn ?? today,
            ...(doneAt ? { completedAt: doneAt } : {}),
            plannedTime: instance.plannedTime,
            listId: instance.listId,
            estimateMin: instance.estimateMin,
            subtasks: instance.subtasks,
            order: instance.order,
            ...(instance.instanceOf ? { instanceOf: instance.instanceOf } : {}),
          }),
        })
          .then(({ task: saved }) => dispatch({ type: "REPLACE_TASK", tempId, task: saved }))
          .catch(() => syncError(() => dispatch({ type: "REMOVE_TASK", id: tempId })));

        // 2) advance the series
        // done for an earlier day: the series may well be due again today
        const after = doneOn ? addDays(today, -1) : t.plannedFor && t.plannedFor > today ? t.plannedFor : today;
        const next = nextOccurrence(t.repeat, after);
        updateTask(id, {
          plannedFor: next,
          status: "planned",
          spotlight: false,
          carryCount: 0,
          reminderAt: null,
          startedAt: null,
          // a fresh occurrence starts with a fresh checklist
          subtasks: t.subtasks.map((s) => ({ ...s, done: false, plannedFor: null })),
        });
        showToast({ message: `↻ Next: ${friendlyDay(next, today)}` });
        return;
      }

      updateTask(id, {
        status: "done",
        ...(doneAt ? { completedAt: doneAt } : {}),
        ...(t.reminderAt ? { reminderAt: null } : {}),
        ...(t.startedAt ? { startedAt: null } : {}),
      });
    },
    [updateTask, showToast, syncError]
  );

  const uncompleteTask = useCallback(
    (id: string) => {
      const t = stateRef.current.tasks[id];
      if (!t) return;

      // A done copy of a repeating task rejoins its series: resurrecting the
      // copy would leave a repeat-less twin, and by tomorrow the sweep would
      // be asking about a "daily" task it has no business questioning.
      const series = t.instanceOf ? stateRef.current.tasks[t.instanceOf] : null;
      if (series?.repeat) {
        dispatch({ type: "REMOVE_TASK", id });
        if (!id.startsWith("temp-")) {
          api(`/api/tasks/${id}`, { method: "DELETE" }).catch(() =>
            syncError(() => dispatch({ type: "UPSERT_TASK", task: t }))
          );
        }
        updateTask(series.id, {
          plannedFor: t.plannedFor ?? stateRef.current.today,
          status: "planned",
        });
        return;
      }

      updateTask(id, {
        status: t.plannedFor ? "planned" : "inbox",
        completedAt: null,
      });
    },
    [updateTask, syncError]
  );

  const deleteTask = useCallback(
    (id: string, opts?: { silent?: boolean }) => {
      const task = stateRef.current.tasks[id];
      if (!task) return;
      if (task.reminderAt) cancelPush(`remind-${id}`);
      dispatch({ type: "REMOVE_TASK", id });

      const doDelete = () =>
        api(`/api/tasks/${id}`, { method: "DELETE" }).catch(() =>
          syncError(() => dispatch({ type: "UPSERT_TASK", task }))
        );

      if (opts?.silent || id.startsWith("temp-")) {
        if (!id.startsWith("temp-")) doDelete();
        return;
      }

      doDelete();
      showToast({
        message: "Let go. One less thing.",
        action: {
          label: "Undo",
          run: () => {
            api<{ task: Task }>("/api/tasks", {
              method: "POST",
              body: JSON.stringify({
                title: task.title,
                note: task.note,
                status: task.status,
                plannedFor: task.plannedFor,
                dueDate: task.dueDate,
                spotlight: task.spotlight,
                listId: task.listId,
                estimateMin: task.estimateMin,
                order: task.order,
                subtasks: task.subtasks,
              }),
            })
              .then(({ task: saved }) => dispatch({ type: "UPSERT_TASK", task: saved }))
              .catch(() => syncError());
          },
        },
      });
    },
    [showToast, syncError]
  );

  const reorderTasks = useCallback(
    (orderedIds: string[]) => {
      const base = Date.now();
      const updates: { id: string; order: number }[] = [];
      const upserts: Task[] = [];
      orderedIds.forEach((id, i) => {
        const t = stateRef.current.tasks[id];
        if (!t) return;
        const order = base + i;
        upserts.push({ ...t, order });
        if (!id.startsWith("temp-")) updates.push({ id, order });
      });
      dispatch({ type: "BULK_UPSERT", tasks: upserts });
      if (updates.length) {
        api("/api/tasks/batch", { method: "POST", body: JSON.stringify({ updates }) }).catch(() =>
          syncError()
        );
      }
    },
    [syncError]
  );

  const sweep = useCallback(
    (decisions: { id: string; action: SweepAction }[]) => {
      const today = stateRef.current.today;
      const updates: Record<string, unknown>[] = [];
      const upserts: Task[] = [];

      for (const { id, action } of decisions) {
        const t = stateRef.current.tasks[id];
        if (!t) continue;

        // repeating tasks: "done" logs+advances, "letgo" means skip — never delete the series
        if (t.repeat && action === "done") {
          completeTask(id, { on: t.plannedFor ?? undefined });
          continue;
        }
        if (t.repeat && (action === "letgo" || action === "later" || action === "someday" || action === "tomorrow")) {
          const next = nextOccurrence(t.repeat, today);
          const skipped: Task = { ...t, plannedFor: next, spotlight: false, carryCount: 0 };
          upserts.push(skipped);
          if (!id.startsWith("temp-")) {
            updates.push({ id, plannedFor: next, spotlight: false, carryCount: 0 });
          }
          continue;
        }

        if (action === "letgo") {
          dispatch({ type: "REMOVE_TASK", id });
          if (!id.startsWith("temp-")) {
            // rollback restores the task the sweep removed; without it a
            // dropped connection made "let go" silently permanent on screen
            // while the server still held the task
            api(`/api/tasks/${id}`, { method: "DELETE" }).catch(() =>
              syncError(() => dispatch({ type: "UPSERT_TASK", task: t }))
            );
          }
          continue;
        }
        let patch: Partial<Task>;
        switch (action) {
          case "today":
            patch = { plannedFor: today, status: "planned", carryCount: t.carryCount + 1 };
            break;
          case "tomorrow":
            patch = { plannedFor: addDays(today, 1), status: "planned", spotlight: false, carryCount: t.carryCount + 1 };
            break;
          case "later":
            patch = { plannedFor: null, status: "inbox", spotlight: false };
            break;
          case "someday":
            patch = { plannedFor: null, status: "someday", spotlight: false };
            break;
          case "done":
            // finished on the day it was planned for, not this morning: it's that day's win
            patch = { status: "done", ...(t.plannedFor && t.plannedFor < today ? { completedAt: new Date(planEpoch(t.plannedFor, "23:59")).toISOString() } : {}) };
            break;
        }
        const next: Task = { ...t, ...patch };
        if (patch.status === "done") next.completedAt = patch.completedAt ?? new Date().toISOString();
        upserts.push(next);
        if (!id.startsWith("temp-")) updates.push({ id, ...patch });
      }

      if (upserts.length) {
        // keep the pre-sweep versions so a failed batch can put the morning
        // back the way it was instead of lying about a clean slate
        const before = upserts
          .map((u) => stateRef.current.tasks[u.id])
          .filter((x): x is Task => Boolean(x));
        dispatch({ type: "BULK_UPSERT", tasks: upserts });
        if (updates.length) {
          api("/api/tasks/batch", { method: "POST", body: JSON.stringify({ updates }) }).catch(() =>
            syncError(() => dispatch({ type: "BULK_UPSERT", tasks: before }))
          );
        }
      } else if (updates.length) {
        api("/api/tasks/batch", { method: "POST", body: JSON.stringify({ updates }) }).catch(() =>
          syncError()
        );
      }
      dispatch({ type: "SET_SWEEP_DISMISSED", dismissed: true });
    },
    [syncError, completeTask]
  );

  const createList = useCallback(
    async (name: string, emoji: string) => {
      // The list exists on screen the moment it is named; the server's only
      // contribution is the real id, swapped in when it arrives. Until then
      // the row is marked pending so nothing sends the temp id anywhere.
      const tempId = `temp-list-${Math.random().toString(36).slice(2, 10)}`;
      const maxOrder = stateRef.current.lists.reduce((m, l) => Math.max(m, l.order), 0);
      dispatch({
        type: "UPSERT_LIST",
        list: { id: tempId, name, emoji, order: maxOrder + 1, locked: false, role: "owner", memberCount: 0, pending: true },
      });
      let list: List;
      try {
        ({ list } = await api<{ list: List }>("/api/lists", {
          method: "POST",
          body: JSON.stringify({ name, emoji }),
        }));
      } catch {
        const lists = stateRef.current.lists.filter((l) => l.id !== tempId);
        syncError(() =>
          dispatch({ type: "REPLACE_ALL", tasks: Object.values(stateRef.current.tasks), lists, people: stateRef.current.people })
        );
        return;
      }
      const lists = stateRef.current.lists.map((l) => (l.id === tempId ? list : l));
      dispatch({ type: "REPLACE_ALL", tasks: Object.values(stateRef.current.tasks), lists, people: stateRef.current.people });
    },
    [syncError]
  );

  const renameList = useCallback(
    (id: string, name: string, emoji: string) => {
      const prev = stateRef.current.lists.find((l) => l.id === id);
      if (!prev) return;
      dispatch({ type: "UPSERT_LIST", list: { ...prev, name, emoji } });
      api(`/api/lists/${id}`, { method: "PATCH", body: JSON.stringify({ name, emoji }) }).catch(() =>
        syncError(() => dispatch({ type: "UPSERT_LIST", list: prev }))
      );
    },
    [syncError]
  );

  const upsertList = useCallback((list: List) => {
    dispatch({ type: "UPSERT_LIST", list });
  }, []);

  const reorderLists = useCallback(
    (ids: string[]) => {
      const prev = stateRef.current.lists;
      const byId = new Map(prev.map((l) => [l.id, l]));
      const next = ids.map((id) => byId.get(id)).filter((l): l is List => Boolean(l));
      if (next.length !== prev.length) return; // stale ids — ignore rather than lose a list
      dispatch({ type: "REPLACE_ALL", tasks: Object.values(stateRef.current.tasks), lists: next, people: stateRef.current.people });

      api("/api/lists/order", { method: "PUT", body: JSON.stringify({ ids }) }).catch(() =>
        syncError(() =>
          dispatch({
            type: "REPLACE_ALL",
            tasks: Object.values(stateRef.current.tasks),
            lists: prev,
            people: stateRef.current.people,
          })
        )
      );
    },
    [syncError]
  );

  const deleteList = useCallback(
    (id: string) => {
      const prev = stateRef.current.lists.find((l) => l.id === id);
      if (!prev) return;
      dispatch({ type: "REMOVE_LIST", id });
      // tasks in this list fall back to inbox locally, mirroring the server
      const affected = Object.values(stateRef.current.tasks)
        .filter((t) => t.listId === id)
        .map((t) => ({ ...t, listId: null }));
      if (affected.length) dispatch({ type: "BULK_UPSERT", tasks: affected });
      api(`/api/lists/${id}`, { method: "DELETE" }).catch(() =>
        syncError(() => dispatch({ type: "UPSERT_LIST", list: prev }))
      );
    },
    [syncError]
  );

  const setOmnibar = useCallback((open: boolean) => dispatch({ type: "SET_OMNIBAR", open }), []);
  const setEditing = useCallback((id: string | null) => dispatch({ type: "SET_EDITING", id }), []);
  const dismissSweep = useCallback(
    () => dispatch({ type: "SET_SWEEP_DISMISSED", dismissed: true }),
    []
  );
  const reopenSweep = useCallback(
    () => dispatch({ type: "SET_SWEEP_DISMISSED", dismissed: false }),
    []
  );
  /**
   * The timer is something you use *while* working on a task, so starting it
   * puts the task in progress too. Keeping these separate let a task be timed
   * without being "in progress", which is two answers to one question.
   */
  const startFocus = useCallback(
    (taskId: string, opts?: { minutes?: number | null; adopt?: boolean; minimized?: boolean }) => {
      const t = stateRef.current.tasks[taskId];
      if (t && !t.startedAt && t.status !== "done") markStarted(taskId);
      // minimized rides along in the same dispatch: a follow-up minimizeFocus
      // call would read stateRef before this commit lands and quietly no-op
      dispatch({
        type: "SET_FOCUS",
        focus: {
          taskId,
          minimized: opts?.minimized ?? false,
          minutes: opts?.minutes ?? null,
          adopt: opts?.adopt ?? false,
        },
      });
    },
    [markStarted]
  );
  /**
   * Closing the timer means you've stopped working, so the task stops too.
   * Minimising goes through minimizeFocus and never lands here — hiding the
   * clock isn't the same as putting the work down.
   */
  const stopFocus = useCallback(() => {
    const cur = stateRef.current.focus;
    if (cur) {
      const t = stateRef.current.tasks[cur.taskId];
      if (t?.startedAt && t.status !== "done") updateTask(cur.taskId, { startedAt: null });
    }
    dispatch({ type: "SET_FOCUS", focus: null });
  }, [updateTask]);
  const stopWork = useCallback(
    (taskId: string) => {
      const t = stateRef.current.tasks[taskId];
      if (t?.startedAt && t.status !== "done") updateTask(taskId, { startedAt: null });
      const cur = stateRef.current.focus;
      if (cur?.taskId === taskId) dispatch({ type: "SET_FOCUS", focus: null });
      // the account's session can outlive this device's copy of it (started
      // elsewhere, or left behind by a tab that went away): end it there too,
      // unless this device is mid-session on some other task
      else if (!cur && !stateRef.current.user.guest) {
        api("/api/focus", { method: "DELETE" }).catch(() => {});
      }
    },
    [updateTask]
  );

  const minimizeFocus = useCallback((minimized: boolean) => {
    const cur = stateRef.current.focus;
    if (cur) dispatch({ type: "SET_FOCUS", focus: { ...cur, minimized } });
  }, []);

  /**
   * Locking gives this browser's grant back to the server, then starts the
   * page over: what was on screen leaves memory too, not just the view.
   */
  const lockApp = useCallback(() => {
    dispatch({ type: "SET_APP_LOCKED", locked: true });
    void fetch("/api/applock/unlock", { method: "DELETE" })
      .catch(() => {})
      .finally(() => window.location.reload());
  }, []);

  /** Unlocked: the server now has a grant for this browser, so the page loads for real. */
  const unlockApp = useCallback(() => {
    window.location.reload();
  }, []);

  const refreshData = useCallback(async () => {
    if (guestMode) return; // a guest's truth is already in this browser
    // don't clobber optimistic creates that are still in flight
    if (Object.keys(stateRef.current.tasks).some((id) => id.startsWith("temp-"))) return;
    try {
      const res = await fetch("/api/bootstrap");
      // locked elsewhere (another tab pressed Lock, or the grant ran out): start over behind the gate
      if (res.status === 401 && stateRef.current.user.appLockEnabled && !stateRef.current.appLocked) {
        window.location.reload();
        return;
      }
      if (!res.ok) return;
      const data: { tasks: Task[]; lists: List[]; people?: AccountInfo[] } = await res.json();
      dispatch({
        type: "REPLACE_ALL",
        tasks: data.tasks,
        lists: data.lists,
        people: data.people ?? stateRef.current.people,
      });
    } catch {}
  }, []);

  /* shared lists change under you — refresh when the tab regains focus */
  useEffect(() => {
    let last = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      // a new day can begin while the tab sat in the background
      const now = todayStr();
      if (now !== stateRef.current.today) dispatch({ type: "SET_TODAY", today: now });
      if (Date.now() - last < 20_000) return;
      last = Date.now();
      refreshData();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshData]);

  const setAvatarChoice = useCallback(
    (choice: string) => {
      const prev = stateRef.current.user.picture;
      const next = avatarChoiceUrl(choice) ?? stateRef.current.user.googlePicture;
      dispatch({ type: "SET_USER_PICTURE", picture: next });
      track("avatar-change", { choice });
      api("/api/profile/avatar", { method: "POST", body: JSON.stringify({ choice }) }).catch(() =>
        syncError(() => dispatch({ type: "SET_USER_PICTURE", picture: prev }))
      );
    },
    [syncError]
  );

  const setSpaces = useCallback(
    async (spaces: SpacePrefs, opts?: { welcomed?: boolean }) => {
      const prev = stateRef.current.user.spaces;
      const prevWelcome = stateRef.current.user.welcome;
      dispatch({ type: "SET_SPACES", spaces, welcome: opts?.welcomed ? false : prevWelcome });
      track("spaces-change", { ...spaces, welcomed: Boolean(opts?.welcomed) });
      if (guestMode) return true;
      try {
        await api("/api/profile/spaces", { method: "PUT", body: JSON.stringify({ ...spaces, ...(opts?.welcomed ? { welcomed: true } : {}) }) });
        return true;
      } catch {
        syncError(() => dispatch({ type: "SET_SPACES", spaces: prev, welcome: prevWelcome }));
        return false;
      }
    },
    [syncError]
  );

  // setting a PIN grants this browser on the server, so nothing to remember here
  const setAppLockEnabled = useCallback((enabled: boolean) => {
    dispatch({ type: "SET_APPLOCK_ENABLED", enabled });
  }, []);

  /**
   * A list opening or closing changes what the server will send, so the store
   * asks again: an opened list's tasks arrive, a closed one's leave memory.
   * Opening is only ever called after the PIN was accepted (which granted it);
   * closing hands the grant back first.
   */
  const setListUnlocked = useCallback(
    (listId: string, unlocked: boolean) => {
      const cur = stateRef.current.unlockedLists;
      const ids = unlocked ? (cur.includes(listId) ? cur : [...cur, listId]) : cur.filter((id) => id !== listId);
      dispatch({ type: "SET_UNLOCKED", ids });
      if (guestMode) return;
      const revoke = unlocked ? Promise.resolve() : fetch(`/api/lists/${listId}/unlock`, { method: "DELETE" }).catch(() => {});
      void revoke.then(() => refreshData());
    },
    [refreshData]
  );

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      addTask,
      getTask,
      updateTask,
      toggleStarted,
      duplicateTask,
      completeTask,
      uncompleteTask,
      deleteTask,
      reorderTasks,
      sweep,
      createList,
      renameList,
      upsertList,
      reorderLists,
      deleteList,
      showToast,
      setOmnibar,
      setEditing,
      dismissSweep,
      reopenSweep,
      startFocus,
      stopFocus,
      stopWork,
      minimizeFocus,
      setListUnlocked,
      lockApp,
      unlockApp,
      setAppLockEnabled,
      setAvatarChoice,
      setSpaces,
      refreshData,
    }),
    [
      state, addTask, getTask, updateTask, toggleStarted, duplicateTask, completeTask, uncompleteTask, deleteTask,
      reorderTasks, sweep, createList, renameList, upsertList, reorderLists, deleteList, showToast,
      setOmnibar, setEditing, dismissSweep, reopenSweep, startFocus, stopFocus, stopWork, minimizeFocus,
      setListUnlocked, lockApp, unlockApp, setAppLockEnabled, setAvatarChoice, setSpaces, refreshData,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
