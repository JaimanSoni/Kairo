"use client";

import { useEffect } from "react";
import { COVERS } from "@/lib/notes-shared";
import { ICON_NAMES, PAGE_ICONS, pageIconKey } from "@/lib/icons";
import { Icon3d } from "../img3d";
import { GlyphPage } from "./glyphs";

/**
 * A page's icon, wherever a page is listed: one of Kairo's 3D icons, or the
 * plain page mark when it has none (or an old emoji with no match).
 */
export function PageIcon({ icon, size = 18, className = "" }: { icon: string | null | undefined; size?: number; className?: string }) {
  const key = pageIconKey(icon);
  if (key) return <Icon3d name={key} size={size} className={className} />;
  return <GlyphPage size={Math.round(size * 0.85)} className={`text-ink-faint ${className}`} />;
}

/**
 * The page icon and cover pickers. Both are popovers anchored where they were
 * opened, closed by a click anywhere else or Escape.
 */

function Popover({
  onClose,
  className = "",
  children,
  label,
}: {
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
  label: string;
}) {
  // Escape closes it wherever focus is: a click in the page hands focus back to the editor
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <>
      <button type="button" aria-hidden tabIndex={-1} className="nt-float fixed inset-0 z-[70] cursor-default" onClick={onClose} />
      <div
        role="dialog"
        aria-label={label}
        className={`nt-float anim-pop absolute z-[71] w-[min(21rem,calc(100vw-2rem))] rounded-2xl border border-line bg-card p-2 shadow-2xl shadow-ink/10 ${className}`}
      >
        {children}
      </div>
    </>
  );
}

function PickerHead({ title, onRemove }: { title: string; onRemove?: () => void }) {
  return (
    <div className="flex h-7 items-center justify-between px-1.5 pb-1">
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-faint">{title}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} className="rounded-md px-1.5 py-0.5 text-xs font-medium text-ink-soft hover:bg-clay-soft hover:text-clay">
          Remove
        </button>
      )}
    </div>
  );
}

export function IconPicker({
  current,
  onPick,
  onRemove,
  onClose,
  className,
  label = "Choose an icon",
}: {
  current: string | null;
  onPick: (key: string) => void;
  onRemove?: () => void;
  onClose: () => void;
  className?: string;
  label?: string;
}) {
  const selected = pageIconKey(current);
  return (
    <Popover onClose={onClose} className={className} label={label}>
      <PickerHead title="Icons" onRemove={onRemove} />
      <div className="grid grid-cols-6 gap-1 p-0.5">
        {PAGE_ICONS.map((key, i) => (
          <button
            key={key}
            type="button"
            autoFocus={selected ? key === selected : i === 0}
            onClick={() => onPick(key)}
            aria-label={ICON_NAMES[key]}
            aria-pressed={key === selected}
            title={ICON_NAMES[key]}
            className={`group grid aspect-square place-items-center rounded-xl outline-none transition-all hover:bg-paper-deep focus-visible:ring-2 focus-visible:ring-sun ${
              key === selected ? "bg-sun-soft ring-2 ring-sun" : ""
            }`}
          >
            <Icon3d name={key} size={30} className="transition-transform group-hover:scale-105" />
          </button>
        ))}
      </div>
    </Popover>
  );
}

export function CoverPicker({
  current,
  onPick,
  onRemove,
  onClose,
  className,
}: {
  current: string | null;
  onPick: (key: string) => void;
  onRemove?: () => void;
  onClose: () => void;
  className?: string;
}) {
  return (
    <Popover onClose={onClose} className={className} label="Choose a cover">
      <PickerHead title="Covers" onRemove={onRemove} />
      <div className="grid grid-cols-2 gap-2 p-1">
        {COVERS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => onPick(c.key)}
            aria-label={`${c.label} cover`}
            aria-pressed={current === c.key}
            className={`group relative h-16 overflow-hidden rounded-xl transition-transform hover:scale-[1.02] ${
              current === c.key ? "ring-2 ring-sun ring-offset-2 ring-offset-card" : ""
            }`}
            style={{ background: c.css }}
          >
            <span className="absolute bottom-1.5 left-2 rounded-md bg-black/25 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
              {c.label}
            </span>
          </button>
        ))}
      </div>
    </Popover>
  );
}
