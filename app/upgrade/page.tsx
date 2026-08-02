import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getUserById } from "@/lib/users";
import { accessFor, type UserBilling } from "@/lib/billing";
import { listSellablePlans } from "@/lib/plans";
import { FEATURES, FEATURE_KEYS, isFeatureKey } from "@/lib/features";
import { billingMode } from "@/lib/razorpay";
import { PlanCards } from "@/components/plan-cards";
import { Icon3d } from "@/components/img3d";

/**
 * Where a gated feature sends people.
 *
 * Outside the (app) group on purpose: the paywall lives in that layout, and
 * somebody whose access has lapsed still needs to be able to reach this page and
 * pay. It is its own route rather than a modal so the link can be shared, linked
 * from an email, and reached from a redirect.
 */
export const metadata: Metadata = {
  title: "Upgrade · Kairo",
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ feature?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/");

  const { feature } = await searchParams;
  const wanted = isFeatureKey(feature) ? feature : null;

  const user = await getUserById(session.userId);
  if (!user) redirect("/api/auth/stale?reason=signin_again");
  if (user.disabled) redirect("/api/auth/stale?reason=deactivated");

  const access = await accessFor({
    createdAt: user.createdAt,
    billing: (user as { billing?: UserBilling }).billing,
  });

  const plans = (await listSellablePlans())
    // Only plans that would actually help. Offering someone the tier they are
    // already on as the answer to a locked feature is worse than saying nothing.
    .filter((p) => !wanted || p.features.includes(wanted))
    .map((p) => ({
      key: p.key,
      name: p.name,
      tagline: p.tagline,
      priceMinor: p.priceMinor,
      anchorMinor: p.anchorMinor,
      currency: p.currency,
      features: p.features,
    }));

  const featureLabels = FEATURE_KEYS.map((k) => ({ key: k, name: FEATURES[k].name }));
  const identity = { name: session.name, email: session.email };

  return (
    <main className="mesh min-h-dvh px-5 py-12">
      <div className="mx-auto w-full max-w-2xl">
        <div className="text-center">
          <Icon3d name="sparkle" size={56} className="mx-auto" />
          <h1 className="font-display mt-4 text-3xl tracking-tight sm:text-4xl">
            {wanted ? FEATURES[wanted].name : "Upgrade Kairo"}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-ink-soft">
            {wanted
              ? FEATURES[wanted].description
              : "One price per month, no tiers to outgrow. Change or stop whenever you like."}
          </p>
          {wanted && (
            <p className="mt-2 text-sm text-ink-faint">
              It isn&apos;t part of your current plan. Everything else keeps working exactly as it is.
            </p>
          )}
        </div>

        <div className="mt-8">
          <PlanCards
            plans={plans}
            features={featureLabels}
            user={identity}
            mode={billingMode()}
            currentPlanKey={access.planKey}
            highlight={wanted}
          />
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-ink-faint">
          <Link href="/today" className="underline underline-offset-2 hover:text-ink-soft">
            Back to Kairo
          </Link>
          <Link href="/billing" className="underline underline-offset-2 hover:text-ink-soft">
            Billing &amp; receipts
          </Link>
          <Link href="/refunds" className="underline underline-offset-2 hover:text-ink-soft">
            Refunds
          </Link>
        </div>
      </div>
    </main>
  );
}
