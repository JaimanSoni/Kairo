import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { requireAdminApi } from "@/lib/admin-api";
import { seedLeads } from "@/lib/leads";
import type { GtmLead } from "@/lib/leads";

export async function POST() {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const leadsPath = resolve(process.cwd(), "lib", "data", "leads.json");
  if (!existsSync(leadsPath)) {
    return NextResponse.json({ error: "leads.json not found" }, { status: 404 });
  }

  const leads: GtmLead[] = JSON.parse(readFileSync(leadsPath, "utf-8"));
  const result = await seedLeads(leads);

  return NextResponse.json({ ok: true, ...result });
}
