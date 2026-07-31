import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { taskSentEmail } from "@/lib/email-templates";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest, notFound } from "@/lib/api-auth";
import { tasksCollection, taskAccessFilter } from "@/lib/tasks";
import { getDb } from "@/lib/db";

/**
 * Sends a COPY of a task to another user — a handoff, not a live share.
 *
 * The copy keeps its shape: planned day and time, estimate, deadline, repeat
 * and steps all travel with it, because "do this at 8pm, it takes 10 minutes"
 * IS the task — a copy stripped to a bare title hands over less than was
 * meant. What never travels is the sender's progress or claims on the
 * recipient's attention: steps arrive unticked, nothing is started, spotlight
 * stays unclaimed, and reminders stay personal.
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

  const db = await getDb();
  const recipient = await db.collection("users").findOne({ email });
  if (!recipient) {
    return NextResponse.json(
      { error: "No Kairo account with that email — they need to sign in once first" },
      { status: 404 }
    );
  }

  const now = new Date();
  const attribution = `↪ from ${session.name}`;
  // a plan in the past is stale, not a gift — those copies arrive in the inbox
  const today = now.toLocaleDateString("en-CA");
  const plannedFor =
    typeof task.plannedFor === "string" && task.plannedFor >= today ? task.plannedFor : null;
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

  {
    const when = plannedFor
      ? `${new Date(plannedFor + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long" })}${
          task.plannedTime ? ` at ${String(task.plannedTime)}` : ""
        }`
      : null;
    const mail = taskSentEmail({ senderName: session.name, taskTitle: String(task.title), when });
    void sendEmail({
      key: `sent:${id}:${recipient._id.toHexString()}`,
      to: String(recipient.email),
      ...mail,
    }).catch((err) => console.error("[email] task-sent failed", err));
  }

  return NextResponse.json({ ok: true, to: recipient.name || recipient.email });
}
