import { NextResponse } from "next/server";
import { requireSession, unauthorized } from "@/lib/api-auth";
import { loadUserData } from "@/lib/tasks";

/**
 * Bootstraps the client: all live tasks (inbox/planned/someday), recently
 * completed tasks (for Today + recent context), and lists.
 */
export async function GET() {
  const session = await requireSession();
  if (!session) return unauthorized();

  const { tasks, lists } = await loadUserData(session.userId);

  return NextResponse.json({
    user: {
      id: session.userId,
      email: session.email,
      name: session.name,
      picture: session.picture,
    },
    tasks,
    lists,
  });
}
