import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Razorpay REST client. Server-only — the key secret must never reach a
 * browser, so nothing here may be imported from a client component.
 *
 * Raw fetch rather than the SDK: we need four endpoints, and the SDK would
 * pull a dependency tree for them.
 */

const API = "https://api.razorpay.com/v1";

export const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID ?? "";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
export const RAZORPAY_PLAN_ID = process.env.RAZORPAY_PLAN_ID ?? "";

/**
 * The monthly price, in the smallest currency unit (29900 = ₹299.00).
 *
 * INR by default. Razorpay will happily *create* a USD order on an account
 * without international payments enabled, then refuse the card at Checkout
 * with "International cards are not supported" — so the currency has to match
 * what the account can actually collect, not what we'd like to charge.
 */
export const PRICE_MINOR = Number(process.env.RAZORPAY_PRICE_MINOR ?? 29900);
export const PRICE_CURRENCY = process.env.RAZORPAY_CURRENCY ?? "INR";

/**
 * Derived, never configured separately — a price label that disagrees with the
 * amount actually charged is the kind of mistake nobody notices until someone
 * is billed differently from what they were shown.
 */
export const PRICE_LABEL = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: PRICE_CURRENCY,
  minimumFractionDigits: PRICE_MINOR % 100 === 0 ? 0 : 2,
  maximumFractionDigits: 2,
}).format(PRICE_MINOR / 100);

/**
 * Two ways to charge, decided by whether a plan id exists.
 *
 * Razorpay gates Subscriptions behind account activation and answers 401 on
 * /plans until it's granted, so an account can be perfectly able to take
 * payments while unable to create a subscription. When that's the case we
 * charge a month at a time through Orders, which every account can do.
 */
export type BillingMode = "subscription" | "one-off";
export function billingMode(): BillingMode {
  return RAZORPAY_PLAN_ID ? "subscription" : "one-off";
}

/** Enough to take money at all — the one-off path needs no plan. */
export function razorpayConfigured(): boolean {
  return Boolean(RAZORPAY_KEY_ID && KEY_SECRET);
}

export function subscriptionsConfigured(): boolean {
  return Boolean(RAZORPAY_KEY_ID && KEY_SECRET && RAZORPAY_PLAN_ID);
}

export function webhookConfigured(): boolean {
  return Boolean(WEBHOOK_SECRET);
}

function authHeader(): string {
  return `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${KEY_SECRET}`).toString("base64")}`;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    // Razorpay puts the useful part in error.description
    let detail = text.slice(0, 300);
    try {
      detail = (JSON.parse(text) as { error?: { description?: string } }).error?.description ?? detail;
    } catch {}
    throw new Error(`Razorpay ${res.status}: ${detail}`);
  }
  return JSON.parse(text) as T;
}

export type RazorpaySubscription = {
  id: string;
  status: "created" | "authenticated" | "active" | "pending" | "halted" | "cancelled" | "completed" | "expired";
  plan_id: string;
  customer_id?: string;
  current_start: number | null;
  current_end: number | null;
  charge_at: number | null;
  ended_at: number | null;
  notes?: Record<string, string>;
};

export type RazorpayPlan = {
  id: string;
  period: string;
  interval: number;
  item: { name: string; amount: number; currency: string };
};

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  receipt?: string;
};

export type RazorpayPayment = {
  id: string;
  order_id: string | null;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  amount: number;
  currency: string;
};

/** One month's access, charged now. Amount is in the smallest currency unit. */
export async function createOrder(input: {
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  if (PRICE_MINOR < 100) throw new Error("Amount must be at least 100 minor units");
  return call<RazorpayOrder>("/orders", {
    method: "POST",
    body: JSON.stringify({
      amount: PRICE_MINOR,
      currency: PRICE_CURRENCY,
      receipt: input.receipt.slice(0, 40),
      ...(input.notes ? { notes: input.notes } : {}),
    }),
  });
}

export async function fetchPayment(id: string): Promise<RazorpayPayment> {
  return call<RazorpayPayment>(`/payments/${id}`);
}

/**
 * Verifies the one-off Checkout handshake.
 *
 * The signed payload here is `order_id|payment_id` — the opposite order to the
 * subscription flow above, which is an easy and silent mistake to make.
 */
export function verifyOrderSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  if (!KEY_SECRET) return false;
  const expected = createHmac("sha256", KEY_SECRET)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");
  return safeEqualHex(expected, input.signature);
}

export async function createCustomer(input: {
  name: string;
  email: string;
}): Promise<{ id: string }> {
  return call<{ id: string }>("/customers", {
    method: "POST",
    // fail_existing:0 returns the existing customer instead of erroring, so a
    // second attempt after a half-finished checkout doesn't dead-end
    body: JSON.stringify({ name: input.name, email: input.email, fail_existing: 0 }),
  });
}

/**
 * A subscription whose first charge is `startAt`. That epoch is how the free
 * trial is implemented: Razorpay collects the mandate now and takes no money
 * until the trial is over.
 */
export async function createSubscription(input: {
  customerId: string;
  startAt?: number;
  notes?: Record<string, string>;
}): Promise<RazorpaySubscription> {
  return call<RazorpaySubscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: RAZORPAY_PLAN_ID,
      customer_id: input.customerId,
      // 120 months — Razorpay requires a bound; this is "until cancelled"
      total_count: 120,
      customer_notify: 1,
      ...(input.startAt ? { start_at: input.startAt } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
    }),
  });
}

export async function fetchSubscription(id: string): Promise<RazorpaySubscription> {
  return call<RazorpaySubscription>(`/subscriptions/${id}`);
}

export async function cancelSubscription(
  id: string,
  atCycleEnd = true
): Promise<RazorpaySubscription> {
  return call<RazorpaySubscription>(`/subscriptions/${id}/cancel`, {
    method: "POST",
    body: JSON.stringify({ cancel_at_cycle_end: atCycleEnd ? 1 : 0 }),
  });
}

export async function fetchPlan(): Promise<RazorpayPlan> {
  return call<RazorpayPlan>(`/plans/${RAZORPAY_PLAN_ID}`);
}

/** Constant-time compare so a signature can't be recovered by timing. */
function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verifies the handshake Checkout hands back after a successful mandate.
 *
 * For subscriptions the signed payload is `payment_id|subscription_id` — note
 * the order, which is the reverse of the one-off order flow.
 */
export function verifyCheckoutSignature(input: {
  paymentId: string;
  subscriptionId: string;
  signature: string;
}): boolean {
  if (!KEY_SECRET) return false;
  const expected = createHmac("sha256", KEY_SECRET)
    .update(`${input.paymentId}|${input.subscriptionId}`)
    .digest("hex");
  return safeEqualHex(expected, input.signature);
}

/**
 * Verifies a webhook against the raw request body. The body must be the exact
 * bytes Razorpay sent — re-serialising parsed JSON changes the signature.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!WEBHOOK_SECRET || !signature) return false;
  const expected = createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}
