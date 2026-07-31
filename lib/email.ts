import { getDb, withDbRetry } from "./db";
import { SUPPORT_EMAIL } from "./site";

/**
 * Email, over Resend's REST API — no SDK, one endpoint, same reasoning as
 * lib/razorpay.ts.
 *
 * Two rules govern everything here:
 *
 * 1. Every send is idempotent, keyed the way payments are. The key is claimed
 *    by inserting into the `emails` collection under a unique index BEFORE
 *    Resend is called; whoever wins the insert sends, and a retried webhook,
 *    a re-run cron or a double-clicked button finds the claim and stops.
 *    Nobody ever receives the same email twice.
 *
 * 2. Email never blocks the thing it announces. The receipt fires after a
 *    payment is credited; if sending fails, the credit stands and the failure
 *    is logged. Callers use `void notify(...)` and move on.
 *
 * EMAIL_DRY=1 logs instead of sending — set in .env.local on purpose, because
 * the local server shares the production database and a local test must never
 * mail a real customer.
 */

const RESEND_API = "https://api.resend.com/emails";
const API_KEY = process.env.RESEND_API_KEY ?? "";
const FROM = process.env.EMAIL_FROM ?? "Kairo <hello@kairo.jaimansoni.com>";
const REPLY_TO = process.env.EMAIL_REPLY_TO ?? SUPPORT_EMAIL;
const DRY = () => process.env.EMAIL_DRY === "1";

export function emailConfigured(): boolean {
  return Boolean(API_KEY);
}

/** The claim: unique on `key`, created on demand like the payments index. */
let indexReady: Promise<unknown> | null = null;
function ensureIndex(db: Awaited<ReturnType<typeof getDb>>): Promise<unknown> {
  indexReady ??= db
    .collection("emails")
    .createIndex({ key: 1 }, { unique: true, name: "email_key_unique" })
    .catch((err: unknown) => {
      indexReady = null;
      throw err;
    });
  return indexReady;
}

function isDuplicateKey(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

export type SendResult = { sent: boolean; skipped?: "duplicate" | "unconfigured" | "dry" };

export async function sendEmail(input: {
  /** Idempotency key — e.g. "receipt:pay_abc". One send per key, ever. */
  key: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  if (!emailConfigured()) {
    console.warn("[email] RESEND_API_KEY unset — not sending", input.key);
    return { sent: false, skipped: "unconfigured" };
  }

  const db = await withDbRetry(getDb);
  try {
    await ensureIndex(db);
  } catch (err) {
    // losing the index costs the once-only guarantee, not the email
    console.error("[email] could not create the emails unique index", err);
  }

  try {
    await db.collection("emails").insertOne({
      key: input.key,
      to: input.to,
      subject: input.subject,
      at: new Date(),
      dry: DRY(),
    });
  } catch (err) {
    if (isDuplicateKey(err)) return { sent: false, skipped: "duplicate" };
    throw err;
  }

  if (DRY()) {
    console.info(`[email] DRY ${input.key} -> ${input.to}: ${input.subject}`);
    return { sent: true, skipped: "dry" };
  }

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [input.to],
      reply_to: REPLY_TO,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    // release the claim so a later attempt can retry a *failed* send; a
    // successful one keeps its claim forever
    await db.collection("emails").deleteOne({ key: input.key }).catch(() => {});
    console.error(`[email] send failed (${res.status}) for ${input.key}: ${detail}`);
    return { sent: false };
  }

  const { id } = (await res.json()) as { id?: string };
  await db
    .collection("emails")
    .updateOne({ key: input.key }, { $set: { resendId: id ?? null, sentAt: new Date() } })
    .catch(() => {});
  return { sent: true };
}
