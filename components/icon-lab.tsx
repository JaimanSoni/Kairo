"use client";

import { useMemo, useState } from "react";
import { ICON_VARIANTS, renderIcon } from "@/lib/icon-variants";

/**
 * The icon lab: every candidate at every size that matters, with export.
 *
 * Judging an icon at 512px is how bad icons get chosen — the sizes that decide
 * whether it works are 48 and below, on both a light and a dark shelf. So each
 * candidate is shown exactly there, and the big preview is almost incidental.
 *
 * Exports happen in the browser from the same SVG string the preview renders,
 * so what you download is exactly what you approved.
 */

function Svg({ markup, size }: { markup: string; size: number }) {
  // The markup declares its export size (512); previews must override it or
  // every tile renders full-size and the grid turns into a pile-up.
  const sized = markup.replace('width="512" height="512"', `width="${size}" height="${size}"`);
  return (
    <span
      style={{ width: size, height: size, display: "inline-block", lineHeight: 0 }}
      // our own generated markup, no user input anywhere near it
      dangerouslySetInnerHTML={{ __html: sized }}
    />
  );
}

function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportPng(svgMarkup: string, size: number, filename: string) {
  const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not rasterise the SVG"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    canvas.getContext("2d")!.drawImage(img, 0, 0, size, size);
    const png = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG failed"))), "image/png")
    );
    download(filename, png);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** A shelf of icons on a given surface — how the OS will actually show it. */
function Shelf({ markup, dark }: { markup: string; dark: boolean }) {
  return (
    <div
      className="flex items-end gap-4 rounded-2xl px-4 py-3"
      style={{ background: dark ? "#101413" : "#e8eeec" }}
    >
      {[64, 48, 32, 16].map((s) => (
        <span key={s} className="flex flex-col items-center gap-1">
          <Svg markup={markup} size={s} />
          <span className={`text-[10px] tabular-nums ${dark ? "text-white/40" : "text-ink-faint"}`}>
            {s}
          </span>
        </span>
      ))}
    </div>
  );
}

export function IconLab() {
  const [selectedKey, setSelectedKey] = useState(ICON_VARIANTS[0].key);
  const selected = ICON_VARIANTS.find((v) => v.key === selectedKey) ?? ICON_VARIANTS[0];

  // one render per placement; ids stay unique across the page
  const big = useMemo(() => renderIcon(selected, "big"), [selected]);
  const maskable = useMemo(() => renderIcon(selected, "mask", { fullBleed: true }), [selected]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl tracking-tight sm:text-4xl">Icon lab</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-soft">
        Eight candidates, all built from the ✱ and the real palette. Judge them on the shelves —
        an icon lives at 48px on someone&apos;s home screen, not at 512 in a design review.
      </p>

      {/* the candidates */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ICON_VARIANTS.map((v) => {
          const markup = renderIcon(v, "grid");
          const active = v.key === selectedKey;
          return (
            <button
              key={v.key}
              onClick={() => setSelectedKey(v.key)}
              className={`flex flex-col items-center gap-2.5 rounded-2xl border bg-card p-4 transition-colors ${
                active ? "border-sun shadow-lg shadow-sun/10" : "border-line hover:border-ink-faint"
              }`}
            >
              <Svg markup={markup} size={96} />
              <span className="text-sm font-semibold">{v.name}</span>
            </button>
          );
        })}
      </div>

      {/* the chosen one, examined properly */}
      <section className="mt-10 rounded-3xl border border-line bg-card p-6 sm:p-8">
        <div className="flex flex-wrap items-start gap-8">
          <div className="shrink-0">
            <Svg markup={big} size={256} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl">{selected.name}</h2>
            <p className="mt-1 max-w-md text-sm leading-6 text-ink-soft">{selected.note}</p>

            <div className="mt-5 space-y-3">
              <Shelf markup={big} dark={false} />
              <Shelf markup={big} dark />
            </div>

            <div className="mt-5 flex items-center gap-4">
              <span className="text-xs text-ink-faint">Android maskable (circle crop):</span>
              <span
                className="inline-block overflow-hidden rounded-full"
                style={{ width: 72, height: 72 }}
              >
                <Svg markup={maskable} size={72} />
              </span>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                onClick={() =>
                  download(
                    `kairo-icon-${selected.key}.svg`,
                    new Blob([big], { type: "image/svg+xml" })
                  )
                }
                className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-paper hover:opacity-90"
              >
                SVG
              </button>
              {[1024, 512, 192].map((s) => (
                <button
                  key={s}
                  onClick={() => void exportPng(big, s, `kairo-icon-${selected.key}-${s}.png`)}
                  className="rounded-full border border-line bg-card px-4 py-2 text-xs font-semibold text-ink-soft transition-colors hover:border-sun hover:text-sun-deep"
                >
                  PNG {s}
                </button>
              ))}
              <button
                onClick={() =>
                  void exportPng(maskable, 512, `kairo-icon-${selected.key}-maskable-512.png`)
                }
                className="rounded-full border border-line bg-card px-4 py-2 text-xs font-semibold text-ink-soft transition-colors hover:border-sun hover:text-sun-deep"
              >
                PNG maskable
              </button>
            </div>
          </div>
        </div>
      </section>

      <p className="mt-6 text-xs leading-5 text-ink-faint">
        Picking one? Say the word and it becomes <code>app/icon.svg</code>, the apple-touch icon and
        the maskable PWA icon in one go — the exports here are the same files.
      </p>
    </div>
  );
}
