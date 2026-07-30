import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "todo";

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

/**
 * Set DB_TRACE=1 to log every command the driver sends. This is how the
 * cache work was measured — guesses about "how many reads does a page cost"
 * were wrong every time; the driver's own event stream is not.
 */
const TRACE = process.env.DB_TRACE === "1";
const TRACED = new Set(["find", "aggregate", "findAndModify", "update", "insert", "delete", "count"]);

function getClientPromise(): Promise<MongoClient> {
  if (!uri) throw new Error("MONGODB_URI is not set");
  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
      // modest pool — Atlas M0 caps total connections, and force-killed dev
      // processes leak theirs until they time out server-side
      maxPoolSize: 10,
      maxIdleTimeMS: 60_000,
      retryReads: true,
      retryWrites: true,
      monitorCommands: TRACE,
    });
    if (TRACE) {
      client.on("commandStarted", (e) => {
        if (TRACED.has(e.commandName)) {
          console.log(`[db] ${e.commandName} ${String(e.command[e.commandName])}`);
        }
      });
    }
    global._mongoClientPromise = client
      .connect()
      .catch((err) => {
        // never cache a failed connection — the next request must retry fresh
        global._mongoClientPromise = undefined;
        throw err;
      });
  }
  return global._mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(dbName);
}

/**
 * Runs a DB operation with retries for transient failures (network blips,
 * Atlas idle disconnects). Waits briefly between attempts.
 */
export async function withDbRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 300 * (i + 1)));
      }
    }
  }
  throw lastErr;
}
