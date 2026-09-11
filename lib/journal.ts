import { MongoServerError, ObjectId, type WithId } from "mongodb";
import { getDb, withDbRetry } from "./db";
import {
  cleanTitle,
  countWords,
  docToText,
  isEmptyPage,
  normalizeDoc,
  previewOf,
  type JNode,
  type JournalEntry,
  type JournalMemories,
  type JournalStats,
  type JournalSummary,
  type Mood,
} from "./journal-shared";

/**
 * Journal pages, one per person per day.
 *
 * The day is the key — not an id — because that is how a diary is addressed.
 * A unique index on (user, date) makes "one page per day" true under
 * concurrency: two devices opening a blank today at once cannot both create it.
 *
 * Every page carries a version. A save states the version it began from, and
 * a save that began from an older one is refused with the current page instead
 * of written over it. A laptop tab left open since breakfast must not quietly
 * erase what was written on a phone at lunch.
 */

export type JournalRecord = {
  _id: ObjectId;
  userId: ObjectId;
  date: string;
  title: string;
  doc: JNode;
  /** Plain text of the page, kept for search. */
  text: string;
  preview: string;
  mood: Mood | null;
  words: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export async function journalCollection() {
  const db = await getDb();
  return db.collection<JournalRecord>("journal_entries");
}

let indexReady: Promise<unknown> | null = null;
export async function ensureJournalIndexes(): Promise<void> {
  const pages = await journalCollection();
  indexReady ??= pages
    .createIndex({ userId: 1, date: 1 }, { unique: true, name: "journal_user_date_unique" })
    .catch((err: unknown) => {
      indexReady = null;
      throw err;
    });
  await indexReady;
}

export function toEntry(r: WithId<JournalRecord>): JournalEntry {
  return {
    date: r.date,
    title: r.title ?? "",
    doc: r.doc,
    mood: r.mood ?? null,
    words: r.words ?? 0,
    version: r.version ?? 1,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function toSummary(r: Pick<JournalRecord, "date" | "title" | "mood" | "words" | "preview" | "updatedAt">): JournalSummary {
  return {
    date: r.date,
    title: r.title ?? "",
    mood: r.mood ?? null,
    words: r.words ?? 0,
    preview: r.preview ?? "",
    updatedAt: r.updatedAt.toISOString(),
  };
}

const SUMMARY_FIELDS = { date: 1, title: 1, mood: 1, words: 1, preview: 1, updatedAt: 1 } as const;

export async function getEntry(userId: ObjectId, date: string): Promise<JournalEntry | null> {
  return withDbRetry(async () => {
    const pages = await journalCollection();
    const r = await pages.findOne({ userId, date });
    return r ? toEntry(r) : null;
  });
}

export async function listSummaries(userId: ObjectId, from: string, to: string): Promise<JournalSummary[]> {
  return withDbRetry(async () => {
    const pages = await journalCollection();
    const docs = await pages
      .find({ userId, date: { $gte: from, $lte: to } }, { projection: SUMMARY_FIELDS })
      .sort({ date: -1 })
      .limit(1000)
      .toArray();
    return docs.map(toSummary);
  });
}

export type SaveResult =
  | { ok: true; entry: JournalEntry | null }
  /** `current` is null when the page was deleted elsewhere while you wrote. */
  | { ok: false; reason: "conflict"; current: JournalEntry | null }
  /** A save with nothing in it, aimed at a page that has something. Erasing takes a DELETE. */
  | { ok: false; reason: "empty" };

/**
 * Writes a page, or refuses because it changed since the writer last saw it.
 *
 * A save can never erase a page. An empty save for a day with nothing stored
 * simply creates nothing, so opening a day and backing out leaves no mark on
 * the calendar; but an empty save aimed at a page that holds words is refused.
 * A person emptying a page makes the editor send an explicit DELETE. A save
 * that arrives blank is what a bug looks like, and a diary must not be one bug
 * away from losing a day.
 */
export async function saveEntry(
  userId: ObjectId,
  date: string,
  input: { title: unknown; doc: unknown; mood: Mood | null },
  baseVersion: number
): Promise<SaveResult> {
  const doc = normalizeDoc(input.doc);
  const title = cleanTitle(input.title);
  const text = docToText(doc);
  const empty = isEmptyPage(text, title, input.mood);
  const now = new Date();

  await ensureJournalIndexes();
  const pages = await journalCollection();
  const existing = await pages.findOne({ userId, date });

  if (existing) {
    if (existing.version !== baseVersion) return { ok: false, reason: "conflict", current: toEntry(existing) };
    if (empty) return { ok: false, reason: "empty" };

    const updated = await pages.findOneAndUpdate(
      // the version in the filter is what makes this atomic: a save that
      // lands between our read and this write finds nothing to update
      { _id: existing._id, version: baseVersion },
      {
        $set: {
          title,
          doc,
          text,
          preview: previewOf(text),
          mood: input.mood,
          words: countWords(text),
          updatedAt: now,
        },
        $inc: { version: 1 },
      },
      { returnDocument: "after" }
    );
    if (updated) return { ok: true, entry: toEntry(updated) };
    const raced = await pages.findOne({ userId, date });
    return { ok: false, reason: "conflict", current: raced ? toEntry(raced) : null };
  }

  // Nothing stored. A writer who believed a page existed has had it deleted
  // out from under them; that is a conflict to show, not a page to recreate.
  if (baseVersion !== 0) return { ok: false, reason: "conflict", current: null };
  if (empty) return { ok: true, entry: null };

  const record: JournalRecord = {
    _id: new ObjectId(),
    userId,
    date,
    title,
    doc,
    text,
    preview: previewOf(text),
    mood: input.mood,
    words: countWords(text),
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await pages.insertOne(record);
    return { ok: true, entry: toEntry(record) };
  } catch (err) {
    // two devices creating today's page in the same instant: one wins, the
    // other is shown what the winner wrote
    if (err instanceof MongoServerError && err.code === 11000) {
      const winner = await pages.findOne({ userId, date });
      return { ok: false, reason: "conflict", current: winner ? toEntry(winner) : null };
    }
    throw err;
  }
}

export async function deleteEntry(
  userId: ObjectId,
  date: string,
  baseVersion: number | null
): Promise<{ ok: true } | { ok: false; current: JournalEntry | null }> {
  const pages = await journalCollection();
  const filter = baseVersion === null ? { userId, date } : { userId, date, version: baseVersion };
  const result = await pages.deleteOne(filter);
  if (result.deletedCount === 1 || baseVersion === null) return { ok: true };
  const current = await pages.findOne({ userId, date });
  return current ? { ok: false, current: toEntry(current) } : { ok: true };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type SearchHit = JournalSummary & { snippet: string };

/**
 * Plain case-insensitive matching over a person's own pages.
 *
 * A text index would rank better, but it stems — "running" finds "run" — and
 * someone searching their diary for a name or a word they used is looking for
 * that exact word. One person's journal is small enough that a scan is fast.
 */
export async function searchEntries(userId: ObjectId, query: string, limit = 50): Promise<SearchHit[]> {
  const q = query.trim().slice(0, 100);
  if (!q) return [];
  const re = new RegExp(escapeRegExp(q), "i");
  return withDbRetry(async () => {
    const pages = await journalCollection();
    const docs = await pages
      .find({ userId, $or: [{ text: re }, { title: re }] }, { projection: { ...SUMMARY_FIELDS, text: 1 } })
      .sort({ date: -1 })
      .limit(limit)
      .toArray();
    return docs.map((d) => {
      const flat = (d.text ?? "").replace(/\s+/g, " ");
      const at = flat.search(re);
      let snippet: string;
      if (at < 0) {
        snippet = previewOf(flat, 160);
      } else {
        const start = Math.max(0, at - 60);
        const end = Math.min(flat.length, at + q.length + 90);
        snippet = `${start > 0 ? "…" : ""}${flat.slice(start, end).trim()}${end < flat.length ? "…" : ""}`;
      }
      return { ...toSummary(d), snippet };
    });
  });
}

function shiftDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** The same day last month, clamped: 31 March looks back to 28 February. */
function lastMonth(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  const days = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  return `${py}-${String(pm).padStart(2, "0")}-${String(Math.min(d, days)).padStart(2, "0")}`;
}

/**
 * Pages worth being reminded of today — a week ago, a month ago, and this day
 * in earlier years. Only pages that exist come back; an empty day a year ago is
 * not a memory, and saying so would be the gap-shaming the Log refuses to do.
 */
export async function memoriesFor(userId: ObjectId, today: string): Promise<JournalMemories> {
  return withDbRetry(async () => {
    const pages = await journalCollection();
    const monthDay = today.slice(4); // "-09-11"
    const [near, years] = await Promise.all([
      pages
        .find({ userId, date: { $in: [shiftDays(today, -7), lastMonth(today)] } }, { projection: SUMMARY_FIELDS })
        .toArray(),
      pages
        .find(
          { userId, date: { $lt: today, $regex: `^\\d{4}${escapeRegExp(monthDay)}$` } },
          { projection: SUMMARY_FIELDS }
        )
        .sort({ date: -1 })
        .limit(10)
        .toArray(),
    ]);
    const byDate = new Map(near.map((d) => [d.date, toSummary(d)]));
    return {
      weekAgo: byDate.get(shiftDays(today, -7)) ?? null,
      monthAgo: byDate.get(lastMonth(today)) ?? null,
      yearsAgo: years.map(toSummary),
    };
  });
}

/**
 * Totals that describe a journal without judging it: how many pages, how many
 * words this year. Deliberately no streak and no "days missed" — those count
 * absences, and a diary is not a chore chart.
 */
export async function journalStats(userId: ObjectId, today: string): Promise<JournalStats> {
  return withDbRetry(async () => {
    const pages = await journalCollection();
    const yearStart = `${today.slice(0, 4)}-01-01`;
    const [entries, words, first] = await Promise.all([
      pages.countDocuments({ userId }),
      pages
        .aggregate<{ total: number }>([
          { $match: { userId, date: { $gte: yearStart, $lte: today } } },
          { $group: { _id: null, total: { $sum: "$words" } } },
        ])
        .toArray(),
      pages.find({ userId }, { projection: { date: 1 } }).sort({ date: 1 }).limit(1).toArray(),
    ]);
    return { entries, wordsThisYear: words[0]?.total ?? 0, firstDate: first[0]?.date ?? null };
  });
}

/** Every page, oldest first, for the export. */
export async function allEntries(userId: ObjectId): Promise<JournalEntry[]> {
  return withDbRetry(async () => {
    const pages = await journalCollection();
    const docs = await pages.find({ userId }).sort({ date: 1 }).limit(20_000).toArray();
    return docs.map(toEntry);
  });
}
