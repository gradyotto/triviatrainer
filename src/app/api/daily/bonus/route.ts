import { NextResponse } from "next/server";
import { z } from "zod";
import { dailyActor } from "@/lib/daily/http";
import { bonusDaily } from "@/lib/daily/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  response: z.string().max(400).optional(),
  skip: z.boolean().optional(),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid bonus" }, { status: 400 });
  }
  try {
    const actor = await dailyActor();
    const state = await bonusDaily(actor, {
      response: parsed.data.response ?? "",
      skip: parsed.data.skip === true,
    });
    return NextResponse.json(state);
  } catch {
    console.error("Failed to score a bonus answer");
    return NextResponse.json(
      { error: "Could not score that bonus" },
      { status: 503 },
    );
  }
}
