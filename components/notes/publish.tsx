"use client";

import { useState } from "react";
import { notesApi } from "@/lib/notes-client";
import type { NoteMeta } from "@/lib/notes-shared";
import { track } from "@/lib/analytics-client";
import { useApp } from "../store";
import { Modal } from "../ui";

/**
 * Sharing one page with the world: a switch, and the link it makes.
 *
 * Read-only and one page deep — sub-pages stay private unless they are
 * shared too. The address is kept once made, so turning sharing off and on
 * again gives back the same link rather than quietly breaking the one already
 * sent.
 */
export function PublishSheet({ page, onClose, onChanged }: { page: NoteMeta; onClose: () => void; onChanged: (page: NoteMeta) => void }) {
  const { showToast } = useApp();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const shared = page.shared;
  const url = page.shareSlug ? `${window.location.origin}/p/${page.shareSlug}` : "";

  const set = async (on: boolean) => {
    if (busy) return;
    setBusy(true);
    const r = await notesApi.setShared(page.id, on);
    setBusy(false);
    if (!r.ok) {
      showToast({ message: r.kind === "invalid" || r.kind === "locked" ? r.message : "That didn't go through. Try again." });
      return;
    }
    track(on ? "note-published" : "note-unpublished");
    onChanged(r.data.page);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast({ message: url });
    }
  };

  return (
    <Modal onClose={onClose} anchor="top">
      <div className="p-5" data-publish-sheet>
        <h2 className="font-display text-2xl leading-tight">Share this page</h2>
        <p className="mt-1 text-sm text-ink-soft">Anyone with the link can read it. Nobody can change it, and nothing else of yours comes with it.</p>

        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-card p-3">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{shared ? "Live on the web" : "Share to web"}</span>
            <span className="block text-xs text-ink-faint">{shared ? "The link below works for anyone who has it." : "Makes a link nobody can guess."}</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={shared}
            aria-label="Share this page to the web"
            disabled={busy}
            onClick={() => void set(!shared)}
            className={`relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:opacity-60 ${shared ? "bg-sun" : "bg-line"}`}
            data-publish-toggle
          >
            <span className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform ${shared ? "translate-x-4" : ""}`} />
          </button>
        </div>

        {shared && url && (
          <div className="mt-3">
            <div className="flex items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm text-ink-soft" data-publish-url>
                {url}
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button type="button" onClick={() => void copy()} className="h-10 flex-1 rounded-full bg-sun text-sm font-bold text-on-accent transition-colors hover:bg-sun-deep" data-copy-public>
                {copied ? "Copied" : "Copy link"}
              </button>
              <a href={url} target="_blank" rel="noreferrer noopener" className="flex h-10 items-center rounded-full border border-line px-4 text-sm font-semibold text-ink-soft transition-colors hover:border-ink-faint hover:text-ink">
                Open
              </a>
            </div>
          </div>
        )}

        <ul className="mt-4 space-y-1.5 text-xs leading-5 text-ink-faint">
          <li>Only this page. Pages inside it stay private until you share them too.</li>
          <li>Search engines are asked not to list it, so it stays a link you hand out.</li>
          <li>Edits show up on the shared page as you make them.</li>
          <li>A locked page can&apos;t be shared.</li>
        </ul>

        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className="h-9 rounded-full px-4 text-sm font-semibold text-ink-soft hover:bg-paper-deep">
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
