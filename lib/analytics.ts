import { type Db, MongoClient } from "mongodb";
import { getDb, withDbRetry } from "./db";

/**
 * First-party events, on their own Atlas cluster.
 *
 * Analytics is the one workload whose volume grows with traffic rather than
 * with users, so it gets its own free cluster (ANALYTICS_MONGODB_URI, the
 * `kairo` database) and can never crowd the product's storage or ops budget.
 * When the variable is unset, events fall back into the main database, so a
 * missing env var degrades to the old behaviour instead of dropping data.
 *
 * What is deliberately NOT stored: IP addresses, full user agents, or
 * anything a visitor typed. An event is a name, a path, anonymous ids, and
 * small labelled properties.
 */

const TTL_DAYS = 120;

declare global {
  var _kairoAnalyticsClient: Promise<MongoClient> | undefined;
}

async function analyticsDb(): Promise<Db> {
  const uri = process.env.ANALYTICS_MONGODB_URI;
  if (!uri) return getDb();
  global._kairoAnalyticsClient ??= new MongoClient(uri, {
    maxPoolSize: 5,
    // an unreachable analytics cluster must fail in seconds, not the
    // driver's 30s default — beacons are fire-and-forget, never worth a wait
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  })
    .connect()
    .catch((err) => {
      // a failed connect must not be cached forever
      global._kairoAnalyticsClient = undefined;
      throw err;
    });
  const client = await global._kairoAnalyticsClient;
  // the db name rides in the URI path; "kairo" is this cluster's convention
  const fromPath = new URL(uri).pathname.replace(/^\//, "");
  return client.db(fromPath || "kairo");
}

export type IngestEvent = {
  event: string;
  path: string;
  vid: string;
  sid: string;
  userId?: string;
  props?: Record<string, string | number | boolean>;
  ref?: string;
  utm?: Record<string, string>;
  landing?: string;
  country?: string;
  device?: "mobile" | "desktop";
};

// keyed by database, not module-wide: the fallback main DB and the analytics
// cluster are different databases, and one flag for both meant whichever
// connected first left the other without its TTL index — unbounded growth
const indexReady = new Map<string, Promise<unknown>>();
function ensureIndexes(db: Db): Promise<unknown> {
  const key = db.databaseName;
  let p = indexReady.get(key);
  if (!p) {
    p = Promise.all([
      db.collection("events").createIndex({ at: 1 }, { expireAfterSeconds: TTL_DAYS * 86_400, name: "events_ttl" }),
      db.collection("events").createIndex({ event: 1, at: -1 }, { name: "events_by_name" }),
    ]).catch((err: unknown) => {
      indexReady.delete(key);
      throw err;
    });
    indexReady.set(key, p);
  }
  return p;
}

export async function recordEvent(e: IngestEvent): Promise<void> {
  // the write is inside the retry, not just the connection
  await withDbRetry(async () => {
    const db = await analyticsDb();
    try {
      await ensureIndexes(db);
    } catch (err) {
      console.error("[analytics] could not create event indexes", err);
    }
    await db.collection("events").insertOne({ at: new Date(), ...e });
  });
}

/* -------------------------------------------------------------- reporting */

export type AnalyticsSnapshot = {
  days: number;
  totalVisits: number;
  totalUniques: number;
  todayVisits: number;
  todayUniques: number;
  daily: { day: string; visits: number; uniques: number }[];
  events: { name: string; count: number }[];
  /** Unique browsers per step of the try-before-signup journey, in order. */
  guestFunnel: { name: string; count: number }[];
  referrers: { name: string; count: number }[];
  sources: { name: string; count: number }[];
  campaigns: { name: string; count: number }[];
  countries: { name: string; count: number }[];
  devices: { name: string; count: number }[];
};

type Bucket = { _id: string | null; count: number };
const named = (rows: Bucket[]) =>
  rows
    .filter((r): r is Bucket & { _id: string } => Boolean(r._id))
    .map((r) => ({ name: r._id, count: r.count }));

export async function loadAnalytics(days = 30): Promise<AnalyticsSnapshot> {
  return withDbRetry(async () => {
    const db = await analyticsDb();
    const since = new Date(Date.now() - days * 86_400_000);

    const [facets] = await db
      .collection("events")
      .aggregate([
        { $match: { at: { $gte: since } } },
        {
          $facet: {
            daily: [
              { $match: { event: "page_view" } },
              {
                $group: {
                  _id: { $dateToString: { format: "%Y-%m-%d", date: "$at" } },
                  visits: { $sum: 1 },
                  vids: { $addToSet: "$vid" },
                },
              },
              { $project: { visits: 1, uniques: { $size: "$vids" } } },
              { $sort: { _id: 1 } },
            ],
            uniques: [
              { $match: { event: "page_view" } },
              { $group: { _id: "$vid" } },
              { $count: "n" },
            ],
            events: [
              { $group: { _id: "$event", count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 20 },
            ],
            // unique browsers, not raw event counts: a guest who captured
            // eight times is one person trying Kairo, not eight
            guestFunnel: [
              {
                $match: {
                  event: {
                    $in: [
                      "guest-visit", "guest-capture", "guest-signup-nudge",
                      "guest-cap-hit", "guest-signin", "guest-sync",
                    ],
                  },
                },
              },
              { $group: { _id: "$event", vids: { $addToSet: "$vid" } } },
              { $project: { count: { $size: "$vids" } } },
            ],
            referrers: [
              { $match: { ref: { $type: "string" } } },
              // one referrer per hostname, not per full deep link
              {
                $group: {
                  _id: {
                    $arrayElemAt: [
                      { $split: [{ $replaceOne: { input: { $replaceOne: { input: "$ref", find: "https://", replacement: "" } }, find: "http://", replacement: "" } }, "/"] },
                      0,
                    ],
                  },
                  count: { $sum: 1 },
                },
              },
              { $sort: { count: -1 } },
              { $limit: 12 },
            ],
            sources: [
              { $match: { "utm.source": { $type: "string" } } },
              { $group: { _id: "$utm.source", count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 12 },
            ],
            campaigns: [
              { $match: { "utm.campaign": { $type: "string" } } },
              { $group: { _id: "$utm.campaign", count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 12 },
            ],
            countries: [
              { $match: { event: "page_view", country: { $type: "string" } } },
              { $group: { _id: "$country", count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 12 },
            ],
            devices: [
              { $match: { event: "page_view", device: { $type: "string" } } },
              { $group: { _id: "$device", count: { $sum: 1 } } },
              { $sort: { count: -1 } },
            ],
          },
        },
      ])
      .toArray();

    const daily = ((facets?.daily ?? []) as { _id: string; visits: number; uniques: number }[]).map(
      (d) => ({ day: d._id, visits: d.visits, uniques: d.uniques })
    );
    const today = new Date().toLocaleDateString("en-CA");
    const todayRow = daily.find((d) => d.day === today);

    return {
      days,
      totalVisits: daily.reduce((n, d) => n + d.visits, 0),
      totalUniques: (facets?.uniques?.[0]?.n as number | undefined) ?? 0,
      todayVisits: todayRow?.visits ?? 0,
      todayUniques: todayRow?.uniques ?? 0,
      daily,
      events: named((facets?.events ?? []) as Bucket[]),
      guestFunnel: (() => {
        const by = new Map(
          ((facets?.guestFunnel ?? []) as Bucket[]).map((r) => [r._id, r.count])
        );
        const step = (event: string, name: string) => ({ name, count: by.get(event) ?? 0 });
        return [
          step("guest-visit", "Tried Kairo without an account"),
          step("guest-capture", "Captured at least one task"),
          step("guest-signup-nudge", "Saw the 5-task invitation"),
          step("guest-cap-hit", "Hit the 10-task cap"),
          step("guest-signin", "Clicked sign in"),
          step("guest-sync", "Signed up, tasks carried over"),
        ];
      })(),
      referrers: named((facets?.referrers ?? []) as Bucket[]),
      sources: named((facets?.sources ?? []) as Bucket[]),
      campaigns: named((facets?.campaigns ?? []) as Bucket[]),
      countries: named((facets?.countries ?? []) as Bucket[]),
      devices: named((facets?.devices ?? []) as Bucket[]),
    };
  });
}
