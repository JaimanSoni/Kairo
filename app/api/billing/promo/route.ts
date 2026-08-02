import { NextResponse } from "next/server";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { listSellablePlans } from "@/lib/plans";
import { discountedMinor, validatePromo } from "@/lib/promos";

/**
 * Previews what a code is worth before checkout opens. Signed-in only, and
 * the answer is per-plan prices computed here — the client shows them but
 * the order route recomputes everything when money actually moves.
 */
export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  let code = "";
  try {
    const body = (await request.json()) as { code?: unknown };
    if (typeof body.code === "string") code = body.code;
  } catch {
    return badRequest("Invalid JSON");
  }
  if (!code.trim()) return badRequest("A code is required");

  const sellable = await listSellablePlans();
  const discounts: Record<string, { amountMinor: number; percentOff: number }> = {};
  let firstError: string | null = null;

  for (const plan of sellable) {
    const check = await validatePromo(code, plan.key, session.userId);
    if (check.ok) {
      discounts[plan.key] = {
        amountMinor: discountedMinor(plan.priceMinor, check.promo.percentOff),
        percentOff: check.promo.percentOff,
      };
    } else {
      firstError ??= check.error;
    }
  }

  if (Object.keys(discounts).length === 0) {
    return badRequest(firstError ?? "That code isn't valid right now");
  }
  return NextResponse.json({ code: code.trim().toUpperCase(), discounts });
}
