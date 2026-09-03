/**
 * A tool call that cannot be carried out.
 *
 * Thrown by argument readers and by the tools themselves, and turned into an
 * `isError` tool result rather than a JSON-RPC error: the model needs to SEE
 * what went wrong so it can fix the call. A protocol-level error, by contrast,
 * is usually swallowed by the client and shown to nobody.
 */
export class ToolFail extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolFail";
  }
}
