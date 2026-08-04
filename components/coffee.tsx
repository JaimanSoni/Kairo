"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { COFFEE, coffeeEnabled } from "@/lib/coffee";
import { markAsked, shouldAsk } from "@/lib/coffee-nudge";
import { track } from "@/lib/analytics-client";
import { CHECKOUT_SRC } from "./plan-cards";
import { IconX, Modal } from "./ui";
import { Icon3d } from "./img3d";

/** Max a tip jar should ever accept — a typo like 99999 is a typo, not a tip. */
const MAX_AMOUNT = 20000;

function CoffeeModal({ onClose, earned }: { onClose: () => void; earned?: boolean }) {
  const [amount, setAmount] = useState<number | null>(COFFEE.amounts[0]);
  const [custom, setCustom] = useState(false);
  const [customText, setCustomText] = useState("");
  const [cardBusy, setCardBusy] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  const customAmount = Number.parseInt(customText, 10);
  const customValid = Number.isFinite(customAmount) && customAmount > 0 && customAmount <= MAX_AMOUNT;
  const effective = custom ? (customValid ? customAmount : null) : amount;
  const canPay = effective != null;

  /**
   * The one payment path: Razorpay Checkout against /api/coffee/order, a tip
   * order that credits nothing and works signed out. Checkout itself offers
   * UPI, cards, netbanking and wallets, which is why the old direct-UPI QR
   * and deep links could retire.
   */
  const payByCard = async () => {
    const rupees = effective;
    if (rupees == null || cardBusy) return;
    setCardBusy(true);
    setCardError(null);
    try {
      const res = await fetch("/api/coffee/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: rupees }),
      });
      const data = (await res.json()) as {
        orderId?: string; amount?: number; currency?: string; keyId?: string; error?: string;
      };
      if (!res.ok || !data.orderId || !data.keyId) {
        throw new Error(data.error ?? "Couldn't start the payment");
      }
      const { ensureCheckout } = await import("./paywall");
      if (!(await ensureCheckout()) || !window.Razorpay) {
        throw new Error("Checkout didn't load, check your connection");
      }

      const rzp = new window.Razorpay({
        key: data.keyId,
        order_id: data.orderId,
        amount: data.amount,
        currency: data.currency,
        name: "Kairo",
        description: "Buy me a coffee",
        theme: { color: "#0c9384" },
        // nothing to verify or unlock: the webhook keeps the books, the
        // browser only gets to say thank you
        handler: () => {
          track("coffee-paid", { via: "card", amount: rupees });
          setPaid(true);
        },
        modal: { ondismiss: () => setCardBusy(false) },
      });
      rzp.on?.("payment.failed", (e: { error?: { description?: string } }) => {
        setCardError(e?.error?.description ?? "That payment didn't go through. Please try again.");
        setCardBusy(false);
      });
      rzp.open();
    } catch (err) {
      setCardError(err instanceof Error ? err.message : "Something went wrong");
      setCardBusy(false);
    }
  };

  if (paid) {
    return (
      <Modal onClose={onClose}>
        <div className="p-8 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-sun-soft" aria-hidden>
            <Icon3d name="coffee" size={30} />
          </span>
          <h2 className="mt-4 font-display text-2xl tracking-tight">Thank you, truly</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-ink-soft">
            The coffee landed, and it genuinely made my day. Kairo stays exactly the same, only
            now it runs on slightly better fuel.
          </p>
          <button
            onClick={onClose}
            className="mt-6 rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-paper transition-transform active:scale-[0.98]"
          >
            Back to it
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose}>
      {/* text-left: the modal renders where its trigger sits, so without this it
          inherits text-center from the landing footer and the whole sheet centres */}
      <div className="p-6 text-left">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sun-soft" aria-hidden>
            <Icon3d name="coffee" size={26} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl leading-tight tracking-tight">
              {earned ? <>Thank you for sticking around</> : <>Buy me a coffee</>}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              {earned ? (
                <>
                  You&apos;ve used Kairo three days running, and that genuinely means a lot. I
                  build and look after it on my own time. If it&apos;s been helping your days go a
                  little smoother, I&apos;d be really grateful for a coffee, and if not, please
                  just carry on enjoying it.
                </>
              ) : (
                <>
                  I build and look after Kairo on my own time, and I love that you&apos;re using
                  it. If it&apos;s been helping your days go a little smoother, a coffee would
                  honestly make my week. Only if you&apos;d like to, of course.
                </>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-faint hover:bg-paper-deep"
            aria-label="Close"
          >
            <IconX />
          </button>
        </div>

        <fieldset className="mt-6">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Amount
          </legend>
          <div className="flex flex-wrap gap-2">
            {COFFEE.amounts.map((a) => {
              const on = !custom && amount === a;
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => {
                    setCustom(false);
                    setAmount(a);
                  }}
                  aria-pressed={on}
                  className={`rounded-xl border px-4 py-2 text-sm font-semibold tabular-nums transition-colors ${
                    on
                      ? "border-sun bg-sun-soft text-sun-deep"
                      : "border-line bg-card text-ink-soft hover:border-sun/50"
                  }`}
                >
                  ₹{a}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setCustom(true)}
              aria-pressed={custom}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                custom
                  ? "border-sun bg-sun-soft text-sun-deep"
                  : "border-line bg-card text-ink-soft hover:border-sun/50"
              }`}
            >
              Custom
            </button>
          </div>

          {custom && (
            <div className="anim-rise mt-3">
              <div
                className={`flex items-center gap-1 rounded-xl border bg-card px-3.5 py-2.5 ${
                  customText && !customValid ? "border-clay" : "border-line focus-within:border-sun"
                }`}
              >
                <span className="text-sm font-semibold text-ink-faint">₹</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value.replace(/[^\d]/g, "").slice(0, 5))}
                  placeholder="Type an amount"
                  aria-label="Custom amount in rupees"
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:font-normal placeholder:text-ink-faint"
                />
              </div>
              {customText && !customValid && (
                <p className="mt-1.5 text-xs text-clay">
                  Enter an amount between ₹1 and ₹{MAX_AMOUNT.toLocaleString("en-IN")}.
                </p>
              )}
            </div>
          )}
        </fieldset>

        <div className="mt-6">
          <button
            type="button"
            onClick={() => void payByCard()}
            disabled={!canPay || cardBusy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sun px-5 py-3.5 text-base font-semibold text-on-accent shadow-lg shadow-sun/25 transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {cardBusy ? "Opening checkout…" : canPay ? `Pay ₹${effective}` : "Pick an amount"}
          </button>
          <p className="mt-2 text-center text-xs text-ink-faint">
            UPI, card, netbanking or wallet, through Razorpay.
          </p>
          {cardError && <p className="mt-2 text-center text-xs text-clay">{cardError}</p>}
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-ink-faint">
          {/* one string, not text-around-an-expression: JSX drops the space when a
              line wrap lands between the two, which silently ate it once already */}
          {`Goes straight to ${COFFEE.payeeName}. It's a thank-you, not a purchase, nothing unlocks, and Kairo stays exactly the same either way.`}
        </p>

        {/* loaded when the modal opens, never on the pages behind it */}
        <Script src={CHECKOUT_SRC} strategy="afterInteractive" />
      </div>
    </Modal>
  );
}

/**
 * Trigger + modal. Renders nothing at all when no UPI ID is configured, so a
 * partially-set-up deploy never shows a payment button that goes nowhere.
 */
export function CoffeeButton({ variant = "link" }: { variant?: "link" | "row" | "inline" }) {
  const [open, setOpen] = useState(false);
  if (!coffeeEnabled) return null;

  if (variant === "inline") {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 text-sm text-ink-faint transition-colors hover:text-sun-deep"
        >
          <Icon3d name="coffee" size={18} />
          <span>
            Enjoying Kairo?{" "}
            <span className="font-semibold underline underline-offset-2">Buy me a coffee</span>
          </span>
        </button>
        {open && <CoffeeModal onClose={() => setOpen(false)} />}
      </>
    );
  }

  return (
    <>
      {variant === "row" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 flex w-full items-center justify-between rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:border-sun hover:text-sun-deep"
        >
          <span className="flex items-center gap-2">
            <Icon3d name="coffee" size={16} /> Buy me a coffee
          </span>
          <span aria-hidden>→</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="underline underline-offset-2 transition-colors hover:text-ink-soft"
        >
          <Icon3d name="coffee" size={15} /> Buy me a coffee
        </button>
      )}

      {open && <CoffeeModal onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * Asks once, after three separate days of use — see lib/coffee-nudge.
 *
 * Deliberately yields to whatever else is on screen: the morning sweep, the
 * capture bar, an open task, the lock gate, a running timer. Landing on top of
 * the thing someone actually opened the app to do would make the ask feel like
 * an ad, and it only gets one chance.
 */
export function CoffeeNudge({ busy, today }: { busy: boolean; today: string }) {
  const [open, setOpen] = useState(false);
  const [due, setDue] = useState(false);
  /**
   * Latches the moment we ask, and never unlatches.
   *
   * Without it, closing the sheet put `open` back to false, which re-ran the
   * effect below, found `due` still true, and scheduled the whole thing again
   * — so dismissing it just delayed it by a second. markAsked() stops it
   * coming back tomorrow; this stops it coming back immediately.
   */
  const askedRef = useRef(false);

  useEffect(() => {
    if (!coffeeEnabled) return;
    // one tick after mount so the first paint is never delayed by this
    const t = setTimeout(() => setDue(shouldAsk(today)), 0);
    return () => clearTimeout(t);
  }, [today]);

  useEffect(() => {
    if (!due || busy || askedRef.current) return;
    // a short beat after the screen settles, so it reads as considered
    const t = setTimeout(() => {
      askedRef.current = true;
      markAsked();
      setOpen(true);
    }, 1200);
    return () => clearTimeout(t);
  }, [due, busy]);

  if (!open) return null;
  return <CoffeeModal earned onClose={() => setOpen(false)} />;
}
