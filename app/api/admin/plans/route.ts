import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdminApi } from "@/lib/admin-api";
import { createPlan, deletePlan, listPlans, updatePlan } from "@/lib/plans";

/**
 * Plan management.
 *
 * Prices arrive in minor units so no money is ever parsed as a float, and the
 * feature list is filtered against the code-defined registry — an admin cannot
 * invent an entitlement that nothing enforces.
 */

export async function GET() {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  return NextResponse.json({ plans: await listPlans({ fresh: true }) });
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

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "A name is required" }, { status: 400 });

  const priceMinor = Number(body.priceMinor);
  if (!Number.isFinite(priceMinor) || priceMinor < 100) {
    return NextResponse.json({ error: "Price must be at least 1.00" }, { status: 400 });
  }

  const plan = await createPlan({
    name,
    tagline: typeof body.tagline === "string" ? body.tagline : "",
    priceMinor: Math.round(priceMinor),
    currency: typeof body.currency === "string" ? body.currency : "INR",
    features: body.features,
    active: body.active !== false,
    order: Number(body.order),
  });
  return NextResponse.json({ plan });
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

  if (body.priceMinor !== undefined) {
    const priceMinor = Number(body.priceMinor);
    if (!Number.isFinite(priceMinor) || priceMinor < 100) {
      return NextResponse.json({ error: "Price must be at least 1.00" }, { status: 400 });
    }
  }

  await updatePlan(id, {
    ...(typeof body.name === "string" ? { name: body.name } : {}),
    ...(typeof body.tagline === "string" ? { tagline: body.tagline } : {}),
    ...(body.priceMinor !== undefined ? { priceMinor: Math.round(Number(body.priceMinor)) } : {}),
    ...(typeof body.currency === "string" ? { currency: body.currency } : {}),
    ...(body.features !== undefined ? { features: body.features } : {}),
    ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
    ...(body.order !== undefined ? { order: Number(body.order) } : {}),
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Valid id required" }, { status: 400 });

  const result = await deletePlan(id);
  // A plan someone holds is retired rather than removed, so their account keeps
  // a name for what it bought. Say so instead of reporting a silent success.
  return NextResponse.json(result);
}
