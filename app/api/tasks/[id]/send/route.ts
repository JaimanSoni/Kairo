import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { taskSentEmail } from "@/lib/email-templates";
import { inviteUserByEmail } from "@/lib/invites";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest, notFound } from "@/lib/api-auth";
import { tasksCollection, taskAccessFilter } from "@/lib/tasks";
import { getDb } from "@/lib/db";
import type { DbUser } from "@/lib/users";

/**
 * Sends a COPY of a task to another user — a handoff, not a live share.
 *
 * The copy keeps its shape: planned day and time, estimate, deadline, repeat
 * and steps all travel with it, because "do this at 8pm, it takes 10 minutes"
 * IS the task — a copy stripped to a bare title hands over less than was
 * meant. What never travels is the sender's progress or claims on the
 * recipient's attention: steps arrive unticked, nothing is started, spotlight
 * stays unclaimed, and reminders stay personal.
 *
 * An address with no account is not an error: the invite email goes out with
 * a magic sign-in link, and only if it lands is the account created and the
 * copy placed in it — waiting there before the recipient ever clicks.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/tasks/[id]/send">) {
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

  const tasks = await tasksCollection();
  const task = await tasks.findOne({
    _id: new ObjectId(id),
    ...(await taskAccessFilter(new ObjectId(session.userId))),
  });
  if (!task) return notFound();

  const now = new Date();
  // a plan in the past is stale, not a gift — those copies arrive in the inbox
  const today = now.toLocaleDateString("en-CA");
  const plannedFor =
    typeof task.plannedFor === "string" && task.plannedFor >= today ? task.plannedFor : null;
  const when = plannedFor
    ? `${new Date(plannedFor + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long" })}${
        task.plannedTime ? ` at ${String(task.plannedTime)}` : ""
      }`
    : null;

  const db = await getDb();
  const found = await db.collection<DbUser>("users").findOne({ email });

  // No account, or an invited one that has never been opened: the invite
  // (with its magic link) is the email for this send, and it goes out first —
  // if the address refuses it, nothing is created.
  let recipient = found;
  let invited = false;
  if (!recipient || recipient.pending) {
    const invite = await inviteUserByEmail({
      email,
      inviterId: session.userId,
      inviterName: session.name,
      emailKey: `invite-task:${id}:${email}`,
      invite: { kind: "task", itemName: String(task.title), when },
    });
    if (!invite.ok) return badRequest(invite.error);
    recipient = invite.user;
    invited = true;
  }

  const attribution = `↪ from ${session.name}`;
  await tasks.insertOne({
    userId: recipient._id,
    title: task.title,
    note: task.note ? `${attribution}\n${task.note}` : attribution,
    status: plannedFor ? "planned" : task.status === "someday" ? "someday" : "inbox",
    plannedFor,
    plannedTime: plannedFor ? (task.plannedTime ?? null) : null,
    dueDate: task.dueDate ?? null,
    spotlight: false,
    listId: null,
    estimateMin: task.estimateMin ?? null,
    order: now.getTime(),
    carryCount: 0,
    repeat: task.repeat ?? null,
    reminderAt: null,
    assigneeId: null,
    subtasks: Array.isArray(task.subtasks)
      ? task.subtasks.map((s: { id: string; title: string; plannedFor?: string | null }) => ({
          id: s.id,
          title: s.title,
          done: false,
          plannedFor: typeof s.plannedFor === "string" && s.plannedFor >= today ? s.plannedFor : null,
        }))
      : [],
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  if (!invited) {
    const mail = taskSentEmail({
      senderName: session.name,
      taskTitle: String(task.title),
      when,
      recipientName: String(recipient.name ?? ""),
    });
    void sendEmail({
      key: `sent:${id}:${recipient._id.toHexString()}`,
      to: String(recipient.email),
      ...mail,
    }).catch((err) => console.error("[email] task-sent failed", err));
  }

  return NextResponse.json({ ok: true, to: recipient.name || recipient.email });
}
