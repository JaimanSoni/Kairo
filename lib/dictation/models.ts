/**
 * Which Whisper to run, and where.
 *
 * The model runs on the person's own device, so the choice is a trade they
 * make once: a bigger model hears better and costs more to fetch. These are
 * measured download sizes, not estimates, and they differ by device because
 * the weights that run well on a GPU are not the ones that run well on a CPU.
 *
 * Nothing here imports the library. This file is safe to pull into any bundle;
 * the 32MB of runtime lives behind a dynamic import inside the worker.
 */

export type Tier = "quick" | "accurate" | "best";

/** How the model will actually run on this device. */
export type Device = "webgpu" | "wasm";

type Build = {
  /** Per-file quantisation, as transformers.js names them. */
  dtype: { encoder_model: string; decoder_model_merged: string };
  /** Bytes fetched the first time, weights plus tokeniser. */
  bytes: number;
};

export type ModelSpec = {
  tier: Tier;
  repo: string;
  /** What it is called where a person can see it. */
  name: string;
  /** The honest one-line trade. */
  blurb: string;
  /** Too heavy for a phone: offered only where there is room to run it. */
  desktopOnly: boolean;
  webgpu: Build;
  wasm: Build | null;
};

const MB = 1024 * 1024;

export const MODELS: Record<Tier, ModelSpec> = {
  quick: {
    tier: "quick",
    repo: "onnx-community/whisper-base",
    name: "Quick",
    blurb: "Small enough for a phone, and understands a clear sentence well.",
    desktopOnly: false,
    // Eight-bit everywhere, on a GPU as well as a processor. Half precision
    // would decode faster, but it is twice the download for a saving of
    // maybe a third of a second on a sentence -- and this is the one a person
    // agrees to before they have any reason to trust it, so it is the one
    // that has to be small.
    webgpu: { dtype: { encoder_model: "q8", decoder_model_merged: "q8" }, bytes: 79 * MB },
    wasm: { dtype: { encoder_model: "q8", decoder_model_merged: "q8" }, bytes: 79 * MB },
  },
  accurate: {
    tier: "accurate",
    repo: "onnx-community/whisper-small",
    name: "Accurate",
    blurb: "Hears accents, names and half-sentences the small one misses.",
    desktopOnly: false,
    webgpu: { dtype: { encoder_model: "fp16", decoder_model_merged: "q4" }, bytes: 412 * MB },
    wasm: { dtype: { encoder_model: "q8", decoder_model_merged: "q8" }, bytes: 251 * MB },
  },
  best: {
    tier: "best",
    repo: "onnx-community/whisper-large-v3-turbo",
    name: "Best",
    blurb: "The full model. Needs a graphics card and a good connection once.",
    desktopOnly: true,
    webgpu: { dtype: { encoder_model: "q4f16", decoder_model_merged: "q4f16" }, bytes: 566 * MB },
    // a CPU would take longer than typing it out
    wasm: null,
  },
};

export const TIERS: Tier[] = ["quick", "accurate", "best"];

/**
 * WebGPU, as far as we are allowed to ask without a user gesture.
 *
 * `navigator.gpu` existing is not the same as an adapter being available --
 * a locked-down driver can have the API and no device behind it -- so the
 * worker asks for the adapter for real and falls back to the CPU if it
 * cannot have one. This is only the cheap first look.
 */
export function mightUseWebGPU(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

/** A phone or a tablet: less memory to spend, and usually a worse connection. */
export function isHandheld(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPod/.test(ua)) return true;
  // an iPad reports itself as a Mac, and is still a handheld
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return true;
  return /Mobi|Tablet/.test(ua);
}

/**
 * What to offer before anyone has chosen: always the small one.
 *
 * It has to be the same answer on the server and in the browser, or the page
 * renders one thing and hydrates into another. It also has to be the smallest
 * one, because this is the download somebody agrees to before they have any
 * reason to believe it was worth it. The bigger models are an upgrade, taken
 * deliberately, once dictation has earned it.
 */
export function suggestedTier(): Tier {
  return "quick";
}

/** The build for a tier on a device, or null if it should not run there. */
export function buildFor(tier: Tier, device: Device): Build | null {
  const spec = MODELS[tier];
  if (!spec) return null;
  if (spec.desktopOnly && isHandheld()) return null;
  return device === "webgpu" ? spec.webgpu : spec.wasm;
}

/** "166 MB", for a sentence a person reads before agreeing to it. */
export function sizeLabel(bytes: number): string {
  if (bytes >= MB) return `${Math.round(bytes / MB)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
