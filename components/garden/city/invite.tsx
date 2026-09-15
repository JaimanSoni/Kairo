"use client";

import { useState } from "react";
import { gardenApi } from "@/lib/habits-client";
import { track } from "@/lib/analytics-client";
import { useApp } from "../../store";
import { Modal } from "../../ui";
import { Plant } from "../plants";

const MESSAGE = "I saved you a plot next to my garden in Kairo City. Claim it, and let's grow better habits side by side.";

/**
 * A plot saved for a friend: the link to send them, the one tap that sends
 * it, and what happens when they claim it. Opened again from a saved plot,
 * it can also let the plot go.
 */
export function InviteSheet({ code, onClose, onCancelled }: { code: string; onClose: () => void; onCancelled: () => void }) {
  const { showToast } = useApp();
  const [copied, setCopied] = useState(false);
  const [letting, setLetting] = useState(false);
  const url = `${window.location.origin}/i/${code}`;

  const share = async () => {
    track("city-invite-share");
    try {
      if (navigator.share) {
        await navigator.share({ title: "A plot for you in Kairo City", text: MESSAGE, url });
        return;
      }
    } catch {
      return;
    }
    await copy();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${MESSAGE} ${url}`);
      setCopied(true);
      showToast({ message: "Invite copied. Send it to your friend." });
    } catch {
      showToast({ message: url });
    }
  };

  const letGo = async () => {
    setLetting(true);
    const r = await gardenApi.cancelInvite(code);
    setLetting(false);
    if (!r.ok) {
      showToast({ message: "That plot couldn't be let go just now." });
      return;
    }
    showToast({ message: "The plot is free again." });
    onCancelled();
  };

  return (
    <Modal onClose={onClose} anchor="top" above>
      <div className="p-5" data-invite-sheet={code}>
        {/* your garden, and the plot beside it waiting */}
        <div className="relative flex h-32 items-end justify-center gap-3 overflow-hidden rounded-2xl bg-[linear-gradient(180deg,#8ad0f6_0%,#d8f2fb_55%,#7cc46c_55%,#5aa651_100%)]" aria-hidden>
          <div className="flex w-[42%] flex-col items-center pb-2">
            <span className="mb-1 rounded-md bg-[#e9c89a] px-2 py-0.5 text-[10px] font-bold text-[#3b2716] shadow">You</span>
            <div className="flex items-end gap-1">
              <Plant species="apple" stage={5} size={46} fit="snug" />
              <Plant species="sunflower" stage={4} size={38} fit="snug" />
            </div>
          </div>
          <div className="city-invite mb-3 flex w-[42%] flex-col items-center rounded-xl border-2 border-dashed border-[#f4c95d] bg-white/40 px-2 py-3">
            <span className="rounded-md bg-[#ffe9a3] px-2 py-0.5 text-[10px] font-bold text-[#5c4300] shadow">Your friend</span>
            <span className="mt-1.5 text-[11px] font-semibold text-[#1c2624]">Saved for them</span>
          </div>
        </div>

        <h2 className="font-display mt-4 text-2xl leading-tight">Save this plot for a friend</h2>
        <p className="mt-1.5 text-sm text-ink-soft">
          Send them the link. When they claim it, they move in right next to you: you&apos;ll be on each other&apos;s Friends street, and you both get a bench for two in your
          gardens.
        </p>

        <div className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-paper py-1.5 pl-3 pr-1.5">
          <span className="min-w-0 flex-1 truncate text-sm text-ink-soft" data-invite-url>
            {url}
          </span>
          <button type="button" onClick={() => void copy()} className="h-8 shrink-0 rounded-lg px-3 text-xs font-semibold text-sun-deep hover:bg-sun-soft">
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <button
          type="button"
          onClick={() => void share()}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-sun text-sm font-bold text-on-accent shadow-sm transition-colors hover:bg-sun-deep"
          data-share-invite
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M8 10V2M8 2 5 5M8 2l3 3M3 9v4h10V9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Send the invite
        </button>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button type="button" onClick={() => void letGo()} disabled={letting} className="text-xs font-medium text-ink-faint hover:text-clay disabled:opacity-60" data-let-go>
            {letting ? "Letting go…" : "Let this plot go"}
          </button>
          <button type="button" onClick={onClose} className="h-9 rounded-full px-4 text-sm font-semibold text-ink-soft hover:bg-paper-deep">
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
