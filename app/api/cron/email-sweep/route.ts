import { NextResponse } from "next/server";
import { getDb, withDbRetry } from "@/lib/db";
import { getBillingSettings, TRIAL_DAYS } from "@/lib/billing";
import { getPlan } from "@/lib/plans";
import { sendEmail } from "@/lib/email";
import { renewalEmail, trialEndingEmail } from "@/lib/email-templates";

/**
 * The daily clock behind the two T-minus emails: "your paid month ends soon"
 * and "your trial ends soon". Vercel Cron calls this once a day.
 *
 * Nothing renews by itself in Kairo's billing — that is the promise on the
 * pricing page — which means every lapse is silent by design, and this sweep
 * is what keeps "no auto-renew" from quietly meaning "no revenue".
 *
 * Idempotency does the real work: renewal keys carry the period end and trial
 * keys the user, so however many times a day runs or retries, each person
 * gets each nudge once. The sweep itself is one query over a tiny collection.
 */

export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;
/** Renewal nudge fires inside this window before the paid period ends. */
const RENEWAL_WINDOW_MS = 3 * DAY_MS;
/** Trial nudge fires when this many days or fewer remain. */
const TRIAL_NUDGE_DAYS = 2;

export async function GET(request: Request) {
  // Vercel Cron authenticates itself with the CRON_SECRET env automatically;
  // anyone else hitting the URL gets nothing.
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const settings = await getBillingSettings();
  if (!settings.paymentsEnabled) {
    // free-for-everyone mode has no periods and no trials worth nagging about
    return NextResponse.json({ ok: true, skipped: "payments-off" });
  }

  const now = Date.now();
  const users = await withDbRetry(async () => {
    const db = await getDb();
    return db
      .collection("users")
      .find(
        { disabled: { $ne: true } },
        { projection: { email: 1, name: 1, createdAt: 1, billing: 1 } }
      )
      .toArray();
  });

  let renewals = 0;
  let trials = 0;

  for (const u of users) {
    const email = typeof u.email === "string" ? u.email : "";
    if (!email || email.endsWith("@local.test")) continue;
    const billing = (u.billing ?? {}) as {
      comped?: boolean;
      currentPeriodEnd?: number;
      planKey?: string;
    };
    if (billing.comped) continue;

    const periodEnd = billing.currentPeriodEnd ?? 0;
    const name = String(u.name ?? "");

    if (periodEnd > now) {
      // paying, and the month is running out
      if (periodEnd - now <= RENEWAL_WINDOW_MS) {
        const plan = billing.planKey ? await getPlan(billing.planKey) : null;
        const priceLabel = plan
          ? new Intl.NumberFormat("en-IN", {
              style: "currency",
              currency: plan.currency,
              minimumFractionDigits: plan.priceMinor % 100 === 0 ? 0 : 2,
            }).format(plan.priceMinor / 100)
          : "the plan price";
        const endsOn = new Date(periodEnd).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
        });
        const mail = renewalEmail({
          name,
          endsOn,
          priceLabel,
          planName: plan?.name ?? "current",
        });
        const r = await sendEmail({
          // the period end in the key scopes the nudge: one per paid month, ever
          key: `renewal:${u._id.toHexString()}:${periodEnd}`,
          to: email,
          ...mail,
        });
        if (r.sent) renewals++;
      }
      continue;
    }

    // not paying: on trial, or lapsed (the paywall handles lapsed — no email
    // nagging after the fact, that is the no-guilt line)
    const createdAt = u.createdAt instanceof Date ? u.createdAt.getTime() : 0;
    const trialEndsAt = createdAt + TRIAL_DAYS * DAY_MS;
    if (trialEndsAt > now) {
      const daysLeft = Math.ceil((trialEndsAt - now) / DAY_MS);
      if (daysLeft <= TRIAL_NUDGE_DAYS) {
        const mail = trialEndingEmail({ name, daysLeft });
        const r = await sendEmail({
          key: `trial:${u._id.toHexString()}`,
          to: email,
          ...mail,
        });
        if (r.sent) trials++;
      }
    }
  }

  return NextResponse.json({ ok: true, renewals, trials, scanned: users.length });
}
