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
};

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
