import type { Repeat } from "./repeat";

export type TaskStatus = "inbox" | "planned" | "done" | "someday";

export type Subtask = {
  id: string;
  title: string;
  done: boolean;
  /** When it was ticked, ISO. Without this a finished step has no place in
   *  time, so the Log can't show it on the day it was actually done. */
  doneAt?: string | null;
  /** Steps can be planned onto days of their own: "YYYY-MM-DD" or null/absent. */
  plannedFor?: string | null;
};

export type Task = {
  id: string;
  title: string;
  note: string;
  status: TaskStatus;
  /** The day the user has committed to doing this: "YYYY-MM-DD", or null. */
  plannedFor: string | null;
  /** Optional time-of-day on the planned day: "HH:MM" (24h), or null. */
  plannedTime: string | null;
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
  /** When work actually began, ISO, or null. Truthy means "in progress" —
   *  a timestamp rather than a flag so the card can say how long it's been. */
  startedAt: string | null;
  /** One-off "remind me" push, epoch ms. Cleared when it fires or the task completes. */
  reminderAt: number | null;
  /** In a shared list, the member this task is assigned to (their user id) or null. */
  assigneeId: string | null;
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
  /** Viewer's relationship to the list. Owners manage lock/rename/share/delete. */
  role: "owner" | "member";
  /** Number of people the list is shared with (excluding the owner). */
  memberCount: number;
};

export type AccountInfo = {
  id: string;
  email: string;
  name: string;
  picture?: string;
};

export type UserProfile = {
  id: string;
  email: string;
  name: string;
  picture?: string;
  /** True when an app-wide PIN lock is set for this account. */
  appLockEnabled: boolean;
  /** Shows the admin entry point. Access itself is enforced server-side. */
  isAdmin: boolean;
};
