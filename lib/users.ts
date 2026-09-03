import { ObjectId } from "mongodb";
import { getDb, withDbRetry } from "./db";
import type { GoogleProfile } from "./google";
import { TRIAL_DAYS } from "./access";
import { sendEmail } from "./email";
import { welcomeEmail } from "./email-templates";

export type DbUser = {
  _id: ObjectId;
  /** Absent on accounts created by an invite that Google has never claimed. */
  googleId?: string;
  email: string;
  name: string;
  picture?: string;
  createdAt: Date;
  lastLoginAt: Date;
  /** App-wide PIN lock (hash + salt live server-side only). */
  appLockHash?: string;
  appLockSalt?: string;
  /** "animal-N" when they chose a house animal over the Google photo. */
  avatarChoice?: string;
  /** Blocked by an admin. Nothing is deleted; sign-in is refused. */
  disabled?: boolean;
  disabledAt?: Date;
  disabledReason?: string;
  /**
   * Created by a share to an address that had no account, and not signed in
   * yet. Cleared on first real sign-in (magic link or Google), which is also
   * when the trial clock starts — an invite sitting unread in an inbox for a
   * week must not burn the free days.
   */
  pending?: boolean;
  invitedAt?: Date;
  invitedBy?: ObjectId;
};

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  picture?: string;
  createdAt: string;
  lastLoginAt: string;
  appLocked: boolean;
  /** Billing, flattened for the admin table. */
  comped: boolean;
  compedNote: string;
  subStatus: string | null;
  currentPeriodEnd: number | null;
  /** Which plan the current paid period bought, if any. */
  planKey: string;
  /** Switched off by an admin. */
  disabled: boolean;
  /** Tasks this user owns, and how many are done. Shared lists are counted
   *  against the owner only, so the totals never double-count. */
  tasks: number;
  tasksDone: number;
  lists: number;
};

export type AdminUsersSnapshot = {
  users: AdminUserRow[];
  activeWeek: number;
  newWeek: number;
  totalTasks: number;
  totalTasksDone: number;
  totalLists: number;
  /** When the snapshot was taken — the page derives "3d ago" from this, so it
   *  never has to call Date.now() during render. */
  now: number;
};

type AdminUserDoc = Omit<DbUser, "appLockHash" | "appLockSalt"> & {
  appLocked: boolean;
  comped?: boolean;
  compedNote?: string;
  subStatus?: string | null;
  currentPeriodEnd?: number | null;
  planKey?: string;
  tasks: number;
  tasksDone: number;
  lists: number;
};

/**
 * Every user, newest signup first — for the admin dashboard only.
 *
 * The PIN hash and salt are reduced to a boolean inside the aggregation, so
 * that secret material is never sent over the wire or held in this process.
 */
export async function listAllUsers(limit = 500): Promise<AdminUserRow[]> {
  return withDbRetry(async () => {
    const db = await getDb();
    const docs = await db
      .collection<DbUser>("users")
      .aggregate<AdminUserDoc>([
        { $sort: { createdAt: -1 } },
        { $limit: limit },
        // counts come back with the rows rather than as N+1 follow-up queries
        {
          $lookup: {
            from: "tasks",
            localField: "_id",
            foreignField: "userId",
            as: "taskStats",
            pipeline: [
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  done: { $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] } },
                },
              },
            ],
          },
        },
        {
          $lookup: {
            from: "lists",
            localField: "_id",
            foreignField: "userId",
            as: "listStats",
            pipeline: [{ $count: "total" }],
          },
        },
        {
          $project: {
            email: 1,
            name: 1,
            picture: 1,
            createdAt: 1,
            lastLoginAt: 1,
            appLocked: { $toBool: { $ifNull: ["$appLockHash", false] } },
            comped: { $toBool: { $ifNull: ["$billing.comped", false] } },
            compedNote: { $ifNull: ["$billing.compedNote", ""] },
            subStatus: { $ifNull: ["$billing.status", null] },
            currentPeriodEnd: { $ifNull: ["$billing.currentPeriodEnd", null] },
            planKey: { $ifNull: ["$billing.planKey", ""] },
            disabled: { $toBool: { $ifNull: ["$disabled", false] } },
            tasks: { $ifNull: [{ $first: "$taskStats.total" }, 0] },
            tasksDone: { $ifNull: [{ $first: "$taskStats.done" }, 0] },
            lists: { $ifNull: [{ $first: "$listStats.total" }, 0] },
          },
        },
      ])
      .toArray();

    return docs.map((u) => ({
      id: u._id.toHexString(),
      name: u.name,
      email: u.email,
      picture: u.picture,
      createdAt: (u.createdAt ?? new Date(0)).toISOString(),
      lastLoginAt: (u.lastLoginAt ?? u.createdAt ?? new Date(0)).toISOString(),
      appLocked: u.appLocked,
      comped: Boolean(u.comped),
      compedNote: u.compedNote ?? "",
      subStatus: u.subStatus ?? null,
      currentPeriodEnd: u.currentPeriodEnd ?? null,
      planKey: u.planKey ?? "",
      disabled: Boolean(u.disabled),
      tasks: u.tasks,
      tasksDone: u.tasksDone,
      lists: u.lists,
    }));
  });
}

/** The whole admin user view in one call, including its own "now". */
export async function loadAdminUsers(limit = 500): Promise<AdminUsersSnapshot> {
  const users = await listAllUsers(limit);
  const now = Date.now();
  const week = 7 * 86_400_000;
  return {
    users,
    activeWeek: users.filter((u) => now - Date.parse(u.lastLoginAt) < week).length,
    newWeek: users.filter((u) => now - Date.parse(u.createdAt) < week).length,
    totalTasks: users.reduce((n, u) => n + u.tasks, 0),
    totalTasksDone: users.reduce((n, u) => n + u.tasksDone, 0),
    totalLists: users.reduce((n, u) => n + u.lists, 0),
    now,
  };
}

export async function getUserById(idHex: string): Promise<DbUser | null> {
  return withDbRetry(async () => {
    const db = await getDb();
    return db.collection<DbUser>("users").findOne({ _id: new ObjectId(idHex) });
  });
}

/**
 * The disabled flag runs on every authenticated API call, so it is the one
 * per-user read worth caching. Sixty seconds per user: deactivating via the
 * admin takes effect instantly on the instance that did it (write-through
 * below) and within a minute everywhere else — against removing one query
 * from every single request the app serves.
 *
 * On globalThis for the same reason as the Mongo client: Next bundles lib/
 * per route, and a module-scope map would fragment into per-route copies.
 */
const DISABLED_TTL_MS = 60_000;
const DISABLED_MAX_ENTRIES = 1_000;

declare global {
  var _kairoDisabledCache: Map<string, { at: number; disabled: boolean }> | undefined;
}

function disabledCache(): Map<string, { at: number; disabled: boolean }> {
  global._kairoDisabledCache ??= new Map();
  return global._kairoDisabledCache;
}

/**
 * Whether an admin has switched this account off.
 *
 * A projected query rather than a full `getUserById`, and cached, because it
 * runs on every authenticated API call: a session cookie stays valid for
 * weeks, so checking only at sign-in would leave a deactivated account
 * working until its cookie happened to expire.
 *
 * If the database is unreachable and nothing is cached, this fails OPEN.
 * Deactivation is an administrative control, not a security boundary — the
 * paywall and feature gates do their own reads — and an Atlas blip must not
 * sign every user out of the app.
 */
export async function isUserDisabled(idHex: string): Promise<boolean> {
  const cache = disabledCache();
  const hit = cache.get(idHex);
  const useCache = process.env.KAIRO_CACHE_OFF !== "1";

  if (useCache && hit && Date.now() - hit.at < DISABLED_TTL_MS) return hit.disabled;

  try {
    const disabled = await withDbRetry(async () => {
      const db = await getDb();
      const doc = await db
        .collection("users")
        .findOne({ _id: new ObjectId(idHex) }, { projection: { disabled: 1 } });
      // A missing user is treated as disabled — a cookie for a deleted account
      // should not keep working either.
      return !doc || doc.disabled === true;
    });
    // crude bound; at this scale the map never gets near it
    if (cache.size >= DISABLED_MAX_ENTRIES) cache.clear();
    cache.set(idHex, { at: Date.now(), disabled });
    return disabled;
  } catch (err) {
    if (hit) return hit.disabled; // stale beats a lie in either direction
    console.error("[users] disabled check failed with no cache, failing open", err);
    return false;
  }
}

/** Switches an account off (or back on). Nothing is deleted either way. */
export async function setUserDisabled(
  idHex: string,
  disabled: boolean,
  reason = ""
): Promise<void> {
  await withDbRetry(async () => {
    const db = await getDb();
    await db.collection("users").updateOne(
      { _id: new ObjectId(idHex) },
      disabled
        ? { $set: { disabled: true, disabledAt: new Date(), disabledReason: reason.slice(0, 200) } }
        : { $unset: { disabled: "", disabledAt: "", disabledReason: "" } }
    );
    // write-through: the admin's own instance must see the change immediately
    disabledCache().set(idHex, { at: Date.now(), disabled });
  });
}

/** What a deletion actually removed, so the admin is told rather than trusted. */
export type DeletionReport = {
  email: string;
  tasks: number;
  lists: number;
  sharedListsLeft: number;
  sharedTasksLeft: number;
  pushSubscriptions: number;
  magicLinks: number;
  /** Connection keys, so an assistant cannot outlive the account it acted for. */
  apiKeys: number;
  /** Kept on purpose: money records outlive the account that made them. */
  paymentsKept: number;
};

/**
 * Erases an account and everything personal it owns.
 *
 * What goes: the user record, every task and list they own, their push
 * subscriptions and scheduled notifications, their unused sign-in links, every
 * connection key an AI assistant was holding, and their membership of other
 * people's shared lists and tasks — a stale id in someone else's memberIds
 * renders as a ghost collaborator.
 *
 * What stays: payments, orders and tips. Those are money that changed hands,
 * and tax rules outlive the account (our privacy policy says exactly this).
 * Promo redemptions stay too, so deleting an account can't recycle a
 * once-per-person code.
 *
 * There is no undo. Deactivation is the reversible door.
 */
export async function deleteUserCompletely(idHex: string): Promise<DeletionReport | null> {
  return withDbRetry(async () => {
    const db = await getDb();
    const _id = new ObjectId(idHex);

    const user = await db.collection("users").findOne({ _id });
    if (!user) return null;

    const [tasks, lists, pushSubs, magic, apiKeys, sharedLists, sharedTasks, paymentsKept] =
      await Promise.all([
        db.collection("tasks").deleteMany({ userId: _id }),
        db.collection("lists").deleteMany({ userId: _id }),
        db.collection("push_subscriptions").deleteMany({ userId: _id }),
        db.collection("magic_links").deleteMany({ email: user.email }),
        // deleted outright rather than revoked: there is no account left for a
        // revoked key to be a record of
        db.collection("api_keys").deleteMany({ userId: _id }),
        // membership of other people's lists, and the tasks shared with them
        db.collection("lists").updateMany({ memberIds: _id }, { $pull: { memberIds: _id } as never }),
        db.collection("tasks").updateMany({ memberIds: _id }, { $pull: { memberIds: _id } as never }),
        db.collection("payments").countDocuments({ userId: _id }),
      ]);

    // work assigned to someone who no longer exists belongs to nobody
    await db.collection("tasks").updateMany({ assigneeId: _id }, { $set: { assigneeId: null } });
    await db.collection("scheduled_pushes").deleteMany({ userId: _id });
    await db.collection("users").deleteOne({ _id });

    // the disabled-check cache would otherwise answer for a ghost
    disabledCache().delete(idHex);

    return {
      email: String(user.email ?? ""),
      tasks: tasks.deletedCount,
      lists: lists.deletedCount,
      sharedListsLeft: sharedLists.modifiedCount,
      sharedTasksLeft: sharedTasks.modifiedCount,
      pushSubscriptions: pushSubs.deletedCount,
      magicLinks: magic.deletedCount,
      apiKeys: apiKeys.deletedCount,
      paymentsKept,
    };
  });
}

export async function upsertGoogleUser(profile: GoogleProfile): Promise<DbUser> {
  return withDbRetry(() => upsertGoogleUserOnce(profile));
}

/**
 * First real arrival of an invited account: the trial clock starts now, the
 * pending flag comes off, and the welcome goes out. The `pending: true` filter
 * makes this once-only even if two sign-ins race — createdAt can never be
 * reset twice, so signing in again is not a way to a fresh trial.
 */
export async function activatePendingUser(user: DbUser): Promise<DbUser> {
  const db = await getDb();
  const now = new Date();
  const activated = await db
    .collection<DbUser>("users")
    .findOneAndUpdate(
      { _id: user._id, pending: true },
      { $set: { createdAt: now, lastLoginAt: now }, $unset: { pending: "" } },
      { returnDocument: "after" }
    );
  if (activated) sendWelcome(activated);
  return activated ?? user;
}

/** Fire-and-forget, keyed once-per-account for life. */
function sendWelcome(user: DbUser): void {
  void (async () => {
    const mail = welcomeEmail({ name: user.name, trialDays: TRIAL_DAYS });
    await sendEmail({ key: `welcome:${user._id.toHexString()}`, to: user.email, ...mail });
  })().catch((err) => console.error("[email] welcome failed", err));
}

/**
 * Every account-by-email lookup in the identity model — invites, magic
 * links, the Google claim — assumes one account per address. The unique
 * index is what makes that true under concurrency rather than by luck.
 */
let emailIndexReady: Promise<unknown> | null = null;
export function ensureUserEmailIndex(db: Awaited<ReturnType<typeof getDb>>): Promise<unknown> {
  emailIndexReady ??= db
    .collection("users")
    .createIndex({ email: 1 }, { unique: true, name: "user_email_unique" })
    .catch((err: unknown) => {
      emailIndexReady = null;
      throw err;
    });
  return emailIndexReady;
}

async function upsertGoogleUserOnce(profile: GoogleProfile): Promise<DbUser> {
  const db = await getDb();
  const users = db.collection<DbUser>("users");
  const now = new Date();
  try {
    await ensureUserEmailIndex(db);
  } catch (err) {
    console.error("[users] could not create the email unique index", err);
  }

  // The usual case: this Google account has signed in before.
  const known = await users.findOneAndUpdate(
    { googleId: profile.sub },
    {
      $set: {
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
        lastLoginAt: now,
      },
    },
    { returnDocument: "after" }
  );
  if (known) return known;

  // An account under this address that Google has never claimed — one created
  // by an invite. Link it rather than insert a duplicate: the shares it
  // already holds are the whole point, and from here on both the magic link
  // and Google land in the same place.
  const claimed = await users.findOneAndUpdate(
    { email: profile.email, googleId: { $exists: false } },
    {
      $set: {
        googleId: profile.sub,
        name: profile.name,
        picture: profile.picture,
        lastLoginAt: now,
      },
    },
    { returnDocument: "after" }
  );
  if (claimed) {
    return claimed.pending ? activatePendingUser(claimed) : claimed;
  }

  // First sign-in ever. Upsert on googleId so two racing first requests write
  // one account; on insert, createdAt is the exact `now` this call wrote —
  // that is what marks the welcome, a side effect and never a dependency.
  const result = await users.findOneAndUpdate(
    { googleId: profile.sub },
    {
      $set: {
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
        lastLoginAt: now,
      },
      $setOnInsert: {
        googleId: profile.sub,
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: "after" }
  );
  if (!result) throw new Error("Failed to upsert user");

  if (result.createdAt?.getTime?.() === now.getTime()) sendWelcome(result);

  return result;
}
