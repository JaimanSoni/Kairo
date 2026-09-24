/// <reference lib="webworker" />

/**
 * Whisper, on a thread of its own.
 *
 * This file is the only place the model library is ever mentioned, and it is
 * mentioned behind a dynamic import, so none of the thirty-odd megabytes of
 * runtime reaches anyone who never dictates anything. The worker itself is
 * built as its own chunk and is only constructed when somebody taps the
 * microphone, which is the whole reason dictation costs the app nothing until
 * it is used.
 *
 * Decoding a few seconds of speech is hundreds of milliseconds of solid
 * arithmetic. On the page that would be hundreds of milliseconds of frozen
 * interface, so it happens here instead, and the page is told the answer.
 */

import type { FromWorker, ToWorker, Device } from "./protocol";

type Transcriber = (audio: Float32Array, opts: Record<string, unknown>) => Promise<{ text: string }>;

let model: Transcriber | null = null;
let loading: Promise<void> | null = null;
let running: Device = "wasm";

const post = (msg: FromWorker) => self.postMessage(msg);

/**
 * WebGPU for real, not just the property being there.
 *
 * A browser can expose `navigator.gpu` and still have no adapter behind it --
 * a blocked driver, a virtual machine, a laptop on its integrated chip with
 * the GPU asleep. Asking for the adapter is the only honest test, and it
 * costs nothing when the answer is yes.
 */
async function haveWebGPU(): Promise<boolean> {
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
    if (!gpu) return false;
    return Boolean(await gpu.requestAdapter());
  } catch {
    return false;
  }
}

async function load(msg: Extract<ToWorker, { kind: "load" }>): Promise<void> {
  const started = performance.now();
  // the import is inside the function on purpose: nothing is fetched until
  // somebody has actually asked for dictation
  const { pipeline, env } = await import("@huggingface/transformers");

  // weights come from the hub and are cached by the browser afterwards; there
  // are no local model files to look for, and looking wastes a round trip
  env.allowLocalModels = false;
  // threads need SharedArrayBuffer, which needs the page to be cross-origin
  // isolated. It is not, deliberately -- isolating it would break embeds
  // elsewhere in the app for a gain that only matters without a GPU.
  if (env.backends?.onnx?.wasm) env.backends.onnx.wasm.numThreads = 1;

  const wanted: Device = (await haveWebGPU()) && msg.dtypes.webgpu ? "webgpu" : "wasm";
  const dtypeFor = (device: Device) => (device === "webgpu" ? msg.dtypes.webgpu : msg.dtypes.wasm);
  if (!dtypeFor(wanted)) throw new Error("this model needs a graphics card");

  // Files arrive in parallel and announce themselves one at a time, so the
  // total is only ever the total of what has introduced itself so far. It
  // settles within the first moment and then counts honestly.
  const seen = new Map<string, { loaded: number; total: number }>();
  const progress_callback = (e: { status: string; file?: string; loaded?: number; total?: number }) => {
    if (!e.file || (e.status !== "progress" && e.status !== "done")) return;
    const was = seen.get(e.file);
    // "done" arrives without a size, which read naively takes a finished file
    // back to nothing and marches the bar backwards. A file's size is the
    // largest it has ever claimed, and what it has fetched never decreases.
    const total = Math.max(e.total ?? 0, was?.total ?? 0);
    const loaded = Math.max(e.status === "done" ? total : (e.loaded ?? 0), was?.loaded ?? 0);
    seen.set(e.file, { loaded, total });
    let l = 0;
    let t = 0;
    for (const v of seen.values()) {
      l += v.loaded;
      t += v.total;
    }
    if (t > 0) post({ kind: "progress", loaded: l, total: t, file: e.file });
  };

  const make = (device: Device) =>
    pipeline("automatic-speech-recognition", msg.repo, {
      device,
      dtype: dtypeFor(device) ?? undefined,
      progress_callback,
    } as never) as unknown as Promise<Transcriber>;

  try {
    model = await make(wanted);
    running = wanted;
  } catch (err) {
    // A GPU that accepted the adapter can still refuse the model: too little
    // memory, a driver that will not compile a shader. The processor always
    // works, so that is where we land rather than failing outright.
    if (wanted !== "webgpu" || !dtypeFor("wasm")) throw err;
    model = await make("wasm");
    running = "wasm";
  }

  // The first run of a fresh model pays for shader compilation and memory
  // layout -- about a second, which would otherwise be charged to whoever
  // spoke first. A second of silence now spends it while they are still
  // reading the microphone button.
  try {
    await model(new Float32Array(16000), { language: "en", task: "transcribe", return_timestamps: false });
  } catch {
    /* the warm-up failing is not the model failing; the real run will say so */
  }

  post({ kind: "ready", device: running, ms: Math.round(performance.now() - started) });
}

self.onmessage = async (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  try {
    if (msg.kind === "load") {
      loading ??= load(msg).catch((err) => {
        loading = null;
        throw err;
      });
      await loading;
      return;
    }

    if (msg.kind === "run") {
      if (loading) await loading;
      if (!model) throw new Error("no model loaded");
      const started = performance.now();
      const out = await model(msg.audio, {
        // Told rather than guessed: language detection off two seconds of
        // speech is a coin toss, and getting it wrong rewrites the sentence.
        language: msg.language ?? undefined,
        task: "transcribe",
        // timestamps cost time and give this app nothing
        return_timestamps: false,
        // one pass, no beam search: a task is a short sentence, and the second
        // beam is a second decode for a difference nobody would notice
        num_beams: 1,
        do_sample: false,
        // the backstop for the loop a model falls into on a short clip. The
        // transcript is cleaned again on the page, but stopping it here saves
        // generating the loop in the first place
        no_repeat_ngram_size: 4,
      });
      post({ kind: "text", id: msg.id, text: out.text ?? "", ms: Math.round(performance.now() - started) });
      return;
    }

    if (msg.kind === "free") {
      model = null;
      loading = null;
      return;
    }
  } catch (err) {
    post({ kind: "failed", id: msg.kind === "run" ? msg.id : null, why: err instanceof Error ? err.message : String(err) });
  }
};
