"use client";

import { useEffect, useState } from "react";
import { canvasToBlob, drawShareCard } from "@/lib/share-card";
import { track } from "@/lib/analytics-client";
import { Modal } from "./ui";

/**
 * Sharing a finished day with someone who's rooting for you.
 *
 * Two halves of the same idea: a quiet line while there's still work left, and
 * the card itself once the day is done.
 *
 * The card is drawn in the browser and previewed before it goes anywhere. Task
 * titles are the private contents of somebody's day, so nothing is generated on
 * a server and nothing is shared unseen.
 */

const CAPTIONS = [
  "Cleared the lot. Your move.",
  "Day: won. Receipts attached.",
  "Everything I said I'd do, done. Beat that.",
  "Certified productive human. One day only.",
];

/** Picked from the date, so the same day always shows the same line. */
function captionFor(date: string): string {
  let n = 0;
  for (const ch of date) n = (n + ch.charCodeAt(0)) % 9973;
  return CAPTIONS[n % CAPTIONS.length];
}

/* --------------------------------------------------------------- the nudge */

/**
 * Shown while the day is unfinished. Dismissible, and quiet by design — Kairo's
 * whole argument is that a list shouldn't make you feel bad, so this can be a
 * reason to finish but never a reproach for not having.
 */
export function BestieNudge({ remaining, done }: { remaining: number; done: number }) {
  const [hidden, setHidden] = useState(false);
  if (hidden || remaining <= 0) return null;

  return (
    <div className="anim-rise mt-4 flex items-start gap-3 rounded-2xl border border-sun/25 bg-sun-soft/40 px-4 py-3">
      <span className="mt-0.5 shrink-0 text-base" aria-hidden>
        👀
      </span>
      <p className="min-w-0 flex-1 text-[13px] leading-6 text-ink-soft">
        {done === 0
          ? "Your bestie might be waiting to see your progress. Finish today and you'll have something worth sending."
          : `${remaining} to go. Your bestie might be waiting to see how today went, clear these and you can share it.`}
      </p>
      <button
        onClick={() => setHidden(true)}
        aria-label="Hide this"
        className="shrink-0 text-ink-faint transition-opacity hover:opacity-70"
      >
        ✕
      </button>
    </div>
  );
}

/* --------------------------------------------------------------- the share */

export function ShareWithBestie({
  done,
  doneCount,
  dateLabel,
  name,
  picture,
  hiddenCount,
}: {
  /** Titles to print, already stripped of anything from a locked list. */
  done: string[];
  doneCount: number;
  dateLabel: string;
  name: string;
  picture?: string | null;
  /** How many finished tasks were withheld because their list is locked. */
  hiddenCount: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        data-track="share-bestie-open"
        className="anim-rise mt-5 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper shadow-lg shadow-ink/15 transition-transform active:scale-[0.99]"
      >
        <span aria-hidden>💌</span> Share it with your bestie
      </button>

      {open && (
        <ShareSheet
          done={done}
          doneCount={doneCount}
          dateLabel={dateLabel}
          name={name}
          picture={picture}
          hiddenCount={hiddenCount}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ShareSheet({
  done,
  doneCount,
  dateLabel,
  name,
  picture,
  hiddenCount,
  onClose,
}: {
  done: string[];
  doneCount: number;
  dateLabel: string;
  name: string;
  picture?: string | null;
  hiddenCount: number;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  // State, not a ref: whether the OS share sheet is offered depends on this,
  // and a ref wouldn't re-render the button in when the drawing finishes.
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const caption = `${captionFor(dateLabel)}\n\n${doneCount} done today with Kairo, kairo.jaimansoni.com`;

  // Drawn once, on open. The object URL is revoked on close so a big PNG isn't
  // left pinned in memory for the rest of the session.
  useEffect(() => {
    let alive = true;
    let created: string | null = null;

    (async () => {
      try {
        const canvas = await drawShareCard({ done, doneCount, dateLabel, name, picture });
        const blob = await canvasToBlob(canvas);
        if (!alive) return;
        created = URL.createObjectURL(blob);
        setFile(new File([blob], "kairo-day-won.png", { type: "image/png" }));
        setUrl(created);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Could not make the image");
      }
    })();

    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
    // done.join, not done: the array is rebuilt by every parent render, and
    // an identity dep made a tab refocus revoke the blob URL mid-preview
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done.join("\n"), doneCount, dateLabel, name, picture]);

  /** A true share sheet, where the browser has one — phones, mostly. */
  const canShareFile = Boolean(file && navigator.canShare?.({ files: [file] }));

  const share = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], text: caption });
      track("share-bestie-shared");
    } catch (err) {
      // AbortError just means they backed out of the sheet; not a failure
      if ((err as Error)?.name !== "AbortError") {
        setError("Sharing didn't work. Save the image and send it instead.");
      }
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
    } catch {
      setError("Couldn't copy, select the text and copy it manually.");
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="p-5 sm:p-6">
        <h2 id="bestie-share-title" className="font-display text-2xl">
          Send it to your bestie
        </h2>
        <p className="mt-1 text-[13px] leading-6 text-ink-soft">
          Made on your device. Nothing is posted anywhere, you choose where it goes.
        </p>

        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-paper-deep/40">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="A card showing the tasks you finished today" className="block w-full" />
          ) : (
            <div className="grid aspect-[4/5] place-items-center text-sm text-ink-faint">
              {error ?? "Drawing your day…"}
            </div>
          )}
        </div>

        {hiddenCount > 0 && (
          <p className="mt-3 rounded-xl bg-paper-deep px-3 py-2 text-xs leading-5 text-ink-soft">
            {hiddenCount} finished {hiddenCount === 1 ? "task is" : "tasks are"} in a locked list, so{" "}
            {hiddenCount === 1 ? "it isn't" : "they aren't"} on the card. Locked stays locked.
          </p>
        )}

        {error && url && <p className="mt-3 text-sm text-clay">{error}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          {canShareFile && (
            <button
              onClick={share}
              disabled={!url}
              className="flex-1 rounded-full bg-sun px-5 py-2.5 text-sm font-semibold text-on-accent shadow-lg shadow-sun/25 disabled:opacity-50"
            >
              Share
            </button>
          )}
          <a
            href={url ?? "#"}
            download="kairo-day-won.png"
            data-track="share-bestie-saved"
            aria-disabled={!url}
            className={`flex-1 rounded-full border border-line bg-card px-5 py-2.5 text-center text-sm font-semibold transition-colors hover:border-sun hover:text-sun-deep ${
              url ? "" : "pointer-events-none opacity-50"
            }`}
          >
            Save image
          </a>
          <button
            onClick={copy}
            className="rounded-full border border-line bg-card px-4 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:border-sun hover:text-sun-deep"
          >
            {copied ? "Copied ✓" : "Copy caption"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
