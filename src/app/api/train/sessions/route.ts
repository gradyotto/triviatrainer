import { NextResponse } from "next/server";
import { z } from "zod";
import { getSignedInClerkId } from "@/lib/clerk-user";
import { openTrainingSession } from "@/lib/persistence";
import { getReviewOverview } from "@/lib/review/service";
import { trackSafely } from "@/lib/tracking/track";
import { getUserByClerkId } from "@/lib/users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  category: z.string().regex(/^[a-z0-9-]{1,64}$/).nullable(),
  timeZone: z.string().min(1).max(64).optional(),
  mode: z.enum(["train", "review"]).optional(),
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
    const mode = parsed.data.mode === "review" ? "review" : "train";
    const sessionId = await openTrainingSession({
      clerkUserId,
      categorySlug: mode === "review" ? null : parsed.data.category,
      timeZone: parsed.data.timeZone,
      mode,
    });
    if (sessionId && mode === "train") {
      try {
        const user = await getUserByClerkId(clerkUserId);
        await trackSafely({
          event: "training_session_started",
          clerkId: clerkUserId,
          userId: user?.id,
          dedupeKey: `training_session_started:${sessionId}`,
          metadata: {
            sessionId,
            category: parsed.data.category,
            plan: user?.plan,
            username: user?.username,
          },
        });
      } catch {
        console.error("Failed to record training_session_started");
      }
    }
    if (sessionId && mode === "review") {
      try {
        const user = await getUserByClerkId(clerkUserId);
        const overview = await getReviewOverview(clerkUserId);
        await trackSafely({
          event: "review_session_started",
          clerkId: clerkUserId,
          userId: user?.id,
          metadata: {
            sessionId,
            dueCount: overview.dueCount,
            plan: user?.plan,
            username: user?.username,
          },
        });
      } catch {
        console.error("Failed to record review_session_started");
      }
    }
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
