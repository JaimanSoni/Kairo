import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, badRequest } from "@/lib/api-auth";
import { isDateString, listAccessFilter, listsCollection, lockedListIds, tasksCollection, toList } from "@/lib/tasks";
import { aiStandup } from "@/lib/ai";
import { getUserById } from "@/lib/users";
import { signsOff, standupText, wantsStandup, type StandupTask } from "@/lib/standup";

/**
 * The morning standup, out of yesterday's finished work and today's plan.
 *
 * The day boundaries come from the browser, not from here: the server's clock
 * is UTC, and a person in Ahmedabad posting a standup at nine in the morning
 * is several hours into a date the server does not agree with yet. Completion
 * is a stamp in time rather than a date, so the window is sent as real
 * instants and matched as instants.
 *
 * Locked lists never take part. Their names are private, and so is what is
 * in them -- a standup is the last place a private task should surface.
 */
export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Sign in" }, { status: 401 });

  const user = await getUserById(session.userId);
  if (!wantsStandup(user?.email)) {
    return NextResponse.json({ error: "Not available on this account" }, { status: 403 });
  }

  let body: { today?: unknown; from?: unknown; to?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const today = isDateString(body.today) ? body.today : new Date().toISOString().slice(0, 10);
  const from = typeof body.from === "string" ? new Date(body.from) : null;
  const to = typeof body.to === "string" ? new Date(body.to) : null;
  if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    return badRequest("from and to required");
  }
  // a window wider than two days is not a yesterday
  if (to.getTime() - from.getTime() > 2 * 24 * 60 * 60 * 1000) return badRequest("window too wide");

  const userId = new ObjectId(session.userId);
  const lists = await listsCollection();
  const listDocs = await lists.find(listAccessFilter(userId)).sort({ order: 1 }).toArray();
  const locked = await lockedListIds(userId, listDocs);
  const lockedSet = new Set(locked.map((l) => l.toHexString()));
  const nameOf = new Map(
    listDocs
      .filter((d) => !lockedSet.has(d._id.toHexString()))
      .map((d) => [d._id.toHexString(), toList(d, session.userId).name])
  );

  const access = {
    $or: [{ userId }, { memberIds: userId }, { listId: { $in: listDocs.map((d) => d._id) } }],
    ...(locked.length ? { listId: { $nin: locked } } : {}),
  };

  const tasks = await tasksCollection();
  const [done, planned] = await Promise.all([
    tasks
      .find({ ...access, status: "done", completedAt: { $gte: from, $lt: to } })
      .sort({ completedAt: 1 })
      .limit(40)
      .toArray(),
    tasks
      .find({ ...access, plannedFor: today, status: { $in: ["planned", "inbox", "done"] } })
      .sort({ order: 1 })
      .limit(40)
      .toArray(),
  ]);

  const shape = (docs: typeof done): StandupTask[] =>
    docs
      .map((d) => ({
        title: typeof d.title === "string" ? d.title.trim().slice(0, 200) : "",
        list: d.listId ? (nameOf.get(String(d.listId)) ?? null) : null,
      }))
      .filter((t) => t.title.length > 0);

  const yesterdayTasks = shape(done);
  const todayTasks = shape(planned);

  if (yesterdayTasks.length === 0 && todayTasks.length === 0) {
    return NextResponse.json({ error: "empty", counts: { yesterday: 0, today: 0 } }, { status: 422 });
  }

  const lines = await aiStandup(yesterdayTasks, todayTasks);
  if (!lines) return NextResponse.json({ error: "AI unavailable" }, { status: 502 });

  return NextResponse.json({
    text: standupText(lines, { signed: signsOff(user?.email) }),
    lines,
    signed: signsOff(user?.email),
    counts: { yesterday: yesterdayTasks.length, today: todayTasks.length },
  });
}
