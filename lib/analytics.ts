import { getDb, withDbRetry } from "./db";

/**
 * First-party events, in the database Kairo already has.
 *
 * At Kairo's scale this is the right sink: no second vendor, no keys, no
 * paused free tiers, and the TTL index caps what it can ever cost the M0
 * cluster. The day traffic outgrows it (thousands of events a day, months of
 * retention wanted), the ingest route swaps its insert for a call to a real
 * event store and nothing else changes.
 *
 * What is deliberately NOT stored: IP addresses, full user agents, or
 * anything a visitor typed. An event is a name, a path, anonymous ids, and
 * small labelled properties.
 */

const TTL_DAYS = 120;

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

let indexReady: Promise<unknown> | null = null;
function ensureIndexes(db: Awaited<ReturnType<typeof getDb>>): Promise<unknown> {
  indexReady ??= Promise.all([
    db.collection("events").createIndex({ at: 1 }, { expireAfterSeconds: TTL_DAYS * 86_400, name: "events_ttl" }),
    db.collection("events").createIndex({ event: 1, at: -1 }, { name: "events_by_name" }),
  ]).catch((err: unknown) => {
    indexReady = null;
    throw err;
  });
  return indexReady;
}

export async function recordEvent(e: IngestEvent): Promise<void> {
  const db = await withDbRetry(getDb);
  try {
    await ensureIndexes(db);
  } catch (err) {
    console.error("[analytics] could not create event indexes", err);
  }
  await db.collection("events").insertOne({ at: new Date(), ...e });
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
    const db = await getDb();
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
      referrers: named((facets?.referrers ?? []) as Bucket[]),
      sources: named((facets?.sources ?? []) as Bucket[]),
      campaigns: named((facets?.campaigns ?? []) as Bucket[]),
      countries: named((facets?.countries ?? []) as Bucket[]),
      devices: named((facets?.devices ?? []) as Bucket[]),
    };
  });
}
