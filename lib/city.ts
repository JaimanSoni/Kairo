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
  type LogLite,
} from "./habits-shared";
import { friendIds, habitsCollection, HabitInputError, logsCollection } from "./habits";
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

let indexReady: Promise<void> | null = null;
async function ensureCityIndexes(): Promise<void> {
  indexReady ??= (async () => {
    const db = await getDb();
    await Promise.all([
      db.collection("users").createIndex({ "gardener.public": 1, "garden.score": -1 }, { name: "city_by_score" }),
      db.collection("users").createIndex({ "gardener.slug": 1 }, { name: "city_by_slug", unique: true, partialFilterExpression: { "gardener.slug": { $type: "string" } } }),
      db.collection<CheerRecord>("garden_cheers").createIndex({ toUserId: 1, fromUserId: 1, day: 1 }, { name: "cheer_once_a_day", unique: true }),
      db.collection<CheerRecord>("garden_cheers").createIndex({ fromUserId: 1 }, { name: "cheers_by_sender" }),
    ]);
  })().catch((err: unknown) => {
    indexReady = null;
    throw err;
  });
  await indexReady;
}

const users = async () => (await getDb()).collection<CityUser>("users");
const cheers = async () => (await getDb()).collection<CheerRecord>("garden_cheers");

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

async function toCityGarden(user: CityUser, viewer: ObjectId | null, today: string, tally: Map<string, CheerTally>, rank: number | null): Promise<CityGarden> {
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
  const tally = await tallyCheers(meDoc ? [...new Set([...street, meDoc])].map((u) => u._id) : street.map((u) => u._id), viewer, today, viewer);

  settleStale(docs, today);
  const gardens = await Promise.all(street.map((u, i) => toCityGarden(u, viewer, today, tally, ranks[i])));
  const meGarden = meDoc ? { ...(gardens.find((g) => g.me) ?? (await toCityGarden(meDoc, viewer, today, tally, myRank))), rank: myRank } : null;
  return { scope, total, me: meGarden, gardens };
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
  const tally = await tallyCheers([doc._id], viewer, today, mine ? doc._id : null);
  return toCityGarden(doc, viewer, today, tally, rank);
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
