import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest, notFound } from "@/lib/api-auth";
import { listsCollection, listAccessFilter, toList } from "@/lib/tasks";
import { getDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { listSharedEmail } from "@/lib/email-templates";
import { inviteUserByEmail } from "@/lib/invites";
import { resolveAvatar } from "@/lib/avatars";
import type { DbUser } from "@/lib/users";

type MemberInfo = { id: string; name: string; email: string; picture?: string; role: "owner" | "member" };

/** Who's on this list (owner + members). Visible to anyone with access. */
export async function GET(_request: Request, ctx: RouteContext<"/api/lists/[id]/share">) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return badRequest("Invalid list id");

  const lists = await listsCollection();
  const list = await lists.findOne({
    _id: new ObjectId(id),
    ...listAccessFilter(new ObjectId(session.userId)),
  });
  if (!list) return notFound();

  const db = await getDb();
  const memberIds = Array.isArray(list.memberIds) ? (list.memberIds as ObjectId[]) : [];
  const users = await db
    .collection("users")
    .find({ _id: { $in: [list.userId as ObjectId, ...memberIds] } })
    .project({ name: 1, email: 1, picture: 1, avatarChoice: 1 })
    .toArray();

  const members: MemberInfo[] = users.map((u) => ({
    id: u._id.toHexString(),
    name: String(u.name ?? ""),
    email: String(u.email ?? ""),
    picture: resolveAvatar(
      typeof u.avatarChoice === "string" ? u.avatarChoice : undefined,
      typeof u.picture === "string" ? u.picture : undefined
    ),
    role: u._id.equals(list.userId as ObjectId) ? "owner" : "member",
  }));

  return NextResponse.json({ members });
}

/**
 * Owner shares the list with someone by email. An address with no Kairo
 * account is not an error: the invite email goes out with a magic sign-in
 * link, and only if it lands is the account created and put on the list —
 * membership is waiting before the recipient ever clicks.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/lists/[id]/share">) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return badRequest("Invalid list id");

  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  if (typeof body.email !== "string" || !body.email.includes("@")) {
    return badRequest("A valid email is required");
  }
  const email = body.email.trim().toLowerCase();
  if (email === session.email.toLowerCase()) return badRequest("That's you already");

  // ownership is settled before any email leaves the building
  const lists = await listsCollection();
  const owned = await lists.findOne({
    _id: new ObjectId(id),
    userId: new ObjectId(session.userId),
  });
  if (!owned) return notFound();

  const db = await getDb();
  const found = await db.collection<DbUser>("users").findOne({ email });

  let recipient = found;
  let invited = false;
  if (!recipient || recipient.pending) {
    const invite = await inviteUserByEmail({
      email,
      inviterId: session.userId,
      inviterName: session.name,
      emailKey: `invite-list:${id}:${email}`,
      invite: { kind: "list", itemName: String(owned.name) },
    });
    if (!invite.ok) return badRequest(invite.error);
    recipient = invite.user;
    invited = true;
  }

  const updated = await lists.findOneAndUpdate(
    { _id: owned._id, userId: new ObjectId(session.userId) },
    { $addToSet: { memberIds: recipient._id } },
    { returnDocument: "after" }
  );
  if (!updated) return notFound();

  // keyed per list+member: re-inviting someone removed and added back tells
  // them again, but a double-click does not
  if (!invited) {
    const mail = listSharedEmail({ inviterName: session.name, listName: String(updated.name) });
    void sendEmail({
      key: `share:${id}:${recipient._id.toHexString()}`,
      to: String(recipient.email),
      ...mail,
    }).catch((err) => console.error("[email] share invite failed", err));
  }

  return NextResponse.json({
    list: toList(updated, session.userId),
    member: { id: recipient._id.toHexString(), name: recipient.name, email: recipient.email },
  });
}

/** Owner removes a member, or a member removes themselves (leave). */
export async function DELETE(request: Request, ctx: RouteContext<"/api/lists/[id]/share">) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return badRequest("Invalid list id");

  let body: { memberId?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  if (typeof body.memberId !== "string" || !ObjectId.isValid(body.memberId)) {
    return badRequest("memberId required");
  }

  const me = new ObjectId(session.userId);
  const target = new ObjectId(body.memberId);
  const lists = await listsCollection();
  const list = await lists.findOne({ _id: new ObjectId(id) });
  if (!list) return notFound();

  const isOwner = (list.userId as ObjectId).equals(me);
  const removingSelf = target.equals(me);
  if (!isOwner && !removingSelf) return unauthorized();

  await lists.updateOne({ _id: list._id }, { $pull: { memberIds: target } as never });
  return NextResponse.json({ ok: true });
}
