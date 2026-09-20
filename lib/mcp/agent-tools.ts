import { ObjectId } from "mongodb";
import { tasksCollection, toTask } from "../tasks";
import { sendToUser } from "../push";
import { AGENT_NOTE_MAX, AGENT_QUESTION_MAX, toAgentRun } from "../agent-run";
import type { McpContext } from "./context";
import { ToolFail } from "./fail";
import { json, text, type JsonSchema, type ToolResult } from "./protocol";
import { findTask, shapeTask, type Scope } from "./data";
import { optBool, reqString, type Args } from "./args";
import type { Tool } from "./tools";

/**
 * Working on someone's behalf while they're away from the machine.
 *
 * An agent holding a key can already read and change tasks. What it couldn't
 * do was say what it was doing, or stop and ask. These three tools are that:
 * a line of progress, a question that reaches the person's phone, and a way
 * to pick their answer up again.
 *
 * The shape is deliberately narrow. One line and one open question per task,
 * because the point is something readable at a glance on a phone, not a
 * transcript. Anything longer belongs in the agent's own logs.
 */

function obj(properties: Record<string, JsonSchema>, required: string[] = []): JsonSchema {
  return { type: "object", properties, ...(required.length > 0 ? { required } : {}), additionalProperties: false };
}

const taskIdSchema: JsonSchema = { type: "string", description: "The task's id, as returned by list_tasks or create_task." };

/** The task, or a clear refusal. Mirrors the other tools' lookup. */
async function mustFind(ctx: McpContext, scope: Scope, args: Args) {
  const id = reqString(args, "taskId", 64);
  const doc = await findTask(ctx, scope, id);
  if (!doc) throw new ToolFail("No task with that id, or it isn't one this key can reach.");
  return doc;
}

function requireWrite(ctx: McpContext) {
  if (ctx.scope !== "write") throw new ToolFail("This key is read-only, so it can't report on work or ask questions.");
}

const reportProgress: Tool = {
  name: "report_progress",
  title: "Say what you're doing",
  description:
    "Leave one line on a task saying what you're working on right now, so the person can see it on their phone without coming back to the machine. Call it when you start something that will take a while, and whenever what you're doing changes — not for every small step. Pass finished: true when your part is over; that does NOT tick the task off, it only says you're done with it, so they can look at the result. Use complete_task when the task itself is genuinely complete.",
  inputSchema: obj(
    {
      taskId: taskIdSchema,
      note: { type: "string", maxLength: AGENT_NOTE_MAX, description: "One line, plainly worded, about what is happening now. \"Rewriting the signup tests\" beats \"working\"." },
      finished: { type: "boolean", description: "True when your part is done and there is something for them to look at." },
    },
    ["taskId", "note"]
  ),
  write: true,
  run: async (ctx: McpContext, scope: Scope, args: Args): Promise<ToolResult> => {
    requireWrite(ctx);
    const doc = await mustFind(ctx, scope, args);
    const note = reqString(args, "note", AGENT_NOTE_MAX);
    const finished = optBool(args, "finished") ?? false;
    const now = new Date();
    const prev = toAgentRun(doc.agent);
    const tasks = await tasksCollection();
    const run = {
      note,
      // a question that has been answered is over; an unanswered one still stands
      question: prev?.question && !prev.answer ? prev.question : null,
      answer: prev?.question && !prev.answer ? null : null,
      by: ctx.keyName || "An agent",
      at: now,
      finishedAt: finished ? now : null,
    };
    await tasks.updateOne({ _id: doc._id }, { $set: { agent: run, updatedAt: now } });
    return text(finished ? `Noted, and marked as done with your part: "${note}"` : `Noted: "${note}"`);
  },
};

const askUser: Tool = {
  name: "ask_user",
  title: "Ask the person a question",
  description:
    "Stop and ask the person something you can't decide on your own, and push it to their phone so they can answer while away from the machine. Use it for real forks — which of two approaches, whether to spend money, permission to delete something — not for things you can reasonably choose yourself. Ask one question at a time, in full, with enough context to answer it away from the screen and without seeing your terminal. After calling this, poll get_answer until it comes back, and carry on with what they said.",
  inputSchema: obj(
    {
      taskId: taskIdSchema,
      question: { type: "string", maxLength: AGENT_QUESTION_MAX, description: "The whole question, answerable on a phone. Include the options where there are options." },
    },
    ["taskId", "question"]
  ),
  write: true,
  run: async (ctx: McpContext, scope: Scope, args: Args): Promise<ToolResult> => {
    requireWrite(ctx);
    const doc = await mustFind(ctx, scope, args);
    const question = reqString(args, "question", AGENT_QUESTION_MAX);
    const now = new Date();
    const prev = toAgentRun(doc.agent);
    const by = ctx.keyName || "An agent";
    const tasks = await tasksCollection();
    await tasks.updateOne(
      { _id: doc._id },
      { $set: { agent: { note: prev?.note ?? "", question, answer: null, by, at: now, finishedAt: null }, updatedAt: now } }
    );
    const title = String(doc.title ?? "a task");
    const sent = await sendToUser(new ObjectId(ctx.userIdHex), {
      title: `${by} needs you`,
      body: `${title} — ${question}`,
      tag: `agent-${doc._id.toHexString()}`,
      url: `/today?answer=${doc._id.toHexString()}`,
    });
    return json({
      asked: question,
      pushedToDevices: sent.delivered,
      next: sent.delivered > 0
        ? "Their phone has it. Poll get_answer until it comes back, then carry on with what they said."
        : "No device took the push, so they'll see it next time they open Kairo. Poll get_answer, and consider carrying on with whatever is safely reversible in the meantime.",
    });
  },
};

const getAnswer: Tool = {
  name: "get_answer",
  title: "Pick up their answer",
  description:
    "Fetch the answer to the question you asked with ask_user. Returns waiting: true while they haven't answered yet — sleep a little and call again rather than looping hard. Once answered, do what they said; the question is closed, so ask_user again if something else comes up.",
  inputSchema: obj({ taskId: taskIdSchema }, ["taskId"]),
  write: false,
  run: async (_ctx: McpContext, scope: Scope, args: Args): Promise<ToolResult> => {
    const doc = await mustFind(_ctx, scope, args);
    const run = toAgentRun(doc.agent);
    if (!run?.question) return json({ waiting: false, answer: null, note: "Nothing has been asked on this task." });
    if (!run.answer) return json({ waiting: true, question: run.question, answer: null, note: "Not answered yet. Sleep a few seconds and ask again." });
    return json({ waiting: false, question: run.question, answer: run.answer });
  },
};

const getAgentWork: Tool = {
  name: "list_agent_work",
  title: "What agents are doing",
  description:
    "Every task that has an agent working on it, with its latest line of progress and any question outstanding. Useful for picking up where a previous run left off, and for seeing whether something else is already on a task before you start it.",
  inputSchema: obj({}),
  write: false,
  run: async (ctx: McpContext, scope: Scope): Promise<ToolResult> => {
    const tasks = await tasksCollection();
    const docs = await tasks
      .find({ userId: new ObjectId(ctx.userIdHex), agent: { $ne: null }, status: { $ne: "done" } })
      .sort({ "agent.at": -1 })
      .limit(50)
      .toArray();
    return json({
      work: docs.map((d) => {
        const run = toAgentRun(d.agent);
        return {
          ...shapeTask(toTask(d), scope),
          agent: run && { note: run.note, question: run.question, answer: run.answer, by: run.by, at: run.at, finished: Boolean(run.finishedAt) },
        };
      }),
    });
  },
};

export const AGENT_TOOLS: Tool[] = [reportProgress, askUser, getAnswer, getAgentWork];
