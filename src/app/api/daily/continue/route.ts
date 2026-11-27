import { NextResponse } from "next/server";
import { dailyActor } from "@/lib/daily/http";
import { continueDaily } from "@/lib/daily/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    const actor = await dailyActor();
    const state = await continueDaily(actor);
    return NextResponse.json(state);
  } catch {
    console.error("Failed to continue the daily challenge");
    return NextResponse.json(
      { error: "Could not load the next question" },
      { status: 503 },
    );
  }
}
