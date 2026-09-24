"use client";

/**
 * The morning update, written for you, on the page you are already looking at.
 *
 * Kairo knows what got ticked off yesterday and what is planned today, which
 * is the whole content of the message. What it cannot know is how your team
 * says things, so the message arrives in a box you can edit before it goes
 * anywhere -- it is a first draft that is right most mornings, not a thing
 * that posts itself.
 *
 * Copy puts two flavours on the clipboard: plain text for anywhere, and HTML
 * so that Slack, which takes rich text, keeps the bullets as bullets and the
 * link as a link.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "./store";
import { Modal } from "./ui";
import { signsOff, standupHtml, standupText, wantsStandup, type StandupLines } from "@/lib/standup";
import { track } from "@/lib/analytics-client";

/** Midnight to midnight, yesterday, where the person actually is. */
function yesterdayWindow(): { from: string; to: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const from = new Date(start);
  from.setDate(from.getDate() - 1);
  return { from: from.toISOString(), to: start.toISOString() };
}

type State =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "ready"; text: string; lines: StandupLines; signed: boolean }
  | { kind: "empty" }
  | { kind: "failed" };

export function StandupButton() {
  const { state } = useApp();
  const [phase, setPhase] = useState<State>({ kind: "idle" });
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);

  const run = useCallback(async () => {
    setPhase({ kind: "working" });
    setCopied(false);
    try {
      const res = await fetch("/api/standup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ today: state.today, ...yesterdayWindow() }),
      });
      if (res.status === 422) {
        setPhase({ kind: "empty" });
        return;
      }
      if (!res.ok) {
        setPhase({ kind: "failed" });
        return;
      }
      const body = (await res.json()) as { text: string; lines: StandupLines; signed: boolean };
      setPhase({ kind: "ready", text: body.text, lines: body.lines, signed: body.signed });
    } catch {
      setPhase({ kind: "failed" });
    }
  }, [state.today]);

  const open = () => {
    track("standup");
    void run();
  };

  const close = () => setPhase({ kind: "idle" });

  /**
   * Copy what is in the box, not what the model wrote: the edits are the
   * point. The rich flavour is rebuilt from the edited text so a line added
   * by hand is a bullet too.
   */
  const copy = async () => {
    const text = phase.kind === "ready" ? (box.current?.value ?? phase.text) : "";
    if (!text) return;
    const signed = phase.kind === "ready" && phase.signed;
    try {
      const html = htmlFromText(text, signed);
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([text], { type: "text/plain" }),
            "text/html": new Blob([html], { type: "text/html" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // a browser that will not give us the clipboard: the text is selectable
      box.current?.select();
    }
  };

  useEffect(() => {
    if (phase.kind === "ready") queueMicrotask(() => box.current?.focus());
  }, [phase.kind]);

  if (!wantsStandup(state.user.email) || state.user.guest) return null;

  return (
    <>
      <button
        onClick={open}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-paper transition-transform active:scale-[0.99] sm:w-auto"
        data-standup-open
      >
        <SlackGlyph />
        Write my update
      </button>

      {phase.kind !== "idle" && (
        <Modal onClose={close}>
          <div className="p-5 sm:p-6" data-standup>
            <h2 className="font-display text-2xl leading-tight">Your update</h2>
            <p className="mt-1 text-sm text-ink-soft">
              {phase.kind === "ready"
                ? "Out of what you finished yesterday and what's on today. Change anything that isn't how you'd say it."
                : phase.kind === "working"
                  ? "Reading yesterday and today…"
                  : phase.kind === "empty"
                    ? "There's nothing to write about yet."
                    : "That didn't work."}
            </p>

            {phase.kind === "working" && (
              <div className="mt-5 flex items-center gap-3 py-6" role="status">
                <span className="cap-dots flex gap-1" aria-hidden>
                  <span />
                  <span />
                  <span />
                </span>
                <span className="text-sm text-ink-soft">Putting it in your words…</span>
              </div>
            )}

            {phase.kind === "empty" && (
              <p className="mt-4 rounded-xl bg-paper-deep px-3.5 py-3 text-[13px] leading-5 text-ink-soft">
                Nothing was ticked off yesterday and nothing is planned for today, so there is nothing to report. Tick
                something off, or plan your day first.
              </p>
            )}

            {phase.kind === "failed" && (
              <p className="mt-4 rounded-xl bg-paper-deep px-3.5 py-3 text-[13px] leading-5 text-ink-soft">
                Couldn&apos;t write it just now. Nothing was changed, and trying again usually does it.
              </p>
            )}

            {phase.kind === "ready" && (
              <textarea
                ref={box}
                defaultValue={phase.text}
                rows={Math.min(20, phase.text.split("\n").length + 2)}
                spellCheck
                className="mt-4 w-full resize-y rounded-xl border border-line bg-paper px-3.5 py-3 font-mono text-[13px] leading-6 outline-none focus:border-ink-faint"
                data-standup-text
              />
            )}

            <div className="mt-5 flex items-center justify-between gap-2">
              <button onClick={close} className="-ml-2 rounded-full px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-paper-deep">
                Close
              </button>
              <div className="flex items-center gap-2">
                {(phase.kind === "ready" || phase.kind === "failed") && (
                  <button
                    onClick={() => void run()}
                    className="rounded-full px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-paper-deep"
                    data-standup-again
                  >
                    {phase.kind === "failed" ? "Try again" : "Write it again"}
                  </button>
                )}
                {phase.kind === "ready" && (
                  <button
                    onClick={() => void copy()}
                    className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper"
                    data-standup-copy
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

/**
 * The edited text, as rich text. Anything under a heading is a bullet, and
 * the sign-off's "kairo" becomes the link it is meant to be.
 */
function htmlFromText(text: string, signed: boolean): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const out: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) out.push(`<ul>${list.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`);
    list = [];
  };
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      out.push("<br>");
      continue;
    }
    const bullet = trimmed.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      list.push(bullet[1]);
      continue;
    }
    flush();
    if (signed && /sent using Kairo/i.test(trimmed)) {
      out.push(
        `<div>${esc(trimmed.replace(/kairo\s*$/i, ""))}<a href="https://kairo.jaimansoni.com">kairo</a></div>`
      );
      continue;
    }
    out.push(`<div>${esc(trimmed)}</div>`);
  }
  flush();
  return out.join("");
}

function SlackGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 9.5h2.5V12A1.25 1.25 0 1 1 3 12zM6.5 9.5A1.25 1.25 0 0 1 9 9.5V12a1.25 1.25 0 0 1-2.5 0zM12.5 6.5H10V4a1.25 1.25 0 1 1 2.5 0zM9 6.5A1.25 1.25 0 0 1 6.5 6.5V4a1.25 1.25 0 0 1 2.5 0z"
        fill="currentColor"
      />
    </svg>
  );
}

/* re-exported so the Today view can ask the same question without the import dance */
export { wantsStandup, standupText, standupHtml, signsOff };
