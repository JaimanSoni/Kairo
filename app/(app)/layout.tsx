import { redirect } from "next/navigation";
import { getSession, getSessionAccounts } from "@/lib/session";
import { loadUserData } from "@/lib/tasks";
import { getUserById } from "@/lib/users";
import { isAdminEmail } from "@/lib/admin";
import { getBillingSettings, resolveAccess, type UserBilling } from "@/lib/billing";
import { Paywall, TrialBanner } from "@/components/paywall";
import { AppProvider } from "@/components/store";
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

  // Access is decided on the server every request. A client that lies about
  // being subscribed gets nowhere, because this is what renders the app.
  const access = resolveAccess({
    createdAt: userDoc?.createdAt,
    billing: (userDoc as { billing?: UserBilling } | null)?.billing,
    settings: billingSettings,
  });
  const identity = { name: session.name, email: session.email };

  if (!access.allowed) return <Paywall access={access} user={identity} />;

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
      <TrialBanner access={access} user={identity} />
      <Shell>{children}</Shell>
    </AppProvider>
  );
}
