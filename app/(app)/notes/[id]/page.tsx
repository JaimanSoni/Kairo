import { AppViews } from "@/components/app-views";

export const metadata = { title: "Notes · Kairo" };

/**
 * A single page. The id is read from the path on the client, where the view
 * switch already lives; this route exists so a hard load or a copied link to a
 * page enters the app the same way a tap in the tree does.
 */
export default function NotePageRoute() {
  return <AppViews />;
}
