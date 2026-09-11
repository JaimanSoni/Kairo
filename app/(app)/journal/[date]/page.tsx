import { AppViews } from "@/components/app-views";

export const metadata = { title: "Journal · Kairo" };

/**
 * A single day's page. The day is read from the path on the client, where the
 * view switch already lives; this route exists so a hard load, a bookmark or a
 * shared link to a day enters the app the same way a tap on the calendar does.
 */
export default function JournalDayPage() {
  return <AppViews />;
}
