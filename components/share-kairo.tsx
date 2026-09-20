"use client";

import { useState } from "react";
import { Modal } from "./ui";
import { SITE_URL } from "@/lib/site";

/**
 * Passing Kairo on to someone.
 *
 * Distinct from the "day won" card, which shares what *you* did. This shares
 * the app, and it is deliberately plain: a link and a sentence, with no
 * referral code, no reward and no tracking parameter. A recommendation carries
 * because a friend meant it, and a URL with a campaign tag on the end quietly
 * says otherwise.
 */

const PITCH =
  "Kairo is my whole day in one place: I plan the day, keep my habits, and watch them grow into a garden. It's the first one I've actually kept using.";

const SHARE_URL = SITE_URL;

export function ShareKairoSheet({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const message = `${PITCH}\n\n${SHARE_URL}`;

  const nativeShare = async () => {
    try {
      await navigator.share({ title: "Kairo", text: PITCH, url: SHARE_URL });
    } catch (err) {
      // backing out of the OS sheet isn't a failure worth reporting
      if ((err as Error)?.name !== "AbortError") setError("Sharing didn't work, copy the link instead.");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      setError("Couldn't copy, select the link and copy it manually.");
    }
  };

  /**
   * Channels for desktop, where there is no OS share sheet. Each one opens a
   * compose window with the text already in it; none of them post anything.
   */
  const channels = [
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodeURIComponent(message)}`,
    },
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(PITCH)}&url=${encodeURIComponent(SHARE_URL)}`,
    },
    {
      label: "Email",
      href: `mailto:?subject=${encodeURIComponent("You might like this")}&body=${encodeURIComponent(message)}`,
    },
  ];

  return (
    <Modal onClose={onClose}>
      <div className="p-5 sm:p-6">
        <h2 className="font-display text-2xl">Tell a friend</h2>
        <p className="mt-1 text-[13px] leading-6 text-ink-soft">
          No referral codes, no rewards, just the link. Say it in your own words if you like.
        </p>

        <div className="mt-4 rounded-2xl border border-line bg-paper-deep/40 p-4">
          <p className="text-[13px] leading-6 text-ink-soft">{PITCH}</p>
          <p className="mt-2 break-all font-medium text-sun-deep">{SHARE_URL}</p>
        </div>

        {error && <p className="mt-3 text-sm text-clay">{error}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          {/* the OS sheet where there is one — phones, mostly */}
          {typeof navigator !== "undefined" && "share" in navigator && (
            <button
              onClick={nativeShare}
              className="flex-1 rounded-full bg-sun px-5 py-2.5 text-sm font-semibold text-on-accent shadow-lg shadow-sun/25"
            >
              Share
            </button>
          )}
          <button
            onClick={copy}
            className="flex-1 rounded-full border border-line bg-card px-5 py-2.5 text-sm font-semibold transition-colors hover:border-sun hover:text-sun-deep"
          >
            {copied ? "Copied ✓" : "Copy link"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {channels.map((ch) => (
            <a
              key={ch.label}
              href={ch.href}
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-full border border-line bg-card px-4 py-2 text-center text-xs font-medium text-ink-soft transition-colors hover:border-sun hover:text-sun-deep"
            >
              {ch.label}
            </a>
          ))}
        </div>
      </div>
    </Modal>
  );
}
