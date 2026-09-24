"use client";

/**
 * Dictation, as the rest of the app sees it.
 *
 * One hook with one button's worth of state, and two engines behind it:
 *
 *   - On-device Whisper, once somebody has agreed to fetch it. It hears
 *     accents and names, punctuates, works with no signal, and nothing ever
 *     leaves the device.
 *   - The browser's own recogniser, which is what this app used before. It
 *     needs no download, so it is what the very first tap uses, and it is
 *     what anything that cannot run a model falls back to.
 *
 * Whichever one answers, the words go through `polish` before the caller
 * sees them, so a transcript arrives already written the way this app reads
 * dates, times and list names.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { getSpeechRecognition, type SpeechRec } from "@/lib/speech";
import { canRecord, startRecording, type Recording } from "@/lib/dictation/audio";
import { prepare, readSettings, transcribe } from "@/lib/dictation/engine";
import { polish, type Fix, type Vocab } from "@/lib/dictation/polish";
import { askPermission } from "../permission-ask";

export type Phase = "idle" | "fetching" | "warming" | "listening" | "thinking";

/**
 * Whether the microphone is already ours to use.
 *
 * The point is to find out without asking: a capture that opens listening is
 * a delight the second time and an ambush the first, and a permission prompt
 * nobody expected is how permissions get denied for good. Browsers that will
 * not answer this question are treated as a no.
 */
export async function micAlreadyAllowed(): Promise<boolean> {
  try {
    const r = await navigator.permissions?.query({ name: "microphone" as PermissionName });
    return r?.state === "granted";
  } catch {
    return false;
  }
}
export type Engine = "device" | "browser";

export type Heard = { text: string; engine: Engine; fixes: Fix[]; ms: number };

type Options = {
  /** The person's own list and habit names, so they come back spelled right. */
  vocab?: Vocab;
  onHeard: (heard: Heard) => void;
  /** Words as they arrive, where the engine offers them. Never final. */
  onInterim?: (text: string) => void;
  onTrouble?: (message: string) => void;
};

export function useDictation({ vocab, onHeard, onInterim, onTrouble }: Options) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [lastEngine, setLastEngine] = useState<Engine | null>(null);
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [onDevice, setOnDevice] = useState(false);

  const recording = useRef<Recording | null>(null);
  const browser = useRef<SpeechRec | null>(null);
  const stopping = useRef(false);

  // what the caller wants, read fresh at the moment it is needed rather than
  // captured into a callback that would then need rebuilding on every change
  const latest = useRef({ vocab, onHeard, onInterim, onTrouble });
  useEffect(() => {
    latest.current = { vocab, onHeard, onInterim, onTrouble };
  });

  useEffect(() => {
    // what was chosen on this device last time. Deferred by a microtask
    // because reading storage is not a render's business
    queueMicrotask(() => setOnDevice(readSettings().on && canRecord()));
  }, []);

  const finish = useCallback((raw: string, engine: Engine, ms: number) => {
    const { text, fixes } = polish(raw, latest.current.vocab);
    setPhase("idle");
    setLastEngine(engine);
    if (!text) {
      latest.current.onTrouble?.("Didn't catch that");
      return;
    }
    latest.current.onHeard({ text, engine, fixes, ms });
  }, []);

  /** The browser's own recogniser: no download, words as you speak. */
  const listenInBrowser = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) {
      latest.current.onTrouble?.("This browser can't listen. Typing works everywhere.");
      setPhase("idle");
      return;
    }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";
    let said = "";
    const started = performance.now();
    rec.onresult = (e) => {
      said = "";
      for (let i = 0; i < e.results.length; i++) said += e.results[i][0].transcript;
      latest.current.onInterim?.(said);
    };
    rec.onend = () => {
      browser.current = null;
      if (said.trim()) finish(said, "browser", Math.round(performance.now() - started));
      else setPhase("idle");
    };
    rec.onerror = () => {
      browser.current = null;
      setPhase("idle");
      latest.current.onTrouble?.("Couldn't hear that, try again, or just type");
    };
    browser.current = rec;
    setPhase("listening");
    rec.start();
  }, [finish]);

  /** Close the recording and turn it into words. */
  const endTake = useCallback(async () => {
    const take = recording.current;
    if (!take || stopping.current) return;
    stopping.current = true;
    recording.current = null;
    setPhase("thinking");
    try {
      const audio = await take.stop();
      if (audio.length === 0) {
        setPhase("idle");
        latest.current.onTrouble?.("Didn't catch that");
        return;
      }
      const started = performance.now();
      const raw = await transcribe(audio, readSettings().language);
      finish(raw, "device", Math.round(performance.now() - started));
    } catch {
      setPhase("idle");
      latest.current.onTrouble?.("Couldn't make that out, try again, or just type");
    } finally {
      stopping.current = false;
    }
  }, [finish]);

  /** Whisper, on this device. Records first, transcribes when you stop. */
  const listenOnDevice = useCallback(async () => {
    const settings = readSettings();
    try {
      setPhase("fetching");
      await prepare(settings.tier, (loaded, total) => setProgress({ loaded, total }));
      setProgress(null);
    } catch {
      // the model could not be had: fall back rather than leave them stuck
      setProgress(null);
      listenInBrowser();
      return;
    }

    try {
      // nothing ends this but the person who started it, bar the backstop
      const take = await startRecording({ onLimit: () => void endTake() });
      recording.current = take;
      setPhase("listening");
    } catch {
      setPhase("idle");
      latest.current.onTrouble?.("Couldn't open the microphone");
    }
  }, [listenInBrowser, endTake]);

  const start = useCallback(async () => {
    if (phase !== "idle") return;
    // the browser asks for the microphone the moment listening starts, so the
    // reason for it has to come first, while there is still a choice to make
    if (!(await askPermission("microphone"))) return;
    /*
     * Read the setting here, not off the state.
     *
     * `onDevice` lands a microtask after mount, and capture opens listening
     * the moment it mounts -- so the first capture of a session raced it and
     * lost, and went out through the browser's recogniser while the model sat
     * on the device unused. Whichever engine is right is a fact about storage,
     * so it is read at the moment it is needed.
     */
    if (readSettings().on && canRecord()) await listenOnDevice();
    else listenInBrowser();
  }, [phase, listenOnDevice, listenInBrowser]);

  const stop = useCallback(() => {
    if (browser.current) {
      browser.current.stop();
      return;
    }
    void endTake();
  }, [endTake]);

  const toggle = useCallback(() => {
    if (phase === "listening") stop();
    else if (phase === "idle") void start();
  }, [phase, start, stop]);

  const cancel = useCallback(() => {
    browser.current?.abort();
    browser.current = null;
    recording.current?.cancel();
    recording.current = null;
    setPhase("idle");
  }, []);

  useEffect(
    () => () => {
      browser.current?.abort();
      recording.current?.cancel();
    },
    [],
  );

  return {
    phase,
    /** Which engine answered last, so the caller can offer the better one. */
    lastEngine,
    /** Fetching weights, as a fraction, or null when nothing is being fetched. */
    progress,
    /** Whether this tap will use the model on the device or the browser's own. */
    onDevice,
    /** Somewhere to listen at all: a recogniser, or a microphone to record with. */
    supported: typeof window !== "undefined" && (getSpeechRecognition() !== null || canRecord()),
    /** Loudness right now, 0 to 1, for a meter. Poll it; it is cheap. */
    level: () => recording.current?.level() ?? 0,
    toggle,
    cancel,
    /** Turn the device model on for later taps (after somebody agrees). */
    useOnDevice: setOnDevice,
  };
}
