"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Icon3d } from "./img3d";

/* ---------------- icons (inline, 16px grid) ---------------- */

type IconProps = { size?: number; className?: string };

export function IconPlus({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconCheck({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M3 8.5l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconSun({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconCalendar({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconInbox({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 9l2-6h8l2 6v4a1 1 0 01-1 1H3a1 1 0 01-1-1V9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M2 9h3.5c0 1.2 1 2.2 2.5 2.2S10.5 10.2 10.5 9H14" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function IconMoon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M13.5 9.5A6 6 0 016.5 2.5a6 6 0 107 7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function IconBook({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 3.5A1.5 1.5 0 013.5 2H8v12H3.5A1.5 1.5 0 012 12.5v-9zM8 2h4.5A1.5 1.5 0 0114 3.5v9a1.5 1.5 0 01-1.5 1.5H8" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function IconStar({ size = 16, className, filled }: IconProps & { filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill={filled ? "currentColor" : "none"} className={className}>
      <path d="M8 1.8l1.8 3.9 4.2.5-3.1 2.9.8 4.2L8 11.2l-3.7 2.1.8-4.2L2 6.2l4.2-.5L8 1.8z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

export function IconTrash({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2.5 4h11M6.5 2h3M4 4l.7 9.3a1 1 0 001 .7h4.6a1 1 0 001-.7L12 4M6.5 7v4M9.5 7v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconDots({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
      <circle cx="3.5" cy="8" r="1.4" />
      <circle cx="8" cy="8" r="1.4" />
      <circle cx="12.5" cy="8" r="1.4" />
    </svg>
  );
}

export function IconX({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconArrowRight({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2.5 8h11M9 3.5L13.5 8 9 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconClock({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/* ---------------- primitives ---------------- */

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-paper-deep px-1.5 py-0.5 font-mono text-[10px] text-ink-soft">
      {children}
    </kbd>
  );
}

export function Chip({
  children,
  tone = "neutral",
  title,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "sun" | "sky" | "clay" | "lilac" | "moss";
  title?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-paper-deep text-ink-soft",
    sun: "bg-sun-soft text-sun-deep",
    sky: "bg-sky-soft text-sky",
    clay: "bg-clay-soft text-clay",
    lilac: "bg-lilac-soft text-lilac",
    moss: "bg-moss-soft text-moss",
  };
  return (
    <span
      title={title}
      className={`inline-flex max-w-full items-center gap-1 overflow-hidden whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Modal({
  onClose,
  children,
  wide,
  anchor = "sheet",
}: {
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  /**
   * Where the panel lives on a phone. "sheet" is the default bottom sheet;
   * "top" drops the panel in from above instead — for anything built around
   * typing, because the keyboard owns the bottom of a phone screen and a
   * bottom sheet ends up crushed against it. Desktop is identical either way.
   */
  anchor?: "sheet" | "top";
}) {
  const top = anchor === "top";
  // portals need a DOM; server render and first hydration pass return null
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);

  /**
   * Slides the sheet out, then unmounts. `velocity` (px/ms, downward positive)
   * shortens the exit after a flick so the motion continues your gesture.
   */
  const dismiss = useCallback(
    (velocity = 0) => {
      if (closingRef.current) return;
      const panel = panelRef.current;
      if (!panel || window.innerWidth >= 640) {
        onClose();
        return;
      }
      if (top) {
        // the top panel leaves the way it came: a short lift and fade
        closingRef.current = true;
        panel.style.transition = "transform 150ms ease-in, opacity 150ms ease-in";
        panel.style.transform = "translate3d(0,-16px,0)";
        panel.style.opacity = "0";
        if (backdropRef.current) {
          backdropRef.current.style.transition = "opacity 150ms ease";
          backdropRef.current.style.opacity = "0";
        }
        setTimeout(onClose, 135);
        return;
      }
      closingRef.current = true;

      const current = panel.getBoundingClientRect().top;
      const remaining = Math.max(1, window.innerHeight - current);
      // a fast flick exits quickly; a slow release eases out
      const ms = Math.round(
        Math.max(150, Math.min(320, velocity > 0.3 ? remaining / velocity / 2 : 300))
      );

      panel.style.transition = `transform ${ms}ms cubic-bezier(0.32, 0.72, 0.24, 1)`;
      panel.style.transform = `translate3d(0, ${panel.offsetHeight + 60}px, 0)`;
      if (backdropRef.current) {
        backdropRef.current.style.transition = `opacity ${ms}ms ease`;
        backdropRef.current.style.opacity = "0";
      }
      setTimeout(onClose, ms - 20);
    },
    [onClose, top]
  );

  const animatedClose = useCallback(() => dismiss(0), [dismiss]);

  /**
   * The entrance keyframes use fill-mode `both`, and CSS animations outrank
   * inline styles — so until this is cleared, dragging the sheet has no visible
   * effect. Drop it as soon as the sheet has finished sliding in.
   */
  const clearEntranceAnimation = useCallback(() => {
    const panel = panelRef.current;
    if (panel) panel.style.animation = "none";
  }, []);

  useEffect(() => {
    // fallback for reduced-motion, where animationend never fires
    const t = setTimeout(clearEntranceAnimation, 420);
    return () => clearTimeout(t);
  }, [clearEntranceAnimation]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        animatedClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [animatedClose]);

  /* lock the page behind the modal — background scroll on touch feels broken */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  /* drag-to-dismiss (mobile bottom sheet). Native listeners because React's
     root touch handlers are passive and can't preventDefault scrolling. A
     top-anchored panel has no handle and no sheet gesture. */
  useEffect(() => {
    if (top) return;
    const panel = panelRef.current;
    if (!panel) return;

    let startY = 0;
    let lastY = 0;
    let lastT = 0;
    let velocity = 0;
    let active = false;
    let dragging = false;
    let grabOffset = 0; // dy at the moment the drag engages — keeps the start jump-free
    let pendingY = 0;
    let raf = 0;

    const setDrag = (y: number, animate: boolean) => {
      panel.style.transition = animate
        ? "transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)"
        : "none";
      panel.style.transform = y > 0 ? `translate3d(0,${y}px,0)` : "";
      if (backdropRef.current) {
        backdropRef.current.style.transition = animate ? "opacity 0.3s ease" : "none";
        backdropRef.current.style.opacity = String(
          1 - Math.min(1, y / Math.max(1, panel.offsetHeight)) * 0.9
        );
      }
    };

    const flushDrag = () => {
      raf = 0;
      setDrag(pendingY, false);
    };

    /* a touch inside a nested scrollable (estimate wheel, sweep list…) belongs to it */
    const insideNestedScroller = (el: HTMLElement | null): boolean => {
      while (el && el !== panel) {
        const style = getComputedStyle(el);
        if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight) return true;
        el = el.parentElement;
      }
      return false;
    };

    const onStart = (e: TouchEvent) => {
      if (window.innerWidth >= 640 || closingRef.current) return;
      const target = e.target as HTMLElement;
      const fromHandle = target.closest("[data-sheet-handle]") !== null;
      if (!fromHandle && insideNestedScroller(target)) return;
      active = true;
      dragging = false;
      grabOffset = 0;
      startY = lastY = e.touches[0].clientY;
      lastT = e.timeStamp;
      velocity = 0;
      panel.style.transition = "none"; // never fight a leftover transition mid-grab
      // the grab handle always drags, content drags only when scrolled to top
      if (fromHandle) dragging = true;
    };

    const onMove = (e: TouchEvent) => {
      if (!active) return;
      const y = e.touches[0].clientY;
      const dy = y - startY;
      const dt = e.timeStamp - lastT || 1;
      // smoothed velocity — a single jittery event shouldn't decide a flick
      velocity = velocity * 0.6 + ((y - lastY) / dt) * 0.4;
      lastY = y;
      lastT = e.timeStamp;

      if (!dragging) {
        if (dy > 4 && panel.scrollTop <= 0) {
          dragging = true;
          grabOffset = dy; // translation starts at 0 from here — no jump
        } else if (dy < -6) {
          active = false; // user is scrolling content upward
          return;
        } else return;
      }
      if (e.cancelable) e.preventDefault();
      pendingY = Math.max(0, dy - grabOffset);
      if (!raf) raf = requestAnimationFrame(flushDrag); // one style write per frame
    };

    const onEnd = () => {
      if (!active) return;
      active = false;
      if (!dragging) return;
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      const dy = Math.max(0, lastY - startY - grabOffset);
      // dismiss on a decisive pull, or on a flick from anywhere
      if (dy > panel.offsetHeight * 0.28 || (dy > 40 && velocity > 0.35)) {
        dismiss(velocity);
      } else {
        setDrag(0, true); // springs back to place
      }
    };

    panel.addEventListener("touchstart", onStart, { passive: true });
    panel.addEventListener("touchmove", onMove, { passive: false });
    panel.addEventListener("touchend", onEnd);
    panel.addEventListener("touchcancel", onEnd);
    return () => {
      panel.removeEventListener("touchstart", onStart);
      panel.removeEventListener("touchmove", onMove);
      panel.removeEventListener("touchend", onEnd);
      panel.removeEventListener("touchcancel", onEnd);
    };
  }, [dismiss, top]);

  if (!mounted) return null;

  /**
   * Rendered into <body>, never in place. The panel below sets
   * will-change: transform, which makes it a containing block for fixed
   * descendants — so a modal opened from inside another modal used to
   * position itself against that panel instead of the viewport, and the
   * bottom sheet came out broken. Portalling also stops a sheet inheriting
   * text styles from wherever its trigger happened to sit.
   */
  return createPortal(
    // bottom sheet on touch, genuinely centred on desktop — it used to sit at a
    // fixed 12vh from the top, which reads as centred only for the tallest
    // sheets. Top-anchored panels hug the top on a phone, keyboard territory
    // stays clear below.
    <div
      className={`fixed inset-0 z-50 flex justify-center sm:items-center sm:p-4 ${
        top ? "items-start p-3 pt-[max(0.75rem,env(safe-area-inset-top))]" : "items-end"
      }`}
    >
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]"
        aria-hidden
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) animatedClose();
        }}
      />
      {/* no-scrollbar on every sheet: a bar cutting through the rounded corner
          reads as a glitch, and the content makes it obvious when there is
          more to scroll */}
      <div
        ref={panelRef}
        data-modal-scroll
        onAnimationEnd={(e) => {
          // only the panel's own entrance, not animations from children
          if (e.target === e.currentTarget) clearEntranceAnimation();
        }}
        className={`${top ? "anim-modal-drop rounded-2xl max-h-[85dvh]" : "anim-modal rounded-t-3xl max-h-[92dvh] pb-[env(safe-area-inset-bottom)]"} no-scrollbar relative w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"} overflow-y-auto overscroll-contain border border-line bg-card shadow-2xl will-change-transform sm:rounded-2xl sm:pb-0`}
        role="dialog"
        aria-modal
      >
        {!top && (
          <div data-sheet-handle className="sticky top-0 z-20 -mb-3 flex touch-none justify-center pb-4 pt-2.5 sm:hidden" aria-hidden>
            <div className="h-1 w-10 rounded-full bg-ink-faint/40" />
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
}

export function EmptyState({
  emoji,
  icon,
  title,
  body,
  children,
}: {
  emoji?: string;
  /** 3D icon key from /public/img — preferred over emoji when available. */
  icon?: string;
  title: string;
  body?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="anim-rise flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      {icon ? <Icon3d name={icon} size={72} /> : <div className="text-4xl">{emoji}</div>}
      <div className="font-display text-2xl">{title}</div>
      {body && <p className="max-w-sm text-sm text-ink-soft">{body}</p>}
      {children}
    </div>
  );
}
