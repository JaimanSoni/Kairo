import { redirect } from "next/navigation";
import { getSession, getSessionAccounts } from "@/lib/session";
import { loadUserData } from "@/lib/tasks";
import { getUserById } from "@/lib/users";
import { isAdminEmail } from "@/lib/admin";
import { accessFor, getBillingSettings, type UserBilling } from "@/lib/billing";
import { Paywall, TrialBanner } from "@/components/paywall";
import { billingMode } from "@/lib/razorpay";
import { listSellablePlans } from "@/lib/plans";
import { FEATURES, FEATURE_KEYS } from "@/lib/features";
import { AppProvider } from "@/components/store";
import { EntitlementsProvider } from "@/components/entitlements";
import { Shell } from "@/components/shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/");

  const [{ tasks, lists, people }, userDoc, roster, billingSettings] = await Promise.all([
    loadUserData(session.userId),
    getUserById(session.userId),
    getSessionAccounts(),
    getBillingSettings(),
  ]);

  // Offered on the paywall and the trial banner. Read here rather than in the
  // client components so a price can never be taken from the browser.
  const sellable = (await listSellablePlans()).map((p) => ({
    key: p.key,
    name: p.name,
    tagline: p.tagline,
    priceMinor: p.priceMinor,
    currency: p.currency,
    features: p.features,
  }));
  const featureLabels = FEATURE_KEYS.map((k) => ({ key: k, name: FEATURES[k].name }));

  // A deactivated account is turned away before anything renders. Sending them
  // to the landing page rather than a dead end is deliberate: the sign-in
  // attempt that follows is where the explanation lives.
  if (!userDoc || userDoc.disabled) redirect("/?auth_error=deactivated");

  // Access is decided on the server every request. A client that lies about
  // being subscribed gets nowhere, because this is what renders the app.
  const access = await accessFor({
    createdAt: userDoc?.createdAt,
    billing: (userDoc as { billing?: UserBilling } | null)?.billing,
    settings: billingSettings,
  });
  const identity = { name: session.name, email: session.email };
  // the charge shape is a server fact; the client is only told which to render
  const mode = billingMode();

  if (!access.allowed) {
    return (
      <Paywall
        access={access}
        user={identity}
        mode={mode}
        plans={sellable}
        features={featureLabels}
      />
    );
  }

  return (
    <AppProvider
      user={{
        id: session.userId,
        email: session.email,
        name: session.name,
        picture: session.picture,
        appLockEnabled: Boolean(userDoc?.appLockHash),
        // from the database record, not the session cookie
        isAdmin: isAdminEmail(userDoc?.email),
        // money has actually changed hands: a live subscription, or a period
        // already paid for. Trial and comped accounts are not paying.
        isPaying: access.reason === "subscribed" || access.reason === "grace",
      }}
      accounts={(roster?.accounts ?? []).map((a) => ({
        id: a.userId,
        email: a.email,
        name: a.name,
        picture: a.picture,
      }))}
      initialTasks={tasks}
      initialLists={lists}
      initialPeople={people}
    >
      <EntitlementsProvider features={access.features}>
      <TrialBanner
        access={access}
        user={identity}
        mode={mode}
        price={
          sellable.length > 0
            ? new Intl.NumberFormat("en-IN", {
                style: "currency",
                currency: sellable[0].currency,
                minimumFractionDigits: sellable[0].priceMinor % 100 === 0 ? 0 : 2,
              }).format(sellable[0].priceMinor / 100)
            : ""
        }
      />
      <Shell>{children}</Shell>
      </EntitlementsProvider>
    </AppProvider>
  );
}
