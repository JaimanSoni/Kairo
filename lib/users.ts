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
};

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  picture?: string;
  createdAt: string;
  lastLoginAt: string;
  appLocked: boolean;
};

export type AdminUsersSnapshot = {
  users: AdminUserRow[];
  activeWeek: number;
  newWeek: number;
  /** When the snapshot was taken — the page derives "3d ago" from this, so it
   *  never has to call Date.now() during render. */
  now: number;
};

type AdminUserDoc = Omit<DbUser, "appLockHash" | "appLockSalt"> & { appLocked: boolean };

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
        {
          $project: {
            googleId: 1,
            email: 1,
            name: 1,
            picture: 1,
            createdAt: 1,
            lastLoginAt: 1,
            appLocked: { $toBool: { $ifNull: ["$appLockHash", false] } },
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
    now,
  };
}

export async function getUserById(idHex: string): Promise<DbUser | null> {
  return withDbRetry(async () => {
    const db = await getDb();
    return db.collection<DbUser>("users").findOne({ _id: new ObjectId(idHex) });
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
