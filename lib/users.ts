import { ObjectId } from "mongodb";
import { getDb, withDbRetry } from "./db";
import type { GoogleProfile } from "./google";

export type DbUser = {
  _id: ObjectId;
  googleId: string;
  email: string;
  name: string;
  picture?: string;
  createdAt: Date;
  lastLoginAt: Date;
  /** App-wide PIN lock (hash + salt live server-side only). */
  appLockHash?: string;
  appLockSalt?: string;
  /** Blocked by an admin. Nothing is deleted; sign-in is refused. */
  disabled?: boolean;
  disabledAt?: Date;
  disabledReason?: string;
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
 * Whether an admin has switched this account off.
 *
 * Its own projected query rather than a full `getUserById`, because it runs on
 * every authenticated API call: a session cookie stays valid for weeks, so
 * checking only at sign-in would leave a deactivated account working until its
 * cookie happened to expire.
 */
export async function isUserDisabled(idHex: string): Promise<boolean> {
  return withDbRetry(async () => {
    const db = await getDb();
    const doc = await db
      .collection("users")
      .findOne({ _id: new ObjectId(idHex) }, { projection: { disabled: 1 } });
    // A missing user is treated as disabled — a cookie for a deleted account
    // should not keep working either.
    return !doc || doc.disabled === true;
  });
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
  });
}

export async function upsertGoogleUser(profile: GoogleProfile): Promise<DbUser> {
  return withDbRetry(() => upsertGoogleUserOnce(profile));
}

async function upsertGoogleUserOnce(profile: GoogleProfile): Promise<DbUser> {
  const db = await getDb();
  const users = db.collection<DbUser>("users");
  const now = new Date();

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
  return result;
}
