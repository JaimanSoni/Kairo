import { redirect } from "next/navigation";
import { getSession, getSessionAccounts } from "@/lib/session";
import { loadUserData } from "@/lib/tasks";
import { getUserById, shouldWelcome, spacesOf } from "@/lib/users";
import { isAdminEmail } from "@/lib/admin";
import { accessFor, getBillingSettings, type UserBilling } from "@/lib/billing";
import { Paywall, TrialBanner } from "@/components/paywall";
import { billingMode } from "@/lib/razorpay";
import { listSellablePlans } from "@/lib/plans";
import { FEATURES, FEATURE_KEYS } from "@/lib/features";
import { AppProvider } from "@/components/store";
import { resolveAvatar } from "@/lib/avatars";
import { EntitlementsProvider } from "@/components/entitlements";
import { GuestSync } from "@/components/guest-sync";
import { Shell } from "@/components/shell";
import { isAppOpen } from "@/lib/lock-grants";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/");

  const [userDoc, roster, billingSettings] = await Promise.all([
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
    anchorMinor: p.anchorMinor,
    currency: p.currency,
    features: p.features,
  }));
  const featureLabels = FEATURE_KEYS.map((k) => ({ key: k, name: FEATURES[k].name }));

  // A cookie for an account that is gone or switched off gets signed out
  // properly, not bounced to the landing page: the landing page sends
  // cookie-holders back here, and that pair of redirects has no exit.
  if (!userDoc) redirect("/api/auth/stale?reason=signin_again");
  if (userDoc.disabled) redirect("/api/auth/stale?reason=deactivated");

  // An app lock that this browser hasn't opened gets the lock screen and
  // nothing else: no tasks, no lists, no people in the page to read past it.
  // Checked before the paywall, which offers downloads that need an open app.
  const appLocked = Boolean(userDoc.appLockHash && userDoc.appLockSalt) && !(await isAppOpen(session.userId, userDoc.appLockHash!));

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

  if (!access.allowed && !appLocked) {
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

  const { tasks, lists, people } = appLocked ? { tasks: [], lists: [], people: [] } : await loadUserData(session.userId);

  return (
    <AppProvider
      user={{
        id: session.userId,
        email: session.email,
        name: session.name,
        // what they chose to wear; the Google photo rides along for the picker
        picture: resolveAvatar(userDoc.avatarChoice, session.picture),
        googlePicture: session.picture,
        appLockEnabled: Boolean(userDoc?.appLockHash),
        appLocked,
        // from the database record, not the session cookie
        isAdmin: isAdminEmail(userDoc?.email),
        // money has actually changed hands: a live subscription, or a period
        // already paid for. Trial and comped accounts are not paying.
        isPaying: access.reason === "subscribed" || access.reason === "grace",
        spaces: spacesOf(userDoc),
        welcome: !appLocked && shouldWelcome(userDoc, tasks.length + lists.length),
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
      {/* tasks made as a guest on "/" walk in with their owner */}
      <GuestSync />
      <TrialBanner
        access={access}
        user={identity}
        mode={mode}
        planKey={sellable[0]?.key}
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
