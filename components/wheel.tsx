"use client";

import { useEffect, useRef } from "react";

const ITEM_H = 36;
const VISIBLE = 5;

/** One snap-scrolling column of an iOS-style wheel picker. */
function WheelColumn({
  options,
  index,
  onChange,
  suffix,
}: {
  options: string[];
  index: number;
  onChange: (i: number) => void;
  suffix?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const programmatic = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = index * ITEM_H;
    if (Math.abs(el.scrollTop - target) > 1) {
      programmatic.current = true;
      el.scrollTo({ top: target });
    }
  }, [index]);

  const handleScroll = () => {
    if (programmatic.current) {
      programmatic.current = false;
      return;
    }
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.max(0, Math.min(options.length - 1, Math.round(el.scrollTop / ITEM_H)));
      if (i !== index) {
        try {
          navigator.vibrate?.(5);
        } catch {}
        onChange(i);
      } else {
        programmatic.current = true;
        el.scrollTo({ top: i * ITEM_H, behavior: "smooth" });
      }
    }, 130);
  };

  const pad = ((VISIBLE - 1) / 2) * ITEM_H;

  /* While a finger is on the wheel, freeze the surrounding modal so ONLY the
     numbers scroll — otherwise the sheet scrolls along and the screen jumps. */
  const lockModal = (lock: boolean) => {
    const modal = ref.current?.closest("[data-modal-scroll]") as HTMLElement | null;
    if (modal) modal.style.overflow = lock ? "hidden" : "";
  };

  return (
    <div
      ref={ref}
      onScroll={handleScroll}
      onTouchStart={() => lockModal(true)}
      onTouchEnd={() => lockModal(false)}
      onTouchCancel={() => lockModal(false)}
      className="no-scrollbar h-[180px] touch-pan-y snap-y snap-mandatory overflow-y-auto overscroll-contain"
      style={{ paddingTop: pad, paddingBottom: pad }}
    >
      {options.map((opt, i) => (
        <button
          key={i}
          onClick={() => onChange(i)}
          className={`flex h-9 w-full snap-center items-center justify-center text-[15px] tabular-nums transition-colors ${
            i === index ? "font-bold text-ink" : "text-ink-faint"
          }`}
        >
          {opt}
          {suffix && <span className="ml-1 text-xs font-normal text-ink-faint">{suffix}</span>}
        </button>
      ))}
    </div>
  );
}

/**
 * Duration wheel: hours + minutes, any amount up to 12h 55m.
 * Reports total minutes (null when 0h 0m).
 */
export function DurationWheel({
  minutes,
  onChange,
}: {
  minutes: number | null;
  onChange: (min: number | null) => void;
}) {
  const total = minutes ?? 0;
  const h = Math.floor(total / 60);
  const m = total % 60;
  const mIndex = Math.round(m / 5);

  const hours = Array.from({ length: 13 }, (_, i) => String(i));
  const mins = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

  const emit = (nh: number, nm: number) => {
    const v = nh * 60 + nm;
    onChange(v === 0 ? null : v);
  };

  return (
    <div className="relative mx-auto flex w-56 items-stretch justify-center gap-1">
      {/* selection band */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-9 -translate-y-1/2 rounded-xl bg-sun-soft" />
      <div className="relative z-10 flex-1">
        <WheelColumn options={hours} index={h} onChange={(i) => emit(i, mIndex * 5)} suffix="h" />
      </div>
      <div className="relative z-10 flex-1">
        <WheelColumn options={mins} index={mIndex} onChange={(i) => emit(h, i * 5)} suffix="m" />
      </div>
      {/* fade edges */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-12 bg-gradient-to-b from-card to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-12 bg-gradient-to-t from-card to-transparent" />
    </div>
  );
}
