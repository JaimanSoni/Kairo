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
import type { List, Task, UserProfile } from "@/lib/types";
import { todayStr } from "@/lib/dates";
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
  today: string;
  toast: Toast | null;
  omnibarOpen: boolean;
  editingId: string | null;
  sweepDismissed: boolean;
  focus: { taskId: string; minimized: boolean } | null;
  /** List ids unlocked for this browser session. */
  unlockedLists: string[];
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
  completeTask: (id: string) => void;
  uncompleteTask: (id: string) => void;
  deleteTask: (id: string, opts?: { silent?: boolean }) => void;
  reorderTasks: (orderedIds: string[]) => void;
  sweep: (decisions: { id: string; action: SweepAction }[]) => void;
  createList: (name: string, emoji: string) => Promise<void>;
  renameList: (id: string, name: string, emoji: string) => void;
  /** Syncs a server-returned list (e.g. lock state changes) into the store. */
  upsertList: (list: List) => void;
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

/* ---------------- provider ---------------- */

export function AppProvider({
  user,
  initialTasks,
  initialLists,
  children,
}: {
  user: UserProfile;
  initialTasks: Task[];
  initialLists: List[];
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    tasks: Object.fromEntries(initialTasks.map((t) => [t.id, t])),
    lists: initialLists,
    user,
    today: todayStr(),
    toast: null,
    omnibarOpen: false,
    editingId: null,
    sweepDismissed: false,
    focus: null,
    unlockedLists: [],
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
        dueDate: input.dueDate,
        spotlight: input.spotlight,
        listId: input.listId,
        estimateMin: input.estimateMin,
        order: Date.now(),
        carryCount: 0,
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
          dueDate: task.dueDate,
          spotlight: task.spotlight,
          listId: task.listId,
          estimateMin: task.estimateMin,
          order: task.order,
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
      dispatch({ type: "UPSERT_TASK", task: next });

      if (id.startsWith("temp-")) return; // will be persisted by the pending create

      const body: Record<string, unknown> = {};
      const fields: (keyof Task)[] = [
        "title", "note", "status", "plannedFor", "dueDate",
        "spotlight", "listId", "estimateMin", "order", "carryCount", "subtasks",
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

  const completeTask = useCallback((id: string) => updateTask(id, { status: "done" }), [updateTask]);

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
    [syncError]
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
  const startFocus = useCallback(
    (taskId: string) => dispatch({ type: "SET_FOCUS", focus: { taskId, minimized: false } }),
    []
  );
  const stopFocus = useCallback(() => dispatch({ type: "SET_FOCUS", focus: null }), []);
  const minimizeFocus = useCallback((minimized: boolean) => {
    const cur = stateRef.current.focus;
    if (cur) dispatch({ type: "SET_FOCUS", focus: { ...cur, minimized } });
  }, []);

  /* restore per-session unlocks (survives refresh, not a new browser session) */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("kairo-unlocked");
      if (raw) {
        const ids = (JSON.parse(raw) as unknown[]).filter((x): x is string => typeof x === "string");
        if (ids.length) dispatch({ type: "SET_UNLOCKED", ids });
      }
    } catch {}
  }, []);

  const setListUnlocked = useCallback((listId: string, unlocked: boolean) => {
    const cur = stateRef.current.unlockedLists;
    const ids = unlocked
      ? cur.includes(listId)
        ? cur
        : [...cur, listId]
      : cur.filter((id) => id !== listId);
    dispatch({ type: "SET_UNLOCKED", ids });
    try {
      sessionStorage.setItem("kairo-unlocked", JSON.stringify(ids));
    } catch {}
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      addTask,
      getTask,
      updateTask,
      completeTask,
      uncompleteTask,
      deleteTask,
      reorderTasks,
      sweep,
      createList,
      renameList,
      upsertList,
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
    }),
    [
      state, addTask, getTask, updateTask, completeTask, uncompleteTask, deleteTask,
      reorderTasks, sweep, createList, renameList, upsertList, deleteList, showToast,
      setOmnibar, setEditing, dismissSweep, reopenSweep, startFocus, stopFocus, minimizeFocus,
      setListUnlocked,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
