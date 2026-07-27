/**
 * Who may use Kairo, decided by pure functions.
 *
 * Deliberately free of database and network imports: this is the rule that
 * gates the whole product, so it must be readable and testable on its own.
 */

/**
 * Free days after signup. Overridable so the paywall can be exercised without
 * waiting three days or editing the database — set TRIAL_DAYS=0 to land on it
 * immediately. Falls back to 3 for anything unparseable.
 */
const configured = Number(process.env.TRIAL_DAYS);
export const TRIAL_DAYS = Number.isFinite(configured) && configured >= 0 ? configured : 3;
const DAY_MS = 86_400_000;

/** Razorpay's own subscription states, stored verbatim. */
export type SubStatus =
  | "created"
  | "authenticated"
  | "active"
  | "pending"
  | "halted"
  | "cancelled"
  | "completed"
  | "expired";

export type UserBilling = {
  subscriptionId?: string;
  /** The one-off order we last opened Checkout for, pending confirmation. */
  pendingOrderId?: string;
  customerId?: string;
  status?: SubStatus;
  /** Epoch ms the paid period runs to — access survives until then. */
  currentPeriodEnd?: number;
  /** Free forever, granted by an admin. */
  comped?: boolean;
  compedNote?: string;
  updatedAt?: Date;
};

export type BillingSettings = {
  /** The master switch. Off means Kairo is free for everyone. */
  paymentsEnabled: boolean;
  updatedAt?: Date;
  updatedBy?: string;
};

export type Access = {
  /** Whether the app is usable right now. */
  allowed: boolean;
  reason: "payments-off" | "comped" | "trial" | "subscribed" | "grace" | "expired" | "none";
  /** Whole days left in the trial, 0 once it's over. */
  trialDaysLeft: number;
  trialEndsAt: number;
  status?: SubStatus;
  currentPeriodEnd?: number;
  paymentsEnabled: boolean;
};

/**
 * The single place that decides whether someone may use Kairo.
 *
 * Order matters: the master switch wins over everything, then a comped
 * account, then a live subscription, then the trial. A cancelled subscription
 * keeps working until the period already paid for runs out — taking away
 * something already bought would be theft, however small.
 */
export function resolveAccess(input: {
  createdAt?: Date | null;
  billing?: UserBilling | null;
  settings: BillingSettings;
  now?: number;
}): Access {
  const now = input.now ?? Date.now();
  const billing = input.billing ?? {};
  const createdAt = input.createdAt ? input.createdAt.getTime() : now;
  const trialEndsAt = createdAt + TRIAL_DAYS * DAY_MS;
  const trialDaysLeft = Math.max(0, Math.ceil((trialEndsAt - now) / DAY_MS));
  const base = {
    trialDaysLeft,
    trialEndsAt,
    status: billing.status,
    currentPeriodEnd: billing.currentPeriodEnd,
    paymentsEnabled: input.settings.paymentsEnabled,
  };

  if (!input.settings.paymentsEnabled) {
    return { ...base, allowed: true, reason: "payments-off" };
  }
  if (billing.comped) {
    return { ...base, allowed: true, reason: "comped" };
  }
  if (billing.status === "active" || billing.status === "authenticated") {
    return { ...base, allowed: true, reason: "subscribed" };
  }
  // cancelled or halted but already paid through — let them finish the period
  if (billing.currentPeriodEnd && billing.currentPeriodEnd > now) {
    return { ...base, allowed: true, reason: "grace" };
  }
  if (now < trialEndsAt) {
    return { ...base, allowed: true, reason: "trial" };
  }
  return { ...base, allowed: false, reason: billing.status ? "expired" : "none" };
}

