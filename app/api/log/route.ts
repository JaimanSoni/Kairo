import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized } from "@/lib/api-auth";
import { tasksCollection, toTask } from "@/lib/tasks";

/** Paginated history of completed tasks, newest first. */
export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const url = new URL(request.url);
  const before = url.searchParams.get("before");
  const limit = Math.min(Number(url.searchParams.get("limit")) || 100, 300);

  const filter: Record<string, unknown> = {
    userId: new ObjectId(session.userId),
    status: "done",
  };
  if (before) {
    const beforeDate = new Date(before);
    if (!isNaN(beforeDate.getTime())) {
      filter.completedAt = { $lt: beforeDate };
    }
  }

  const tasks = await tasksCollection();
  const docs = await tasks.find(filter).sort({ completedAt: -1 }).limit(limit).toArray();
  return NextResponse.json({ tasks: docs.map(toTask) });
}
