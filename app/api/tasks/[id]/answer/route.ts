import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest, notFound } from "@/lib/api-auth";
import { tasksCollection, taskAccessFilter, toTask } from "@/lib/tasks";
import { AGENT_ANSWER_MAX, toAgentRun } from "@/lib/agent-run";

/**
 * Answering the question an agent stopped to ask.
 *
 * The one part of a run that comes from the person rather than the machine,
 * which is why it has a route of its own: the ordinary task patch route
 * refuses to touch anything under `agent`, so nothing an agent reports can be
 * written by anything but the agent, and the answer by anything but you.
 */

export async function POST(request: Request, ctx: RouteContext<"/api/tasks/[id]/answer">) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return badRequest("Invalid task id");

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const answer = typeof body.answer === "string" ? body.answer.trim().replace(/\s+/g, " ").slice(0, AGENT_ANSWER_MAX) : "";
  if (!answer) return badRequest("An answer is required");

  const userId = new ObjectId(session.userId);
  const tasks = await tasksCollection();
  const existing = await tasks.findOne({ _id: new ObjectId(id), ...(await taskAccessFilter(userId)) });
  if (!existing) return notFound();

  const run = toAgentRun(existing.agent);
  if (!run?.question) return badRequest("Nothing is being asked on that task");

  const updated = await tasks.findOneAndUpdate(
    { _id: existing._id },
    { $set: { "agent.answer": answer, "agent.at": new Date(), updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  return NextResponse.json({ task: toTask(updated ?? existing) });
}
