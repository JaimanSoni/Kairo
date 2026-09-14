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
  /**
   * Stable across the optimistic-insert -> saved swap, and used as the React
   * key. `id` changes from a temp value to the real one when the save lands,
   * which would otherwise unmount and rebuild the row mid-glance.
   * Absent on tasks that arrived from the server already saved.
   */
  clientId?: string;
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
  /**
   * For the done copy a repeating task leaves in the log: the id of the
   * series it came from. Un-completing such a copy rejoins the series
   * instead of resurrecting a repeat-less twin that the morning sweep
   * would interrogate tomorrow.
   */
  instanceOf: string | null;
  /** Who created the task. Everyone else on it is in memberIds. */
  ownerId: string;
  /**
   * People this single task is shared with, like guests on a calendar event:
   * one live task everyone sees, edits, and completes together. Distinct from
   * list sharing, which shares a whole list.
   */
  memberIds: string[];
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
  /** For a locked list: whether this browser has entered its PIN. The server decides, and its tasks only arrive when true. */
  unlocked?: boolean;
  /** Client-only: created optimistically, still waiting for its real id.
   *  Anything that would send this id to the server stays off until then. */
  pending?: boolean;
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
  /** The face currently worn: chosen animal, or the Google photo. */
  picture?: string;
  /** The Google photo itself, kept for the avatar picker. */
  googlePicture?: string;
  /** True when an app-wide PIN lock is set for this account. */
  appLockEnabled: boolean;
  /** True when that lock is shut for this browser: the server sent no data, and nothing loads until the PIN is entered. */
  appLocked?: boolean;
  /** Shows the admin entry point. Access itself is enforced server-side. */
  isAdmin: boolean;
  /** True when this account is actually paying us. Suppresses the tip jar —
   *  asking a paying customer for a coffee is asking twice. */
  isPaying: boolean;
  /** True for the try-before-signup visitor on "/": tasks live in
   *  localStorage, and signing in carries them into a real account. */
  guest?: boolean;
};
