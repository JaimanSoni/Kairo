import type { Repeat } from "./repeat";

export type TaskStatus = "inbox" | "planned" | "done" | "someday";

export type Subtask = {
  id: string;
  title: string;
  done: boolean;
};

export type Task = {
  id: string;
  title: string;
  note: string;
  status: TaskStatus;
  /** The day the user has committed to doing this: "YYYY-MM-DD", or null. */
  plannedFor: string | null;
  /** A real external deadline, distinct from plannedFor. */
  dueDate: string | null;
  /** True for the 1-3 tasks marked as today's "must win" items. */
  spotlight: boolean;
  listId: string | null;
  /** Rough time estimate in minutes, powers the day's capacity meter. */
  estimateMin: number | null;
  order: number;
  /** How many days this task has carried over without being done. */
  carryCount: number;
  /** Recurrence rule. A repeating task is one card that advances on completion. */
  repeat: Repeat | null;
  subtasks: Subtask[];
  completedAt: string | null;
  createdAt: string;
};

export type List = {
  id: string;
  name: string;
  emoji: string;
  order: number;
  /** True when the list is protected by a PIN (hash lives server-side only). */
  locked: boolean;
};

export type UserProfile = {
  id: string;
  email: string;
  name: string;
  picture?: string;
};
