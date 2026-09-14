import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest, notFound } from "@/lib/api-auth";
import { harvestFruit } from "@/lib/habits";
import { habitFailure, jsonBody } from "@/lib/habit-api";

/** Picks a ripe fruit or golden fruit into the harvest basket. */
export async function POST(request: Request, ctx: RouteContext<"/api/habits/[id]/harvest">) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;
  const body = await jsonBody(request);
  if (!body) return badRequest("Invalid JSON");
  try {
    const result = await harvestFruit(new ObjectId(session.userId), id, body.kind);
    return result ? NextResponse.json(result, { status: 201 }) : notFound();
  } catch (err) {
    return habitFailure(err);
  }
}
