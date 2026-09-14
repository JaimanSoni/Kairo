import { ObjectId } from "mongodb";
import { requireSession, unauthorized } from "@/lib/api-auth";
import { getUserById } from "@/lib/users";
import { allNotesInOrder } from "@/lib/notes";
import { notesToMarkdown } from "@/lib/notes-shared";

/**
 * Every page as one Markdown file, parents before their sub-pages.
 *
 * Checks the session and nothing else — deliberately not the subscription.
 * Nobody should lose their own notes to a lapsed card.
 */
export async function GET() {
  const session = await requireSession();
  if (!session) return unauthorized();

  const userId = new ObjectId(session.userId);
  const [pages, user] = await Promise.all([allNotesInOrder(userId), getUserById(session.userId)]);
  const today = new Date().toISOString().slice(0, 10);
  const markdown = notesToMarkdown(pages, String(user?.name ?? "").split(" ")[0] ?? "", today);

  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="kairo-notes-${today}.md"`,
      "Cache-Control": "no-store",
    },
  });
}
