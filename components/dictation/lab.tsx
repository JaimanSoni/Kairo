"use client";

/**
 * A bench for the dictation, because "accurate" is a measurement.
 *
 * Two ways to use it. The known clip is the same sentence every time, so a
 * change to the model, the audio shaping or the corrections can be judged
 * against the run before it -- and a script can drive it with no microphone
 * at all. Recording your own is the only test that matters in the end: your
 * voice, your accent, your list names, the phrases you actually dictate.
 *
 * It shows the raw transcript beside the corrected one on purpose. If the
 * corrections are doing harm, that is where it will show.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { MODELS, TIERS, sizeLabel, type Tier } from "@/lib/dictation/models";
import { alreadyFetched, forget, prepare, readSettings, transcribe, writeSettings } from "@/lib/dictation/engine";
import { startRecording, toModelAudio, type Recording } from "@/lib/dictation/audio";
import { buildVocab, polish, type Fix } from "@/lib/dictation/polish";

/** The clip every Whisper demo uses, and its transcript, word for word. */
const KNOWN = {
  url: "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/jfk.wav",
  said: "and so my fellow americans ask not what your country can do for you ask what you can do for your country",
};

type Run = {
  raw: string;
  text: string;
  fixes: Fix[];
  decodeMs: number;
  audioMs: number;
  wer: number | null;
  device: string;
};

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .split(/\s+/)
    .filter(Boolean);

/** Word error rate: the usual measure, the usual way. */
function wordErrorRate(said: string, heard: string): number {
  const a = words(said);
  const b = words(heard);
  if (a.length === 0) return b.length === 0 ? 0 : 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row.push(Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
    }
    prev = row;
  }
  return prev[b.length] / a.length;
}

export function DictationLab() {
  // never read storage during a render: the server has none, and the page
  // would hydrate into a different answer than it was sent
  const [tier, setTier] = useState<Tier>("quick");
  useEffect(() => {
    queueMicrotask(() => setTier(readSettings().tier));
  }, []);
  const [status, setStatus] = useState("Nothing loaded yet.");
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [listening, setListening] = useState(false);
  const [names, setNames] = useState("Groceries, Reading list, Ravi, Shreya");
  const take = useRef<Recording | null>(null);

  const vocab = buildVocab(
    names.split(",").map((n) => n.trim()).filter(Boolean),
    [],
    [],
  );

  const load = useCallback(async () => {
    setStatus("Loading…");
    const t0 = performance.now();
    try {
      const device = await prepare(tier, (loaded, total) => setProgress({ loaded, total }));
      setProgress(null);
      setStatus(`Ready on ${device} in ${Math.round(performance.now() - t0)}ms`);
      return true;
    } catch (err) {
      setProgress(null);
      setStatus(`Failed: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }, [tier]);

  const run = useCallback(
    async (audio: Float32Array, said: string | null) => {
      const audioMs = Math.round((audio.length / 16000) * 1000);
      const t0 = performance.now();
      const raw = await transcribe(audio, readSettings().language);
      const decodeMs = Math.round(performance.now() - t0);
      const { text, fixes } = polish(raw, vocab);
      setRuns((r) => [
        { raw, text, fixes, decodeMs, audioMs, wer: said ? wordErrorRate(said, text) : null, device: readSettings().tier },
        ...r,
      ]);
    },
    [vocab],
  );

  const runKnown = useCallback(async () => {
    if (!(await load())) return;
    setStatus("Fetching the clip…");
    const blob = await (await fetch(KNOWN.url)).blob();
    setStatus("Transcribing…");
    await run(await toModelAudio(blob), KNOWN.said);
    setStatus("Done.");
  }, [load, run]);

  const endTake = useCallback(async () => {
    const t = take.current;
    if (!t) return;
    take.current = null;
    setListening(false);
    setStatus("Transcribing…");
    await run(await t.stop(), null);
    setStatus("Done.");
  }, [run]);

  const toggleRecord = useCallback(async () => {
    if (take.current) return endTake();
    if (!(await load())) return;
    take.current = await startRecording({ quietMs: 2000, onQuiet: () => void endTake() });
    setListening(true);
    setStatus("Listening…");
  }, [load, endTake]);

  const spec = MODELS[tier];

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="font-display text-3xl">Dictation bench</h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        The model runs here, on this device. Nothing recorded on this page is sent anywhere.
      </p>

      <div className="mt-6 rounded-2xl border border-line p-4">
        <div className="text-sm font-semibold">Model</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {TIERS.map((t) => (
            <button
              key={t}
              onClick={() => {
                setTier(t);
                writeSettings({ ...readSettings(), tier: t });
              }}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${t === tier ? "bg-ink text-paper" : "bg-paper-deep text-ink-soft"}`}
            >
              {MODELS[t].name} <span className="font-normal opacity-70">{sizeLabel(MODELS[t].webgpu.bytes)}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-ink-faint">{spec.blurb}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={() => void runKnown()} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper" data-lab-known>
            Run the known clip
          </button>
          <button
            onClick={() => void toggleRecord()}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${listening ? "bg-clay text-on-accent" : "bg-paper-deep text-ink"}`}
            data-lab-record
          >
            {listening ? "Stop" : "Record your own"}
          </button>
          <button
            onClick={() => void forget(tier).then(() => setStatus("Weights removed from this device."))}
            className="rounded-full px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-paper-deep"
          >
            Remove weights
          </button>
          <button
            onClick={() => void alreadyFetched(tier).then((has) => setStatus(has ? "Already on this device." : "Not fetched yet."))}
            className="rounded-full px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-paper-deep"
          >
            Is it here?
          </button>
        </div>
        <p className="mt-3 text-[13px] text-ink-soft" data-lab-status>
          {status}
          {progress && progress.total > 0 ? ` ${Math.floor((progress.loaded / progress.total) * 100)}% of ${sizeLabel(progress.total)}` : ""}
        </p>
      </div>

      <label className="mt-4 block">
        <span className="text-sm font-semibold">Your words, comma separated</span>
        <input
          value={names}
          onChange={(e) => setNames(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-ink-faint"
        />
        <span className="mt-1 block text-[13px] text-ink-faint">List and habit names, and people you mention. These get snapped back after transcription.</span>
      </label>

      <div className="mt-6 space-y-3" data-lab-runs>
        {runs.map((r, i) => (
          <div key={runs.length - i} className="rounded-2xl border border-line p-4" data-lab-run>
            <div className="text-base" data-lab-text>
              {r.text || <span className="text-ink-faint">(nothing)</span>}
            </div>
            {r.raw !== r.text && (
              <div className="mt-1.5 text-[13px] text-ink-faint">
                heard: <span data-lab-raw>{r.raw}</span>
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-ink-faint">
              <span className="rounded-full bg-paper-deep px-2 py-0.5">{r.audioMs}ms of speech</span>
              <span className="rounded-full bg-paper-deep px-2 py-0.5" data-lab-decode>
                {r.decodeMs}ms to transcribe
              </span>
              <span className="rounded-full bg-paper-deep px-2 py-0.5">{Math.round((r.audioMs / Math.max(1, r.decodeMs)) * 10) / 10}x realtime</span>
              {r.wer !== null && (
                <span className={`rounded-full px-2 py-0.5 ${r.wer === 0 ? "bg-moss-soft text-moss-deep" : "bg-sun-soft text-sun-deep"}`} data-lab-wer={r.wer.toFixed(3)}>
                  {(r.wer * 100).toFixed(1)}% word error
                </span>
              )}
              {r.fixes.map((f, k) => (
                <span key={k} className="rounded-full bg-sun-soft px-2 py-0.5 text-sun-deep">
                  {f.kind}: {f.from.slice(0, 24)} &rarr; {f.to.slice(0, 24) || "(gone)"}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
