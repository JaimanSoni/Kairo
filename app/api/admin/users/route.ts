import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdminApi } from "@/lib/admin-api";
import { deleteUserCompletely, getUserById, setUserDisabled } from "@/lib/users";
import { isAdminEmail } from "@/lib/admin";
import { updateUserBilling } from "@/lib/billing";
import { getPlan } from "@/lib/plans";

/**
 * Per-account admin actions: switching an account off, and moving it to a
 * different plan by hand.
 *
 * Setting a plan does not take money or extend anything — it only changes what
 * the current paid period unlocks. Granting free access is what `comped` is for.
 */
export async function PATCH(request: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  let body: { userId?: unknown; disabled?: unknown; reason?: unknown; planKey?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "Valid userId required" }, { status: 400 });
  }
  // Locking yourself out of the admin would need a database client to undo.
  if (userId === gate.admin._id.toHexString() && body.disabled === true) {
    return NextResponse.json({ error: "You can't deactivate your own account" }, { status: 400 });
  }

  if (body.disabled !== undefined) {
    await setUserDisabled(
      userId,
      Boolean(body.disabled),
      typeof body.reason === "string" ? body.reason : ""
    );
  }

  if (typeof body.planKey === "string") {
    if (body.planKey === "") {
      await updateUserBilling(userId, { planKey: "" });
    } else {
      const plan = await getPlan(body.planKey, { fresh: true });
      if (!plan) return NextResponse.json({ error: "No such plan" }, { status: 400 });
      await updateUserBilling(userId, { planKey: plan.key });
    }
  }

  return NextResponse.json({ ok: true });
}

/**
 * Erases an account and everything it owns. Irreversible, so the request has
 * to name the account twice: once by id, and once by typing its email. A
 * mistyped id then deletes nothing instead of deleting the wrong person.
 */
export async function DELETE(request: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  let body: { userId?: unknown; confirmEmail?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "Valid userId required" }, { status: 400 });
  }
  if (userId === gate.admin._id.toHexString()) {
    return NextResponse.json({ error: "You can't delete your own account" }, { status: 400 });
  }

  const target = await getUserById(userId);
  if (!target) return NextResponse.json({ error: "No such account" }, { status: 404 });

  // an admin is defined by an allow-list, so a deleted one simply returns on
  // next sign-in — losing their data for nothing
  if (isAdminEmail(target.email)) {
    return NextResponse.json(
      { error: "That account is an admin. Remove it from ADMIN_EMAILS first." },
      { status: 400 }
    );
  }

  const typed = typeof body.confirmEmail === "string" ? body.confirmEmail.trim().toLowerCase() : "";
  if (typed !== String(target.email ?? "").toLowerCase()) {
    return NextResponse.json(
      { error: "The typed email doesn't match that account" },
      { status: 400 }
    );
  }

  const report = await deleteUserCompletely(userId);
  if (!report) return NextResponse.json({ error: "No such account" }, { status: 404 });

  console.warn(
    `[admin] ${gate.admin.email} deleted ${report.email}: ` +
      `${report.tasks} tasks, ${report.lists} lists, ${report.paymentsKept} payments kept`
  );
  return NextResponse.json({ ok: true, report });
}
