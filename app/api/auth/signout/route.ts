import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSession, removeAccountSession, destroySession } from "@/lib/session";
import { clearAllGrants } from "@/lib/lock-grants";
import { forgetPushDevice } from "@/lib/push";

/**
 * Signs the ACTIVE account out. If other accounts remain, switches to one.
 * Whatever that account had unlocked here is locked again, and this browser
 * stops receiving its notifications.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    await destroySession();
    return NextResponse.redirect(new URL("/", request.url), 303);
  }
  await clearAllGrants(session.userId);
  try {
    await forgetPushDevice(new ObjectId(session.userId));
  } catch (err) {
    console.error("[signout] couldn't forget this device's push subscription", err);
  }
  const remaining = await removeAccountSession(session.userId);
  return NextResponse.redirect(new URL(remaining > 0 ? "/today" : "/", request.url), 303);
}
