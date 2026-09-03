/**
 * The JSON-RPC 2.0 envelope MCP speaks, and the handful of rules the
 * Streamable HTTP transport adds on top.
 *
 * Hand-rolled for the same reason the Google OAuth flow is: the whole of what
 * Kairo needs is a request/response dispatcher over one POST endpoint, and a
 * dependency that owns the transport would own the error handling too — which
 * is where the compatibility differences between clients actually live.
 */

export const JSONRPC_VERSION = "2.0";

/** Newest first. An unknown version from a client is answered with SUPPORTED[0]. */
export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;
export const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

/** Assumed when a client sends no MCP-Protocol-Version header, per the spec. */
export const DEFAULT_NEGOTIATED_VERSION = "2025-03-26";

export const ErrorCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
} as const;

export type RpcId = string | number | null;

export type RpcRequest = {
  jsonrpc: typeof JSONRPC_VERSION;
  id?: RpcId;
  method: string;
  params?: Record<string, unknown>;
};

export type RpcSuccess = { jsonrpc: typeof JSONRPC_VERSION; id: RpcId; result: unknown };
export type RpcFailure = {
  jsonrpc: typeof JSONRPC_VERSION;
  id: RpcId;
  error: { code: number; message: string; data?: unknown };
};
export type RpcResponse = RpcSuccess | RpcFailure;

export function ok(id: RpcId, result: unknown): RpcSuccess {
  return { jsonrpc: JSONRPC_VERSION, id, result };
}

export function fail(id: RpcId, code: number, message: string, data?: unknown): RpcFailure {
  return { jsonrpc: JSONRPC_VERSION, id, error: data === undefined ? { code, message } : { code, message, data } };
}

/**
 * A well-formed JSON-RPC call. `id` absent (not null) means a notification,
 * which gets no response at all — the distinction the 202 path depends on.
 */
export function isRpcRequest(value: unknown): value is RpcRequest {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.jsonrpc !== JSONRPC_VERSION) return false;
  if (typeof v.method !== "string" || !v.method) return false;
  if ("id" in v && v.id !== null && typeof v.id !== "string" && typeof v.id !== "number") return false;
  if ("params" in v && v.params !== undefined) {
    if (typeof v.params !== "object" || v.params === null || Array.isArray(v.params)) return false;
  }
  return true;
}

export function isNotification(msg: RpcRequest): boolean {
  return !("id" in msg) || msg.id === undefined;
}

/** Negotiation per the spec: echo the client's version when we speak it. */
export function negotiateVersion(requested: unknown): string {
  if (typeof requested === "string" && (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)) {
    return requested;
  }
  return LATEST_PROTOCOL_VERSION;
}

/* ------------------------------------------------------------------ tools */

export type JsonSchema = Record<string, unknown>;

export type ToolContent = { type: "text"; text: string };

export type ToolResult = {
  content: ToolContent[];
  isError?: boolean;
};

export function text(body: string): ToolResult {
  return { content: [{ type: "text", text: body }] };
}

/**
 * A tool that failed is a result, not a protocol error: the model must see
 * what went wrong and be able to try something else. Only malformed calls —
 * an unknown tool, a bad envelope — become JSON-RPC errors.
 */
export function toolError(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

export function json(value: unknown): ToolResult {
  return text(JSON.stringify(value, null, 2));
}
