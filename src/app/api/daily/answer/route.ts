import { NextResponse } from "next/server";
import { z } from "zod";
import { dailyActor } from "@/lib/daily/http";
import { answerDaily } from "@/lib/daily/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  response: z.string().max(400),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success || parsed.data.response.trim().length === 0) {
    return NextResponse.json({ error: "Enter an answer" }, { status: 400 });
  }
  try {
    const actor = await dailyActor();
    const state = await answerDaily(actor, parsed.data.response);
    return NextResponse.json(state);
  } catch {
    console.error("Failed to score a daily answer");
    return NextResponse.json(
      { error: "Could not score that answer" },
      { status: 503 },
    );
  }
}
