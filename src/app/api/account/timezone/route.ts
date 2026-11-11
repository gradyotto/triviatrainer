import { NextResponse } from "next/server";
import { z } from "zod";
import { getSignedInClerkId } from "@/lib/clerk-user";
import { isDatabaseConfigured } from "@/lib/env";
import { resolveTimeZone } from "@/lib/time/zone";
import { ensureUser } from "@/lib/users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  timeZone: z.string().min(1).max(64),
  source: z.enum(["detect", "manual"]).optional(),
});

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }
  const clerkUserId = await getSignedInClerkId();
  if (!clerkUserId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success || !resolveTimeZone(parsed.data.timeZone)) {
    return NextResponse.json({ error: "Unknown time zone" }, { status: 400 });
  }

  try {
    const user = await ensureUser(clerkUserId, {
      timeZone: parsed.data.timeZone,
      source: parsed.data.source ?? "detect",
    });
    return NextResponse.json({
      timeZone: user.timeZone,
      confirmed: user.timeZoneConfirmed,
    });
  } catch {
    console.error("Failed to save time zone");
    return NextResponse.json(
      { error: "Could not save time zone" },
      { status: 500 },
    );
  }
}
