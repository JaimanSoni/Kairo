"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { COFFEE, coffeeEnabled, upiLink } from "@/lib/coffee";
import { IconCheck, IconX, Modal } from "./ui";

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

function CoffeeModal({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState<number | null>(COFFEE.amounts[1]);
  const isTouch = useIsTouch();
  const link = upiLink(amount);

  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sun-soft text-xl" aria-hidden>
            ☕
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold">Buy me a coffee</h2>
            <p className="mt-0.5 text-sm leading-snug text-ink-soft">
              Kairo is free and always will be. If it earned a spot in your day, a coffee keeps it
              going.
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
            {COFFEE.amounts.map((a, i) => (
              <button
                key={a}
                type="button"
                onClick={() => setAmount(a)}
                aria-pressed={amount === a}
                className={`rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors ${
                  amount === a
                    ? "border-sun bg-sun-soft text-sun-deep"
                    : "border-line bg-card text-ink-soft hover:border-sun/50"
                }`}
              >
                <span aria-hidden>{"☕".repeat(i + 1)}</span> ₹{a}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAmount(null)}
              aria-pressed={amount === null}
              className={`rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors ${
                amount === null
                  ? "border-sun bg-sun-soft text-sun-deep"
                  : "border-line bg-card text-ink-soft hover:border-sun/50"
              }`}
            >
              Any amount
            </button>
          </div>
        </fieldset>

        {isTouch ? (
          <div className="mt-6">
            <a
              href={link}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sun px-5 py-3.5 text-base font-semibold text-on-accent shadow-lg shadow-sun/25 transition-transform active:scale-[0.98]"
            >
              {amount == null ? "Pay with any UPI app" : `Pay ₹${amount}`}
            </a>
            <p className="mt-2 text-center text-xs text-ink-faint">
              Opens GPay, PhonePe, Paytm — whichever you use. Nothing happened? Copy the ID below.
            </p>
          </div>
        ) : (
          <div className="mt-6">
            <div className="mx-auto max-w-[13rem] rounded-2xl bg-white p-3 shadow-sm ring-1 ring-line">
              <QrCode value={link} />
            </div>
            <p className="mt-3 text-center text-xs text-ink-faint">
              Scan with any UPI app
              {amount != null && <> — it&apos;ll prefill ₹{amount}</>}
            </p>
          </div>
        )}

        <div className="mt-4">
          <CopyableId />
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-ink-faint">
          Goes straight to {COFFEE.payeeName} over UPI. No account, no subscription, nothing
          unlocks — Kairo works the same either way.
        </p>
      </div>
    </Modal>
  );
}

/**
 * Trigger + modal. Renders nothing at all when no UPI ID is configured, so a
 * partially-set-up deploy never shows a payment button that goes nowhere.
 */
export function CoffeeButton({ variant = "link" }: { variant?: "link" | "row" }) {
  const [open, setOpen] = useState(false);
  if (!coffeeEnabled) return null;

  return (
    <>
      {variant === "row" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 flex w-full items-center justify-between rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:border-sun hover:text-sun-deep"
        >
          <span className="flex items-center gap-2">
            <span aria-hidden>☕</span> Buy me a coffee
          </span>
          <span aria-hidden>→</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="underline underline-offset-2 transition-colors hover:text-ink-soft"
        >
          <span aria-hidden>☕</span> Buy me a coffee
        </button>
      )}

      {open && <CoffeeModal onClose={() => setOpen(false)} />}
    </>
  );
}
