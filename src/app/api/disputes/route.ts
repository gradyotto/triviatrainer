import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, isDatabaseConfigured } from "@/db";
import { answerDisputes } from "@/db/schema";
import { dailyActor } from "@/lib/daily/http";
import { findGradable } from "@/lib/questions";
import { dayKeyInTimeZone } from "@/lib/time/zone";
import { trackSafely } from "@/lib/tracking/track";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bodySchema = z.object({
  questionId: z.string().min(1).max(80),
  response: z.string().max(400),
  context: z.enum(["train", "review", "daily"]),
});

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "Disputes are saved once a database is connected" },
      { status: 503 },
    );
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid dispute" }, { status: 400 });
  }

  const question = await findGradable(parsed.data.questionId);
  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  try {
    const actor = await dailyActor();
    await getDb().insert(answerDisputes).values({
      userId: actor.user?.id ?? null,
      anonymousId: actor.user ? null : actor.guestId,
      questionId:
        question.databaseId && UUID_RE.test(question.databaseId)
          ? question.databaseId
          : null,
      questionKey: parsed.data.questionId,
      response: parsed.data.response.trim(),
      expectedAnswer: question.answer,
      context: parsed.data.context,
    });
    const day = dayKeyInTimeZone(new Date(), actor.user?.timeZone ?? "UTC");
    const actorKey = actor.user?.id ?? actor.guestId ?? "guest";
    await trackSafely({
      event: "answer_disputed",
      clerkId: actor.user?.clerkId,
      userId: actor.user?.id,
      dedupeKey: `answer_disputed:${actorKey}:${parsed.data.questionId}:${day}`,
      metadata: {
        context: parsed.data.context,
        questionId: parsed.data.questionId,
        plan: actor.user?.plan,
        username: actor.user?.username,
        ...(actor.user ? {} : { anonymousId: actor.guestId }),
      },
    });
    return NextResponse.json({ saved: true });
  } catch {
    console.error("Failed to save an answer dispute");
    return NextResponse.json(
      { error: "Could not save that" },
      { status: 503 },
    );
  }
}
