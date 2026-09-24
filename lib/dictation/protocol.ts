/**
 * What the page and the worker say to each other.
 *
 * Its own file because both sides import it, and neither side should drag the
 * other's dependencies along: this must stay free of the model library, or a
 * 32MB runtime lands in the page bundle.
 */

export type Device = "webgpu" | "wasm";

export type ToWorker =
  /**
   * Both sets of weights are named, and the worker takes the one for the
   * device it actually ends up on -- it is the only side that can ask the
   * GPU for real, and fetching half-precision weights for a processor that
   * cannot use them would be a download spent on nothing.
   */
  | { kind: "load"; repo: string; dtypes: { webgpu: Record<string, string>; wasm: Record<string, string> | null } }
  | { kind: "run"; id: number; audio: Float32Array; language: string | null }
  | { kind: "free" };

export type FromWorker =
  /** Fetching weights: bytes so far out of the bytes known about so far. */
  | { kind: "progress"; loaded: number; total: number; file: string }
  /** Loaded and warm, and here is what it ended up running on. */
  | { kind: "ready"; device: Device; ms: number }
  | { kind: "text"; id: number; text: string; ms: number }
  | { kind: "failed"; id: number | null; why: string };
