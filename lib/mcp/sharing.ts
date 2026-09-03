import { ObjectId, type Document, type WithId } from "mongodb";
import { getDb } from "../db";
import { listsCollection, tasksCollection, toTask } from "../tasks";
import { sendEmail } from "../email";
import { listSharedEmail, taskSharedEmail, taskSentEmail, taskAssignedEmail } from "../email-templates";
import { inviteUserByEmail } from "../invites";
import { sendToUser } from "../push";
import type { DbUser } from "../users";
import { ToolFail } from "./fail";
import type { McpContext } from "./context";
import { taskScopeFilter, type Scope } from "./data";

/**
 * Sharing, from a connection rather than a browser.
 *
 * These do exactly what the /api/lists/[id]/share and /api/tasks/[id]/share
 * routes do, including the emails: a share that reaches nobody is not a share,
 * and a recipient who learns about it only when they next open Kairo is worse
 * off than one who got a message. The invite path is rate limited to one email
 * per address per day inside inviteUserByEmail, which is what stops an
 * assistant with a long list of addresses from becoming an email cannon.
 */

async function findOrInvite(
  ctx: McpContext,
  email: string,
  invite: { kind: "task" | "list"; itemName: string; when?: string | null }
): Promise<{ user: DbUser; invited: boolean }> {
  const db = await getDb();
  const found = await db.collection<DbUser>("users").findOne({ email });
  if (found && !found.pending) return { user: found, invited: false };

  const result = await inviteUserByEmail({
    email,
    inviterId: ctx.userIdHex,
    inviterName: ctx.name,
    invite,
  });
  if (!result.ok) throw new ToolFail(result.error);
  return { user: result.user, invited: true };
}

/** "4 September at 18:00" for an invite email, from the task's own plan. */
function whenOf(task: Document, today: string): string | null {
  if (typeof task.plannedFor !== "string" || task.plannedFor < today) return null;
  const day = new Date(`${task.plannedFor}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  return `${day}${task.plannedTime ? ` at ${String(task.plannedTime)}` : ""}`;
}

export async function shareList(
  ctx: McpContext,
  listId: ObjectId,
  email: string
): Promise<{ name: string; email: string; invited: boolean }> {
  if (email === ctx.email.toLowerCase()) throw new ToolFail("That is your own address.");

  // ownership is settled before any email leaves the building
  const lists = await listsCollection();
  const owned = await lists.findOne({ _id: listId, userId: ctx.userId });
  if (!owned) throw new ToolFail("Only the owner of a list can share it.");

  const { user: recipient, invited } = await findOrInvite(ctx, email, {
    kind: "list",
    itemName: String(owned.name),
  });

  await lists.updateOne({ _id: listId, userId: ctx.userId }, { $addToSet: { memberIds: recipient._id } });

  if (!invited) {
    const mail = listSharedEmail({
      inviterName: ctx.name,
      listName: String(owned.name),
      recipientName: String(recipient.name ?? ""),
    });
    void sendEmail({
      key: `share:${listId.toHexString()}:${recipient._id.toHexString()}`,
      to: String(recipient.email),
      ...mail,
    }).catch((err: unknown) => console.error("[mcp] list share email failed", err));
  }

  return { name: String(recipient.name ?? ""), email: String(recipient.email), invited };
}

export async function shareTask(
  ctx: McpContext,
  doc: WithId<Document>,
  email: string
): Promise<{ name: string; email: string; invited: boolean }> {
  if (email === ctx.email.toLowerCase()) throw new ToolFail("That is your own address.");

  const when = whenOf(doc, ctx.today);
  const { user: recipient, invited } = await findOrInvite(ctx, email, {
    kind: "task",
    itemName: String(doc.title),
    when,
  });
  if (recipient._id.equals(doc.userId as ObjectId)) {
    throw new ToolFail("They already own this task.");
  }

  const tasks = await tasksCollection();
  await tasks.updateOne(
    { _id: doc._id },
    { $addToSet: { memberIds: recipient._id }, $set: { updatedAt: new Date() } }
  );

  if (!invited) {
    const mail = taskSharedEmail({
      sharerName: ctx.name,
      taskTitle: String(doc.title),
      when,
      recipientName: String(recipient.name ?? ""),
    });
    void sendEmail({
      key: `taskshare:${doc._id.toHexString()}:${recipient._id.toHexString()}`,
      to: String(recipient.email),
      ...mail,
    }).catch((err: unknown) => console.error("[mcp] task share email failed", err));
    void sendToUser(recipient._id, {
      title: `${ctx.name} added you to a task`,
      body: String(doc.title ?? "A task"),
      tag: `taskshare-${doc._id.toHexString()}`,
      url: "/today",
    });
  }

  return { name: String(recipient.name ?? ""), email: String(recipient.email), invited };
}

/**
 * Removing a person. The owner can remove anyone; anyone can remove
 * themselves. Same rule the app applies, and the only rule that lets someone
 * walk away from a list they were added to without asking permission.
 */
export async function unshare(
  ctx: McpContext,
  target: "list" | "task",
  id: ObjectId,
  memberId: ObjectId
): Promise<void> {
  if (target === "list") {
    const lists = await listsCollection();
    const list = await lists.findOne({ _id: id });
    if (!list) throw new ToolFail("No such list.");
    const isOwner = (list.userId as ObjectId).equals(ctx.userId);
    if (!isOwner && !memberId.equals(ctx.userId)) {
      throw new ToolFail("Only the list's owner can remove someone else.");
    }
    await lists.updateOne({ _id: id }, { $pull: { memberIds: memberId } as never });
    return;
  }

  const tasks = await tasksCollection();
  const task = await tasks.findOne({ _id: id });
  if (!task) throw new ToolFail("No such task.");
  const isOwner = (task.userId as ObjectId).equals(ctx.userId);
  if (!isOwner && !memberId.equals(ctx.userId)) {
    throw new ToolFail("Only the task's owner can remove someone else.");
  }
  await tasks.updateOne(
    { _id: id },
    { $pull: { memberIds: memberId } as never, $set: { updatedAt: new Date() } }
  );
}

/**
 * A copy, handed over. Everything that describes the work travels — the day,
 * the time, the estimate, the steps — and nothing that records progress on the
 * original does. Mirrors /api/tasks/[id]/send exactly.
 */
export async function sendTaskCopy(
  ctx: McpContext,
  doc: WithId<Document>,
  email: string
): Promise<{ to: string }> {
  if (email === ctx.email.toLowerCase()) throw new ToolFail("That is your own address.");

  const now = new Date();
  // a plan in the past is stale, not a gift — those copies arrive in the inbox
  const plannedFor =
    typeof doc.plannedFor === "string" && doc.plannedFor >= ctx.today ? doc.plannedFor : null;
  const when = plannedFor ? whenOf({ ...doc, plannedFor }, ctx.today) : null;

  const { user: recipient, invited } = await findOrInvite(ctx, email, {
    kind: "task",
    itemName: String(doc.title),
    when,
  });

  const attribution = `↪ from ${ctx.name}`;
  const note = typeof doc.note === "string" && doc.note ? `${attribution}\n${doc.note}` : attribution;
  const tasks = await tasksCollection();
  await tasks.insertOne({
    userId: recipient._id,
    title: doc.title,
    note,
    status: plannedFor ? "planned" : doc.status === "someday" ? "someday" : "inbox",
    plannedFor,
    plannedTime: plannedFor ? (doc.plannedTime ?? null) : null,
    dueDate: doc.dueDate ?? null,
    spotlight: false,
    listId: null,
    estimateMin: doc.estimateMin ?? null,
    order: now.getTime(),
    carryCount: 0,
    repeat: doc.repeat ?? null,
    reminderAt: null,
    assigneeId: null,
    subtasks: Array.isArray(doc.subtasks)
      ? (doc.subtasks as { id: string; title: string; plannedFor?: string | null }[]).map((s) => ({
          id: s.id,
          title: s.title,
          done: false,
          plannedFor: typeof s.plannedFor === "string" && s.plannedFor >= ctx.today ? s.plannedFor : null,
        }))
      : [],
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  if (!invited) {
    const mail = taskSentEmail({
      senderName: ctx.name,
      taskTitle: String(doc.title),
      when,
      recipientName: String(recipient.name ?? ""),
    });
    void sendEmail({
      key: `sent:${doc._id.toHexString()}:${recipient._id.toHexString()}`,
      to: String(recipient.email),
      ...mail,
    }).catch((err: unknown) => console.error("[mcp] task send email failed", err));
  }

  return { to: String(recipient.name || recipient.email) };
}

/**
 * Assigning inside a shared list. Assignment is only meaningful to someone who
 * can actually see the task, so the target must already be on the list — the
 * same check PATCH /api/tasks/[id] makes.
 */
export async function assignTask(
  ctx: McpContext,
  scope: Scope,
  doc: WithId<Document>,
  assignee: ObjectId | null
): Promise<{ task: ReturnType<typeof toTask>; notified: string | null }> {
  const tasks = await tasksCollection();
  const now = new Date();

  if (assignee === null) {
    const cleared = await tasks.findOneAndUpdate(
      { _id: doc._id, ...taskScopeFilter(ctx, scope) },
      { $set: { assigneeId: null, updatedAt: now } },
      { returnDocument: "after" }
    );
    if (!cleared) throw new ToolFail("That task is no longer available.");
    return { task: toTask(cleared), notified: null };
  }

  const listId = (doc.listId as ObjectId | null) ?? null;
  if (!listId) throw new ToolFail("Assigning only works inside a shared list. Move the task into one first.");

  const lists = await listsCollection();
  const list = await lists.findOne({ _id: listId });
  if (!list) throw new ToolFail("That task's list has gone.");

  const roster = new Set<string>([
    (list.userId as ObjectId).toHexString(),
    ...(Array.isArray(list.memberIds) ? (list.memberIds as ObjectId[]) : []).map((m) => m.toHexString()),
  ]);
  if (!roster.has(ctx.userIdHex)) throw new ToolFail("You are not on that list.");
  if (!roster.has(assignee.toHexString())) {
    throw new ToolFail("That person is not on this list. Share the list with them first.");
  }

  const previous = doc.assigneeId ? (doc.assigneeId as ObjectId).toHexString() : null;
  const updated = await tasks.findOneAndUpdate(
    { _id: doc._id, ...taskScopeFilter(ctx, scope) },
    { $set: { assigneeId: assignee, updatedAt: now } },
    { returnDocument: "after" }
  );
  if (!updated) throw new ToolFail("That task is no longer available.");

  // Telling someone is the point of assigning, but not when the assignee is
  // you, and not when nothing changed.
  let notified: string | null = null;
  if (assignee.toHexString() !== previous && !assignee.equals(ctx.userId)) {
    const db = await getDb();
    const person = await db.collection<DbUser>("users").findOne({ _id: assignee });
    if (person?.email) {
      notified = String(person.email);
      const where = String(list.name ?? "a shared list");
      void sendToUser(assignee, {
        title: `${ctx.name} sent this your way`,
        body: `${String(updated.title ?? "A task")} · in ${where}`,
        tag: `assign-${doc._id.toHexString()}`,
        url: "/today",
      });
      const mail = taskAssignedEmail({
        assignerName: ctx.name,
        taskTitle: String(updated.title ?? "A task"),
        listName: where,
        recipientName: String(person.name ?? ""),
      });
      void sendEmail({
        key: `assign:${doc._id.toHexString()}:${assignee.toHexString()}`,
        to: String(person.email),
        ...mail,
      }).catch((err: unknown) => console.error("[mcp] assignment email failed", err));
    }
  }

  return { task: toTask(updated), notified };
}

/** Resolves an email to an account that already exists — never creates one. */
export async function findPersonByEmail(email: string): Promise<DbUser | null> {
  const db = await getDb();
  return db.collection<DbUser>("users").findOne({ email: email.trim().toLowerCase() });
}
