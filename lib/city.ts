import { randomBytes } from "node:crypto";
import { after } from "next/server";
import { ObjectId, type Document, type WithId } from "mongodb";
import { getDb } from "./db";
import {
  addDays,
  daysBetween,
  gardenLevelOf,
  gardenScore,
  isAnimal,
  live,
  MAX_HABITS,
  plantStageFor,
  seedOf,
  strengthOf,
  STRENGTH_WINDOW_DAYS,
  type City,
  type CityGarden,
  type CityPlant,
  type CityScope,
  type FriendCard,
  type FriendsOverview,
  type Friendship,
  type LogLite,
} from "./habits-shared";
import { habitsCollection, HabitInputError, logsCollection, setGardener } from "./habits";
import {
  acceptedSinceLastLook,
  acceptFriend,
  askFriend,
  befriendByPlot,
  declineFriend,
  dropFriend,
  FriendRefused,
  friendIds,
  friendsCollection,
  incomingRequests,
  outgoingRequests,
  relationsOf,
} from "./friends";
import { safeTimeZone, todayIn } from "./tz";

/**
 * Kairo City: the gardens of everyone who chose to join, side by side.
 *
 * A garden's standing is its score, the strength of its five strongest
 * habits. Reading every habit and log of every gardener on each visit would
 * never scale, so each garden keeps a snapshot on its account: refreshed
 * after anything changes one of its habits, and aged on read when its owner
 * hasn't been by in a while, so a garden left alone slowly fades rather than
 * standing at the top of the street forever.
 *
 * What the city shows of a garden: a chosen name, an animal, its plants and
 * level, and the names of habits started from Ideas. Never an email, a photo,
 * or the name of a habit someone wrote themselves.
 */

export type GardenSnapshot = {
  /** The owner's local day it was taken on. */
  day: string;
  score: number;
  /** The strongest habits' plants, strongest first. */
  plants: CityPlant[];
  habits: number;
  doneToday: number;
  dueToday: number;
  updatedAt: Date;
};

type GardenerDoc = { name: string; animal: string; public: boolean; slug?: string };
type CityUser = WithId<Document> & { gardener?: GardenerDoc; garden?: GardenSnapshot };

/** How many plants a garden shows in the city. */
const CITY_PLANTS = 8;
/** How much strength a garden loses for each day its owner hasn't been by: a day kept is worth the same. */
const FADE = 0.97;

type CheerRecord = { _id: ObjectId; toUserId: ObjectId; fromUserId: ObjectId; day: string; at: Date };

/** A free plot saved for a friend: a link, until someone claims it. */
type InviteRecord = {
  _id: ObjectId;
  code: string;
  fromUserId: ObjectId;
  createdAt: Date;
  claimedBy: ObjectId | null;
  claimedAt: Date | null;
  seenByInviter: boolean;
  /** Emailed to this address, when it was sent by email. */
  sentTo?: string | null;
  sentAt?: Date | null;
};

/** How many plots one gardener can hold for friends at once. */
export const MAX_OPEN_INVITES = 10;
/** How many invite emails one gardener can send in a day: enough for friends, too few for spam. */
export const MAX_INVITE_EMAILS_PER_DAY = 15;

let indexReady: Promise<void> | null = null;
async function ensureCityIndexes(): Promise<void> {
  indexReady ??= (async () => {
    const db = await getDb();
    await Promise.all([
      db.collection("users").createIndex({ "gardener.public": 1, "garden.score": -1 }, { name: "city_by_score" }),
      db.collection("users").createIndex({ "gardener.slug": 1 }, { name: "city_by_slug", unique: true, partialFilterExpression: { "gardener.slug": { $type: "string" } } }),
      db.collection<CheerRecord>("garden_cheers").createIndex({ toUserId: 1, fromUserId: 1, day: 1 }, { name: "cheer_once_a_day", unique: true }),
      db.collection<CheerRecord>("garden_cheers").createIndex({ fromUserId: 1 }, { name: "cheers_by_sender" }),
      db.collection<InviteRecord>("city_invites").createIndex({ code: 1 }, { name: "invite_by_code", unique: true }),
      db.collection<InviteRecord>("city_invites").createIndex({ fromUserId: 1, claimedBy: 1 }, { name: "invites_by_sender" }),
      db.collection<InviteRecord>("city_invites").createIndex({ claimedBy: 1 }, { name: "invites_by_claimer" }),
    ]);
  })().catch((err: unknown) => {
    indexReady = null;
    throw err;
  });
  await indexReady;
}

const users = async () => (await getDb()).collection<CityUser>("users");
const cheers = async () => (await getDb()).collection<CheerRecord>("garden_cheers");
const invites = async () => (await getDb()).collection<InviteRecord>("city_invites");

/* ------------------------------------------------------------- snapshots */

/** Recomputes a garden's snapshot from its habits and logs, and stores it. */
export async function refreshGardenSnapshot(userId: ObjectId, today?: string): Promise<GardenSnapshot> {
  const habits = await (await habitsCollection()).find({ userId, archivedAt: null }).limit(MAX_HABITS).toArray();
  const day = today ?? todayIn(safeTimeZone(habits[0]?.timezone));
  const rows = habits.length
    ? await (await logsCollection())
        .find({ userId, habitId: { $in: habits.map((h) => h._id) }, date: { $gte: addDays(day, -(STRENGTH_WINDOW_DAYS + 14)) } }, { projection: { habitId: 1, date: 1, count: 1, done: 1, frozen: 1 } })
        .toArray()
    : [];
  const byHabit = new Map<string, Map<string, LogLite>>();
  for (const l of rows) {
    const key = l.habitId.toHexString();
    const map = byHabit.get(key) ?? new Map<string, LogLite>();
    map.set(l.date, { date: l.date, count: l.count, done: l.done, frozen: l.frozen });
    byHabit.set(key, map);
  }

  let due = 0;
  let done = 0;
  const plants: CityPlant[] = habits.map((h) => {
    const logs = byHabit.get(h._id.toHexString()) ?? new Map<string, LogLite>();
    const shape = { schedule: h.schedule, startDate: h.startDate };
    const lv = live(shape, logs, h.settled, day);
    const strength = strengthOf(shape, logs, day);
    if (lv.dueToday || lv.todayDone) due++;
    if (lv.todayDone) done++;
    const seed = seedOf(h.seedId);
    const rescuable = lv.rescue && !lv.rescue.covered;
    return {
      species: h.species,
      color: h.color,
      stage: plantStageFor(strength, h.growth > 0 || lv.todayDone),
      strength,
      streak: rescuable ? Math.max(lv.streak, lv.rescue!.keeps) : lv.streak,
      doneToday: lv.todayDone,
      // the journal's habit says whether someone writes a diary: it stays unnamed, like one's own
      name: seed && seed.id !== "journal" ? seed.name : null,
    };
  });

  const snapshot: GardenSnapshot = {
    day,
    score: gardenScore(plants.map((p) => p.strength)),
    plants: [...plants].sort((a, b) => b.strength - a.strength).slice(0, CITY_PLANTS),
    habits: habits.length,
    doneToday: done,
    dueToday: due,
    updatedAt: new Date(),
  };
  await (await users()).updateOne({ _id: userId }, { $set: { garden: snapshot } });
  return snapshot;
}

/** Refreshes a garden's snapshot once the response has gone, so the change that prompted it isn't kept waiting. */
export function refreshGardenLater(userId: ObjectId, today?: string): void {
  const run = () => refreshGardenSnapshot(userId, today).then(
    () => undefined,
    (err: unknown) => console.error("[city] snapshot", err)
  );
  try {
    after(run);
  } catch {
    // outside a request (a script): just run it
    void run();
  }
}

/** A snapshot as it stands today: a garden nobody has tended since fades a little for every day away. */
export function agedSnapshot(s: GardenSnapshot | undefined, today: string): GardenSnapshot | null {
  if (!s) return null;
  const gap = daysBetween(s.day, today);
  if (gap <= 0) return s;
  // yesterday could still be marked, so the fade starts the day after
  const f = Math.pow(FADE, Math.max(0, gap - 1));
  const plants = s.plants.map((p) => {
    const strength = Math.round(p.strength * f);
    return { ...p, strength, stage: p.stage === 0 ? 0 : Math.max(1, plantStageFor(strength, true)), doneToday: false, streak: gap > 2 ? 0 : p.streak };
  });
  return { ...s, day: today, plants, score: Math.round(s.score * f), doneToday: 0 };
}

/**
 * Writes a faded score back for gardens whose owners have been away, once the
 * response has gone: the city's order is read from stored scores, so they need
 * to fade too, not only the numbers shown.
 */
function settleStale(docs: CityUser[], today: string): void {
  const stale = docs.filter((u) => u.garden && daysBetween(u.garden.day, today) > 1);
  if (stale.length === 0) return;
  const run = async () => {
    const col = await users();
    await Promise.all(
      stale.map((u) => {
        const aged = agedSnapshot(u.garden, today)!;
        // only over the snapshot that was read, never over a fresher one
        return col.updateOne({ _id: u._id, "garden.day": u.garden!.day }, { $set: { garden: { ...aged, updatedAt: u.garden!.updatedAt } } });
      })
    );
  };
  const safe = () => run().catch((err: unknown) => console.error("[city] fade", err));
  try {
    after(safe);
  } catch {
    void safe();
  }
}

/* ---------------------------------------------------------------- the city */

/** A garden's address in the city: random, and never the account's id. */
async function slugFor(user: CityUser): Promise<string> {
  if (user.gardener?.slug) return user.gardener.slug;
  const slug = randomBytes(6).toString("hex");
  const col = await users();
  await col.updateOne({ _id: user._id, "gardener.slug": { $exists: false } }, { $set: { "gardener.slug": slug } });
  const fresh = await col.findOne({ _id: user._id }, { projection: { "gardener.slug": 1 } });
  return fresh?.gardener?.slug ?? slug;
}

type CheerTally = { today: number; total: number; mine: boolean; from: string[] };

async function tallyCheers(ids: ObjectId[], viewer: ObjectId | null, today: string, ownerId: ObjectId | null): Promise<Map<string, CheerTally>> {
  const out = new Map<string, CheerTally>();
  if (ids.length === 0) return out;
  const col = await cheers();
  const rows = await col
    .aggregate<{ _id: ObjectId; total: number; today: number; mine: number }>([
      { $match: { toUserId: { $in: ids } } },
      {
        $group: {
          _id: "$toUserId",
          total: { $sum: 1 },
          today: { $sum: { $cond: [{ $eq: ["$day", today] }, 1, 0] } },
          mine: { $sum: { $cond: [{ $and: [{ $eq: ["$day", today] }, { $eq: ["$fromUserId", viewer ?? null] }] }, 1, 0] } },
        },
      },
    ])
    .toArray();
  for (const r of rows) out.set(r._id.toHexString(), { today: r.today, total: r.total, mine: r.mine > 0, from: [] });
  // who cheered, told only to the garden's owner
  if (ownerId && out.get(ownerId.toHexString())?.today) {
    const today_ = await col.find({ toUserId: ownerId, day: today }).sort({ at: -1 }).limit(12).toArray();
    const senders = await (await users()).find({ _id: { $in: today_.map((c) => c.fromUserId) }, "gardener.public": true }, { projection: { gardener: 1 } }).toArray();
    const names = new Map(senders.map((u) => [u._id.toHexString(), u.gardener?.name ?? ""]));
    out.get(ownerId.toHexString())!.from = today_.map((c) => names.get(c.fromUserId.toHexString())).filter((n): n is string => Boolean(n));
  }
  return out;
}

const EMPTY_TALLY: CheerTally = { today: 0, total: 0, mine: false, from: [] };

/** How many friends each gardener has made in the city, asked for or moved in next door: each one is a bench. */
async function tallyFriends(ids: ObjectId[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (ids.length === 0) return out;
  const [plots, records] = await Promise.all([
    (await invites()).find({ claimedBy: { $ne: null }, $or: [{ fromUserId: { $in: ids } }, { claimedBy: { $in: ids } }] }, { projection: { fromUserId: 1, claimedBy: 1 } }).toArray(),
    (await friendsCollection()).find({ users: { $in: ids }, status: { $in: ["friends", "removed"] } }, { projection: { users: 1, status: 1 } }).limit(5000).toArray(),
  ]);
  const wanted = new Set(ids.map((i) => i.toHexString()));
  const sets = new Map<string, Set<string>>();
  const link = (a: ObjectId, b: ObjectId, on: boolean) => {
    for (const [x, y] of [
      [a, b],
      [b, a],
    ]) {
      const hex = x.toHexString();
      if (!wanted.has(hex)) continue;
      const set = sets.get(hex) ?? new Set<string>();
      if (on) set.add(y.toHexString());
      else set.delete(y.toHexString());
      sets.set(hex, set);
    }
  };
  for (const p of plots) link(p.fromUserId, p.claimedBy!, true);
  for (const r of records) if (r.status === "friends") link(r.users[0], r.users[1], true);
  // a friendship ended takes its bench with it
  for (const r of records) if (r.status === "removed") link(r.users[0], r.users[1], false);
  for (const [hex, set] of sets) if (set.size) out.set(hex, set.size);
  return out;
}

async function toCityGarden(user: CityUser, viewer: ObjectId | null, today: string, tally: Map<string, CheerTally>, rank: number | null, friends = new Map<string, number>(), relations?: Map<string, Friendship>): Promise<CityGarden> {
  const me = Boolean(viewer && user._id.equals(viewer));
  const snap = agedSnapshot(user.garden, today);
  const g = user.gardener;
  const score = snap?.score ?? 0;
  return {
    id: g ? await slugFor(user) : "me",
    name: g?.name ?? "You",
    animal: g && isAnimal(g.animal) ? g.animal : "1",
    me,
    joined: Boolean(g?.public),
    score,
    level: gardenLevelOf(score).level,
    rank,
    plants: snap?.plants ?? [],
    habits: snap?.habits ?? 0,
    doneToday: snap?.doneToday ?? 0,
    dueToday: snap?.dueToday ?? 0,
    cheers: tally.get(user._id.toHexString()) ?? EMPTY_TALLY,
    friends: friends.get(user._id.toHexString()) ?? 0,
    ...(viewer && !me ? { friendship: relations?.get(user._id.toHexString()) ?? null } : {}),
  };
}

const PUBLIC = { "gardener.public": true, disabled: { $ne: true }, "garden.score": { $exists: true } };
const PROJECTION = { projection: { gardener: 1, garden: 1 } };

/** Competition ranks down a street already in score order, starting from the rank of its first garden. */
function ranksFrom(first: number, scores: number[]): number[] {
  const out: number[] = [];
  scores.forEach((s, i) => out.push(i > 0 && s === scores[i - 1] ? out[i - 1] : first + i));
  return out;
}

declare global {
  var _kairoGuestCity: Map<string, { at: number; city: City }> | undefined;
}

/**
 * A street of the city. `neighbours` is the gardens just ahead of yours and
 * just behind; `friends` the people you share lists with; `top` the best in
 * the city. Someone signed out sees the top street, and no garden of their own.
 */
export async function loadCity(viewer: ObjectId | null, asked: CityScope, today: string): Promise<City> {
  // the street shown to people signed out is the same for everyone that day: kept for a minute, since a shared link can bring a crowd
  if (!viewer) {
    const cache = (globalThis._kairoGuestCity ??= new Map());
    const hit = cache.get(today);
    const ttl = process.env.NODE_ENV === "production" ? 60_000 : 0;
    if (hit && Date.now() - hit.at < ttl) return hit.city;
    const city = await buildCity(null, "top", today);
    cache.set(today, { at: Date.now(), city });
    if (cache.size > 4) cache.delete(cache.keys().next().value as string);
    return city;
  }
  return buildCity(viewer, asked, today);
}

async function buildCity(viewer: ObjectId | null, asked: CityScope, today: string): Promise<City> {
  await ensureCityIndexes();
  const col = await users();
  const scope: CityScope = viewer ? asked : "top";
  const total = await col.countDocuments(PUBLIC);

  let meDoc: CityUser | null = null;
  if (viewer) {
    const snapshot = await refreshGardenSnapshot(viewer, today);
    meDoc = await col.findOne({ _id: viewer }, PROJECTION);
    if (meDoc) meDoc.garden = snapshot;
  }
  const myScore = agedSnapshot(meDoc?.garden, today)?.score ?? 0;
  const others = viewer ? { ...PUBLIC, _id: { $ne: viewer } } : PUBLIC;

  let docs: CityUser[];
  if (scope === "top") {
    docs = await col.find(others, PROJECTION).sort({ "garden.score": -1, _id: 1 }).limit(24).toArray();
  } else if (scope === "friends") {
    const ids = (await friendIds(viewer!)).filter((id) => !id.equals(viewer!));
    docs = await col.find({ ...others, _id: { $in: ids } }, PROJECTION).sort({ "garden.score": -1, _id: 1 }).limit(40).toArray();
  } else {
    const [ahead, behind] = await Promise.all([
      col.find({ ...others, "garden.score": { $gt: myScore } }, PROJECTION).sort({ "garden.score": 1, _id: 1 }).limit(8).toArray(),
      col.find({ ...others, "garden.score": { $lte: myScore } }, PROJECTION).sort({ "garden.score": -1, _id: 1 }).limit(8).toArray(),
    ]);
    docs = [...ahead.reverse(), ...behind];
  }

  // your own garden stands on your street, joined or not (only you see it until you join); on the top street, only if it makes the cut
  const scoreOf = (u: CityUser) => (u === meDoc ? myScore : (agedSnapshot(u.garden, today)?.score ?? 0));
  const street: CityUser[] = [...docs];
  if (meDoc && (scope !== "top" || docs.length < 24 || docs.some((d) => scoreOf(d) <= myScore))) street.push(meDoc);
  street.sort((a, b) => scoreOf(b) - scoreOf(a));
  if (scope === "top" && street.length > 24) street.length = 24;

  const myRank = viewer ? (await col.countDocuments({ ...others, "garden.score": { $gt: myScore } })) + 1 : null;
  const firstRank = scope === "neighbours" && street.length ? (await col.countDocuments({ ...others, "garden.score": { $gt: scoreOf(street[0]) } })) + 1 : 1;
  const ranks = ranksFrom(firstRank, street.map(scoreOf));
  const ids = meDoc ? [...new Set([...street, meDoc])].map((u) => u._id) : street.map((u) => u._id);
  const [tally, friends, relations] = await Promise.all([tallyCheers(ids, viewer, today, viewer), tallyFriends(ids), viewer ? relationsOf(viewer, ids) : undefined]);

  settleStale(docs, today);
  const gardens = await Promise.all(street.map((u, i) => toCityGarden(u, viewer, today, tally, ranks[i], friends, relations)));
  const meGarden = meDoc ? { ...(gardens.find((g) => g.me) ?? (await toCityGarden(meDoc, viewer, today, tally, myRank, friends))), rank: myRank } : null;
  if (!viewer) return { scope, total, me: meGarden, gardens };
  const [invited, requests] = await Promise.all([invitesOf(viewer), requestsOf(viewer)]);
  return { scope, total, me: meGarden, gardens, invites: invited, requests };
}

/** One garden, to walk into. Only a joined garden, or your own. */
export async function visitGarden(viewer: ObjectId | null, id: string, today: string): Promise<CityGarden | null> {
  await ensureCityIndexes();
  const col = await users();
  let doc: CityUser | null = null;
  if (id === "me" && viewer) doc = await col.findOne({ _id: viewer }, PROJECTION);
  else if (/^[a-f0-9]{12}$/.test(id)) doc = await col.findOne({ "gardener.slug": id, disabled: { $ne: true } }, PROJECTION);
  if (!doc) return null;
  const mine = Boolean(viewer && doc._id.equals(viewer));
  if (!mine && !doc.gardener?.public) return null;
  if (mine) doc.garden = await refreshGardenSnapshot(doc._id, today);
  const score = agedSnapshot(doc.garden, today)?.score ?? 0;
  const rank = doc.gardener?.public ? (await col.countDocuments({ ...PUBLIC, _id: { $ne: doc._id }, "garden.score": { $gt: score } })) + 1 : null;
  const [tally, friends, relations] = await Promise.all([tallyCheers([doc._id], viewer, today, mine ? doc._id : null), tallyFriends([doc._id]), viewer && !mine ? relationsOf(viewer, [doc._id]) : undefined]);
  return toCityGarden(doc, viewer, today, tally, rank, friends, relations);
}

export class CheerRefused extends Error {}

/** A cheer: once a day from one gardener to another, never to yourself, and only from someone who joined. */
export async function cheerGarden(viewer: ObjectId, id: string, today: string): Promise<CityGarden["cheers"]> {
  await ensureCityIndexes();
  const col = await users();
  if (!/^[a-f0-9]{12}$/.test(id)) throw new HabitInputError("That garden isn't in the city.");
  const [target, me] = await Promise.all([col.findOne({ "gardener.slug": id, "gardener.public": true, disabled: { $ne: true } }, PROJECTION), col.findOne({ _id: viewer }, PROJECTION)]);
  if (!target) throw new HabitInputError("That garden isn't in the city.");
  if (target._id.equals(viewer)) throw new HabitInputError("You can't cheer your own garden.");
  if (!me?.gardener?.public) throw new CheerRefused("Join the city to cheer other gardens.");
  await (await cheers()).updateOne({ toUserId: target._id, fromUserId: viewer, day: today }, { $setOnInsert: { at: new Date() } }, { upsert: true });
  const tally = await tallyCheers([target._id], viewer, today, null);
  return tally.get(target._id.toHexString()) ?? EMPTY_TALLY;
}

/** Cheers your own garden got today, for the Habits page. */
export async function cheersToday(userId: ObjectId, today: string): Promise<{ today: number; from: string[] }> {
  await ensureCityIndexes();
  const tally = await tallyCheers([userId], null, today, userId);
  const t = tally.get(userId.toHexString());
  return { today: t?.today ?? 0, from: t?.from ?? [] };
}

/** Everything the city holds about an account, for when it's deleted. */
export async function forgetCityOf(userId: ObjectId): Promise<number> {
  const r = await (await cheers()).deleteMany({ $or: [{ toUserId: userId }, { fromUserId: userId }] });
  return r.deletedCount;
}

/* ----------------------------------------------------------------- invites */

export class InviteRefused extends Error {}
export class InviteSendFailed extends Error {}

/** Your saved plots, and the friends who've claimed one since you last looked (told once). */
async function invitesOf(userId: ObjectId): Promise<NonNullable<City["invites"]>> {
  const col = await invites();
  const [open, news] = await Promise.all([
    col.find({ fromUserId: userId, claimedBy: null }).sort({ createdAt: 1 }).limit(MAX_OPEN_INVITES).toArray(),
    col.find({ fromUserId: userId, claimedBy: { $ne: null }, seenByInviter: false }).limit(10).toArray(),
  ]);
  let arrived: string[] = [];
  if (news.length) {
    const who = await (await users()).find({ _id: { $in: news.map((n) => n.claimedBy!) } }, { projection: { gardener: 1 } }).toArray();
    arrived = who.map((u) => u.gardener?.name).filter((n): n is string => Boolean(n));
    await col.updateMany({ _id: { $in: news.map((n) => n._id) } }, { $set: { seenByInviter: true } });
  }
  return { open: open.map((i) => i.code), arrived };
}

/** Saves a free plot for a friend. Only someone on the street can save the plot beside theirs. */
export async function createInvite(userId: ObjectId): Promise<{ code: string }> {
  await ensureCityIndexes();
  const me = await (await users()).findOne({ _id: userId }, PROJECTION);
  if (!me?.gardener?.public) throw new InviteRefused("Claim your own plot first, then save the one beside it for a friend.");
  const col = await invites();
  if ((await col.countDocuments({ fromUserId: userId, claimedBy: null })) >= MAX_OPEN_INVITES) {
    throw new HabitInputError(`You're holding ${MAX_OPEN_INVITES} plots for friends already. Share one of those, or let one go.`);
  }
  const code = randomBytes(5).toString("hex");
  await col.insertOne({ _id: new ObjectId(), code, fromUserId: userId, createdAt: new Date(), claimedBy: null, claimedAt: null, seenByInviter: false });
  return { code };
}

/** Lets a saved plot go again. Only the one who saved it, and only while it's unclaimed. */
export async function cancelInvite(userId: ObjectId, code: string): Promise<boolean> {
  if (!/^[a-f0-9]{10}$/.test(code)) return false;
  const r = await (await invites()).deleteOne({ code, fromUserId: userId, claimedBy: null });
  return r.deletedCount === 1;
}

export type InviteInfo = {
  status: "open" | "claimed" | "mine";
  /** The garden beside the saved plot, when its owner is on the street. */
  inviter: CityGarden | null;
  inviterName: string | null;
};

/** What a saved plot's link shows: whose garden it's beside, and whether it's still free. */
export async function inviteInfo(viewer: ObjectId | null, code: string, today: string): Promise<InviteInfo | null> {
  if (!/^[a-f0-9]{10}$/.test(code)) return null;
  await ensureCityIndexes();
  const invite = await (await invites()).findOne({ code });
  if (!invite) return null;
  const owner = await (await users()).findOne({ _id: invite.fromUserId, disabled: { $ne: true } }, PROJECTION);
  if (!owner) return null;
  const inviter = owner.gardener?.public && owner.gardener.slug ? await visitGarden(null, owner.gardener.slug, today) : null;
  const status = viewer && invite.fromUserId.equals(viewer) ? "mine" : invite.claimedBy ? "claimed" : "open";
  return { status, inviter, inviterName: owner.gardener?.public ? owner.gardener.name : null };
}

/**
 * Claims a saved plot: the claimer joins the city (with the name and animal
 * they chose, or the ones they have), the two become friends on each other's
 * Friends street, and the one who saved it hears about it.
 */
export async function claimInvite(userId: ObjectId, code: string, input: { name?: unknown; animal?: unknown }, today: string): Promise<{ inviter: { name: string; id: string } | null }> {
  if (!/^[a-f0-9]{10}$/.test(code)) throw new HabitInputError("That invite link isn't right.");
  await ensureCityIndexes();
  const col = await invites();
  const invite = await col.findOne({ code });
  if (!invite) throw new HabitInputError("That invite link isn't right.");
  if (invite.fromUserId.equals(userId)) throw new HabitInputError("This is a plot you saved for a friend. Send them the link.");
  if (invite.claimedBy) throw new InviteRefused(invite.claimedBy.equals(userId) ? "You've already claimed this plot." : "Someone has already claimed this plot.");
  if (await col.findOne({ fromUserId: invite.fromUserId, claimedBy: userId })) throw new InviteRefused("You already live next door to them.");

  const people = await users();
  const me = await people.findOne({ _id: userId }, PROJECTION);
  if (me?.gardener?.name) {
    // already has a name: claiming puts them (back) on the street under it
    if (!me.gardener.public) await setGardener(userId, { name: me.gardener.name, animal: me.gardener.animal, public: true });
  } else {
    await setGardener(userId, { name: input.name, animal: input.animal, public: true });
  }

  const claimed = await col.updateOne({ _id: invite._id, claimedBy: null }, { $set: { claimedBy: userId, claimedAt: new Date(), seenByInviter: false } });
  if (claimed.modifiedCount === 0) throw new InviteRefused("Someone has just claimed this plot.");
  await Promise.all([refreshGardenSnapshot(userId, today), befriendByPlot(invite.fromUserId, userId)]);

  const owner = await people.findOne({ _id: invite.fromUserId }, PROJECTION);
  const fresh = await people.findOne({ _id: userId }, PROJECTION);
  const name = fresh?.gardener?.name ?? "A friend";
  const notify = async () => {
    const { sendToUser } = await import("./push");
    await sendToUser(invite.fromUserId, { title: `${name} claimed your plot`, body: "They've moved in next to your garden in Kairo City. Leave them a cheer.", tag: "city-claim", url: "/today?city=open&street=friends" });
  };
  try {
    after(() => notify().catch((err: unknown) => console.error("[city] claim push", err)));
  } catch {
    void notify().catch(() => undefined);
  }
  return { inviter: owner?.gardener?.public && owner.gardener.slug ? { name: owner.gardener.name, id: owner.gardener.slug } : null };
}

/* ------------------------------------------------------------ invite emails */

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

/** The addresses you've sent plots to, newest first: suggestions for the next one. */
export async function sentInviteEmails(userId: ObjectId): Promise<{ email: string; claimed: boolean }[]> {
  const rows = await (await invites()).find({ fromUserId: userId, sentTo: { $type: "string" } }, { projection: { sentTo: 1, claimedBy: 1, sentAt: 1 } }).sort({ sentAt: -1 }).limit(60).toArray();
  const seen = new Map<string, { email: string; claimed: boolean }>();
  for (const r of rows) {
    const email = r.sentTo as string;
    if (!seen.has(email)) seen.set(email, { email, claimed: Boolean(r.claimedBy) });
  }
  return [...seen.values()].slice(0, 20);
}

/**
 * Sends a saved plot to someone by email: a letter with a picture of the
 * garden and the plot beside it, and one button to claim it. One plot goes to
 * one address; sending it again to someone else moves it to them. A day's
 * sends are capped, and the same plot never mails the same person twice.
 */
export async function emailInvite(userId: ObjectId, code: string, rawEmail: unknown, today: string): Promise<{ sent: boolean; dry: boolean; email: string }> {
  if (!/^[a-f0-9]{10}$/.test(code)) throw new HabitInputError("That plot isn't one of yours.");
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) throw new HabitInputError("That doesn't look like an email address.");
  await ensureCityIndexes();
  const col = await invites();
  const invite = await col.findOne({ code, fromUserId: userId });
  if (!invite) throw new HabitInputError("That plot isn't one of yours.");
  if (invite.claimedBy) throw new InviteRefused("Someone has already claimed this plot. Save another for them.");
  const people = await users();
  const me = await people.findOne({ _id: userId }, { projection: { gardener: 1, garden: 1, email: 1, name: 1 } });
  if (!me?.gardener?.public) throw new InviteRefused("Claim your own plot first, then invite a friend beside it.");
  if (String(me.email ?? "").toLowerCase() === email) throw new HabitInputError("That's your own address. Send it to a friend.");
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if ((await col.countDocuments({ fromUserId: userId, sentAt: { $gte: since } })) >= MAX_INVITE_EMAILS_PER_DAY) {
    throw new InviteRefused(`That's ${MAX_INVITE_EMAILS_PER_DAY} invites by email today. Copy the link instead, or send more tomorrow.`);
  }

  const { sendEmail } = await import("./email");
  const { cityInviteEmail } = await import("./email-templates");
  const { SITE_URL } = await import("./site");
  const snap = agedSnapshot(me.garden, today);
  const score = snap?.score ?? 0;
  const level = gardenLevelOf(score);
  const rendered = cityInviteEmail({
    inviterName: me.gardener.name,
    level: level.level,
    levelName: level.name,
    habits: snap?.habits ?? 0,
    doneToday: snap?.doneToday ?? 0,
    claimUrl: `${SITE_URL}/i/${code}`,
    imageUrl: `${SITE_URL}/i/${code}/opengraph-image`,
    email,
  });
  const result = await sendEmail({ key: `city-invite:${code}:${email}`, to: email, ...rendered });
  if (!result.sent && result.skipped !== "duplicate") {
    throw new InviteSendFailed(result.skipped === "unconfigured" ? "Email isn't set up on this server. Copy the link instead." : "The invite didn't send. Try again, or copy the link.");
  }
  await col.updateOne({ _id: invite._id }, { $set: { sentTo: email, sentAt: new Date() } });
  return { sent: true, dry: result.skipped === "dry", email };
}

/* ----------------------------------------------------------------- friends */

export { FriendRefused };

/** On the street, whatever their score: someone who can be found, asked, and visited. */
const GARDENERS = { "gardener.public": true, disabled: { $ne: true } };

/** A push to someone, once the response has gone. */
function pushLater(userId: ObjectId, payload: { title: string; body: string; tag: string; url: string }): void {
  const run = async () => {
    const { sendToUser } = await import("./push");
    await sendToUser(userId, payload);
  };
  const safe = () => run().catch((err: unknown) => console.error("[city] push", err));
  try {
    after(safe);
  } catch {
    void safe();
  }
}

/** Friend requests waiting for an answer (from people still on the street), and who accepted yours since you last looked. */
async function requestsOf(userId: ObjectId): Promise<NonNullable<City["requests"]>> {
  const [incoming, accepted] = await Promise.all([incomingRequests(userId), acceptedSinceLastLook(userId)]);
  const people = await users();
  const [askers, accepters] = await Promise.all([
    incoming.length ? people.countDocuments({ _id: { $in: incoming.map((r) => r.from) }, ...GARDENERS }) : 0,
    accepted.length ? people.find({ _id: { $in: accepted }, ...GARDENERS }, { projection: { gardener: 1 } }).toArray() : [],
  ]);
  return { incoming: askers, accepted: accepters.map((u) => u.gardener?.name).filter((n): n is string => Boolean(n)) };
}

/** How many friend requests are waiting for this account, for the badge on the way into the city. */
export async function friendRequestCount(userId: ObjectId): Promise<number> {
  const incoming = await incomingRequests(userId);
  if (incoming.length === 0) return 0;
  return (await users()).countDocuments({ _id: { $in: incoming.map((r) => r.from) }, ...GARDENERS });
}

async function toFriendCards(docs: CityUser[], today: string, relations: Map<string, Friendship>, notes?: Map<string, string>): Promise<FriendCard[]> {
  return Promise.all(
    docs.map(async (u) => {
      const snap = agedSnapshot(u.garden, today);
      const score = snap?.score ?? 0;
      const hex = u._id.toHexString();
      const note = notes?.get(hex);
      return {
        id: await slugFor(u),
        name: u.gardener?.name ?? "A gardener",
        animal: u.gardener && isAnimal(u.gardener.animal) ? u.gardener.animal : "1",
        level: gardenLevelOf(score).level,
        score,
        doneToday: snap?.doneToday ?? 0,
        dueToday: snap?.dueToday ?? 0,
        plants: (snap?.plants ?? []).slice(0, 3),
        friendship: relations.get(hex) ?? null,
        ...(note ? { note } : {}),
      };
    })
  );
}

/** In the order of the records they came from: newest request first. */
function inOrder(docs: CityUser[], ids: ObjectId[]): CityUser[] {
  const byId = new Map(docs.map((d) => [d._id.toHexString(), d]));
  return ids.map((id) => byId.get(id.toHexString())).filter((d): d is CityUser => Boolean(d));
}

/**
 * Everything the friends sheet shows: your friends, requests waiting on you,
 * requests you sent, and a few people you might know from the city (who
 * cheered your garden lately, then gardens near yours on the street).
 */
export async function friendsOverview(viewer: ObjectId, today: string): Promise<FriendsOverview> {
  await ensureCityIndexes();
  const people = await users();
  const [me, ids, incoming, outgoing] = await Promise.all([people.findOne({ _id: viewer }, PROJECTION), friendIds(viewer), incomingRequests(viewer), outgoingRequests(viewer)]);
  const friendOnly = ids.filter((id) => !id.equals(viewer));
  const [friendDocs, incomingDocs, outgoingDocs] = await Promise.all([
    friendOnly.length ? people.find({ _id: { $in: friendOnly }, ...GARDENERS }, PROJECTION).sort({ "garden.score": -1, _id: 1 }).limit(200).toArray() : [],
    incoming.length ? people.find({ _id: { $in: incoming.map((r) => r.from) }, ...GARDENERS }, PROJECTION).toArray() : [],
    outgoing.length ? people.find({ _id: { $in: outgoing.map((r) => r.to) }, ...GARDENERS }, PROJECTION).toArray() : [],
  ]);

  // people you might know: never yourself, a friend, or someone a request is already waiting on
  const taken = new Set([viewer, ...friendOnly, ...incoming.map((r) => r.from), ...outgoing.map((r) => r.to)].map((id) => id.toHexString()));
  const notes = new Map<string, string>();
  const cheerers = await (await cheers())
    .aggregate<{ _id: ObjectId; last: Date }>([{ $match: { toUserId: viewer, day: { $gte: addDays(today, -30) } } }, { $group: { _id: "$fromUserId", last: { $max: "$at" } } }, { $sort: { last: -1 } }, { $limit: 30 }])
    .toArray();
  const cheererIds = cheerers.map((c) => c._id).filter((id) => !taken.has(id.toHexString()));
  let suggested = cheererIds.length ? inOrder(await people.find({ _id: { $in: cheererIds }, ...GARDENERS }, PROJECTION).toArray(), cheererIds).slice(0, 6) : [];
  for (const u of suggested) notes.set(u._id.toHexString(), "Cheered your garden");
  if (suggested.length < 6 && me?.gardener?.public) {
    for (const u of suggested) taken.add(u._id.toHexString());
    const myScore = agedSnapshot(me.garden, today)?.score ?? 0;
    const skip = [...taken].map((h) => new ObjectId(h));
    const [ahead, behind] = await Promise.all([
      people.find({ ...PUBLIC, _id: { $nin: skip }, "garden.score": { $gt: myScore } }, PROJECTION).sort({ "garden.score": 1, _id: 1 }).limit(4).toArray(),
      people.find({ ...PUBLIC, _id: { $nin: skip }, "garden.score": { $lte: myScore } }, PROJECTION).sort({ "garden.score": -1, _id: 1 }).limit(4).toArray(),
    ]);
    const near: CityUser[] = [];
    for (let i = 0; i < 4; i++) {
      if (ahead[i]) near.push(ahead[i]);
      if (behind[i]) near.push(behind[i]);
    }
    for (const u of near) notes.set(u._id.toHexString(), "Near you on the street");
    suggested = [...suggested, ...near].slice(0, 6);
  }

  const everyone = [...friendDocs, ...incomingDocs, ...outgoingDocs, ...suggested];
  const relations = await relationsOf(viewer, everyone.map((u) => u._id));
  const [friends, asking, asked, suggestions] = await Promise.all([
    toFriendCards(friendDocs, today, relations),
    toFriendCards(inOrder(incomingDocs, incoming.map((r) => r.from)), today, relations),
    toFriendCards(inOrder(outgoingDocs, outgoing.map((r) => r.to)), today, relations),
    toFriendCards(suggested, today, relations, notes),
  ]);
  return { joined: Boolean(me?.gardener?.public), friends, incoming: asking, outgoing: asked, suggestions };
}

/** Gardeners on the street whose names hold what was typed: names that start with it first, then by score. */
export async function searchGardeners(viewer: ObjectId, raw: unknown, today: string): Promise<FriendCard[]> {
  const q = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (q.length < 2 || q.length > 40) return [];
  await ensureCityIndexes();
  const pattern = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const docs = await (await users())
    .find({ ...GARDENERS, _id: { $ne: viewer }, "gardener.name": { $regex: pattern, $options: "i" } }, PROJECTION)
    .sort({ "garden.score": -1, _id: 1 })
    .limit(40)
    .toArray();
  const lower = q.toLowerCase();
  const starts = (u: CityUser) => (u.gardener?.name.toLowerCase().startsWith(lower) ? 0 : 1);
  const top = docs.sort((a, b) => starts(a) - starts(b)).slice(0, 20);
  return toFriendCards(top, today, await relationsOf(viewer, top.map((u) => u._id)));
}

async function gardenerBySlug(slug: string, onStreet: boolean): Promise<CityUser | null> {
  if (!/^[a-f0-9]{12}$/.test(slug)) return null;
  return (await users()).findOne({ "gardener.slug": slug, ...(onStreet ? GARDENERS : { disabled: { $ne: true } }) }, PROJECTION);
}

/**
 * Asks a gardener on the street to be friends, or says yes to one who asked
 * first. Only from someone on the street too: a request comes with a name
 * and a garden to look at.
 */
export async function askFriendship(viewer: ObjectId, slug: string): Promise<Friendship> {
  await ensureCityIndexes();
  const [me, them] = await Promise.all([(await users()).findOne({ _id: viewer }, PROJECTION), gardenerBySlug(slug, true)]);
  if (!them) throw new HabitInputError("That garden isn't in the city.");
  if (them._id.equals(viewer)) throw new HabitInputError("That's your own garden.");
  if (!me?.gardener?.public) throw new FriendRefused("Claim your plot in the city first, then add friends.");
  const { friendship, tell } = await askFriend(viewer, them._id);
  if (tell) {
    const tag = `city-friend-${await slugFor(me)}`;
    pushLater(
      them._id,
      tell === "request"
        ? { title: `${me.gardener.name} wants to be friends`, body: "Say yes, and your gardens share a street in Kairo City.", tag, url: "/today?city=open&friends=open" }
        : { title: `${me.gardener.name} accepted your friend request`, body: "You're on each other's Friends street now. Go and see their garden.", tag, url: "/today?city=open&street=friends" }
    );
  }
  return friendship;
}

/** Says yes, or quietly no, to a friend request. */
export async function answerFriendship(viewer: ObjectId, slug: string, action: "accept" | "decline"): Promise<Friendship> {
  await ensureCityIndexes();
  const them = await gardenerBySlug(slug, action === "accept");
  if (!them) throw new HabitInputError("That garden isn't in the city.");
  if (action === "decline") {
    await declineFriend(viewer, them._id);
    return null;
  }
  const me = await (await users()).findOne({ _id: viewer }, PROJECTION);
  if (!me?.gardener?.public) throw new FriendRefused("Claim your plot in the city to accept.");
  if (!(await acceptFriend(viewer, them._id))) {
    const now = await relationsOf(viewer, [them._id]);
    if (now.get(them._id.toHexString()) === "friends") return "friends";
    throw new HabitInputError("That request isn't waiting any more.");
  }
  pushLater(them._id, { title: `${me.gardener.name} accepted your friend request`, body: "You're on each other's Friends street now. Go and see their garden.", tag: `city-friend-${await slugFor(me)}`, url: "/today?city=open&street=friends" });
  return "friends";
}

/** Takes back a request, or ends a friendship. False when there was nothing to end. */
export async function endFriendship(viewer: ObjectId, slug: string): Promise<boolean> {
  const them = await gardenerBySlug(slug, false);
  if (!them || them._id.equals(viewer)) return false;
  return dropFriend(viewer, them._id);
}

/**
 * Takes a garden off the street: nobody can find, visit or cheer it, it leaves
 * the habit leaderboards, and the plots it saved for friends are let go.
 * Habits, friends and cheers stay, for coming back under the same name.
 */
export async function leaveCity(userId: ObjectId): Promise<void> {
  await (await users()).updateOne({ _id: userId, "gardener.name": { $type: "string" } }, { $set: { "gardener.public": false } });
  await (await invites()).deleteMany({ fromUserId: userId, claimedBy: null });
  globalThis._kairoGuestCity?.clear();
}
