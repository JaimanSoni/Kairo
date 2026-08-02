import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdminApi } from "@/lib/admin-api";
import { createPromo, deletePromo, listPromos, updatePromo } from "@/lib/promos";

export async function GET() {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  return NextResponse.json({ promos: await listPromos() });
}

export async function POST(request: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const percentOff = Number(body.percentOff);
  if (!Number.isFinite(percentOff) || percentOff < 1 || percentOff > 100) {
    return NextResponse.json({ error: "Percent off must be 1 to 100" }, { status: 400 });
  }

  try {
    const promo = await createPromo({
      code: typeof body.code === "string" && body.code.trim() ? body.code : undefined,
      percentOff,
      maxUses: Number.isFinite(Number(body.maxUses)) && Number(body.maxUses) > 0 ? Number(body.maxUses) : null,
      planKeys: Array.isArray(body.planKeys) && body.planKeys.length > 0 ? body.planKeys.map(String) : null,
      expiresAt:
        typeof body.expiresAt === "string" && body.expiresAt
          ? new Date(`${body.expiresAt}T23:59:59`)
          : null,
      note: typeof body.note === "string" ? body.note : "",
    });
    return NextResponse.json({ promo });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create the code";
    const dup = /E11000|duplicate/i.test(message);
    return NextResponse.json(
      { error: dup ? "That code already exists" : message },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id : "";
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Valid id required" }, { status: 400 });

  await updatePromo(id, {
    ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
    ...(body.maxUses !== undefined
      ? { maxUses: Number.isFinite(Number(body.maxUses)) && Number(body.maxUses) > 0 ? Number(body.maxUses) : null }
      : {}),
    ...(body.expiresAt !== undefined
      ? {
          expiresAt:
            typeof body.expiresAt === "string" && body.expiresAt
              ? new Date(`${body.expiresAt}T23:59:59`)
              : null,
        }
      : {}),
    ...(typeof body.note === "string" ? { note: body.note } : {}),
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Valid id required" }, { status: 400 });
  return NextResponse.json(await deletePromo(id));
}
