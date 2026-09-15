import { AppViews } from "@/components/app-views";

export const metadata = { title: "Habits · Kairo" };

/**
 * Ideas, the leaderboards, or one habit. The slug is read on the client, where
 * the habits' own switch lives; this route exists so a hard load or a shared
 * link enters the app the same way a tap does.
 */
export default function HabitsSlugPage() {
  return <AppViews />;
}
