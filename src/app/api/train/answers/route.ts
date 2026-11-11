import { NextResponse } from "next/server";
import { z } from "zod";
import { checkDailyLimit } from "@/lib/billing/usage";
import { getSignedInClerkId } from "@/lib/clerk-user";
import { isDatabaseConfigured } from "@/lib/env";
import { findGradable, gradeStoredQuestion } from "@/lib/questions";
import { saveAttempt } from "@/lib/persistence";
import { trackSafely } from "@/lib/tracking/track";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  questionId: z.string().min(1).max(80),
  response: z.string().max(400),
  sessionId: z.string().uuid().nullish(),
  usedHint: z.boolean().optional(),
  responseMs: z.number().int().nonnegative().max(30 * 60 * 1000).optional(),
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
    return NextResponse.json({ error: "Invalid answer" }, { status: 400 });
  }

  const question = await findGradable(parsed.data.questionId);
  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const correct = gradeStoredQuestion(question, parsed.data.response);
  const clerkUserId = await getSignedInClerkId();
  if (!clerkUserId || !isDatabaseConfigured()) {
    return NextResponse.json({
      correct,
      answer: question.answer,
      explanation: question.explanation,
      persisted: false,
    });
  }

  let gate;
  try {
    gate = await checkDailyLimit({
      clerkUserId,
      kind: "question",
      timeZone: parsed.data.timeZone,
    });
  } catch {
    console.error("Failed to check the daily question limit");
    return NextResponse.json(
      { error: "Could not check today's allowance" },
      { status: 503 },
    );
  }

  if (!gate.decision.allowed) {
    await trackSafely({
      event: "daily_limit_hit",
      clerkId: clerkUserId,
      userId: gate.user.id,
      dedupeKey: `daily_limit_hit:${clerkUserId}:${gate.dayKey}:question`,
      metadata: {
        kind: "question",
        used: gate.decision.used,
        limit: gate.decision.limit,
      },
    });
    return NextResponse.json(
      {
        code: "daily_limit",
        limit: gate.decision.limit,
        used: gate.decision.used,
        upgradeUrl: "/upgrade",
      },
      { status: 402 },
    );
  }

  if (!parsed.data.sessionId || !question.databaseId) {
    return NextResponse.json(
      { error: "A saved session is required" },
      { status: 409 },
    );
  }

  let persisted = false;
  try {
    persisted = await saveAttempt({
      clerkUserId,
      sessionId: parsed.data.sessionId,
      questionId: question.databaseId,
      response: parsed.data.response,
      correct,
      usedHint: parsed.data.usedHint ?? false,
      responseMs: parsed.data.responseMs,
      kind: "question",
    });
  } catch {
    console.error("Failed to persist attempt");
    persisted = false;
  }
  if (!persisted) {
    return NextResponse.json(
      { error: "Could not save that answer" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    correct,
    answer: question.answer,
    explanation: question.explanation,
    persisted: true,
  });
}
