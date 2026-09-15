import { ObjectId } from "mongodb";
import { getDb } from "./db";
import type { Friendship } from "./habits-shared";

/**
 * Friends in Kairo City: one record for each pair of gardeners, asked for by
 * one and accepted by the other.
 *
 * Friends come from three places. People you share a list with, and people
 * who moved into a plot one of you saved, are friends already. Anyone else on
 * the street can be asked. A record also remembers a friendship someone ended,
 * so a shared list doesn't quietly bring back a friend who was let go.
 *
 * A declined request isn't announced. The asker still sees "Requested", and
 * asking again stays quiet for a while, so declining never turns into a
 * stream of the same request.
 */

export type FriendRecord = {
  _id: ObjectId;
  /** The two account ids, lower first: one record per pair. */
  pair: string;
  users: ObjectId[];
  /** Who asked last, and who was asked. */
  from: ObjectId;
  to: ObjectId;
  status: "pending" | "friends" | "removed";
  /** How the pair met: asked on the street, or a plot saved and claimed. */
  via: "city" | "plot";
  createdAt: Date;
  askedAt: Date;
  acceptedAt: Date | null;
  /** The asker has heard that the request was accepted. */
  seenByFrom: boolean;
  /** Declined by the one asked: the request stays pending for the asker, and out of sight for them. */
  declinedAt: Date | null;
};

/** How many requests one gardener can have waiting at once. */
export const MAX_PENDING_REQUESTS = 50;
/** How many requests one gardener can send in a day. */
export const MAX_REQUESTS_PER_DAY = 30;
/** How long a declined request stays quiet if it's asked again. */
const QUIET_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export class FriendRefused extends Error {}

export function pairKey(a: ObjectId, b: ObjectId): string {
  const [x, y] = [a.toHexString(), b.toHexString()].sort();
  return `${x}:${y}`;
}

let indexReady: Promise<void> | null = null;
export async function friendsCollection() {
  const col = (await getDb()).collection<FriendRecord>("garden_friends");
  indexReady ??= Promise.all([
    col.createIndex({ pair: 1 }, { name: "friend_pair", unique: true }),
    col.createIndex({ users: 1, status: 1 }, { name: "friends_of" }),
    col.createIndex({ to: 1, status: 1 }, { name: "friend_requests_to" }),
    col.createIndex({ from: 1, askedAt: -1 }, { name: "friend_requests_from" }),
  ]).then(
    () => undefined,
    (err: unknown) => {
      indexReady = null;
      throw err;
    }
  );
  await indexReady;
  return col;
}

const other = (r: Pick<FriendRecord, "users">, me: ObjectId) => (r.users[0].equals(me) ? r.users[1] : r.users[0]);

/**
 * Everyone this account counts as a friend, itself included: people it shares
 * a list with, neighbours from a claimed plot, and friends asked and accepted,
 * less any friendship that was ended. Lists, not tasks: a single task shared
 * once is too thin a tie to put someone's streaks in front of you.
 */
export async function friendIds(userId: ObjectId): Promise<ObjectId[]> {
  const db = await getDb();
  const filter = { $or: [{ userId }, { memberIds: userId }], "memberIds.0": { $exists: true } };
  const [lists, neighbours, records] = await Promise.all([
    db.collection("lists").find(filter, { projection: { userId: 1, memberIds: 1 } }).limit(500).toArray(),
    db.collection("city_invites").find({ claimedBy: { $ne: null }, $or: [{ fromUserId: userId }, { claimedBy: userId }] }, { projection: { fromUserId: 1, claimedBy: 1 } }).limit(500).toArray(),
    (await friendsCollection()).find({ users: userId, status: { $in: ["friends", "removed"] } }, { projection: { users: 1, status: 1 } }).limit(1000).toArray(),
  ]);
  const ids = new Map<string, ObjectId>();
  for (const doc of lists) {
    ids.set((doc.userId as ObjectId).toHexString(), doc.userId as ObjectId);
    for (const m of (doc.memberIds as ObjectId[]) ?? []) ids.set(m.toHexString(), m);
  }
  for (const n of neighbours) {
    for (const who of [n.fromUserId as ObjectId, n.claimedBy as ObjectId]) ids.set(who.toHexString(), who);
  }
  for (const r of records) {
    const them = other(r, userId);
    if (r.status === "friends") ids.set(them.toHexString(), them);
  }
  // an ended friendship wins over a shared list or an old plot
  for (const r of records) if (r.status === "removed") ids.delete(other(r, userId).toHexString());
  ids.set(userId.toHexString(), userId);
  return [...ids.values()];
}

/** Where the viewer stands with each of these accounts. */
export async function relationsOf(viewer: ObjectId, ids: ObjectId[]): Promise<Map<string, Friendship>> {
  const out = new Map<string, Friendship>();
  const others = ids.filter((id) => !id.equals(viewer));
  if (others.length === 0) return out;
  const [friends, records] = await Promise.all([
    friendIds(viewer),
    (await friendsCollection()).find({ pair: { $in: others.map((id) => pairKey(viewer, id)) } }).toArray(),
  ]);
  const known = new Set(friends.map((f) => f.toHexString()));
  const byPair = new Map(records.map((r) => [r.pair, r]));
  for (const id of others) {
    const r = byPair.get(pairKey(viewer, id));
    let rel: Friendship = known.has(id.toHexString()) ? "friends" : null;
    if (r?.status === "pending") rel = r.from.equals(viewer) ? "requested" : r.declinedAt ? null : "incoming";
    out.set(id.toHexString(), rel);
  }
  return out;
}

/**
 * Asks to be friends. Asking someone who already asked you accepts them.
 * Returns where the two stand now, and who (if anyone) should hear about it.
 */
export async function askFriend(from: ObjectId, to: ObjectId): Promise<{ friendship: Friendship; tell: "request" | "accepted" | null }> {
  if (from.equals(to)) throw new FriendRefused("That's your own garden.");
  const col = await friendsCollection();
  const pair = pairKey(from, to);
  const record = await col.findOne({ pair });

  if (record?.status === "friends") return { friendship: "friends", tell: null };
  if (record?.status === "pending" && record.from.equals(from)) return { friendship: "requested", tell: null };
  if (record?.status === "pending" && record.to.equals(from)) {
    await col.updateOne({ _id: record._id, status: "pending" }, { $set: { status: "friends", acceptedAt: new Date(), seenByFrom: false, declinedAt: null } });
    return { friendship: "friends", tell: "accepted" };
  }
  if (!record && (await friendIds(from)).some((id) => id.equals(to))) return { friendship: "friends", tell: null };

  const since = new Date(Date.now() - DAY_MS);
  const [waiting, today] = await Promise.all([col.countDocuments({ from, status: "pending" }), col.countDocuments({ from, askedAt: { $gte: since } })]);
  if (waiting >= MAX_PENDING_REQUESTS) throw new FriendRefused(`You have ${MAX_PENDING_REQUESTS} requests waiting already. Give people a little time to answer.`);
  if (today >= MAX_REQUESTS_PER_DAY) throw new FriendRefused(`That's ${MAX_REQUESTS_PER_DAY} friend requests today. Ask more tomorrow.`);

  // declined before, by the same person, not long ago: it stays out of their sight
  const quiet = Boolean(record?.declinedAt && record.from.equals(from) && Date.now() - record.declinedAt.getTime() < QUIET_DAYS * DAY_MS);
  const now = new Date();
  const [a, b] = pair.split(":");
  await col.updateOne(
    { pair },
    {
      $set: { from, to, status: "pending", askedAt: now, acceptedAt: null, seenByFrom: false, declinedAt: quiet ? record!.declinedAt : null },
      $setOnInsert: { _id: new ObjectId(), users: [new ObjectId(a), new ObjectId(b)], via: "city", createdAt: now },
    },
    { upsert: true }
  );
  return { friendship: "requested", tell: quiet ? null : "request" };
}

/** Accepts a request someone sent you. False when there's none waiting. */
export async function acceptFriend(me: ObjectId, them: ObjectId): Promise<boolean> {
  const col = await friendsCollection();
  const r = await col.updateOne({ pair: pairKey(me, them), status: "pending", to: me }, { $set: { status: "friends", acceptedAt: new Date(), seenByFrom: false, declinedAt: null } });
  return r.modifiedCount === 1;
}

/** Declines a request, quietly. False when there's none waiting. */
export async function declineFriend(me: ObjectId, them: ObjectId): Promise<boolean> {
  const col = await friendsCollection();
  const r = await col.updateOne({ pair: pairKey(me, them), status: "pending", to: me, declinedAt: null }, { $set: { declinedAt: new Date() } });
  return r.modifiedCount === 1;
}

/**
 * Takes back a request you sent, or ends a friendship, wherever it came from.
 * False when there was nothing between you to end.
 */
export async function dropFriend(me: ObjectId, them: ObjectId): Promise<boolean> {
  const col = await friendsCollection();
  const pair = pairKey(me, them);
  const record = await col.findOne({ pair });
  if (record) {
    if (record.status === "removed") return false;
    // a request someone sent you is declined, not ended
    if (record.status === "pending" && record.to.equals(me)) return declineFriend(me, them);
    await col.updateOne({ _id: record._id }, { $set: { status: "removed" } });
    return true;
  }
  if (!(await friendIds(me)).some((id) => id.equals(them))) return false;
  const now = new Date();
  const [a, b] = pair.split(":");
  await col.updateOne(
    { pair },
    { $setOnInsert: { _id: new ObjectId(), users: [new ObjectId(a), new ObjectId(b)], from: me, to: them, status: "removed", via: "city", createdAt: now, askedAt: now, acceptedAt: null, seenByFrom: true, declinedAt: null } },
    { upsert: true }
  );
  return true;
}

/** A plot saved by one and claimed by the other: friends, whatever stood between them before. */
export async function befriendByPlot(a: ObjectId, b: ObjectId): Promise<void> {
  const col = await friendsCollection();
  const pair = pairKey(a, b);
  const [x, y] = pair.split(":");
  const now = new Date();
  await col.updateOne(
    { pair },
    {
      $set: { status: "friends", acceptedAt: now, declinedAt: null, seenByFrom: true },
      $setOnInsert: { _id: new ObjectId(), users: [new ObjectId(x), new ObjectId(y)], from: a, to: b, via: "plot", createdAt: now, askedAt: now },
    },
    { upsert: true }
  );
}

/** Requests waiting for this account's answer, newest first. */
export async function incomingRequests(userId: ObjectId, limit = 50): Promise<FriendRecord[]> {
  return (await friendsCollection()).find({ to: userId, status: "pending", declinedAt: null }).sort({ askedAt: -1 }).limit(limit).toArray();
}

/** Requests this account sent that are still waiting, newest first. */
export async function outgoingRequests(userId: ObjectId, limit = 50): Promise<FriendRecord[]> {
  return (await friendsCollection()).find({ from: userId, status: "pending" }).sort({ askedAt: -1 }).limit(limit).toArray();
}

/** People who accepted this account's requests since it last looked: told once. */
export async function acceptedSinceLastLook(userId: ObjectId): Promise<ObjectId[]> {
  const col = await friendsCollection();
  const news = await col.find({ from: userId, status: "friends", seenByFrom: false }).limit(10).toArray();
  if (news.length === 0) return [];
  await col.updateMany({ _id: { $in: news.map((n) => n._id) } }, { $set: { seenByFrom: true } });
  return news.map((n) => n.to);
}

/** Every friendship and request an account is part of, for when it's deleted. */
export async function forgetFriendsOf(userId: ObjectId): Promise<number> {
  const r = await (await friendsCollection()).deleteMany({ users: userId });
  return r.deletedCount;
}
