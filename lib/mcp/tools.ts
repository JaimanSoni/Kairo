import { ObjectId, type AnyBulkWriteOperation, type Document, type WithId } from "mongodb";
import { randomUUID } from "crypto";
import {
  buildTaskUpdate,
  listsCollection,
  sanitizeTaskPatch,
  tasksCollection,
  toTask,
  TASK_STATUSES,
} from "../tasks";
import { friendlyDay, fmtMinutes, weekdayName } from "../dates";
import { sanitizeRepeat } from "../repeat";
import { epochIn } from "../tz";
import { scheduledCollection, ensureTicker, armPrecise, processDuePushes } from "../push";
import type { Subtask, Task } from "../types";
import { canWrite, type McpContext } from "./context";
import { ToolFail } from "./fail";
import { json, text, type JsonSchema, type ToolResult } from "./protocol";
import {
  cancelReminder,
  completeTask as completeTaskOp,
  findTask,
  loadScope,
  peopleByIds,
  projectedNext,
  resolveListRef,
  shapeList,
  shapeTask,
  SPOTLIGHT_MAX,
  taskScopeFilter,
  uncompleteTask as uncompleteTaskOp,
  type Scope,
} from "./data";
import {
  assignTask,
  findPersonByEmail,
  sendTaskCopy,
  shareList,
  shareTask,
  unshare,
} from "./sharing";
import {
  escapeRegExp,
  nullableDate,
  nullableInt,
  nullableString,
  nullableTime,
  optBool,
  optDate,
  optEnum,
  optInt,
  optObjectArray,
  optString,
  optStringArray,
  optTime,
  reqEmail,
  reqEnum,
  reqString,
  type Args,
} from "./args";

/** A soft cap, the same six hours the day's capacity meter uses. */
const DAY_CAPACITY_MIN = 6 * 60;
const MAX_REMINDER_AHEAD_MS = 30 * 24 * 60 * 60 * 1000;

export type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  /** False for tools a read-only key may call. */
  write: boolean;
  annotations?: Record<string, boolean | string>;
  run: (ctx: McpContext, scope: Scope, args: Args) => Promise<ToolResult>;
};

/* --------------------------------------------------------- schema helpers */

function obj(properties: Record<string, JsonSchema>, required: string[] = []): JsonSchema {
  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: false,
  };
}

const S = {
  taskId: {
    type: "string",
    description: "The task's id, as returned by get_overview, list_tasks or create_task.",
  } as JsonSchema,
  listRef: {
    type: "string",
    description:
      "A list, given either as its id or its exact name. Omit to leave a task unfiled (the inbox).",
  } as JsonSchema,
  date: (description: string): JsonSchema => ({
    type: "string",
    pattern: "^\\d{4}-\\d{2}-\\d{2}$",
    description,
  }),
  nullableDate: (description: string): JsonSchema => ({
    type: ["string", "null"],
    pattern: "^\\d{4}-\\d{2}-\\d{2}$",
    description: `${description} Pass null to clear it.`,
  }),
  time: (description: string): JsonSchema => ({
    type: "string",
    pattern: "^([01]\\d|2[0-3]):[0-5]\\d$",
    description,
  }),
  repeat: {
    type: ["object", "null"],
    description:
      'How the task recurs. Daily: {"type":"daily","interval":1}. Weekly: {"type":"weekly","weekdays":[1,3,5]} where 0 is Sunday. Monthly: {"type":"monthly","dayOfMonth":15}. Pass null to stop it repeating.',
    properties: {
      type: { type: "string", enum: ["daily", "weekly", "monthly"] },
      interval: { type: "integer", minimum: 1, maximum: 365 },
      weekdays: { type: "array", items: { type: "integer", minimum: 0, maximum: 6 }, maxItems: 7 },
      dayOfMonth: { type: "integer", minimum: 1, maximum: 31 },
    },
    required: ["type"],
    additionalProperties: false,
  } as JsonSchema,
};

/* -------------------------------------------------------------- utilities */

function requireWrite(ctx: McpContext, what: string): void {
  if (!canWrite(ctx)) {
    throw new ToolFail(
      `This connection is read-only, so it cannot ${what}. Create a key with write access in Kairo under Settings → Connections.`
    );
  }
}

async function mustFindTask(ctx: McpContext, scope: Scope, args: Args): Promise<WithId<Document>> {
  const id = reqString(args, "taskId", 64);
  const doc = await findTask(ctx, scope, id);
  if (!doc) {
    throw new ToolFail(
      `No task with id ${id}. It may have been deleted, or it may live in a PIN-locked list this connection cannot see.`
    );
  }
  return doc;
}

async function mustFindList(scope: Scope, args: Args, key = "listId"): Promise<ObjectId> {
  const ref = reqString(args, key, 120);
  const resolved = resolveListRef(scope, ref);
  if (!resolved.ok) throw new ToolFail(resolved.error);
  if (!resolved.id) throw new ToolFail(`${key} is required.`);
  return resolved.id;
}

/** Every task field a model may set, validated by the app's own sanitiser. */
function patchFromArgs(args: Args, opts: { creating: boolean }): Record<string, unknown> {
  const body: Record<string, unknown> = {};

  const title = opts.creating ? reqString(args, "title") : optString(args, "title");
  if (title !== undefined) body.title = title;

  const note = nullableString(args, "note", 10000);
  if (note !== undefined) body.note = note ?? "";

  const plannedFor = nullableDate(args, "plannedFor");
  if (plannedFor !== undefined) body.plannedFor = plannedFor;

  const plannedTime = nullableTime(args, "plannedTime");
  if (plannedTime !== undefined) body.plannedTime = plannedTime;

  const dueDate = nullableDate(args, "dueDate");
  if (dueDate !== undefined) body.dueDate = dueDate;

  const estimateMin = nullableInt(args, "estimateMin", 0, 24 * 60);
  if (estimateMin !== undefined) body.estimateMin = estimateMin;

  const spotlight = optBool(args, "spotlight");
  if (spotlight !== undefined) body.spotlight = spotlight;

  const status = optEnum(args, "status", TASK_STATUSES);
  if (status !== undefined) body.status = status;

  if ("repeat" in args && args.repeat !== undefined) {
    const repeat = sanitizeRepeat(args.repeat);
    if (repeat === undefined) {
      throw new ToolFail(
        'repeat must be null, or {"type":"daily","interval":N}, {"type":"weekly","weekdays":[0-6]}, or {"type":"monthly","dayOfMonth":1-31}.'
      );
    }
    body.repeat = repeat;
  }

  return body;
}

/**
 * Spotlight holds three, and a connection is not allowed to hold a fourth. The
 * cap is the feature: "everything is a must-win" is the state the app exists
 * to prevent, and an assistant told to "make these important" would walk
 * straight into it.
 */
async function guardSpotlight(
  ctx: McpContext,
  scope: Scope,
  adding: number,
  excludeIds: ObjectId[] = []
): Promise<void> {
  if (adding <= 0) return;
  const tasks = await tasksCollection();
  const held = await tasks.countDocuments({
    ...taskScopeFilter(ctx, scope),
    spotlight: true,
    status: { $ne: "done" },
    ...(excludeIds.length > 0 ? { _id: { $nin: excludeIds } } : {}),
  });
  if (held + adding > SPOTLIGHT_MAX) {
    throw new ToolFail(
      `Spotlight holds ${SPOTLIGHT_MAX} — that's the point. ${held} ${held === 1 ? "is" : "are"} already spotlit; drop one first, or plan the rest as ordinary tasks for the day.`
    );
  }
}

function stepsFromTitles(titles: string[]): Subtask[] {
  return titles
    .map((t) => t.trim())
    .filter(Boolean)
    .map((title) => ({ id: randomUUID(), title: title.slice(0, 500), done: false }));
}

function shapeMany(docs: WithId<Document>[], scope: Scope) {
  return docs.map((d) => shapeTask(toTask(d), scope));
}

/* -------------------------------------------------------------- the tools */

const whoami: Tool = {
  name: "whoami",
  title: "Who is connected",
  description:
    "The Kairo account this connection acts as, today's date in the user's own time zone, what the key is allowed to do, and how much of Kairo is in scope. Call this first when you need today's date — never assume it from your own clock.",
  inputSchema: obj({}),
  write: false,
  annotations: { readOnlyHint: true },
  run: async (ctx, scope) => {
    const tasks = await tasksCollection();
    const filter = taskScopeFilter(ctx, scope);
    const [open, plannedToday, done] = await Promise.all([
      tasks.countDocuments({ ...filter, status: { $in: ["inbox", "planned", "someday"] } }),
      tasks.countDocuments({ ...filter, status: "planned", plannedFor: ctx.today }),
      tasks.countDocuments({ ...filter, status: "done" }),
    ]);
    return json({
      account: { name: ctx.name, email: ctx.email },
      connection: {
        name: ctx.keyName,
        scope: ctx.scope,
        lockedListsVisible: ctx.includeLocked,
        hiddenLockedLists: scope.hiddenIds.length,
      },
      today: ctx.today,
      weekday: weekdayName(ctx.today),
      localTime: ctx.clock,
      timezone: ctx.timezone,
      plan: { access: ctx.accessReason, trialDaysLeft: ctx.trialDaysLeft },
      counts: { openTasks: open, plannedToday, completedEver: done, lists: scope.visible.length },
    });
  },
};

const getOverview: Tool = {
  name: "get_overview",
  title: "The day at a glance",
  description:
    "Everything needed to talk about a day: what is spotlit, what is planned, what is still in progress, what carried over from before and needs a decision, what is due soon, what is waiting in the inbox, what has already been finished today, and how full the day looks. This is the right first call for 'plan my day', 'what's on today' or 'how am I doing'.",
  inputSchema: obj({
    date: S.date("The day to look at, YYYY-MM-DD. Defaults to today in the user's time zone."),
  }),
  write: false,
  annotations: { readOnlyHint: true },
  run: async (ctx, scope, args) => {
    const date = optDate(args, "date") ?? ctx.today;
    const tasks = await tasksCollection();
    const filter = taskScopeFilter(ctx, scope);
    const isToday = date === ctx.today;

    const [live, doneThatDay] = await Promise.all([
      tasks
        .find({ ...filter, status: { $in: ["inbox", "planned", "someday"] } })
        .sort({ order: 1, createdAt: 1 })
        .limit(1000)
        .toArray(),
      // Finished ON that day, not planned for it — an inbox task ticked off
      // this afternoon belongs in today's wins, and the app's own "Done today"
      // counts it by completedAt for exactly that reason. The boundaries are
      // the user's own midnights, not the server's.
      tasks
        .find({
          ...filter,
          status: "done",
          completedAt: {
            $gte: new Date(epochIn(date, "00:00", ctx.timezone)),
            $lt: new Date(epochIn(addDaysStr(date, 1), "00:00", ctx.timezone)),
          },
        })
        .sort({ completedAt: -1 })
        .limit(100)
        .toArray(),
    ]);

    const all = live.map(toTask);
    const shaped = (list: Task[]) => list.map((t) => shapeTask(t, scope));

    const planned = all.filter((t) => t.status === "planned" && t.plannedFor === date);
    const spotlight = all.filter((t) => t.spotlight);
    const inProgress = all.filter((t) => t.startedAt);

    // Carried over: a plan made for a day that has passed. Repeating tasks are
    // excluded on purpose — a daily habit missed yesterday has an obvious
    // answer, and asking about it would be nagging.
    const needsDecision = isToday
      ? all.filter((t) => t.status === "planned" && t.plannedFor && t.plannedFor < date && !t.repeat)
      : [];

    // Repeating tasks whose day has passed are shown where the rule puts them,
    // without writing anything: a read must not quietly move someone's plan.
    const recurringDue = isToday
      ? all
          .filter((t) => t.repeat && t.status === "planned" && t.plannedFor && t.plannedFor < date)
          .map((t) => ({ ...shapeTask(t, scope), nextOccurrence: projectedNext(t, date) }))
      : [];

    const soonCutoff = addDaysStr(date, 7);
    const dueSoon = all.filter(
      (t) => t.dueDate && t.dueDate >= date && t.dueDate <= soonCutoff && t.status !== "done"
    );
    const inbox = all.filter((t) => t.status === "inbox");
    const someday = all.filter((t) => t.status === "someday");

    const load = planned.reduce((sum, t) => sum + (t.estimateMin ?? 0), 0);
    const unestimated = planned.filter((t) => t.estimateMin === null).length;

    return json({
      date,
      weekday: weekdayName(date),
      isToday,
      localTime: isToday ? ctx.clock : undefined,
      timezone: ctx.timezone,
      spotlight: shaped(spotlight),
      planned: shaped(planned),
      inProgress: shaped(inProgress),
      needsDecision: shaped(needsDecision),
      recurringDue,
      dueSoon: shaped(dueSoon),
      inbox: { count: inbox.length, tasks: shaped(inbox.slice(0, 25)) },
      someday: { count: someday.length },
      finishedOnTheDay: shapeMany(doneThatDay, scope),
      capacity: {
        plannedMinutes: load,
        plannedLabel: load > 0 ? fmtMinutes(load) : "nothing estimated yet",
        softCapMinutes: DAY_CAPACITY_MIN,
        overCapacity: load > DAY_CAPACITY_MIN,
        tasksWithoutEstimate: unestimated,
      },
      lists: scope.visible.map((l) => shapeList(l, ctx)),
      hiddenLockedLists: scope.hiddenIds.length,
    });
  },
};

/** Local-day arithmetic on the string itself — no Date, so no zone to get wrong. */
function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

const listTasks: Tool = {
  name: "list_tasks",
  title: "Find tasks",
  description:
    "Search and filter tasks. Every filter is optional and they combine. Completed tasks are excluded unless includeDone is true — use get_log for history.",
  inputSchema: obj({
    status: {
      type: "array",
      items: { type: "string", enum: [...TASK_STATUSES] },
      description:
        "Which states to include. 'inbox' is captured but unplanned, 'planned' has a day, 'someday' is parked, 'done' is finished.",
    },
    plannedOn: S.date("Only tasks planned for this exact day."),
    plannedFrom: S.date("Only tasks planned on or after this day."),
    plannedTo: S.date("Only tasks planned on or before this day."),
    dueBefore: S.date("Only tasks with a real deadline on or before this day."),
    listId: S.listRef,
    spotlight: { type: "boolean", description: "Only today's must-wins." },
    inProgress: { type: "boolean", description: "Only tasks that have been started." },
    search: { type: "string", description: "Case-insensitive text match on title and note." },
    includeDone: { type: "boolean", description: "Include completed tasks. Default false." },
    limit: { type: "integer", minimum: 1, maximum: 200, description: "Default 50." },
  }),
  write: false,
  annotations: { readOnlyHint: true },
  run: async (ctx, scope, args) => {
    const filter: Document = { ...taskScopeFilter(ctx, scope) };

    const statuses = optStringArray(args, "status", 4, 20);
    const includeDone = optBool(args, "includeDone") ?? false;
    if (statuses && statuses.length > 0) {
      for (const s of statuses) {
        if (!TASK_STATUSES.includes(s as Task["status"])) {
          throw new ToolFail(`status entries must be one of: ${TASK_STATUSES.join(", ")}.`);
        }
      }
      filter.status = { $in: statuses };
    } else if (!includeDone) {
      filter.status = { $ne: "done" };
    }

    const on = optDate(args, "plannedOn");
    const from = optDate(args, "plannedFrom");
    const to = optDate(args, "plannedTo");
    if (on) filter.plannedFor = on;
    else if (from || to) {
      filter.plannedFor = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    }

    const dueBefore = optDate(args, "dueBefore");
    if (dueBefore) filter.dueDate = { $ne: null, $lte: dueBefore };

    const listRef = optString(args, "listId", 120);
    if (listRef) {
      const resolved = resolveListRef(scope, listRef);
      if (!resolved.ok) throw new ToolFail(resolved.error);
      filter.listId = resolved.id;
    }

    if (optBool(args, "spotlight")) filter.spotlight = true;
    if (optBool(args, "inProgress")) filter.startedAt = { $ne: null };

    const search = optString(args, "search", 200);
    if (search && search.trim()) {
      const re = new RegExp(escapeRegExp(search.trim()), "i");
      filter.$and = [...((filter.$and as Document[]) ?? []), { $or: [{ title: re }, { note: re }] }];
    }

    const limit = optInt(args, "limit", 1, 200) ?? 50;
    const tasks = await tasksCollection();
    const docs = await tasks
      .find(filter)
      .sort({ plannedFor: 1, order: 1, createdAt: 1 })
      .limit(limit)
      .toArray();

    return json({
      count: docs.length,
      truncated: docs.length === limit,
      tasks: shapeMany(docs, scope),
    });
  },
};

const getTask: Tool = {
  name: "get_task",
  title: "Read one task",
  description: "One task in full, including its steps, its list, and anyone it is shared with.",
  inputSchema: obj({ taskId: S.taskId }, ["taskId"]),
  write: false,
  annotations: { readOnlyHint: true },
  run: async (ctx, scope, args) => {
    const doc = await mustFindTask(ctx, scope, args);
    const task = toTask(doc);
    const memberIds = Array.isArray(doc.memberIds) ? (doc.memberIds as ObjectId[]) : [];
    const people = await peopleByIds([doc.userId as ObjectId, ...memberIds]);
    return json({
      task: shapeTask(task, scope, { full: true }),
      owner: people.find((p) => p.id === task.ownerId) ?? null,
      sharedWith: people.filter((p) => p.id !== task.ownerId),
      nextOccurrence: projectedNext(task, ctx.today),
    });
  },
};

const listLists: Tool = {
  name: "list_lists",
  title: "The user's lists",
  description:
    "Every list the user can reach, with how many open tasks each holds. PIN-locked lists are omitted unless this connection was created with access to them.",
  inputSchema: obj({
    includeMembers: {
      type: "boolean",
      description: "Also return who each shared list is shared with, with their ids.",
    },
  }),
  write: false,
  annotations: { readOnlyHint: true },
  run: async (ctx, scope, args) => {
    const tasks = await tasksCollection();
    const counts = await tasks
      .aggregate<{ _id: ObjectId | null; n: number }>([
        { $match: { ...taskScopeFilter(ctx, scope), status: { $ne: "done" } } },
        { $group: { _id: "$listId", n: { $sum: 1 } } },
      ])
      .toArray();
    const byList = new Map(counts.map((c) => [c._id ? c._id.toHexString() : "", c.n]));

    const withMembers = optBool(args, "includeMembers") ?? false;
    const shaped = await Promise.all(
      scope.visible.map(async (doc) => {
        const base = shapeList(doc, ctx);
        base.openTasks = byList.get(base.id) ?? 0;
        if (!withMembers) return base;
        const memberIds = Array.isArray(doc.memberIds) ? (doc.memberIds as ObjectId[]) : [];
        if (memberIds.length === 0) return base;
        const people = await peopleByIds([doc.userId as ObjectId, ...memberIds]);
        return { ...base, members: people };
      })
    );

    return json({
      lists: shaped,
      unfiledOpenTasks: byList.get("") ?? 0,
      hiddenLockedLists: scope.hiddenIds.length,
    });
  },
};

const getLog: Tool = {
  name: "get_log",
  title: "What got done",
  description:
    "Finished work, newest first — the evidence trail, not a scoreboard. Use it to answer 'what did I get done this week'.",
  inputSchema: obj({
    from: S.date("Only work completed on or after this day."),
    to: S.date("Only work completed on or before this day."),
    limit: { type: "integer", minimum: 1, maximum: 300, description: "Default 100." },
  }),
  write: false,
  annotations: { readOnlyHint: true },
  run: async (ctx, scope, args) => {
    const filter: Document = { ...taskScopeFilter(ctx, scope), status: "done" };
    const from = optDate(args, "from");
    const to = optDate(args, "to");
    if (from || to) {
      // completedAt is an instant; the boundaries are the user's own midnights
      const range: Document = {};
      if (from) range.$gte = new Date(epochIn(from, "00:00", ctx.timezone));
      if (to) range.$lt = new Date(epochIn(addDaysStr(to, 1), "00:00", ctx.timezone));
      filter.completedAt = range;
    }
    const limit = optInt(args, "limit", 1, 300) ?? 100;
    const tasks = await tasksCollection();
    const docs = await tasks.find(filter).sort({ completedAt: -1 }).limit(limit).toArray();
    const shaped = docs.map((d) => shapeTask(toTask(d), scope));
    const minutes = shaped.reduce((sum, t) => sum + (t.estimateMin ?? 0), 0);
    return json({
      count: shaped.length,
      truncated: shaped.length === limit,
      estimatedMinutes: minutes,
      tasks: shaped,
    });
  },
};

const createTask: Tool = {
  name: "create_task",
  title: "Add a task",
  description:
    "Capture one task. A planned day is a promise to yourself, not a deadline — set plannedFor for when you intend to do it, and dueDate only when something genuinely expires on that date. Leave plannedFor out and it waits in the inbox.",
  inputSchema: obj(
    {
      title: { type: "string", maxLength: 500, description: "What the task is. Required." },
      note: { type: "string", maxLength: 10000, description: "Longer detail, optional." },
      plannedFor: S.date("The day you intend to do it, YYYY-MM-DD."),
      plannedTime: S.time("A time of day on the planned day, 24-hour, e.g. 18:30."),
      dueDate: S.date("A real external deadline. Rare — most tasks do not have one."),
      listId: S.listRef,
      estimateMin: {
        type: "integer",
        minimum: 0,
        maximum: 1440,
        description: "Rough size in minutes. Feeds the day's capacity meter.",
      },
      spotlight: {
        type: "boolean",
        description: `Mark as one of the day's must-wins. At most ${SPOTLIGHT_MAX} at a time.`,
      },
      status: {
        type: "string",
        enum: ["inbox", "planned", "someday"],
        description: "Defaults to 'planned' when plannedFor is set, otherwise 'inbox'.",
      },
      repeat: S.repeat,
      steps: {
        type: "array",
        items: { type: "string", maxLength: 500 },
        maxItems: 100,
        description: "Sub-steps to create with the task, in order.",
      },
    },
    ["title"]
  ),
  write: true,
  run: async (ctx, scope, args) => {
    requireWrite(ctx, "create tasks");
    const body = patchFromArgs(args, { creating: true });

    const listResolved = resolveListRef(scope, optString(args, "listId", 120));
    if (!listResolved.ok) throw new ToolFail(listResolved.error);

    const stepTitles = optStringArray(args, "steps", 100);
    const subtasks = stepTitles ? stepsFromTitles(stepTitles) : [];
    if (subtasks.length > 0) body.subtasks = subtasks;

    const patch = sanitizeTaskPatch(body);
    if (!patch || !patch.title) throw new ToolFail("A task needs a title.");

    if (patch.spotlight) await guardSpotlight(ctx, scope, 1);

    const now = new Date();
    const status = patch.status ?? (patch.plannedFor ? "planned" : "inbox");
    if (status === "done") throw new ToolFail("Create the task, then complete it with complete_task.");

    const doc = {
      userId: ctx.userId,
      title: patch.title,
      note: patch.note ?? "",
      status,
      plannedFor: patch.plannedFor ?? null,
      plannedTime: patch.plannedFor ? (patch.plannedTime ?? null) : null,
      dueDate: patch.dueDate ?? null,
      spotlight: patch.spotlight ?? false,
      listId: listResolved.id,
      estimateMin: patch.estimateMin ?? null,
      order: now.getTime(),
      carryCount: 0,
      repeat: patch.repeat ?? null,
      reminderAt: null,
      assigneeId: null,
      instanceOf: null,
      memberIds: [] as ObjectId[],
      subtasks: patch.subtasks ?? [],
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const tasks = await tasksCollection();
    const result = await tasks.insertOne(doc);
    const saved = toTask({ ...doc, _id: result.insertedId });
    return json({ created: shapeTask(saved, scope) });
  },
};

const updateTask: Tool = {
  name: "update_task",
  title: "Change a task",
  description:
    "Edit any field of an existing task. Only the fields you pass are changed; pass null to clear plannedFor, plannedTime, dueDate, estimateMin, note or repeat. To finish a task use complete_task instead — it handles repeating tasks correctly.",
  inputSchema: obj(
    {
      taskId: S.taskId,
      title: { type: "string", maxLength: 500 },
      note: { type: ["string", "null"], maxLength: 10000 },
      plannedFor: S.nullableDate("The day you intend to do it."),
      plannedTime: {
        type: ["string", "null"],
        pattern: "^([01]\\d|2[0-3]):[0-5]\\d$",
        description: "A time on the planned day, 24-hour. Pass null to clear it.",
      },
      dueDate: S.nullableDate("A real external deadline."),
      listId: {
        type: ["string", "null"],
        description: "Move to a list, by id or exact name. Pass null to move it out of any list.",
      },
      estimateMin: { type: ["integer", "null"], minimum: 0, maximum: 1440 },
      spotlight: { type: "boolean", description: `At most ${SPOTLIGHT_MAX} at a time.` },
      status: { type: "string", enum: ["inbox", "planned", "someday"] },
      repeat: S.repeat,
    },
    ["taskId"]
  ),
  write: true,
  run: async (ctx, scope, args) => {
    requireWrite(ctx, "change tasks");
    const doc = await mustFindTask(ctx, scope, args);
    const body = patchFromArgs(args, { creating: false });

    if (body.status === "done") {
      throw new ToolFail("Use complete_task to finish something — it advances repeating tasks and logs the win.");
    }

    if ("listId" in args && args.listId !== undefined) {
      const resolved = resolveListRef(scope, args.listId as string | null);
      if (!resolved.ok) throw new ToolFail(resolved.error);
      body.listId = resolved.id ? resolved.id.toHexString() : null;
    }

    const patch = sanitizeTaskPatch(body);
    if (!patch || Object.keys(patch).length === 0) {
      throw new ToolFail("Nothing to change — pass at least one field besides taskId.");
    }
    if (patch.spotlight === true && !doc.spotlight) {
      await guardSpotlight(ctx, scope, 1, [doc._id]);
    }

    // Un-completing has rules of its own: a finished copy of a repeating task
    // has to rejoin its series rather than come back as a repeat-less twin.
    if (patch.status && patch.status !== "done" && doc.status === "done" && doc.instanceOf) {
      const rejoined = await uncompleteTaskOp(ctx, scope, doc);
      return json({
        updated: shapeTask(rejoined.task, scope),
        rejoinedSeries: rejoined.rejoinedSeries,
      });
    }

    const tasks = await tasksCollection();
    const updated = await tasks.findOneAndUpdate(
      { _id: doc._id, ...taskScopeFilter(ctx, scope) },
      buildTaskUpdate(patch),
      { returnDocument: "after" }
    );
    if (!updated) throw new ToolFail("That task is no longer available.");
    return json({ updated: shapeTask(toTask(updated), scope) });
  },
};

const completeTask: Tool = {
  name: "complete_task",
  title: "Mark something done",
  description:
    "Finish a task. A repeating task leaves a finished copy in the log and moves on to its next occurrence — the reply says which day that is.",
  inputSchema: obj({ taskId: S.taskId }, ["taskId"]),
  write: true,
  run: async (ctx, scope, args) => {
    requireWrite(ctx, "complete tasks");
    const doc = await mustFindTask(ctx, scope, args);
    if (doc.status === "done") {
      return text(`"${String(doc.title)}" was already done.`);
    }
    const outcome = await completeTaskOp(ctx, doc);
    if (outcome.nextOccurrence) {
      return json({
        completed: String(doc.title),
        repeating: true,
        nextOccurrence: outcome.nextOccurrence,
        nextOccurrenceLabel: friendlyDay(outcome.nextOccurrence, ctx.today),
        series: shapeTask(outcome.task, scope),
      });
    }
    return json({ completed: shapeTask(outcome.task, scope) });
  },
};

const uncompleteTask: Tool = {
  name: "uncomplete_task",
  title: "Put something back",
  description:
    "Undo a completion. A finished copy of a repeating task rejoins its series rather than coming back as a duplicate.",
  inputSchema: obj({ taskId: S.taskId }, ["taskId"]),
  write: true,
  run: async (ctx, scope, args) => {
    requireWrite(ctx, "reopen tasks");
    const doc = await mustFindTask(ctx, scope, args);
    if (doc.status !== "done") return text(`"${String(doc.title)}" is not marked done.`);
    const outcome = await uncompleteTaskOp(ctx, scope, doc);
    return json({
      reopened: shapeTask(outcome.task, scope),
      ...(outcome.rejoinedSeries ? { rejoinedSeries: outcome.rejoinedSeries } : {}),
    });
  },
};

const deleteTask: Tool = {
  name: "delete_task",
  title: "Let a task go",
  description:
    "Delete a task for good. Letting go is a win, not a failure — but it cannot be undone, so prefer moving it to 'someday' when the user is only unsure. On a task that was shared with the user by someone else, this removes them from it rather than deleting the owner's copy.",
  inputSchema: obj({ taskId: S.taskId }, ["taskId"]),
  write: true,
  annotations: { destructiveHint: true },
  run: async (ctx, scope, args) => {
    requireWrite(ctx, "delete tasks");
    const doc = await mustFindTask(ctx, scope, args);
    const tasks = await tasksCollection();

    // Calendar-guest semantics: someone who can see this task ONLY because it
    // was shared with them leaves it, rather than deleting the owner's copy.
    const isOwner = (doc.userId as ObjectId).equals(ctx.userId);
    const viaList = doc.listId != null && scope.visibleIds.some((l) => l.equals(doc.listId as ObjectId));
    if (!isOwner && !viaList) {
      await tasks.updateOne({ _id: doc._id }, { $pull: { memberIds: ctx.userId } as never });
      return text(`Left "${String(doc.title)}" — it stays with its owner.`);
    }

    await cancelReminder(ctx, doc._id);
    await tasks.deleteOne({ _id: doc._id });
    return text(`Let go: "${String(doc.title)}". One less thing.`);
  },
};

const duplicateTask: Tool = {
  name: "duplicate_task",
  title: "Copy a task",
  description:
    "A fresh copy of a task, sitting next to the original. Copies what describes the work — title, note, steps, list, estimate, day, deadline, repeat — and drops what records progress: steps come back unticked, nothing is started, spotlight and assignee are not copied.",
  inputSchema: obj({ taskId: S.taskId }, ["taskId"]),
  write: true,
  run: async (ctx, scope, args) => {
    requireWrite(ctx, "duplicate tasks");
    const doc = await mustFindTask(ctx, scope, args);
    const src = toTask(doc);
    const now = new Date();
    const copy = {
      userId: ctx.userId,
      title: src.title,
      note: src.note,
      status: src.plannedFor ? "planned" : src.status === "done" ? "inbox" : src.status,
      plannedFor: src.plannedFor,
      plannedTime: src.plannedTime,
      dueDate: src.dueDate,
      spotlight: false,
      listId: src.listId ? new ObjectId(src.listId) : null,
      estimateMin: src.estimateMin,
      // +1 keeps the copy adjacent to the original instead of at the end
      order: src.order + 1,
      carryCount: 0,
      repeat: src.repeat,
      reminderAt: null,
      assigneeId: null,
      instanceOf: null,
      memberIds: [] as ObjectId[],
      subtasks: src.subtasks.map((s) => ({
        id: randomUUID(),
        title: s.title,
        done: false,
        plannedFor: s.plannedFor ?? null,
      })),
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const tasks = await tasksCollection();
    const result = await tasks.insertOne(copy);
    return json({ created: shapeTask(toTask({ ...copy, _id: result.insertedId }), scope) });
  },
};

const startTask: Tool = {
  name: "start_task",
  title: "Start working on something",
  description:
    "Mark a task as being worked on right now. Only one task can be in progress at a time — starting this one stops whatever else was running, because you can only actually be doing one thing.",
  inputSchema: obj({ taskId: S.taskId }, ["taskId"]),
  write: true,
  run: async (ctx, scope, args) => {
    requireWrite(ctx, "start tasks");
    const doc = await mustFindTask(ctx, scope, args);
    if (doc.status === "done") throw new ToolFail("That task is already done.");
    const tasks = await tasksCollection();
    const now = new Date();
    const stopped = await tasks.updateMany(
      { ...taskScopeFilter(ctx, scope), startedAt: { $ne: null }, _id: { $ne: doc._id } },
      { $set: { startedAt: null, updatedAt: now } }
    );
    const updated = await tasks.findOneAndUpdate(
      { _id: doc._id },
      { $set: { startedAt: now, updatedAt: now } },
      { returnDocument: "after" }
    );
    return json({
      started: shapeTask(toTask(updated ?? doc), scope),
      alsoStopped: stopped.modifiedCount,
    });
  },
};

const stopTask: Tool = {
  name: "stop_task",
  title: "Stop working",
  description:
    "Clear the in-progress mark. Pass a taskId for a specific task, or nothing to stop whatever is currently running. This does not complete anything.",
  inputSchema: obj({ taskId: { ...S.taskId, description: "Optional — defaults to whatever is running." } }),
  write: true,
  run: async (ctx, scope, args) => {
    requireWrite(ctx, "stop tasks");
    const tasks = await tasksCollection();
    const now = new Date();
    const id = optString(args, "taskId", 64);
    if (id) {
      const doc = await mustFindTask(ctx, scope, { taskId: id });
      await tasks.updateOne({ _id: doc._id }, { $set: { startedAt: null, updatedAt: now } });
      return text(`Stopped "${String(doc.title)}".`);
    }
    const result = await tasks.updateMany(
      { ...taskScopeFilter(ctx, scope), startedAt: { $ne: null } },
      { $set: { startedAt: null, updatedAt: now } }
    );
    return text(result.modifiedCount === 0 ? "Nothing was running." : `Stopped ${result.modifiedCount} task(s).`);
  },
};

const planDay: Tool = {
  name: "plan_day",
  title: "Plan a day",
  description:
    "Put a set of existing tasks onto one day, optionally with times, estimates and up to three spotlit must-wins. Also un-plans anything listed in unplan, sending it back to the inbox. Use create_task first for anything that does not exist yet. The tasks you list keep the order you give them and are added after whatever is already on that day; the reply returns the day's full running order.",
  inputSchema: obj(
    {
      date: S.date("The day being planned. Defaults to today in the user's time zone."),
      plan: {
        type: "array",
        maxItems: 100,
        description: "Tasks to place on the day, in the order they should appear.",
        items: obj(
          {
            taskId: S.taskId,
            time: S.time("Optional time of day, 24-hour."),
            estimateMin: { type: "integer", minimum: 0, maximum: 1440 },
            spotlight: { type: "boolean" },
          },
          ["taskId"]
        ),
      },
      unplan: {
        type: "array",
        items: { type: "string" },
        maxItems: 100,
        description: "Task ids to take off the day and return to the inbox.",
      },
    },
    []
  ),
  write: true,
  run: async (ctx, scope, args) => {
    requireWrite(ctx, "plan days");
    const date = optDate(args, "date") ?? ctx.today;
    const plan = optObjectArray(args, "plan", 100) ?? [];
    const unplanIds = optStringArray(args, "unplan", 100) ?? [];
    if (plan.length === 0 && unplanIds.length === 0) {
      throw new ToolFail("Pass plan, unplan, or both.");
    }

    const tasks = await tasksCollection();
    const access = taskScopeFilter(ctx, scope);
    const ops: AnyBulkWriteOperation[] = [];
    const base = Date.now();

    // Spotlight is capped across the whole day, not per call: three requests
    // asking for two each must not add up to six.
    const spotlightIds: ObjectId[] = [];
    const touched: ObjectId[] = [];

    for (const [i, entry] of plan.entries()) {
      const taskId = reqString(entry, "taskId", 64);
      if (!ObjectId.isValid(taskId)) throw new ToolFail(`plan[${i}].taskId is not a task id.`);
      const _id = new ObjectId(taskId);
      touched.push(_id);

      const set: Document = {
        plannedFor: date,
        status: "planned",
        order: base + i,
        completedAt: null,
        updatedAt: new Date(),
      };
      const time = optTime(entry, "time");
      if (time !== undefined) set.plannedTime = time;
      const estimate = optInt(entry, "estimateMin", 0, 24 * 60);
      if (estimate !== undefined) set.estimateMin = estimate;
      const spot = optBool(entry, "spotlight");
      if (spot !== undefined) {
        set.spotlight = spot;
        if (spot) spotlightIds.push(_id);
      }
      ops.push({ updateOne: { filter: { _id, ...access }, update: { $set: set } } });
    }

    if (spotlightIds.length > SPOTLIGHT_MAX) {
      throw new ToolFail(
        `Spotlight holds ${SPOTLIGHT_MAX} — that's the point. You asked for ${spotlightIds.length}.`
      );
    }
    if (spotlightIds.length > 0) await guardSpotlight(ctx, scope, spotlightIds.length, touched);

    for (const raw of unplanIds) {
      if (!ObjectId.isValid(raw)) throw new ToolFail(`unplan contains "${raw}", which is not a task id.`);
      ops.push({
        updateOne: {
          filter: { _id: new ObjectId(raw), ...access },
          update: {
            $set: {
              plannedFor: null,
              plannedTime: null,
              status: "inbox",
              spotlight: false,
              updatedAt: new Date(),
            },
          },
        },
      });
    }

    const result = await tasks.bulkWrite(ops);
    const matched = result.matchedCount;
    const asked = plan.length + unplanIds.length;

    const after = await tasks
      .find({ ...access, status: "planned", plannedFor: date })
      .sort({ order: 1 })
      .limit(200)
      .toArray();
    const shaped = after.map((d) => shapeTask(toTask(d), scope));
    const load = shaped.reduce((sum, t) => sum + (t.estimateMin ?? 0), 0);

    return json({
      date,
      applied: matched,
      ...(matched < asked
        ? { skipped: asked - matched, note: "Some ids were not found or are out of this connection's scope." }
        : {}),
      planned: shaped,
      capacity: {
        plannedMinutes: load,
        plannedLabel: load > 0 ? fmtMinutes(load) : "nothing estimated yet",
        overCapacity: load > DAY_CAPACITY_MIN,
      },
    });
  },
};

const SWEEP_ACTIONS = ["today", "later", "someday", "done", "letgo"] as const;

const sweepTasks: Tool = {
  name: "sweep_tasks",
  title: "Fresh Start sweep",
  description:
    "Give each task that carried over from a previous day exactly one decision. 'today' brings it to today, 'later' returns it to the inbox with no day, 'someday' parks it, 'done' marks it finished, 'letgo' deletes it. Letting go counts as a win. Get the list from get_overview's needsDecision.",
  inputSchema: obj(
    {
      decisions: {
        type: "array",
        minItems: 1,
        maxItems: 200,
        items: obj(
          {
            taskId: S.taskId,
            action: { type: "string", enum: [...SWEEP_ACTIONS] },
          },
          ["taskId", "action"]
        ),
      },
    },
    ["decisions"]
  ),
  write: true,
  annotations: { destructiveHint: true },
  run: async (ctx, scope, args) => {
    requireWrite(ctx, "sweep tasks");
    const decisions = optObjectArray(args, "decisions", 200) ?? [];
    if (decisions.length === 0) throw new ToolFail("decisions must hold at least one entry.");

    const tasks = await tasksCollection();
    const access = taskScopeFilter(ctx, scope);
    const ids = decisions.map((d, i) => {
      const raw = reqString(d, "taskId", 64);
      if (!ObjectId.isValid(raw)) throw new ToolFail(`decisions[${i}].taskId is not a task id.`);
      return new ObjectId(raw);
    });
    const docs = await tasks.find({ _id: { $in: ids }, ...access }).toArray();
    const byId = new Map(docs.map((d) => [d._id.toHexString(), d]));

    const summary = { today: 0, later: 0, someday: 0, done: 0, letgo: 0, skipped: 0 };
    const ops: AnyBulkWriteOperation[] = [];
    const now = new Date();

    for (const decision of decisions) {
      const action = reqEnum(decision, "action", SWEEP_ACTIONS);
      const doc = byId.get(String(decision.taskId));
      if (!doc) {
        summary.skipped++;
        continue;
      }
      const task = toTask(doc);

      // A repeating task is never deleted or parked by the sweep — its rule
      // simply moves it on. "done" logs the win properly, the rest skip today.
      if (task.repeat) {
        if (action === "done") {
          await completeTaskOp(ctx, doc);
          summary.done++;
          continue;
        }
        const next = projectedNext(task, ctx.today) ?? ctx.today;
        ops.push({
          updateOne: {
            filter: { _id: doc._id, ...access },
            update: {
              $set: { plannedFor: next, spotlight: false, carryCount: 0, updatedAt: now },
            },
          },
        });
        summary[action]++;
        continue;
      }

      if (action === "letgo") {
        await cancelReminder(ctx, doc._id);
        ops.push({ deleteOne: { filter: { _id: doc._id, ...access } } });
        summary.letgo++;
        continue;
      }
      if (action === "done") {
        await completeTaskOp(ctx, doc);
        summary.done++;
        continue;
      }

      const set: Document = { updatedAt: now };
      if (action === "today") {
        set.plannedFor = ctx.today;
        set.status = "planned";
        // the carry counter is the gentle nudge: after three, break it down
        set.carryCount = task.carryCount + 1;
      } else if (action === "later") {
        set.plannedFor = null;
        set.plannedTime = null;
        set.status = "inbox";
        set.spotlight = false;
      } else {
        set.plannedFor = null;
        set.plannedTime = null;
        set.status = "someday";
        set.spotlight = false;
      }
      ops.push({ updateOne: { filter: { _id: doc._id, ...access }, update: { $set: set } } });
      summary[action]++;
    }

    if (ops.length > 0) await tasks.bulkWrite(ops);
    return json({ swept: decisions.length - summary.skipped, ...summary });
  },
};

const STEP_ACTIONS = ["add", "complete", "uncomplete", "remove", "replace"] as const;

const manageSteps: Tool = {
  name: "manage_steps",
  title: "Steps inside a task",
  description:
    "Break a task into steps, or tick them off. 'add' appends new steps, 'replace' swaps the whole checklist, and 'complete', 'uncomplete' and 'remove' act on the step ids returned by get_task.",
  inputSchema: obj(
    {
      taskId: S.taskId,
      action: { type: "string", enum: [...STEP_ACTIONS] },
      titles: {
        type: "array",
        items: { type: "string", maxLength: 500 },
        maxItems: 100,
        description: "For 'add' and 'replace': the step text, in order.",
      },
      stepIds: {
        type: "array",
        items: { type: "string" },
        maxItems: 100,
        description: "For 'complete', 'uncomplete' and 'remove': which steps, by id.",
      },
    },
    ["taskId", "action"]
  ),
  write: true,
  run: async (ctx, scope, args) => {
    requireWrite(ctx, "change steps");
    const doc = await mustFindTask(ctx, scope, args);
    const action = reqEnum(args, "action", STEP_ACTIONS);
    const task = toTask(doc);
    let steps: Subtask[] = task.subtasks.map((s) => ({ ...s }));

    if (action === "add" || action === "replace") {
      const titles = optStringArray(args, "titles", 100);
      if (!titles || titles.length === 0) {
        throw new ToolFail(`'${action}' needs titles — an array of step text.`);
      }
      const fresh = stepsFromTitles(titles);
      if (fresh.length === 0) throw new ToolFail("Every step title was blank.");
      steps = action === "add" ? [...steps, ...fresh] : fresh;
    } else {
      const stepIds = optStringArray(args, "stepIds", 100, 100);
      if (!stepIds || stepIds.length === 0) {
        throw new ToolFail(`'${action}' needs stepIds. Call get_task to see them.`);
      }
      const wanted = new Set(stepIds);
      const known = new Set(steps.map((s) => s.id));
      const missing = stepIds.filter((id) => !known.has(id));
      if (missing.length > 0) {
        throw new ToolFail(`No step on this task with id: ${missing.join(", ")}.`);
      }
      if (action === "remove") {
        steps = steps.filter((s) => !wanted.has(s.id));
      } else {
        const done = action === "complete";
        steps = steps.map((s) =>
          wanted.has(s.id)
            ? { ...s, done, ...(done ? { doneAt: new Date().toISOString() } : { doneAt: null }) }
            : s
        );
      }
    }

    if (steps.length > 100) throw new ToolFail("A task holds at most 100 steps.");

    // Validated through the app's own sanitiser rather than trusted, so a
    // shape this code got wrong cannot reach the database.
    const patch = sanitizeTaskPatch({ subtasks: steps });
    if (!patch) throw new ToolFail("Those steps are not valid.");

    const tasks = await tasksCollection();
    const updated = await tasks.findOneAndUpdate(
      { _id: doc._id, ...taskScopeFilter(ctx, scope) },
      buildTaskUpdate(patch),
      { returnDocument: "after" }
    );
    if (!updated) throw new ToolFail("That task is no longer available.");
    return json({ task: shapeTask(toTask(updated), scope) });
  },
};

const setReminder: Tool = {
  name: "set_reminder",
  title: "Remind me",
  description:
    "Set or clear a one-off push reminder on a task, given in the user's own local time. A reminder for something already finished never fires. Reminders can be up to 30 days ahead, and the user needs notifications enabled in Kairo for one to arrive.",
  inputSchema: obj(
    {
      taskId: S.taskId,
      date: S.date("The local day to fire on."),
      time: S.time("The local time to fire at, 24-hour."),
      clear: { type: "boolean", description: "Pass true to remove the existing reminder." },
    },
    ["taskId"]
  ),
  write: true,
  run: async (ctx, scope, args) => {
    requireWrite(ctx, "set reminders");
    const doc = await mustFindTask(ctx, scope, args);
    const tasks = await tasksCollection();

    if (optBool(args, "clear")) {
      await tasks.updateOne({ _id: doc._id }, { $set: { reminderAt: null, updatedAt: new Date() } });
      await cancelReminder(ctx, doc._id);
      return text(`Reminder cleared on "${String(doc.title)}".`);
    }

    const date = optDate(args, "date");
    const time = optTime(args, "time");
    if (!date || !time) throw new ToolFail("Pass both date and time, or clear: true.");
    if (doc.status === "done") throw new ToolFail("That task is already done — it needs no reminder.");

    const fireAt = epochIn(date, time, ctx.timezone);
    const now = Date.now();
    if (fireAt <= now) {
      throw new ToolFail(
        `${date} ${time} is in the past for this user (their local time is ${ctx.clock} on ${ctx.today}).`
      );
    }
    if (fireAt > now + MAX_REMINDER_AHEAD_MS) {
      throw new ToolFail("Reminders can be set at most 30 days ahead.");
    }

    await tasks.updateOne({ _id: doc._id }, { $set: { reminderAt: fireAt, updatedAt: new Date() } });

    // Same shape the app schedules, so one reminder per task and a reschedule
    // replaces rather than stacks.
    const tag = `remind-${doc._id.toHexString()}`;
    const scheduled = await scheduledCollection();
    await scheduled.deleteMany({ userId: ctx.userId, tag });
    await scheduled.insertOne({
      userId: ctx.userId,
      fireAt,
      title: String(doc.title ?? "Reminder"),
      body: "You asked to be nudged about this now.",
      tag,
      taskId: doc._id,
      url: "/today",
      createdAt: new Date(),
    });
    ensureTicker();
    armPrecise(fireAt);
    void processDuePushes().catch(() => {});

    return json({
      task: String(doc.title),
      remindAt: new Date(fireAt).toISOString(),
      localTime: `${date} ${time} (${ctx.timezone})`,
    });
  },
};

/* ------------------------------------------------------------------ lists */

const createList: Tool = {
  name: "create_list",
  title: "Make a list",
  description: "Create a list to file tasks under — a project, a place, a person, a context.",
  inputSchema: obj(
    {
      name: { type: "string", maxLength: 100 },
      emoji: { type: "string", maxLength: 24, description: "A single emoji. Optional." },
    },
    ["name"]
  ),
  write: true,
  run: async (ctx, scope, args) => {
    requireWrite(ctx, "create lists");
    const name = reqString(args, "name", 100).trim();
    const emoji = optString(args, "emoji", 24) ?? "list-folder";
    const now = new Date();
    const doc = {
      userId: ctx.userId,
      name,
      emoji,
      order: now.getTime(),
      memberIds: [] as ObjectId[],
      createdAt: now,
    };
    const lists = await listsCollection();
    const result = await lists.insertOne(doc);
    return json({ created: shapeList({ ...doc, _id: result.insertedId }, ctx) });
  },
};

const updateList: Tool = {
  name: "update_list",
  title: "Rename a list",
  description: "Change a list's name or emoji. Only its owner can.",
  inputSchema: obj(
    {
      listId: S.listRef,
      name: { type: "string", maxLength: 100 },
      emoji: { type: "string", maxLength: 24 },
    },
    ["listId"]
  ),
  write: true,
  run: async (ctx, scope, args) => {
    requireWrite(ctx, "rename lists");
    const listId = await mustFindList(scope, args);
    const set: Record<string, unknown> = {};
    const name = optString(args, "name", 100);
    if (name !== undefined) {
      if (!name.trim()) throw new ToolFail("A list needs a name.");
      set.name = name.trim();
    }
    const emoji = optString(args, "emoji", 24);
    if (emoji !== undefined) set.emoji = emoji;
    if (Object.keys(set).length === 0) throw new ToolFail("Pass a name or an emoji to change.");

    const lists = await listsCollection();
    const updated = await lists.findOneAndUpdate(
      { _id: listId, userId: ctx.userId },
      { $set: set },
      { returnDocument: "after" }
    );
    if (!updated) throw new ToolFail("Only the owner of a list can rename it.");
    return json({ updated: shapeList(updated, ctx) });
  },
};

const deleteList: Tool = {
  name: "delete_list",
  title: "Delete a list",
  description:
    "Delete a list. The tasks inside are NOT deleted — they fall back to their creators' inboxes. Only the owner can delete a list.",
  inputSchema: obj({ listId: S.listRef }, ["listId"]),
  write: true,
  annotations: { destructiveHint: true },
  run: async (ctx, scope, args) => {
    requireWrite(ctx, "delete lists");
    const listId = await mustFindList(scope, args);
    const lists = await listsCollection();
    const result = await lists.deleteOne({ _id: listId, userId: ctx.userId });
    if (result.deletedCount === 0) throw new ToolFail("Only the owner of a list can delete it.");
    const tasks = await tasksCollection();
    const freed = await tasks.updateMany({ listId }, { $set: { listId: null } });
    return text(
      `List deleted. ${freed.modifiedCount} task(s) went back to the inbox — nothing was lost.`
    );
  },
};

/* ---------------------------------------------------------------- sharing */

const shareListTool: Tool = {
  name: "share_list",
  title: "Share a list",
  description:
    "Invite someone to a list by email — you both then see and edit the same tasks. If they have no Kairo account, an invitation with a sign-in link is emailed and their membership waits for them. Only the owner can share.",
  inputSchema: obj({ listId: S.listRef, email: { type: "string" } }, ["listId", "email"]),
  write: true,
  annotations: { openWorldHint: true },
  run: async (ctx, scope, args) => {
    requireWrite(ctx, "share lists");
    const listId = await mustFindList(scope, args);
    const email = reqEmail(args, "email");
    const result = await shareList(ctx, listId, email);
    return text(
      result.invited
        ? `Invitation sent to ${result.email}. They join the list as soon as they sign in.`
        : `${result.name || result.email} is now on the list, and has been told.`
    );
  },
};

const shareTaskTool: Tool = {
  name: "share_task",
  title: "Share one task",
  description:
    "Add someone to a single task, calendar-guest style: one live task you both see, edit and complete together. Use send_task_copy instead to hand over an independent copy.",
  inputSchema: obj({ taskId: S.taskId, email: { type: "string" } }, ["taskId", "email"]),
  write: true,
  annotations: { openWorldHint: true },
  run: async (ctx, scope, args) => {
    requireWrite(ctx, "share tasks");
    const doc = await mustFindTask(ctx, scope, args);
    const email = reqEmail(args, "email");
    const result = await shareTask(ctx, doc, email);
    return text(
      result.invited
        ? `Invitation sent to ${result.email}. They see the task as soon as they sign in.`
        : `${result.name || result.email} is now on "${String(doc.title)}", and has been told.`
    );
  },
};

const unshareTool: Tool = {
  name: "unshare",
  title: "Remove someone",
  description:
    "Take a person off a shared list or task. The owner can remove anyone; anyone can remove themselves. Get member ids from list_lists with includeMembers, or from get_task.",
  inputSchema: obj(
    {
      target: { type: "string", enum: ["list", "task"] },
      id: { type: "string", description: "The list id or task id." },
      memberId: { type: "string", description: "The person's user id." },
    },
    ["target", "id", "memberId"]
  ),
  write: true,
  run: async (ctx, scope, args) => {
    requireWrite(ctx, "change sharing");
    const target = reqEnum(args, "target", ["list", "task"] as const);
    const rawId = reqString(args, "id", 64);
    const rawMember = reqString(args, "memberId", 64);
    if (!ObjectId.isValid(rawId)) throw new ToolFail("id is not valid.");
    if (!ObjectId.isValid(rawMember)) throw new ToolFail("memberId is not valid.");

    if (target === "list") {
      const inScope = scope.visible.some((l) => l._id.toHexString() === rawId);
      if (!inScope) throw new ToolFail("No such list in this connection's scope.");
    } else {
      await mustFindTask(ctx, scope, { taskId: rawId });
    }

    await unshare(ctx, target, new ObjectId(rawId), new ObjectId(rawMember));
    return text("Removed.");
  },
};

const sendTaskCopyTool: Tool = {
  name: "send_task_copy",
  title: "Hand a task over",
  description:
    "Send someone an independent copy of a task — a handoff, not a shared item. The day, time, estimate, deadline, repeat and steps travel with it; progress does not, and the steps arrive unticked.",
  inputSchema: obj({ taskId: S.taskId, email: { type: "string" } }, ["taskId", "email"]),
  write: true,
  annotations: { openWorldHint: true },
  run: async (ctx, scope, args) => {
    requireWrite(ctx, "send tasks");
    const doc = await mustFindTask(ctx, scope, args);
    const email = reqEmail(args, "email");
    const result = await sendTaskCopy(ctx, doc, email);
    return text(`Copy sent to ${result.to}.`);
  },
};

const assignTaskTool: Tool = {
  name: "assign_task",
  title: "Assign work",
  description:
    "Give a task in a shared list to one of that list's members, or clear the assignment. The person must already be on the list.",
  inputSchema: obj(
    {
      taskId: S.taskId,
      email: { type: "string", description: "The member's email. Omit along with assigneeId to unassign." },
      assigneeId: { type: "string", description: "The member's user id, if you have it." },
    },
    ["taskId"]
  ),
  write: true,
  run: async (ctx, scope, args) => {
    requireWrite(ctx, "assign tasks");
    const doc = await mustFindTask(ctx, scope, args);

    let assignee: ObjectId | null = null;
    const idArg = optString(args, "assigneeId", 64);
    const emailArg = optString(args, "email", 320);
    if (idArg) {
      if (!ObjectId.isValid(idArg)) throw new ToolFail("assigneeId is not valid.");
      assignee = new ObjectId(idArg);
    } else if (emailArg) {
      const person = await findPersonByEmail(emailArg);
      if (!person) {
        throw new ToolFail(
          `No Kairo account for ${emailArg}. Share the list with them first — that sends an invitation.`
        );
      }
      assignee = person._id;
    }

    const result = await assignTask(ctx, scope, doc, assignee);
    return json({
      task: shapeTask(result.task, scope),
      assignedTo: assignee ? assignee.toHexString() : null,
      notified: result.notified,
    });
  },
};

/* --------------------------------------------------------------- registry */

export const TOOLS: Tool[] = [
  whoami,
  getOverview,
  listTasks,
  getTask,
  listLists,
  getLog,
  createTask,
  updateTask,
  completeTask,
  uncompleteTask,
  deleteTask,
  duplicateTask,
  startTask,
  stopTask,
  planDay,
  sweepTasks,
  manageSteps,
  setReminder,
  createList,
  updateList,
  deleteList,
  shareListTool,
  shareTaskTool,
  unshareTool,
  sendTaskCopyTool,
  assignTaskTool,
];

const BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

export function findTool(name: string): Tool | undefined {
  return BY_NAME.get(name);
}

/**
 * The tool list a given connection may see.
 *
 * A read-only key is shown only the tools it can actually call: offering a
 * model a "delete_task" it will always be refused wastes a turn and reads, to
 * the person watching, like the assistant failing.
 */
export function toolsFor(ctx: McpContext) {
  return TOOLS.filter((t) => (canWrite(ctx) ? true : !t.write)).map((t) => ({
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema: t.inputSchema,
    ...(t.annotations ? { annotations: { title: t.title, ...t.annotations } } : {}),
  }));
}

export async function runTool(
  ctx: McpContext,
  name: string,
  args: Args
): Promise<ToolResult> {
  const tool = findTool(name);
  if (!tool) throw new ToolFail(`No tool called "${name}".`);
  const scope = await loadScope(ctx);
  return tool.run(ctx, scope, args);
}

export { loadScope };
export type { Scope };
