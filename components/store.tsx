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
import type { AccountInfo, List, Task, UserProfile } from "@/lib/types";
import { friendlyDay, todayStr } from "@/lib/dates";
import { nextOccurrence } from "@/lib/repeat";
import { cancelPush } from "@/lib/push-client";
import type { ParsedInput } from "@/lib/nlp";

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
  focus: { taskId: string; minimized: boolean } | null;
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
  | { type: "REPLACE_ALL"; tasks: Task[]; lists: List[]; people: AccountInfo[] }
  | { type: "BULK_UPSERT"; tasks: Task[] };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "UPSERT_TASK":
      return { ...state, tasks: { ...state.tasks, [action.task.id]: action.task } };
    case "REPLACE_TASK": {
      const tasks = { ...state.tasks };
      delete tasks[action.tempId];
      tasks[action.task.id] = action.task;
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
    default:
      return state;
  }
}

/* ---------------- api helpers ---------------- */

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

/* ---------------- context ---------------- */

export type SweepAction = "today" | "later" | "someday" | "done" | "letgo";

type AppContextValue = {
  state: State;
  /** Optimistically adds a task; resolves to the persisted id (null if save failed). */
  addTask: (input: ParsedInput, opts?: { status?: Task["status"] }) => Promise<string | null>;
  /** Reads the latest version of a task (safe inside async callbacks). */
  getTask: (id: string) => Task | undefined;
  updateTask: (id: string, patch: Partial<Task>) => void;
  /** Marks a task as being worked on now, or stops it. Only one at a time. */
  toggleStarted: (id: string) => void;
  completeTask: (id: string) => void;
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
  startFocus: (taskId: string) => void;
  stopFocus: () => void;
  minimizeFocus: (minimized: boolean) => void;
  setListUnlocked: (listId: string, unlocked: boolean) => void;
  lockApp: () => void;
  unlockApp: () => void;
  setAppLockEnabled: (enabled: boolean) => void;
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

/** Ids of lists whose contents are currently hidden (locked, not unlocked this session). */
export function hiddenListIds(state: { lists: List[]; unlockedLists: string[] }): Set<string> {
  return new Set(
    state.lists.filter((l) => l.locked && !state.unlockedLists.includes(l.id)).map((l) => l.id)
  );
}

/** Lists safe to show/offer right now (unlocked or never locked). */
export function visibleLists(state: { lists: List[]; unlockedLists: string[] }): List[] {
  return state.lists.filter((l) => !l.locked || state.unlockedLists.includes(l.id));
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
  children,
}: {
  user: UserProfile;
  accounts: AccountInfo[];
  initialTasks: Task[];
  initialLists: List[];
  initialPeople: AccountInfo[];
  children: React.ReactNode;
}) {
  /* unlock state is scoped per account — switching users never leaks an unlock */
  const unlockedListsKey = `kairo-unlocked:${user.id}`;
  const appLockKey = `kairo-applock:${user.id}`;
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
    unlockedLists: [],
    // starts locked when a lock exists — the mount effect lifts it for
    // sessions that already unlocked (SSR-safe: no storage read here)
    appLocked: user.appLockEnabled,
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
      showToast({ message: "Couldn't save — check your connection" });
    },
    [showToast]
  );

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
    (input: ParsedInput, opts?: { status?: Task["status"] }) => {
      const tempId = `temp-${crypto.randomUUID()}`;
      const status = opts?.status ?? (input.plannedFor ? "planned" : "inbox");
      const now = new Date().toISOString();
      const task: Task = {
        id: tempId,
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
        subtasks: [],
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
    [syncError]
  );

  const getTask = useCallback((id: string) => stateRef.current.tasks[id], []);

  const updateTask = useCallback(
    (id: string, patch: Partial<Task>) => {
      const prev = stateRef.current.tasks[id];
      if (!prev) return;
      const next: Task = { ...prev, ...patch };
      if (patch.status === "done" && prev.status !== "done") {
        next.completedAt = new Date().toISOString();
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
    (id: string) => {
      const t = stateRef.current.tasks[id];
      if (!t || t.status === "done") return;

      if (t.reminderAt) cancelPush(`remind-${id}`); // a done task needs no reminder

      if (t.repeat) {
        const today = stateRef.current.today;
        const nowIso = new Date().toISOString();

        // 1) the finished copy that lands in Done today / the Log
        const tempId = `temp-${crypto.randomUUID()}`;
        const instance: Task = {
          ...t,
          id: tempId,
          repeat: null,
          dueDate: null,
          status: "done",
          spotlight: false,
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
            listId: instance.listId,
            estimateMin: instance.estimateMin,
            subtasks: instance.subtasks,
            order: instance.order,
          }),
        })
          .then(({ task: saved }) => dispatch({ type: "REPLACE_TASK", tempId, task: saved }))
          .catch(() => syncError(() => dispatch({ type: "REMOVE_TASK", id: tempId })));

        // 2) advance the series
        const after = t.plannedFor && t.plannedFor > today ? t.plannedFor : today;
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
      updateTask(id, {
        status: t.plannedFor ? "planned" : "inbox",
        completedAt: null,
      });
    },
    [updateTask]
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
          completeTask(id);
          continue;
        }
        if (t.repeat && (action === "letgo" || action === "later" || action === "someday")) {
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
            api(`/api/tasks/${id}`, { method: "DELETE" }).catch(() => syncError());
          }
          continue;
        }
        let patch: Partial<Task>;
        switch (action) {
          case "today":
            patch = { plannedFor: today, status: "planned", carryCount: t.carryCount + 1 };
            break;
          case "later":
            patch = { plannedFor: null, status: "inbox", spotlight: false };
            break;
          case "someday":
            patch = { plannedFor: null, status: "someday", spotlight: false };
            break;
          case "done":
            patch = { status: "done" };
            break;
        }
        const next: Task = { ...t, ...patch };
        if (patch.status === "done") next.completedAt = new Date().toISOString();
        upserts.push(next);
        if (!id.startsWith("temp-")) updates.push({ id, ...patch });
      }

      if (upserts.length) dispatch({ type: "BULK_UPSERT", tasks: upserts });
      if (updates.length) {
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
      const { list } = await api<{ list: List }>("/api/lists", {
        method: "POST",
        body: JSON.stringify({ name, emoji }),
      });
      dispatch({ type: "UPSERT_LIST", list });
    },
    []
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
    (taskId: string) => {
      const t = stateRef.current.tasks[taskId];
      if (t && !t.startedAt && t.status !== "done") markStarted(taskId);
      dispatch({ type: "SET_FOCUS", focus: { taskId, minimized: false } });
    },
    [markStarted]
  );
  const stopFocus = useCallback(() => dispatch({ type: "SET_FOCUS", focus: null }), []);
  const minimizeFocus = useCallback((minimized: boolean) => {
    const cur = stateRef.current.focus;
    if (cur) dispatch({ type: "SET_FOCUS", focus: { ...cur, minimized } });
  }, []);

  /* restore per-session unlocks (survives refresh, not a new browser session) */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(unlockedListsKey);
      if (raw) {
        const ids = (JSON.parse(raw) as unknown[]).filter((x): x is string => typeof x === "string");
        if (ids.length) dispatch({ type: "SET_UNLOCKED", ids });
      }
      if (sessionStorage.getItem(appLockKey) === "open") {
        dispatch({ type: "SET_APP_LOCKED", locked: false });
      }
    } catch {}
  }, [unlockedListsKey, appLockKey]);

  const lockApp = useCallback(() => {
    try {
      sessionStorage.removeItem(appLockKey);
    } catch {}
    dispatch({ type: "SET_APP_LOCKED", locked: true });
  }, [appLockKey]);

  const unlockApp = useCallback(() => {
    try {
      sessionStorage.setItem(appLockKey, "open");
    } catch {}
    dispatch({ type: "SET_APP_LOCKED", locked: false });
  }, [appLockKey]);

  const refreshData = useCallback(async () => {
    // don't clobber optimistic creates that are still in flight
    if (Object.keys(stateRef.current.tasks).some((id) => id.startsWith("temp-"))) return;
    try {
      const res = await fetch("/api/bootstrap");
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
      if (Date.now() - last < 20_000) return;
      last = Date.now();
      refreshData();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshData]);

  const setAppLockEnabled = useCallback(
    (enabled: boolean) => {
      dispatch({ type: "SET_APPLOCK_ENABLED", enabled });
      try {
        if (enabled) sessionStorage.setItem(appLockKey, "open");
        else sessionStorage.removeItem(appLockKey);
      } catch {}
    },
    [appLockKey]
  );

  const setListUnlocked = useCallback(
    (listId: string, unlocked: boolean) => {
      const cur = stateRef.current.unlockedLists;
      const ids = unlocked
        ? cur.includes(listId)
          ? cur
          : [...cur, listId]
        : cur.filter((id) => id !== listId);
      dispatch({ type: "SET_UNLOCKED", ids });
      try {
        sessionStorage.setItem(unlockedListsKey, JSON.stringify(ids));
      } catch {}
    },
    [unlockedListsKey]
  );

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      addTask,
      getTask,
      updateTask,
      toggleStarted,
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
      minimizeFocus,
      setListUnlocked,
      lockApp,
      unlockApp,
      setAppLockEnabled,
      refreshData,
    }),
    [
      state, addTask, getTask, updateTask, toggleStarted, completeTask, uncompleteTask, deleteTask,
      reorderTasks, sweep, createList, renameList, upsertList, reorderLists, deleteList, showToast,
      setOmnibar, setEditing, dismissSweep, reopenSweep, startFocus, stopFocus, minimizeFocus,
      setListUnlocked, lockApp, unlockApp, setAppLockEnabled, refreshData,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
