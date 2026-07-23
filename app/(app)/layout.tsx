import { redirect } from "next/navigation";
import { getSession, getSessionAccounts } from "@/lib/session";
import { loadUserData } from "@/lib/tasks";
import { getUserById } from "@/lib/users";
import { AppProvider } from "@/components/store";
import { Shell } from "@/components/shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/");

  const [{ tasks, lists }, userDoc, roster] = await Promise.all([
    loadUserData(session.userId),
    getUserById(session.userId),
    getSessionAccounts(),
  ]);

  return (
    <AppProvider
      user={{
        id: session.userId,
        email: session.email,
        name: session.name,
        picture: session.picture,
        appLockEnabled: Boolean(userDoc?.appLockHash),
      }}
      accounts={(roster?.accounts ?? []).map((a) => ({
        id: a.userId,
        email: a.email,
        name: a.name,
        picture: a.picture,
      }))}
      initialTasks={tasks}
      initialLists={lists}
    >
      <Shell>{children}</Shell>
    </AppProvider>
  );
}
