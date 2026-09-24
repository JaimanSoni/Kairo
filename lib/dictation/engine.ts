"use client";

/**
 * The page's side of dictation: one worker, started late and let go early.
 *
 * Three rules, and they are the whole design:
 *
 *   1. Nothing happens until somebody dictates. The worker is not created,
 *      the library is not fetched, the weights are not fetched. An app that
 *      nobody dictates into is byte for byte the app it was before.
 *   2. Between two sentences the model stays warm, because loading it again
 *      is a second and decoding a sentence is a fraction of one.
 *   3. After a few minutes of nobody speaking it is let go entirely. A
 *      speech model is hundreds of megabytes of memory, and a planner left
 *      open in a tab all afternoon should not be holding it.
 */

import { MODELS, type Tier, suggestedTier } from "./models";
import type { Device, FromWorker, ToWorker } from "./protocol";

const SETTINGS_KEY = "kairo-dictation";
const IDLE_MS = 3 * 60_000;
/** Where transformers.js keeps the weights it has fetched. */
const WEIGHT_CACHE = "transformers-cache";

export type Settings = { on: boolean; tier: Tier; language: string | null };

export function readSettings(): Settings {
  const fallback: Settings = { on: false, tier: suggestedTier(), language: "en" };
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw) as Partial<Settings>;
    return {
      on: saved.on === true,
      tier: saved.tier && saved.tier in MODELS ? saved.tier : fallback.tier,
      language: saved.language === undefined ? "en" : saved.language,
    };
  } catch {
    return fallback;
  }
}

export function writeSettings(next: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    /* a browser refusing storage is not a reason to stop working */
  }
}

/**
 * Whether this model's weights are already on the device.
 *
 * It decides whether somebody is asked to agree to a download or simply gets
 * dictation: having said yes once on this device, they should never be asked
 * again, and asking again would be the app forgetting them.
 */
export async function alreadyFetched(tier: Tier): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  try {
    const cache = await caches.open(WEIGHT_CACHE);
    const keys = await cache.keys();
    const repo = MODELS[tier].repo;
    return keys.some((k) => k.url.includes(repo) && k.url.endsWith(".onnx"));
  } catch {
    return false;
  }
}

/** Forget the weights for one model, or for all of them. */
export async function forget(tier?: Tier): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    if (!tier) {
      await caches.delete(WEIGHT_CACHE);
      return;
    }
    const cache = await caches.open(WEIGHT_CACHE);
    const repo = MODELS[tier].repo;
    for (const k of await cache.keys()) if (k.url.includes(repo)) await cache.delete(k);
  } catch {
    /* nothing to forget */
  }
}

/* ------------------------------------------------------------ the worker */

type Pending = { resolve: (text: string) => void; reject: (err: Error) => void };

let worker: Worker | null = null;
let loadedTier: Tier | null = null;
let readyFor: Promise<Device> | null = null;
let settleReady: ((device: Device) => void) | null = null;
let failReady: ((err: Error) => void) | null = null;
let onProgress: ((loaded: number, total: number) => void) | null = null;
const pending = new Map<number, Pending>();
let nextId = 1;
let idle: ReturnType<typeof setTimeout> | null = null;

function release(): void {
  if (idle) clearTimeout(idle);
  idle = null;
  worker?.terminate();
  worker = null;
  loadedTier = null;
  readyFor = null;
  for (const p of pending.values()) p.reject(new Error("dictation stopped"));
  pending.clear();
}

function keepUntilIdle(): void {
  if (idle) clearTimeout(idle);
  idle = setTimeout(release, IDLE_MS);
}

function spawn(): Worker {
  const w = new Worker(new URL("./whisper.worker.ts", import.meta.url), { type: "module" });
  w.onmessage = (e: MessageEvent<FromWorker>) => {
    const msg = e.data;
    if (msg.kind === "progress") {
      onProgress?.(msg.loaded, msg.total);
      return;
    }
    if (msg.kind === "ready") {
      settleReady?.(msg.device);
      return;
    }
    if (msg.kind === "text") {
      pending.get(msg.id)?.resolve(msg.text);
      pending.delete(msg.id);
      return;
    }
    if (msg.kind === "failed") {
      const err = new Error(msg.why);
      if (msg.id !== null) {
        pending.get(msg.id)?.reject(err);
        pending.delete(msg.id);
      } else {
        failReady?.(err);
      }
    }
  };
  w.onerror = () => {
    const err = new Error("dictation could not start");
    failReady?.(err);
    for (const p of pending.values()) p.reject(err);
    pending.clear();
  };
  return w;
}

/**
 * Have the model loaded and warm, fetching it if this device has never had
 * it. Safe to call as often as you like: the second call waits on the first.
 */
export function prepare(tier: Tier, progress?: (loaded: number, total: number) => void): Promise<Device> {
  onProgress = progress ?? null;
  if (worker && loadedTier === tier && readyFor) {
    keepUntilIdle();
    return readyFor;
  }
  if (worker && loadedTier !== tier) release(); // a different model: start over

  const spec = MODELS[tier];
  worker ??= spawn();
  loadedTier = tier;
  readyFor = new Promise<Device>((resolve, reject) => {
    settleReady = resolve;
    failReady = reject;
  });
  // the worker decides for real whether the GPU is usable, and takes the
  // weights to match -- it is the only side that can ask
  const load: ToWorker = {
    kind: "load",
    repo: spec.repo,
    dtypes: { webgpu: spec.webgpu.dtype, wasm: spec.wasm?.dtype ?? null },
  };
  worker.postMessage(load);
  keepUntilIdle();
  return readyFor;
}

/** Speech in, words out. The audio is handed over, not copied. */
export async function transcribe(audio: Float32Array, language: string | null): Promise<string> {
  if (!worker || !readyFor) throw new Error("dictation is not ready");
  await readyFor;
  keepUntilIdle();
  const id = nextId++;
  const done = new Promise<string>((resolve, reject) => pending.set(id, { resolve, reject }));
  const run: ToWorker = { kind: "run", id, audio, language };
  worker.postMessage(run, [audio.buffer as ArrayBuffer]);
  return done;
}

/** Let the model go now rather than in three minutes. */
export const stopDictation = release;
