"use client";

/**
 * The moment a guest reaches for something only an account can hold.
 *
 * Kairo lets people in without signing in, which means the ask has to land
 * somewhere. The worst place is the door: a page that says "sign in to
 * continue" over an empty screen tells you nothing about what you would be
 * signing into. The best place is here -- they have seen the thing, reached
 * for it, and the ask is the answer to something they just did.
 *
 * So it says what happens next rather than what is missing, and "look around
 * first" is always there, because somebody who wanted to sign in would have.
 */

import { GoogleBadge } from "./guest-mode";
import { Modal } from "./ui";
import { track } from "@/lib/analytics-client";

export function GuestAsk({
  title,
  body,
  action,
  where,
  onClose,
}: {
  title: string;
  /** What signing in gets them, in their own terms. */
  body: string;
  /** The button's words: "Sign in and plant it", not "Sign in". */
  action: string;
  /** Which reach this was, for the funnel. */
  where: string;
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose}>
      <div className="p-6 text-center" data-guest-ask={where}>
        <h2 className="font-display text-2xl leading-tight tracking-tight">{title}</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink-soft">{body}</p>
        <a
          href="/api/auth/google"
          data-track="guest-signin"
          onClick={() => track("guest-ask", { where })}
          className="mt-5 flex w-full items-center justify-center gap-3 rounded-full bg-sun py-2.5 pl-2.5 pr-6 text-sm font-semibold text-on-accent shadow-lg shadow-sun/25 transition-transform active:scale-[0.99]"
        >
          <GoogleBadge size={30} /> {action}
        </a>
        <button
          onClick={onClose}
          className="mt-2 w-full rounded-full px-5 py-2 text-sm font-medium text-ink-faint hover:text-ink"
          data-guest-ask-dismiss
        >
          Look around first
        </button>
      </div>
    </Modal>
  );
}
