import { NextResponse } from "next/server";
import { dailyActor } from "@/lib/daily/http";
import { startDaily } from "@/lib/daily/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    const actor = await dailyActor({ createGuest: true });
    const state = await startDaily(actor);
    return NextResponse.json(state);
  } catch {
    console.error("Failed to start the daily challenge");
    return NextResponse.json(
      { error: "Could not start today's challenge" },
      { status: 503 },
    );
  }
}
