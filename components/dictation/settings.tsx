"use client";

/**
 * Dictation, in Settings: turn it on or off, pick how good it should be, and
 * take the weights back off the device.
 *
 * The last one matters. Agreeing to a few hundred megabytes is easy to do and
 * should be just as easy to undo, and a person who has changed their mind
 * should not have to go looking through browser storage to act on it.
 */

import { useCallback, useEffect, useState } from "react";
import { MODELS, TIERS, sizeLabel, type Tier } from "@/lib/dictation/models";
import { alreadyFetched, forget, readSettings, stopDictation, writeSettings } from "@/lib/dictation/engine";
import { canRecord } from "@/lib/dictation/audio";

export function DictationControls() {
  const [on, setOn] = useState(false);
  const [tier, setTier] = useState<Tier>("quick");
  const [here, setHere] = useState<Record<string, boolean>>({});
  const [able, setAble] = useState(true);

  const look = useCallback(async (which: Tier) => {
    const has = await alreadyFetched(which);
    setHere((h) => ({ ...h, [which]: has }));
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      const saved = readSettings();
      setOn(saved.on);
      setTier(saved.tier);
      setAble(canRecord());
      for (const t of TIERS) void look(t);
    });
  }, [look]);

  const save = (next: { on?: boolean; tier?: Tier }) => {
    const merged = { ...readSettings(), ...next };
    writeSettings(merged);
    if (next.on !== undefined) setOn(next.on);
    if (next.tier !== undefined) setTier(next.tier);
    // a model already loaded is the wrong one now, or is not wanted at all
    stopDictation();
  };

  if (!able) {
    return <p className="text-[13px] text-ink-soft">This browser can&apos;t record audio, so dictation isn&apos;t available here.</p>;
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => save({ on: e.target.checked })}
          className="size-4 accent-[color:var(--moss,#4a7c59)]"
          data-dictation-on
        />
        <span>Listen on this device</span>
      </label>

      {on && (
        <>
          <div className="flex flex-wrap gap-2">
            {TIERS.map((t) => {
              const spec = MODELS[t];
              return (
                <button
                  key={t}
                  onClick={() => save({ tier: t })}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${t === tier ? "bg-ink text-paper" : "bg-paper-deep text-ink-soft hover:text-ink"}`}
                  data-dictation-tier={t}
                >
                  {spec.name}
                  <span className="ml-1 font-normal opacity-70">{here[t] ? "on this device" : sizeLabel(spec.webgpu.bytes)}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[13px] leading-5 text-ink-soft">{MODELS[tier].blurb}</p>
        </>
      )}

      {TIERS.some((t) => here[t]) && (
        <button
          onClick={() =>
            void forget().then(() => {
              stopDictation();
              setHere({});
            })
          }
          className="text-[13px] font-semibold text-clay hover:underline"
          data-dictation-forget
        >
          Remove the downloaded voice models from this device
        </button>
      )}
    </div>
  );
}
