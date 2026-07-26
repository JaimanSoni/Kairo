"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { COFFEE, coffeeEnabled, upiLink } from "@/lib/coffee";
import { markAsked, shouldAsk } from "@/lib/coffee-nudge";
import { IconCheck, IconX, Modal } from "./ui";
import { Icon3d } from "./img3d";

const TOUCH_QUERY = "(hover: none) and (pointer: coarse)";

/**
 * True on phones and tablets — the only places a `upi://` link resolves to an
 * actual app. Read through useSyncExternalStore so the server snapshot is a
 * stable `false` (desktop) and hydration can't mismatch.
 */
function useIsTouch() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(TOUCH_QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(TOUCH_QUERY).matches,
    () => false
  );
}

/**
 * Renders the UPI string as a QR. Always dark-on-white regardless of theme —
 * an inverted QR defeats some scanners, and a tip nobody can scan is worse
 * than an ugly one. The 4-module quiet zone lives in the viewBox so it can't
 * be squeezed out by CSS.
 */
function QrCode({ value }: { value: string }) {
  const [qr, setQr] = useState<{ d: string; count: number } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // loaded on demand: the encoder never ships to anyone who doesn't tip
    import("qrcode-generator")
      .then(({ default: qrcode }) => {
        if (cancelled) return;
        const code = qrcode(0, "M");
        code.addData(value);
        code.make();
        const count = code.getModuleCount();
        let d = "";
        for (let r = 0; r < count; r++) {
          for (let c = 0; c < count; c++) {
            if (code.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
          }
        }
        setQr({ d, count });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (failed) {
    return (
      <div className="grid aspect-square w-full place-items-center rounded-2xl bg-paper-deep p-6 text-center text-xs text-ink-soft">
        Couldn&apos;t draw the QR — the UPI ID below works just as well.
      </div>
    );
  }

  if (!qr) {
    return <div className="aspect-square w-full animate-pulse rounded-2xl bg-paper-deep" />;
  }

  const pad = 4;
  const span = qr.count + pad * 2;
  return (
    <svg
      viewBox={`${-pad} ${-pad} ${span} ${span}`}
      className="aspect-square w-full rounded-2xl"
      shapeRendering="crispEdges"
      role="img"
      aria-label={`UPI QR code for ${COFFEE.upiId}`}
    >
      <rect x={-pad} y={-pad} width={span} height={span} fill="#ffffff" />
      <path d={qr.d} fill="#0f1413" />
    </svg>
  );
}

function CopyableId() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(COFFEE.upiId);
          setCopied(true);
        } catch {
          /* clipboard blocked — the ID is on screen to type manually */
        }
      }}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-card px-3.5 py-2.5 text-left transition-colors hover:border-sun"
    >
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          UPI ID
        </span>
        <span className="block truncate font-mono text-sm">{COFFEE.upiId}</span>
      </span>
      <span
        className={`shrink-0 text-xs font-semibold ${copied ? "text-moss" : "text-sun-deep"}`}
      >
        {copied ? (
          <span className="flex items-center gap-1">
            <IconCheck size={13} /> Copied
          </span>
        ) : (
          "Copy"
        )}
      </span>
    </button>
  );
}

/** Max a tip jar should ever accept — a typo like 99999 is a typo, not a tip. */
const MAX_AMOUNT = 20000;

function CoffeeModal({ onClose, earned }: { onClose: () => void; earned?: boolean }) {
  const [amount, setAmount] = useState<number | null>(COFFEE.amounts[0]);
  const [custom, setCustom] = useState(false);
  const [customText, setCustomText] = useState("");
  const isTouch = useIsTouch();

  const customAmount = Number.parseInt(customText, 10);
  const customValid = Number.isFinite(customAmount) && customAmount > 0 && customAmount <= MAX_AMOUNT;
  const effective = custom ? (customValid ? customAmount : null) : amount;
  const link = upiLink(effective);
  const canPay = effective != null;

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
                  little smoother, I&apos;d be really grateful for a coffee — and if not, please
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

        {isTouch ? (
          <div className="mt-6">
            <a
              href={link}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sun px-5 py-3.5 text-base font-semibold text-on-accent shadow-lg shadow-sun/25 transition-transform active:scale-[0.98]"
            >
              {canPay ? `Pay ₹${effective}` : "Pay with any UPI app"}
            </a>
            <p className="mt-2 text-center text-xs text-ink-faint">
              Opens GPay, PhonePe or Paytm — whichever you prefer. If nothing opens, the ID below works too.
            </p>
          </div>
        ) : (
          <div className="mt-6">
            <div className="mx-auto max-w-[13rem] rounded-2xl bg-white p-3 shadow-sm ring-1 ring-line">
              <QrCode value={link} />
            </div>
            <p className="mt-3 text-center text-xs text-ink-faint">
              Scan with any UPI app
              {canPay && <> — it&apos;ll prefill ₹{effective}</>}
            </p>
          </div>
        )}

        <div className="mt-4">
          <CopyableId />
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-ink-faint">
          {/* one string, not text-around-an-expression: JSX drops the space when a
              line wrap lands between the two, which silently ate it once already */}
          {`Goes straight to ${COFFEE.payeeName} over UPI. It's a thank-you, not a purchase — nothing unlocks, and Kairo stays exactly the same either way.`}
        </p>
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

  useEffect(() => {
    if (!coffeeEnabled) return;
    // one tick after mount so the first paint is never delayed by this
    const t = setTimeout(() => setDue(shouldAsk(today)), 0);
    return () => clearTimeout(t);
  }, [today]);

  useEffect(() => {
    if (!due || busy || open) return;
    // a short beat after the screen settles, so it reads as considered
    const t = setTimeout(() => {
      setOpen(true);
      markAsked();
    }, 1200);
    return () => clearTimeout(t);
  }, [due, busy, open]);

  if (!open) return null;
  return <CoffeeModal earned onClose={() => setOpen(false)} />;
}
