import { authenticate } from "@/lib/mcp/context";
import { checkRate, CALLS_PER_MINUTE } from "@/lib/mcp/rate-limit";
import { handleMessage } from "@/lib/mcp/server";
import {
  ErrorCode,
  isRpcRequest,
  isNotification,
  JSONRPC_VERSION,
  type RpcRequest,
  type RpcResponse,
} from "@/lib/mcp/protocol";

/**
 * Kairo's MCP endpoint — published at /mcp, which rewrites here.
 *
 * Streamable HTTP, stateless: one POST carries one JSON-RPC message (or a
 * batch of them) and gets its answer in the body. No session id is issued and
 * no SSE stream is opened, because nothing here is server-initiated — every
 * exchange is a question from the assistant and an answer from Kairo. That
 * makes each request independent, which is exactly what a serverless
 * deployment can actually keep promising.
 *
 * Authentication is a connection key, not OAuth: the point is that this works
 * from any assistant, including the ones whose connector UI offers a URL and a
 * header and nothing else. See lib/mcp/context.ts for the three ways to send
 * one.
 */

/** A megabyte is far more than any tool call needs, and a cheap floor to stand on. */
const MAX_BODY_BYTES = 1_000_000;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-API-Key, Accept, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, MCP-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

function respond(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      ...(body === null ? {} : { "Content-Type": "application/json" }),
      // A tool result is a fact about right now; nothing between here and the
      // assistant should ever hand back an older one.
      "Cache-Control": "no-store, no-cache, must-revalidate",
      ...extra,
    },
  });
}

/**
 * An HTTP-level failure, shaped so both kinds of client can read it: the
 * status and WWW-Authenticate for the ones that check, and a JSON-RPC error
 * body for the ones that parse everything as a message.
 */
function protocolError(
  status: number,
  code: number,
  message: string,
  extra: Record<string, string> = {}
): Response {
  return respond({ jsonrpc: JSONRPC_VERSION, id: null, error: { code, message } }, status, extra);
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * The spec allows a GET here to open a server-to-client SSE stream. Kairo has
 * nothing to push, so it says so plainly — 405 with Allow is the documented
 * way to decline, and clients treat it as "no stream", not as a failure.
 */
export async function GET(): Promise<Response> {
  return protocolError(
    405,
    ErrorCode.InvalidRequest,
    "Kairo's MCP endpoint is request/response only — send JSON-RPC over POST. There is no server-initiated stream to open.",
    { Allow: "POST, OPTIONS" }
  );
}

/** Stateless: there is no session to end. */
export async function DELETE(): Promise<Response> {
  return protocolError(405, ErrorCode.InvalidRequest, "This server is stateless; there is no session to delete.", {
    Allow: "POST, OPTIONS",
  });
}

export async function POST(request: Request): Promise<Response> {
  // guessing keys costs a database read each time; a caller that keeps failing is slowed first
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const failures = checkRate(`bad-key:${ip}`, 30, 0);
  if (!failures.allowed) {
    return protocolError(429, -32003, "Too many failed attempts from here. Try again shortly.", { "Retry-After": String(failures.retryAfter) });
  }
  const auth = await authenticate(request);
  if (!auth.ok) {
    checkRate(`bad-key:${ip}`, 30, 1);
    return protocolError(
      auth.status,
      auth.status === 402 ? -32002 : -32001,
      auth.error,
      auth.challenge ? { "WWW-Authenticate": auth.challenge } : {}
    );
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return protocolError(413, ErrorCode.InvalidRequest, "That request is too large.");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return protocolError(400, ErrorCode.ParseError, "Body is not valid JSON.");
  }

  // Batching was part of the 2025-03-26 protocol and dropped in 2025-06-18.
  // Both are still in the wild, so both are answered.
  const messages: unknown[] = Array.isArray(payload) ? payload : [payload];
  const isBatch = Array.isArray(payload);
  if (messages.length === 0) {
    return protocolError(400, ErrorCode.InvalidRequest, "Empty batch.");
  }
  if (messages.length > 50) {
    return protocolError(400, ErrorCode.InvalidRequest, "At most 50 messages per batch.");
  }

  // charged per message, so a batch can't carry fifty times the allowance
  const rate = checkRate(auth.key._id.toHexString(), CALLS_PER_MINUTE, messages.length);
  if (!rate.allowed) {
    return protocolError(
      429,
      -32003,
      `Too many calls. Kairo allows about ${CALLS_PER_MINUTE} a minute per connection; try again in ${rate.retryAfter}s.`,
      { "Retry-After": String(rate.retryAfter) }
    );
  }

  const responses: RpcResponse[] = [];
  for (const message of messages) {
    if (!isRpcRequest(message)) {
      // A malformed member of a batch does not sink the rest of it.
      const id =
        typeof message === "object" && message !== null && "id" in message
          ? ((message as { id?: unknown }).id as string | number | null) ?? null
          : null;
      responses.push({
        jsonrpc: JSONRPC_VERSION,
        id,
        error: { code: ErrorCode.InvalidRequest, message: "Not a valid JSON-RPC 2.0 request." },
      });
      continue;
    }
    const answer = await handleMessage(auth.ctx, message as RpcRequest);
    if (answer) responses.push(answer);
  }

  // Nothing but notifications: the spec's answer is 202 with no body, and a
  // client that gets a body here will complain about an unmatched response.
  if (responses.length === 0) {
    const onlyNotifications = messages.every((m) => isRpcRequest(m) && isNotification(m as RpcRequest));
    return respond(null, onlyNotifications ? 202 : 204);
  }

  return respond(isBatch ? responses : responses[0], 200, {
    "X-RateLimit-Remaining": String(rate.remaining),
  });
}
