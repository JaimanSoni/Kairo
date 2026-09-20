/**
 * Work an agent is doing on one of your tasks, and the one thing it can ask
 * you for.
 *
 * You can hand a task to something that runs on its own — a coding agent on
 * your laptop, a script, anything holding an MCP key — and then walk away
 * from the machine. This is the part that comes with you: what it's doing
 * now, whether it finished, and, when it can't go on without a decision, the
 * question itself, pushed to your phone so you can answer from there.
 *
 * Deliberately one line and one question per task, not a transcript. A task
 * you gave away should be readable in a glance on a phone; the reasoning
 * belongs in whatever is doing the work, not in your to-do list.
 *
 * None of this is written by the app's own editing routes. It arrives from
 * an MCP connection, except the answer, which only you can give.
 */

export type AgentRun = {
  /** One line on what it's doing, or what it did. */
  note: string;
  /** What it needs from you before it can go on. Null when it isn't waiting. */
  question: string | null;
  /** Your reply, once you've given one. */
  answer: string | null;
  /** Which connection is doing the work: the name on the key. */
  by: string;
  /** When it last said anything, ISO. */
  at: string;
  /** When it said its part was done, ISO, or null while it's still going. */
  finishedAt: string | null;
};

/**
 * Where a run has got to.
 *   waiting  — it asked you something and is stopped until you answer
 *   finished — it says it's done; the task itself may still be yours to check
 *   working  — anything else
 */
export type AgentState = "working" | "waiting" | "finished";

export function agentState(run: AgentRun | null | undefined): AgentState | null {
  if (!run) return null;
  if (run.question && !run.answer) return "waiting";
  if (run.finishedAt) return "finished";
  return "working";
}

export const AGENT_NOTE_MAX = 280;
export const AGENT_QUESTION_MAX = 500;
export const AGENT_ANSWER_MAX = 1000;

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/\s+/g, " ");
  return t ? t.slice(0, max) : null;
};

/** A run as it comes back out of the database. */
export function toAgentRun(raw: unknown): AgentRun | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const at = r.at instanceof Date ? r.at.toISOString() : typeof r.at === "string" ? r.at : null;
  if (!at) return null;
  const finishedAt = r.finishedAt instanceof Date ? r.finishedAt.toISOString() : typeof r.finishedAt === "string" ? r.finishedAt : null;
  return {
    note: str(r.note, AGENT_NOTE_MAX) ?? "",
    question: str(r.question, AGENT_QUESTION_MAX),
    answer: str(r.answer, AGENT_ANSWER_MAX),
    by: str(r.by, 60) ?? "An agent",
    at,
    finishedAt,
  };
}

/** How long ago, in the fewest words: "just now", "4m ago", "2h ago", "yesterday". */
export function agentWhen(at: string, now = Date.now()): string {
  const ms = now - Date.parse(at);
  if (!Number.isFinite(ms) || ms < 45_000) return "just now";
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min}m ago`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours}h ago`;
  return hours < 48 ? "yesterday" : `${Math.round(hours / 24)}d ago`;
}
