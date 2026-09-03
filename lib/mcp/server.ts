import { ToolFail } from "./fail";
import {
  ErrorCode,
  fail,
  isNotification,
  negotiateVersion,
  ok,
  toolError,
  type RpcRequest,
  type RpcResponse,
} from "./protocol";
import { runTool, toolsFor } from "./tools";
import type { McpContext } from "./context";

export const SERVER_NAME = "kairo";
export const SERVER_TITLE = "Kairo";
export const SERVER_VERSION = "1.0.0";

/**
 * What the model is told about Kairo before it touches anything.
 *
 * This is the whole product philosophy compressed to the part that changes
 * behaviour. Without it an assistant does what every other task tool has
 * taught it to do — pile on deadlines, mark everything urgent, and treat an
 * unfinished day as a failure — which is precisely what Kairo exists to stop.
 */
export const INSTRUCTIONS = `Kairo is a daily planner built on one rule: a to-do list should never make someone feel bad. Hold to these when you act on it.

A planned day is not a deadline. \`plannedFor\` is a promise the user made to themselves and may freely move; \`dueDate\` is a real external deadline and is rare. Do not invent deadlines. If the user says "do this Tuesday", that is plannedFor, not dueDate.

Spotlight holds three. At most three tasks a day are must-wins, and the cap is enforced. Win those and the day is won; do not try to make everything important.

Nothing rots. Work that carried over from a previous day gets one decision each through sweep_tasks: today, later, someday, done, or let go. Letting something go is a win, not a failure, and it is worth offering. Never present carried-over work as overdue, late, or a backlog.

Capacity is a suggestion. The day's estimated minutes are shown against a soft six-hour cap. If a day is overfull, say so once and offer to move something — never refuse to plan it.

Repeating tasks look after themselves. Completing one logs a finished copy and advances the series; you do not need to recreate it. A missed occurrence simply moves on.

Dates are the user's local dates. Call whoami or get_overview for today's date in their zone — never assume it from your own clock. All dates are "YYYY-MM-DD" and all times are 24-hour "HH:MM", both local to the user.

Read before writing. get_overview answers "what's on today", "plan my day" and "how am I doing" in one call. When the user says they finished something, find it with list_tasks and call complete_task rather than creating a new done task.

Be brief about it. The user asked for their day, not a report on the API.`;

type Handler = (ctx: McpContext, params: Record<string, unknown>) => Promise<unknown>;

const METHODS: Record<string, Handler> = {
  initialize: async (ctx, params) => ({
    protocolVersion: negotiateVersion(params.protocolVersion),
    capabilities: {
      // listChanged is false: the tool set is fixed at deploy time, and a
      // server that claims it can notify must actually hold a stream open.
      tools: { listChanged: false },
    },
    serverInfo: { name: SERVER_NAME, title: SERVER_TITLE, version: SERVER_VERSION },
    instructions: INSTRUCTIONS,
  }),

  ping: async () => ({}),

  "tools/list": async (ctx) => ({ tools: toolsFor(ctx) }),

  "tools/call": async (ctx, params) => {
    const name = params.name;
    if (typeof name !== "string" || !name) {
      throw new ToolFail("tools/call needs a tool name.");
    }
    const rawArgs = params.arguments;
    if (rawArgs !== undefined && (typeof rawArgs !== "object" || rawArgs === null || Array.isArray(rawArgs))) {
      throw new ToolFail("arguments must be an object.");
    }
    return runTool(ctx, name, (rawArgs as Record<string, unknown>) ?? {});
  },

  // Not advertised in capabilities, but answered anyway: a few clients probe
  // for them regardless, and an empty list is a friendlier reply than an error
  // some of them render as a failed connection.
  "resources/list": async () => ({ resources: [] }),
  "resources/templates/list": async () => ({ resourceTemplates: [] }),
  "prompts/list": async () => ({ prompts: [] }),
  "logging/setLevel": async () => ({}),
};

/**
 * One JSON-RPC message in, at most one response out.
 *
 * A tool that fails comes back as a successful RPC carrying `isError` — the
 * model has to be able to read what went wrong and try again. Only a broken
 * envelope or an unknown method becomes a JSON-RPC error.
 */
export async function handleMessage(
  ctx: McpContext,
  msg: RpcRequest
): Promise<RpcResponse | null> {
  const id = msg.id ?? null;
  const handler = METHODS[msg.method];

  if (!handler) {
    // Notifications are fire-and-forget, including ones we do not implement.
    if (isNotification(msg)) return null;
    return fail(id, ErrorCode.MethodNotFound, `Unknown method: ${msg.method}`);
  }

  try {
    const result = await handler(ctx, msg.params ?? {});
    if (isNotification(msg)) return null;
    return ok(id, result);
  } catch (err) {
    if (isNotification(msg)) return null;
    if (err instanceof ToolFail) {
      // A tool-shaped failure inside tools/call is a result, not an error.
      if (msg.method === "tools/call") return ok(id, toolError(err.message));
      return fail(id, ErrorCode.InvalidParams, err.message);
    }
    console.error(`[mcp] ${msg.method} failed`, err);
    if (msg.method === "tools/call") {
      return ok(
        id,
        toolError("Kairo could not complete that just now. Try again in a moment.")
      );
    }
    return fail(id, ErrorCode.InternalError, "Internal error");
  }
}
