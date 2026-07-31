import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { taskSentEmail } from "@/lib/email-templates";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest, notFound } from "@/lib/api-auth";
import { tasksCollection, taskAccessFilter } from "@/lib/tasks";
import { getDb } from "@/lib/db";

/** Sends a COPY of a task to another user's inbox — a handoff, not a live share. */
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
  await tasks.insertOne({
    userId: recipient._id,
    title: task.title,
    note: task.note ? `${attribution}\n${task.note}` : attribution,
    status: "inbox",
    plannedFor: null,
    dueDate: task.dueDate ?? null,
    spotlight: false,
    listId: null,
    estimateMin: task.estimateMin ?? null,
    order: now.getTime(),
    carryCount: 0,
    repeat: null,
    reminderAt: null,
    subtasks: Array.isArray(task.subtasks)
      ? task.subtasks.map((s: { id: string; title: string }) => ({
          id: s.id,
          title: s.title,
          done: false,
          plannedFor: null,
        }))
      : [],
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  {
    const mail = taskSentEmail({ senderName: session.name, taskTitle: String(task.title) });
    void sendEmail({
      key: `sent:${id}:${recipient._id.toHexString()}`,
      to: String(recipient.email),
      ...mail,
    }).catch((err) => console.error("[email] task-sent failed", err));
  }

  return NextResponse.json({ ok: true, to: recipient.name || recipient.email });
}
