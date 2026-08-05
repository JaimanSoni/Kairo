import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api";
import { listLeads, getLeadStats, updateLeadStatus } from "@/lib/leads";

export async function GET(request: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  const stats = url.searchParams.get("stats");
  const status = url.searchParams.get("status") || undefined;
  const competitor = url.searchParams.get("competitor") || undefined;
  const minScore = url.searchParams.get("minScore") ? parseInt(url.searchParams.get("minScore")!) : undefined;
  const sort = (url.searchParams.get("sort") as "score" | "created" | "updated") || "score";
  const limit = url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!) : 100;
  const offset = url.searchParams.get("offset") ? parseInt(url.searchParams.get("offset")!) : 0;

  if (stats === "1") {
    const data = await getLeadStats();
    return NextResponse.json(data);
  }

  const { leads, total } = await listLeads({
    status: status as Parameters<typeof listLeads>[0] extends { status?: infer S } ? S : never,
    competitor,
    minScore,
    sort,
    limit,
    offset,
  });

  return NextResponse.json({ leads, total });
}

export async function PATCH(request: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  let body: { username?: unknown; platform?: unknown; status?: unknown; notes?: unknown; contacted?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username : "";
  const platform = typeof body.platform === "string" ? body.platform : "";
  if (!username || !platform) {
    return NextResponse.json({ error: "username and platform required" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (typeof body.status === "string") update.status = body.status;
  if (typeof body.notes === "string") update.notes = body.notes;
  if (typeof body.contacted === "boolean") update.contacted = body.contacted;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const ok = await updateLeadStatus(username, platform, update as Parameters<typeof updateLeadStatus>[2]);
  return NextResponse.json({ ok });
}
