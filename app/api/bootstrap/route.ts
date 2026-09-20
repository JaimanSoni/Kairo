import { NextResponse, after } from "next/server";
import { requireSession, unauthorized } from "@/lib/api-auth";
import { loadUserData } from "@/lib/tasks";
import { catchUpPushes } from "@/lib/push";

/**
 * Bootstraps the client: all live tasks (inbox/planned/someday), recently
 * completed tasks (for Today + recent context), and lists.
 */
export async function GET() {
  const session = await requireSession();
  if (!session) return unauthorized();
  // someone opening the app is a chance to notice a push that's overdue: after the response, never in its way
  after(() => catchUpPushes());

  const { tasks, lists, people } = await loadUserData(session.userId);

  return NextResponse.json({
    user: {
      id: session.userId,
      email: session.email,
      name: session.name,
      picture: session.picture,
    },
    tasks,
    lists,
    people,
  });
}
