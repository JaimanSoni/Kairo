import { randomBytes } from "node:crypto";
import { ObjectId, type AnyBulkWriteOperation, type WithId } from "mongodb";
import { getDb, withDbRetry } from "./db";
import { countWords, docToText, EMPTY_DOC, previewOf, type JNode } from "./doc-model";

/** Bumped when what goes into a page's search text changes (2: task chip titles left it). */
const TEXT_VERSION = 2;
import {
  cleanCover,
  cleanIcon,
  cleanNoteTitle,
  isNoteId,
  linksIn,
  MAX_DUPLICATE,
  MAX_NOTE_DEPTH,
  MAX_NOTES,
  NOTE_FONTS,
  normalizeNoteDoc,
  remapLinks,
  TRASH_DAYS,
  type NoteFont,
  type NoteMeta,
  type NoteMetaPatch,
  type NotePage,
  type NoteRef,
  type NoteSearchHit,
  type TrashItem,
} from "./notes-shared";

/**
 * Notes: pages in a tree, one tree per person.
 *
 * A page names its parent; order among siblings is a number that only means
 * something next to its neighbours, so moving a page rewrites one row, not the
 * whole shelf. The body carries a version like a journal page does — a save
 * states the version it began from and is refused if the page moved on — while
 * the title, icon and page settings are plain last-writer-wins fields, so
 * renaming a page in the sidebar never collides with typing on it.
 *
 * Deleting is two steps. A page goes to the trash with everything beneath it,
 * stays restorable for thirty days, and only then — or when someone empties the
 * trash — is it gone.
 */

export type NoteRecord = {
  /** Which rules built `text` (see TEXT_VERSION). */
  textV?: number;
  _id: ObjectId;
  userId: ObjectId;
  parentId: ObjectId | null;
  rank: number;
  title: string;
  icon: string | null;
  cover: string | null;
  doc: JNode;
  /** Plain text of the body, kept for search. */
  text: string;
  words: number;
  /** Pages this body links to, for "linked from". */
  links: ObjectId[];
  favorite: boolean;
  favoritedAt: Date | null;
  fullWidth: boolean;
  smallText: boolean;
  font: NoteFont;
  locked: boolean;
  /** Published to the web, and the address it lives at. */
  shared?: boolean;
  shareSlug?: string | null;
  sharedAt?: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  trashedAt: Date | null;
  /** True on the page someone deleted; false on the sub-pages that went with it. */
  trashRoot: boolean;
};

export async function notesCollection() {
  const db = await getDb();
  return db.collection<NoteRecord>("notes");
}

let indexReady: Promise<unknown> | null = null;
export async function ensureNoteIndexes(): Promise<void> {
  const notes = await notesCollection();
  indexReady ??= Promise.all([
    notes.createIndex({ userId: 1, parentId: 1, rank: 1 }, { name: "notes_tree" }),
    notes.createIndex({ userId: 1, trashedAt: 1 }, { name: "notes_trash" }),
    notes.createIndex({ userId: 1, links: 1 }, { name: "notes_links" }),
    notes.createIndex({ shareSlug: 1 }, { name: "notes_share", unique: true, partialFilterExpression: { shareSlug: { $type: "string" } } }),
  ]).catch((err: unknown) => {
    indexReady = null;
    throw err;
  });
  await indexReady;
}

const META_FIELDS = {
  parentId: 1,
  rank: 1,
  title: 1,
  icon: 1,
  cover: 1,
  favorite: 1,
  fullWidth: 1,
  smallText: 1,
  font: 1,
  locked: 1,
  shared: 1,
  shareSlug: 1,
  words: 1,
  createdAt: 1,
  updatedAt: 1,
} as const;

type MetaRecord = Pick<NoteRecord, "_id" | keyof typeof META_FIELDS>;

export function toMeta(r: MetaRecord): NoteMeta {
  return {
    id: r._id.toHexString(),
    parentId: r.parentId ? r.parentId.toHexString() : null,
    rank: r.rank ?? 0,
    title: r.title ?? "",
    icon: r.icon ?? null,
    cover: r.cover ?? null,
    favorite: Boolean(r.favorite),
    fullWidth: Boolean(r.fullWidth),
    smallText: Boolean(r.smallText),
    font: NOTE_FONTS.includes(r.font) ? r.font : "sans",
    locked: Boolean(r.locked),
    shared: Boolean(r.shared),
    shareSlug: typeof r.shareSlug === "string" ? r.shareSlug : null,
    words: r.words ?? 0,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export function toPage(r: WithId<NoteRecord>): NotePage {
  return {
    ...toMeta(r),
    doc: r.doc ?? EMPTY_DOC,
    version: r.version ?? 1,
    trashedAt: r.trashedAt ? r.trashedAt.toISOString() : null,
  };
}

const oid = (hex: string) => new ObjectId(hex);

/** The shape of someone's whole tree, trash included — ids and parents only. */
type Skeleton = { id: string; parentId: string | null; trashedAt: Date | null; rank: number };

async function skeleton(userId: ObjectId): Promise<Map<string, Skeleton>> {
  const notes = await notesCollection();
  const rows = await notes
    .find({ userId }, { projection: { parentId: 1, trashedAt: 1, rank: 1 } })
    .limit(MAX_NOTES + 500)
    .toArray();
  return new Map(
    rows.map((r) => [
      r._id.toHexString(),
      { id: r._id.toHexString(), parentId: r.parentId?.toHexString() ?? null, trashedAt: r.trashedAt ?? null, rank: r.rank },
    ])
  );
}

function childrenIndex(nodes: Map<string, Skeleton>): Map<string | null, Skeleton[]> {
  const index = new Map<string | null, Skeleton[]>();
  for (const n of nodes.values()) {
    const list = index.get(n.parentId) ?? [];
    list.push(n);
    index.set(n.parentId, list);
  }
  return index;
}

function descendants(id: string, index: Map<string | null, Skeleton[]>, keep: (n: Skeleton) => boolean = () => true): Skeleton[] {
  const out: Skeleton[] = [];
  const queue = [id];
  const seen = new Set<string>([id]);
  while (queue.length) {
    const next = queue.shift()!;
    for (const child of index.get(next) ?? []) {
      if (seen.has(child.id) || !keep(child)) continue;
      seen.add(child.id);
      out.push(child);
      queue.push(child.id);
    }
  }
  return out;
}

/** How many ancestors a page has. A broken chain (a parent that's gone) just ends the count. */
function depthOf(id: string | null, nodes: Map<string, Skeleton>): number {
  let depth = 0;
  let at = id ? nodes.get(id) : undefined;
  const seen = new Set<string>();
  while (at && !seen.has(at.id)) {
    seen.add(at.id);
    depth++;
    at = at.parentId ? nodes.get(at.parentId) : undefined;
  }
  return depth;
}

/** Levels beneath a page, counting the page itself as one. */
function heightOf(id: string, index: Map<string | null, Skeleton[]>): number {
  const kids = (index.get(id) ?? []).filter((k) => !k.trashedAt);
  return 1 + (kids.length ? Math.max(...kids.map((k) => heightOf(k.id, index))) : 0);
}

const GAP = 1024;

/**
 * A rank that sorts between two neighbours. When the gap has been halved so
 * often that doubles can't split it, the siblings are renumbered first — a
 * rare, whole-shelf write that keeps every later move a single-row one.
 */
async function rankBetween(
  userId: ObjectId,
  parentId: string | null,
  exclude: string | null,
  beforeId: string | null
): Promise<number> {
  const notes = await notesCollection();
  const load = () =>
    notes
      .find(
        { userId, parentId: parentId ? oid(parentId) : null, trashedAt: null },
        { projection: { rank: 1 } }
      )
      .sort({ rank: 1 })
      .toArray()
      .then((rows) => rows.filter((r) => r._id.toHexString() !== exclude));

  let siblings = await load();
  for (let attempt = 0; attempt < 2; attempt++) {
    const at = beforeId ? siblings.findIndex((s) => s._id.toHexString() === beforeId) : -1;
    if (at < 0) return siblings.length ? siblings[siblings.length - 1].rank + GAP : GAP;
    const after = siblings[at].rank;
    const before = at > 0 ? siblings[at - 1].rank : after - 2 * GAP;
    const mid = (before + after) / 2;
    if (mid > before && mid < after && after - before > 1e-6) return mid;

    const ops: AnyBulkWriteOperation<NoteRecord>[] = siblings.map((s, i) => ({
      updateOne: { filter: { _id: s._id }, update: { $set: { rank: (i + 1) * GAP } } },
    }));
    if (ops.length) await notes.bulkWrite(ops, { ordered: false });
    siblings = await load();
  }
  return siblings.length ? siblings[siblings.length - 1].rank + GAP : GAP;
}

export type Failure = { ok: false; status: 400 | 404 | 409 | 413 | 423; error: string };
const fail = (status: Failure["status"], error: string): Failure => ({ ok: false, status, error });

/* ---------------------------------------------------------------- reads */

/** Every live page, without bodies, in sibling order. */
export async function listTree(userId: ObjectId): Promise<NoteMeta[]> {
  return withDbRetry(async () => {
    const notes = await notesCollection();
    const rows = await notes
      .find({ userId, trashedAt: null }, { projection: META_FIELDS })
      .sort({ rank: 1 })
      .limit(MAX_NOTES)
      .toArray();
    return rows.map(toMeta);
  });
}

export async function getNote(
  userId: ObjectId,
  id: string
): Promise<{ page: NotePage; backlinks: NoteRef[] } | null> {
  if (!isNoteId(id)) return null;
  return withDbRetry(async () => {
    const notes = await notesCollection();
    const r = await notes.findOne({ _id: oid(id), userId });
    if (!r) return null;
    const linking = await notes
      .find({ userId, links: r._id, trashedAt: null, _id: { $ne: r._id } }, { projection: { title: 1, icon: 1 } })
      .sort({ updatedAt: -1 })
      .limit(50)
      .toArray();
    return {
      page: toPage(r),
      backlinks: linking.map((l) => ({ id: l._id.toHexString(), title: l.title ?? "", icon: l.icon ?? null })),
    };
  });
}

/* --------------------------------------------------------------- create */

export async function createNote(
  userId: ObjectId,
  input: { parentId?: unknown; afterId?: unknown; title?: unknown; icon?: unknown; cover?: unknown; doc?: unknown }
): Promise<{ ok: true; page: NotePage } | Failure> {
  await ensureNoteIndexes();
  const notes = await notesCollection();

  const parentId = input.parentId === null || input.parentId === undefined ? null : input.parentId;
  if (parentId !== null && !isNoteId(parentId)) return fail(400, "parentId must be a page id or null");
  const doc = input.doc === undefined ? EMPTY_DOC : normalizeNoteDoc(input.doc);

  if ((await notes.countDocuments({ userId })) >= MAX_NOTES) {
    return fail(413, `You have ${MAX_NOTES.toLocaleString("en-US")} pages, which is the most an account can hold. Empty the trash or delete a few first.`);
  }

  if (parentId) {
    const nodes = await skeleton(userId);
    const parent = nodes.get(parentId);
    if (!parent) return fail(404, "That parent page doesn't exist.");
    if (parent.trashedAt) return fail(409, "That parent page is in the trash.");
    if (depthOf(parentId, nodes) + 1 > MAX_NOTE_DEPTH) {
      return fail(400, `Pages can nest ${MAX_NOTE_DEPTH} levels deep, and that one is already at the bottom.`);
    }
  }

  // a new page after a sibling slots in right behind it; otherwise it goes last
  let beforeId: string | null = null;
  if (isNoteId(input.afterId)) {
    const siblings = await notes
      .find({ userId, parentId: parentId ? oid(parentId) : null, trashedAt: null }, { projection: { rank: 1 } })
      .sort({ rank: 1 })
      .toArray();
    const at = siblings.findIndex((s) => s._id.toHexString() === input.afterId);
    if (at >= 0 && at + 1 < siblings.length) beforeId = siblings[at + 1]._id.toHexString();
  }
  const rank = await rankBetween(userId, parentId, null, beforeId);

  const text = docToText(doc);
  const now = new Date();
  const record: NoteRecord = {
    _id: new ObjectId(),
    userId,
    parentId: parentId ? oid(parentId) : null,
    rank,
    title: cleanNoteTitle(input.title),
    icon: cleanIcon(input.icon),
    cover: cleanCover(input.cover),
    doc,
    text,
    textV: TEXT_VERSION,
    words: countWords(text),
    links: linksIn(doc).map(oid),
    favorite: false,
    favoritedAt: null,
    fullWidth: false,
    smallText: false,
    font: "sans",
    locked: false,
    version: 1,
    createdAt: now,
    updatedAt: now,
    trashedAt: null,
    trashRoot: false,
  };
  await notes.insertOne(record);
  return { ok: true, page: toPage(record) };
}

/* ----------------------------------------------------------------- body */

export type SaveNoteResult =
  | { ok: true; page: NoteMeta & { version: number } }
  | { ok: false; reason: "conflict"; current: NotePage | null }
  | { ok: false; reason: "missing" | "trashed" | "locked" | "empty" };

/**
 * Saves a page's body, or refuses because it changed since the writer saw it.
 *
 * Emptying a page is allowed — a page can be a blank page — but only when the
 * writer says so. A body that arrives blank over one that holds words, without
 * that flag, is what a bug looks like, and is refused.
 */
export async function saveNoteDoc(
  userId: ObjectId,
  id: string,
  input: unknown,
  baseVersion: number,
  allowEmpty: boolean
): Promise<SaveNoteResult> {
  if (!isNoteId(id)) return { ok: false, reason: "missing" };
  const doc = normalizeNoteDoc(input);
  const text = docToText(doc);
  const notes = await notesCollection();
  const existing = await notes.findOne({ _id: oid(id), userId });

  if (!existing) return { ok: false, reason: "missing" };
  if (existing.trashedAt) return { ok: false, reason: "trashed" };
  if (existing.version !== baseVersion) return { ok: false, reason: "conflict", current: toPage(existing) };
  if (existing.locked) return { ok: false, reason: "locked" };
  if (!text.trim() && (existing.text ?? "").trim() && !allowEmpty) return { ok: false, reason: "empty" };

  const updated = await notes.findOneAndUpdate(
    // the version in the filter is what makes this atomic
    { _id: existing._id, version: baseVersion },
    {
      $set: {
        doc,
        text,
        textV: TEXT_VERSION,
        words: countWords(text),
        links: linksIn(doc)
          .filter((l) => l !== id)
          .map(oid),
        updatedAt: new Date(),
      },
      $inc: { version: 1 },
    },
    { returnDocument: "after" }
  );
  if (updated) return { ok: true, page: { ...toMeta(updated), version: updated.version } };
  const raced = await notes.findOne({ _id: existing._id });
  return { ok: false, reason: "conflict", current: raced ? toPage(raced) : null };
}

/* ----------------------------------------------------------------- meta */

export async function updateNoteMeta(
  userId: ObjectId,
  id: string,
  patch: NoteMetaPatch
): Promise<{ ok: true; page: NoteMeta } | Failure> {
  if (!isNoteId(id)) return fail(404, "No such page.");
  const notes = await notesCollection();
  const existing = await notes.findOne({ _id: oid(id), userId }, { projection: { trashedAt: 1, locked: 1 } });
  if (!existing) return fail(404, "No such page.");
  if (existing.trashedAt) return fail(409, "That page is in the trash. Restore it first.");

  const touchesContent =
    patch.title !== undefined || patch.icon !== undefined || patch.cover !== undefined;
  const touchesLayout =
    patch.fullWidth !== undefined || patch.smallText !== undefined || patch.font !== undefined;
  // a locked page keeps its words and its look until someone unlocks it
  if (existing.locked && patch.locked !== false && (touchesContent || touchesLayout)) {
    return fail(423, "That page is locked. Unlock it to change it.");
  }

  const set: Partial<NoteRecord> = {};
  if (patch.title !== undefined) set.title = cleanNoteTitle(patch.title);
  if (patch.icon !== undefined) set.icon = cleanIcon(patch.icon);
  if (patch.cover !== undefined) set.cover = cleanCover(patch.cover);
  if (patch.favorite !== undefined) {
    set.favorite = patch.favorite;
    set.favoritedAt = patch.favorite ? new Date() : null;
  }
  if (patch.fullWidth !== undefined) set.fullWidth = patch.fullWidth;
  if (patch.smallText !== undefined) set.smallText = patch.smallText;
  if (patch.font !== undefined) set.font = patch.font;
  if (patch.locked !== undefined) set.locked = patch.locked;
  // "recently edited" means the words changed, not that a star was ticked
  if (touchesContent) set.updatedAt = new Date();

  const updated = await notes.findOneAndUpdate(
    { _id: oid(id), userId },
    { $set: set },
    { returnDocument: "after", projection: META_FIELDS }
  );
  return updated ? { ok: true, page: toMeta(updated) } : fail(404, "No such page.");
}

/* ----------------------------------------------------------------- move */

export async function moveNote(
  userId: ObjectId,
  id: string,
  target: { parentId: unknown; beforeId?: unknown }
): Promise<{ ok: true; page: NoteMeta } | Failure> {
  if (!isNoteId(id)) return fail(404, "No such page.");
  const parentId = target.parentId === null || target.parentId === undefined ? null : target.parentId;
  if (parentId !== null && !isNoteId(parentId)) return fail(400, "parentId must be a page id or null");
  const beforeId = isNoteId(target.beforeId) ? target.beforeId : null;

  const nodes = await skeleton(userId);
  const page = nodes.get(id);
  if (!page) return fail(404, "No such page.");
  if (page.trashedAt) return fail(409, "That page is in the trash. Restore it first.");

  if (parentId) {
    const parent = nodes.get(parentId);
    if (!parent) return fail(404, "That page doesn't exist.");
    if (parent.trashedAt) return fail(409, "That page is in the trash.");
    // walking up from the new parent must never pass through the page itself
    let at: Skeleton | undefined = parent;
    const seen = new Set<string>();
    while (at && !seen.has(at.id)) {
      if (at.id === id) return fail(400, "A page can't move inside itself or one of its own sub-pages.");
      seen.add(at.id);
      at = at.parentId ? nodes.get(at.parentId) : undefined;
    }
    const index = childrenIndex(nodes);
    if (depthOf(parentId, nodes) + heightOf(id, index) > MAX_NOTE_DEPTH) {
      return fail(400, `Pages can nest ${MAX_NOTE_DEPTH} levels deep, and that move would go past it.`);
    }
  }
  if (beforeId) {
    const before = nodes.get(beforeId);
    if (!before || before.parentId !== parentId || before.trashedAt || beforeId === id) {
      return fail(400, "beforeId must be another page under the same parent");
    }
  }

  const rank = await rankBetween(userId, parentId, id, beforeId);
  const notes = await notesCollection();
  const updated = await notes.findOneAndUpdate(
    { _id: oid(id), userId, trashedAt: null },
    { $set: { parentId: parentId ? oid(parentId) : null, rank } },
    { returnDocument: "after", projection: META_FIELDS }
  );
  return updated ? { ok: true, page: toMeta(updated) } : fail(404, "No such page.");
}

/* ------------------------------------------------------------ duplicate */

/**
 * A copy of a page with everything beneath it, placed right after the
 * original. Links between pages inside the copy point at each other's copies;
 * links out of it still point where they did.
 */
export async function duplicateNote(
  userId: ObjectId,
  id: string
): Promise<{ ok: true; root: NotePage; pages: NoteMeta[] } | Failure> {
  if (!isNoteId(id)) return fail(404, "No such page.");
  const nodes = await skeleton(userId);
  const page = nodes.get(id);
  if (!page) return fail(404, "No such page.");
  if (page.trashedAt) return fail(409, "That page is in the trash. Restore it first.");

  const index = childrenIndex(nodes);
  const subtree = [page, ...descendants(id, index, (n) => !n.trashedAt)];
  if (subtree.length > MAX_DUPLICATE) {
    return fail(413, `That page holds ${subtree.length} pages. Duplicates are limited to ${MAX_DUPLICATE} at a time.`);
  }
  if (nodes.size + subtree.length > MAX_NOTES) {
    return fail(413, "Duplicating that would pass the most pages an account can hold.");
  }

  const notes = await notesCollection();
  const records = await notes.find({ userId, _id: { $in: subtree.map((n) => oid(n.id)) } }).toArray();
  const ids = new Map(subtree.map((n) => [n.id, new ObjectId().toHexString()]));

  const siblings = (index.get(page.parentId) ?? []).filter((s) => !s.trashedAt).sort((a, b) => a.rank - b.rank);
  const at = siblings.findIndex((s) => s.id === id);
  const next = at >= 0 && at + 1 < siblings.length ? siblings[at + 1].id : null;
  const rootRank = await rankBetween(userId, page.parentId, null, next);

  const now = new Date();
  const copies: NoteRecord[] = records.map((r) => {
    const old = r._id.toHexString();
    const isRoot = old === id;
    const doc = remapLinks(r.doc ?? EMPTY_DOC, ids);
    return {
      ...r,
      _id: oid(ids.get(old)!),
      parentId: isRoot ? r.parentId : r.parentId ? oid(ids.get(r.parentId.toHexString()) ?? r.parentId.toHexString()) : null,
      rank: isRoot ? rootRank : r.rank,
      title: isRoot ? cleanNoteTitle(`${r.title || "Untitled"} (copy)`) : r.title,
      doc,
      links: linksIn(doc).map(oid),
      favorite: false,
      favoritedAt: null,
      locked: false,
      version: 1,
      createdAt: now,
      updatedAt: now,
      trashedAt: null,
      trashRoot: false,
    };
  });
  if (copies.length) await notes.insertMany(copies);
  const root = copies.find((c) => c._id.toHexString() === ids.get(id))!;
  return { ok: true, root: toPage(root), pages: copies.map(toMeta) };
}

/* ---------------------------------------------------------------- trash */

export async function trashNote(userId: ObjectId, id: string): Promise<{ ok: true; ids: string[] } | Failure> {
  if (!isNoteId(id)) return fail(404, "No such page.");
  const nodes = await skeleton(userId);
  const page = nodes.get(id);
  if (!page) return fail(404, "No such page.");
  if (page.trashedAt) return { ok: true, ids: [] };

  const going = [id, ...descendants(id, childrenIndex(nodes), (n) => !n.trashedAt).map((n) => n.id)];
  const notes = await notesCollection();
  const now = new Date();
  await notes.updateMany(
    { userId, _id: { $in: going.map(oid) }, trashedAt: null },
    { $set: { trashedAt: now, trashRoot: false } }
  );
  await notes.updateOne({ _id: oid(id), userId }, { $set: { trashRoot: true } });
  return { ok: true, ids: going };
}

/**
 * Brings a page back with the sub-pages that went to the trash with it. A
 * sub-page deleted on its own, earlier, stays in the trash as its own entry.
 * If the page's old parent is gone or still in the trash, it comes back at the
 * top level rather than into a place nobody can see.
 */
export async function restoreNote(userId: ObjectId, id: string): Promise<{ ok: true; pages: NoteMeta[] } | Failure> {
  if (!isNoteId(id)) return fail(404, "No such page.");
  const nodes = await skeleton(userId);
  const page = nodes.get(id);
  if (!page) return fail(404, "No such page.");
  if (!page.trashedAt) return fail(409, "That page isn't in the trash.");

  const when = page.trashedAt.getTime();
  const group = [
    id,
    ...descendants(id, childrenIndex(nodes), (n) => n.trashedAt?.getTime() === when).map((n) => n.id),
  ];
  const parent = page.parentId ? nodes.get(page.parentId) : undefined;
  const homeless = !parent || Boolean(parent.trashedAt);

  const notes = await notesCollection();
  await notes.updateMany(
    { userId, _id: { $in: group.map(oid) } },
    { $set: { trashedAt: null, trashRoot: false } }
  );
  if (homeless && page.parentId !== null) {
    const rank = await rankBetween(userId, null, id, null);
    await notes.updateOne({ _id: oid(id), userId }, { $set: { parentId: null, rank } });
  }
  const rows = await notes.find({ userId, _id: { $in: group.map(oid) } }, { projection: META_FIELDS }).toArray();
  return { ok: true, pages: rows.map(toMeta) };
}

/** Gone for good: the page and everything beneath it, whatever state they're in. */
export async function deleteNoteForever(userId: ObjectId, id: string): Promise<{ ok: true; deleted: number } | Failure> {
  if (!isNoteId(id)) return fail(404, "No such page.");
  const nodes = await skeleton(userId);
  const page = nodes.get(id);
  if (!page) return fail(404, "No such page.");
  if (!page.trashedAt) return fail(409, "Move a page to the trash before deleting it for good.");

  const going = [id, ...descendants(id, childrenIndex(nodes)).map((n) => n.id)];
  const notes = await notesCollection();
  const result = await notes.deleteMany({ userId, _id: { $in: going.map(oid) } });
  return { ok: true, deleted: result.deletedCount };
}

export async function listTrash(userId: ObjectId): Promise<TrashItem[]> {
  return withDbRetry(async () => {
    const notes = await notesCollection();
    // the thirty days are enforced here, lazily: nothing needs a cron to forget
    const cutoff = new Date(Date.now() - TRASH_DAYS * 86_400_000);
    const expired = await notes
      .find({ userId, trashRoot: true, trashedAt: { $lt: cutoff } }, { projection: { _id: 1 } })
      .limit(50)
      .toArray();
    for (const e of expired) await deleteNoteForever(userId, e._id.toHexString());

    const nodes = await skeleton(userId);
    const index = childrenIndex(nodes);
    const roots = await notes
      .find({ userId, trashRoot: true, trashedAt: { $ne: null } }, { projection: { title: 1, icon: 1, trashedAt: 1, parentId: 1 } })
      .sort({ trashedAt: -1 })
      .limit(300)
      .toArray();
    const parentIds = roots.map((r) => r.parentId).filter((p): p is ObjectId => p !== null);
    const parents = parentIds.length
      ? await notes.find({ userId, _id: { $in: parentIds } }, { projection: { title: 1 } }).toArray()
      : [];
    const parentTitle = new Map(parents.map((p) => [p._id.toHexString(), p.title || "Untitled"]));
    return roots.map((r) => {
      const hex = r._id.toHexString();
      const when = r.trashedAt!.getTime();
      return {
        id: hex,
        title: r.title ?? "",
        icon: r.icon ?? null,
        trashedAt: r.trashedAt!.toISOString(),
        pages: 1 + descendants(hex, index, (n) => n.trashedAt?.getTime() === when).length,
        parentTitle: r.parentId ? parentTitle.get(r.parentId.toHexString()) ?? null : null,
      };
    });
  });
}

export async function emptyTrash(userId: ObjectId): Promise<number> {
  const notes = await notesCollection();
  const result = await notes.deleteMany({ userId, trashedAt: { $ne: null } });
  return result.deletedCount;
}

/* --------------------------------------------------------------- search */

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Plain case-insensitive matching over a person's own live pages, titles
 * first. Exact words, not stems: someone searching their notes for a name is
 * looking for that name.
 */
export async function searchNotes(userId: ObjectId, query: string, limit = 30): Promise<NoteSearchHit[]> {
  const q = query.trim().slice(0, 100);
  if (!q) return [];
  const re = new RegExp(escapeRegExp(q), "i");
  return withDbRetry(async () => {
    const notes = await notesCollection();
    const found = await notes
      .find(
        { userId, trashedAt: null, $or: [{ title: re }, { text: re }] },
        { projection: { title: 1, icon: 1, parentId: 1, text: 1, updatedAt: 1, textV: 1 } }
      )
      .sort({ updatedAt: -1 })
      .limit(200)
      .toArray();
    // Pages saved before chip titles left the search text still carry them.
    // Those are re-read from their bodies (once: the fresh text is written
    // back), so a locked task's title can't be found by searching for it.
    const rows = [];
    for (const r of found) {
      if (r.textV !== TEXT_VERSION && !re.test(r.title ?? "")) {
        const full = await notes.findOne({ _id: r._id, userId }, { projection: { doc: 1 } });
        const text = full ? docToText(full.doc) : "";
        await notes.updateOne({ _id: r._id, userId }, { $set: { text, textV: TEXT_VERSION } });
        if (!re.test(text)) continue;
        rows.push({ ...r, text });
      } else {
        rows.push(r);
      }
    }
    return rows
      .map((r) => {
        const flat = (r.text ?? "").replace(/\s+/g, " ");
        const at = flat.search(re);
        let snippet: string;
        if (at < 0) {
          snippet = previewOf(flat, 140);
        } else {
          const start = Math.max(0, at - 50);
          const end = Math.min(flat.length, at + q.length + 80);
          snippet = `${start > 0 ? "…" : ""}${flat.slice(start, end).trim()}${end < flat.length ? "…" : ""}`;
        }
        return {
          hit: {
            id: r._id.toHexString(),
            title: r.title ?? "",
            icon: r.icon ?? null,
            parentId: r.parentId?.toHexString() ?? null,
            snippet,
            updatedAt: r.updatedAt.toISOString(),
          },
          titled: re.test(r.title ?? ""),
        };
      })
      .sort((a, b) => Number(b.titled) - Number(a.titled))
      .slice(0, limit)
      .map((x) => x.hit);
  });
}

/* ------------------------------------------------------- locked chips */

function taskRefIds(node: JNode | undefined, out: Set<string>): void {
  if (!node) return;
  if (node.type === "taskRef" && typeof node.attrs?.id === "string" && ObjectId.isValid(node.attrs.id)) out.add(node.attrs.id);
  for (const child of node.content ?? []) taskRefIds(child, out);
}

function withHiddenChips(node: JNode, hidden: Set<string>): JNode {
  if (node.type === "taskRef" && typeof node.attrs?.id === "string" && hidden.has(node.attrs.id)) {
    return { ...node, attrs: { ...node.attrs, title: "Locked task" } };
  }
  return node.content ? { ...node, content: node.content.map((c) => withHiddenChips(c, hidden)) } : node;
}

/**
 * A task chip keeps a copy of its task's title. When that task now lives in a
 * list this viewer can't see into, the copy is replaced before the page leaves
 * the server — in the app, in exports and over MCP alike.
 */
export async function hideLockedChips<T extends { doc: JNode }>(pages: T[], lockedLists: ObjectId[]): Promise<T[]> {
  if (lockedLists.length === 0 || pages.length === 0) return pages;
  const ids = new Set<string>();
  for (const p of pages) taskRefIds(p.doc, ids);
  if (ids.size === 0) return pages;
  const { tasksCollection } = await import("./tasks");
  const rows = await (await tasksCollection())
    .find({ _id: { $in: [...ids].map((id) => new ObjectId(id)) }, listId: { $in: lockedLists } }, { projection: { _id: 1 } })
    .toArray();
  if (rows.length === 0) return pages;
  const hidden = new Set(rows.map((r) => r._id.toHexString()));
  return pages.map((p) => ({ ...p, doc: withHiddenChips(p.doc, hidden) }));
}

/* --------------------------------------------------------------- export */

/** Every live page with its path, parents before children, siblings in order. */
export async function allNotesInOrder(userId: ObjectId): Promise<{ page: NotePage; path: string[] }[]> {
  return withDbRetry(async () => {
    const notes = await notesCollection();
    const rows = await notes.find({ userId, trashedAt: null }).sort({ rank: 1 }).limit(MAX_NOTES).toArray();
    const byParent = new Map<string | null, WithId<NoteRecord>[]>();
    const ids = new Set(rows.map((r) => r._id.toHexString()));
    for (const r of rows) {
      // a page whose parent is gone is shown at the top rather than lost
      const key = r.parentId && ids.has(r.parentId.toHexString()) ? r.parentId.toHexString() : null;
      const list = byParent.get(key) ?? [];
      list.push(r);
      byParent.set(key, list);
    }
    const out: { page: NotePage; path: string[] }[] = [];
    const walk = (parent: string | null, path: string[], depth: number) => {
      if (depth > MAX_NOTE_DEPTH + 1) return;
      for (const r of byParent.get(parent) ?? []) {
        out.push({ page: toPage(r), path });
        walk(r._id.toHexString(), [...path, r.title || "Untitled"], depth + 1);
      }
    };
    walk(null, [], 0);
    return out;
  });
}

/* ------------------------------------------------------------ publishing */

/**
 * Publishing a page to the web.
 *
 * One page, read-only, at an address nobody can guess. The address is kept
 * once made, so unpublishing and publishing again returns the same link
 * rather than quietly breaking the one already sent. A locked page is never
 * published: the PIN is the whole point of it.
 */
export async function setNoteShared(userId: ObjectId, id: string, shared: boolean): Promise<{ ok: true; page: NoteMeta } | Failure> {
  if (!isNoteId(id)) return fail(404, "No such page.");
  await ensureNoteIndexes();
  const notes = await notesCollection();
  const existing = await notes.findOne({ _id: oid(id), userId }, { projection: { ...META_FIELDS, trashedAt: 1 } });
  if (!existing) return fail(404, "No such page.");
  if (existing.trashedAt) return fail(409, "That page is in the trash. Restore it first.");
  if (shared && existing.locked) return fail(423, "That page is locked. Unlock it before sharing it.");

  const slug = existing.shareSlug ?? randomBytes(9).toString("hex");
  await notes.updateOne({ _id: oid(id), userId }, { $set: { shared, shareSlug: slug, sharedAt: shared ? new Date() : null } });
  const fresh = await notes.findOne({ _id: oid(id), userId }, { projection: META_FIELDS });
  return fresh ? { ok: true, page: toMeta(fresh) } : fail(404, "No such page.");
}

export type PublicNote = {
  title: string;
  icon: string | null;
  cover: string | null;
  font: NoteFont;
  fullWidth: boolean;
  smallText: boolean;
  doc: JNode;
  words: number;
  updatedAt: string;
};

/** A published page, for anyone with the link. Nothing about who wrote it, and nothing else of theirs. */
export async function publicNote(slug: string): Promise<PublicNote | null> {
  if (typeof slug !== "string" || !/^[a-f0-9]{18}$/.test(slug)) return null;
  const notes = await notesCollection();
  const page = await notes.findOne({ shareSlug: slug, shared: true, trashedAt: null, locked: { $ne: true } });
  if (!page) return null;
  const owner = await (await getDb()).collection("users").findOne({ _id: page.userId }, { projection: { disabled: 1 } });
  if (!owner || owner.disabled) return null;
  return {
    title: page.title ?? "",
    icon: page.icon ?? null,
    cover: page.cover ?? null,
    font: NOTE_FONTS.includes(page.font) ? page.font : "sans",
    fullWidth: Boolean(page.fullWidth),
    smallText: Boolean(page.smallText),
    doc: page.doc ?? EMPTY_DOC,
    words: page.words ?? 0,
    updatedAt: page.updatedAt.toISOString(),
  };
}
