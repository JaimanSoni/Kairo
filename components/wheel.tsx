"use client";

import { useEffect, useRef } from "react";

const ITEM_H = 36;
const VISIBLE = 5;
/** How long after a programmatic scroll to ignore scroll events. */
const SUPPRESS_MS = 320;

/**
 * One column of an iOS-style wheel picker.
 *
 * Touch uses the browser's native scrolling (momentum + snap feel best that way).
 * Mouse and pen get a real grab-and-drag with velocity fling, because plain
 * scroll containers are effectively undraggable with a pointer.
 */
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
  /** Scroll events before this timestamp came from us, not the user. */
  const suppressUntil = useRef(0);
  const drag = useRef<{
    active: boolean;
    startY: number;
    startTop: number;
    lastY: number;
    lastT: number;
    velocity: number;
    moved: boolean;
  } | null>(null);

  const clampIndex = (i: number) => Math.max(0, Math.min(options.length - 1, i));

  const scrollToIndex = (i: number, smooth: boolean) => {
    const el = ref.current;
    if (!el) return;
    suppressUntil.current = Date.now() + SUPPRESS_MS;
    el.scrollTo({ top: i * ITEM_H, behavior: smooth ? "smooth" : "auto" });
  };

  /* keep the column parked on the selected value when it changes elsewhere */
  useEffect(() => {
    const el = ref.current;
    if (!el || drag.current?.active) return;
    if (Math.abs(el.scrollTop - index * ITEM_H) > 1) {
      suppressUntil.current = Date.now() + SUPPRESS_MS;
      el.scrollTo({ top: index * ITEM_H });
    }
  }, [index]);

  const tick = () => {
    try {
      navigator.vibrate?.(4);
    } catch {}
  };

  /** Settle to the nearest row after free scrolling (wheel / trackpad / touch). */
  const handleScroll = () => {
    if (Date.now() < suppressUntil.current || drag.current?.active) return;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const i = clampIndex(Math.round(el.scrollTop / ITEM_H));
      if (i !== index) {
        tick();
        onChange(i);
      } else {
        scrollToIndex(i, true);
      }
    }, 120);
  };

  /* ---------------- pointer drag (mouse & pen only) ---------------- */

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return; // native scrolling is better on touch
    const el = ref.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    el.style.scrollSnapType = "none"; // let the wheel move freely under the finger
    drag.current = {
      active: true,
      startY: e.clientY,
      startTop: el.scrollTop,
      lastY: e.clientY,
      lastT: e.timeStamp,
      velocity: 0,
      moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = ref.current;
    if (!d?.active || !el) return;
    e.preventDefault();

    const dy = e.clientY - d.startY;
    if (Math.abs(dy) > 3) d.moved = true;

    const dt = e.timeStamp - d.lastT;
    if (dt > 0) {
      // px per ms, smoothed so one jittery sample can't define the fling
      d.velocity = d.velocity * 0.7 + ((e.clientY - d.lastY) / dt) * 0.3;
    }
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;

    const max = (options.length - 1) * ITEM_H;
    el.scrollTop = Math.max(0, Math.min(max, d.startTop - dy));

    // live feedback: report the row under the band as you pass it
    const i = clampIndex(Math.round(el.scrollTop / ITEM_H));
    if (i !== index) {
      tick();
      onChange(i);
    }
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = ref.current;
    if (!d?.active || !el) return;
    drag.current = null;
    el.releasePointerCapture?.(e.pointerId);
    el.style.scrollSnapType = "";

    // a little fling, then settle on a row
    const fling = -d.velocity * 90;
    const max = (options.length - 1) * ITEM_H;
    const projected = Math.max(0, Math.min(max, el.scrollTop + fling));
    const i = clampIndex(Math.round(projected / ITEM_H));
    scrollToIndex(i, true);
    if (i !== index) {
      tick();
      onChange(i);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const i = clampIndex(index + (e.key === "ArrowDown" ? 1 : -1));
      if (i !== index) onChange(i);
    }
  };

  const pad = ((VISIBLE - 1) / 2) * ITEM_H;

  /* while a finger is on the wheel, freeze the surrounding sheet so only
     the numbers move — otherwise the modal scrolls along with it */
  const lockModal = (lock: boolean) => {
    const modal = ref.current?.closest("[data-modal-scroll]") as HTMLElement | null;
    if (modal) modal.style.overflow = lock ? "hidden" : "";
  };

  return (
    <div
      ref={ref}
      role="listbox"
      tabIndex={0}
      aria-label={suffix === "h" ? "Hours" : "Minutes"}
      onScroll={handleScroll}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      onTouchStart={() => lockModal(true)}
      onTouchEnd={() => lockModal(false)}
      onTouchCancel={() => lockModal(false)}
      className="no-scrollbar h-[180px] cursor-grab touch-pan-y snap-y snap-mandatory select-none overflow-y-auto overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-sun/40 active:cursor-grabbing"
      style={{ paddingTop: pad, paddingBottom: pad }}
    >
      {options.map((opt, i) => (
        <button
          key={i}
          type="button"
          tabIndex={-1}
          role="option"
          aria-selected={i === index}
          onClick={() => {
            // ignore the click that ends a drag
            if (drag.current?.moved) return;
            onChange(i);
          }}
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
