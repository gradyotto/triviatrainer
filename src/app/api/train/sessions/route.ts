import { NextResponse } from "next/server";
import { z } from "zod";
import { getSignedInClerkId } from "@/lib/clerk-user";
import { openTrainingSession } from "@/lib/persistence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  category: z.string().regex(/^[a-z0-9-]{1,64}$/).nullable(),
  timeZone: z.string().min(1).max(64).optional(),
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
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  const clerkUserId = await getSignedInClerkId();
  if (!clerkUserId) {
    return NextResponse.json({
      sessionId: null,
      persisted: false,
      signedIn: false,
    });
  }

  try {
    const sessionId = await openTrainingSession({
      clerkUserId,
      categorySlug: parsed.data.category,
      timeZone: parsed.data.timeZone,
    });
    return NextResponse.json({
      sessionId,
      persisted: Boolean(sessionId),
      signedIn: true,
    });
  } catch {
    console.error("Failed to open a training session");
    return NextResponse.json({
      sessionId: null,
      persisted: false,
      signedIn: true,
    });
  }
}
