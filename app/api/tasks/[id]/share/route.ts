import { NextResponse } from "next/server";
import { ObjectId, type Document } from "mongodb";
import { requireSession, unauthorized, badRequest, notFound } from "@/lib/api-auth";
import { tasksCollection, taskAccessFilter, toTask } from "@/lib/tasks";
import { getDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { taskSharedEmail } from "@/lib/email-templates";
import { inviteUserByEmail } from "@/lib/invites";
import { sendToUser } from "@/lib/push";
import { resolveAvatar } from "@/lib/avatars";
import type { DbUser } from "@/lib/users";

/**
 * People on a task, calendar-guest style: ONE live task that everyone named
 * on it sees, edits, and completes together. The counterpart to
 * /api/tasks/[id]/send, which hands over an independent copy.
 *
 * Anyone who can see the task can add people to it, the way calendar guests
 * can invite others. Removal is stricter: the owner can remove anyone, and
 * everyone can remove themselves.
 */

type PersonInfo = { id: string; name: string; email: string; picture?: string; role: "owner" | "member" };

/** "1 August at 20:00" for the invite email, from the task's own plan. */
function whenOf(task: Document): string | null {
  const today = new Date().toLocaleDateString("en-CA");
  if (typeof task.plannedFor !== "string" || task.plannedFor < today) return null;
  const day = new Date(task.plannedFor + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
  });
  return `${day}${task.plannedTime ? ` at ${String(task.plannedTime)}` : ""}`;
}

export async function GET(_request: Request, ctx: RouteContext<"/api/tasks/[id]/share">) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return badRequest("Invalid task id");

  const tasks = await tasksCollection();
  const task = await tasks.findOne({
    _id: new ObjectId(id),
    ...(await taskAccessFilter(new ObjectId(session.userId))),
  });
  if (!task) return notFound();

  const memberIds = Array.isArray(task.memberIds) ? (task.memberIds as ObjectId[]) : [];
  const db = await getDb();
  const users = await db
    .collection("users")
    .find({ _id: { $in: [task.userId as ObjectId, ...memberIds] } })
    .project({ name: 1, email: 1, picture: 1, avatarChoice: 1 })
    .toArray();

  const people: PersonInfo[] = users.map((u) => ({
    id: u._id.toHexString(),
    name: String(u.name ?? ""),
    email: String(u.email ?? ""),
    picture: resolveAvatar(
      typeof u.avatarChoice === "string" ? u.avatarChoice : undefined,
      typeof u.picture === "string" ? u.picture : undefined
    ),
    role: u._id.equals(task.userId as ObjectId) ? "owner" : "member",
  }));

  return NextResponse.json({ people });
}

export async function POST(request: Request, ctx: RouteContext<"/api/tasks/[id]/share">) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return badRequest("Invalid task id");

  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  if (typeof body.email !== "string" || !body.email.includes("@")) {
    return badRequest("A valid email is required");
  }
  const email = body.email.trim().toLowerCase();
  if (email === session.email.toLowerCase()) return badRequest("That's you already");

  // access is settled before any email leaves the building
  const userId = new ObjectId(session.userId);
  const tasks = await tasksCollection();
  const task = await tasks.findOne({ _id: new ObjectId(id), ...(await taskAccessFilter(userId)) });
  if (!task) return notFound();

  const when = whenOf(task);
  const db = await getDb();
  const found = await db.collection<DbUser>("users").findOne({ email });

  // No account, or an invited one never opened: the invite email with its
  // magic sign-in link IS the notification, and it goes out first — if the
  // address refuses it, nobody is added to anything.
  let recipient = found;
  let invited = false;
  if (!recipient || recipient.pending) {
    const invite = await inviteUserByEmail({
      email,
      inviterId: session.userId,
      inviterName: session.name,
      invite: { kind: "task", itemName: String(task.title), when },
    });
    if (!invite.ok) return badRequest(invite.error);
    recipient = invite.user;
    invited = true;
  }

  if (recipient._id.equals(task.userId as ObjectId)) {
    return badRequest("They already own this task");
  }

  const updated = await tasks.findOneAndUpdate(
    { _id: task._id },
    { $addToSet: { memberIds: recipient._id }, $set: { updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!updated) return notFound();

  // keyed per task+person: re-adding someone removed tells them again, a
  // double-click does not
  if (!invited) {
    const mail = taskSharedEmail({
      sharerName: session.name,
      taskTitle: String(task.title),
      when,
      recipientName: String(recipient.name ?? ""),
    });
    void sendEmail({
      key: `taskshare:${id}:${recipient._id.toHexString()}`,
      to: String(recipient.email),
      ...mail,
    }).catch((err) => console.error("[email] task share failed", err));
    void sendToUser(recipient._id, {
      title: `${session.name} added you to a task`,
      body: String(task.title ?? "A task"),
      tag: `taskshare-${id}`,
      url: "/today",
    });
  }

  return NextResponse.json({
    task: toTask(updated),
    person: { id: recipient._id.toHexString(), name: recipient.name, email: recipient.email },
  });
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/tasks/[id]/share">) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return badRequest("Invalid task id");

  let body: { memberId?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  if (typeof body.memberId !== "string" || !ObjectId.isValid(body.memberId)) {
    return badRequest("memberId required");
  }

  const me = new ObjectId(session.userId);
  const target = new ObjectId(body.memberId);
  const tasks = await tasksCollection();
  const task = await tasks.findOne({ _id: new ObjectId(id), ...(await taskAccessFilter(me)) });
  if (!task) return notFound();

  const isOwner = (task.userId as ObjectId).equals(me);
  const removingSelf = target.equals(me);
  if (!isOwner && !removingSelf) return unauthorized();

  const updated = await tasks.findOneAndUpdate(
    { _id: task._id },
    { $pull: { memberIds: target } as never, $set: { updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!updated) return notFound();
  return NextResponse.json({ task: toTask(updated) });
}
