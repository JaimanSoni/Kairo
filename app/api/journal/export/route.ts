import { ObjectId } from "mongodb";
import { requireSession, unauthorized } from "@/lib/api-auth";
import { journalGate } from "@/lib/journal-lock";
import { allEntries } from "@/lib/journal";
import { journalToMarkdown, utcTomorrow } from "@/lib/journal-shared";

/**
 * The whole journal as one Markdown file.
 *
 * Checks the session and the journal PIN, and nothing else — deliberately not
 * the subscription. The paywall covers the app, but nobody should lose their
 * own diary to a lapsed card. Markdown because it opens in anything, today
 * and in twenty years.
 */
export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const gate = await journalGate(session.userId);
  if (!gate.ok) {
    // This URL is usually opened as a download link, not fetched, so a locked
    // journal would otherwise greet someone with a raw JSON error in a tab.
    if (gate.response.status === 423 && (request.headers.get("accept") ?? "").includes("text/html")) {
      return new Response(
        "Your journal has a PIN.\n\nOpen the Journal in Kairo, enter your PIN, then download it from Journal settings.\n",
        { status: 423, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } }
      );
    }
    return gate.response;
  }

  const entries = await allEntries(new ObjectId(session.userId));
  // the server's today is close enough for a filename and a heading
  const today = new Date(Date.parse(utcTomorrow()) - 86_400_000).toISOString().slice(0, 10);
  const markdown = journalToMarkdown(entries, gate.user.name?.split(" ")[0] ?? "", today);

  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="kairo-journal-${today}.md"`,
      "Cache-Control": "no-store",
    },
  });
}
