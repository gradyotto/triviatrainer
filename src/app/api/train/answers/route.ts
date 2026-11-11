import { NextResponse } from "next/server";
import { z } from "zod";
import { getSignedInClerkId } from "@/lib/clerk-user";
import { findGradable, gradeStoredQuestion } from "@/lib/questions";
import { saveAttempt } from "@/lib/persistence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  questionId: z.string().min(1).max(80),
  response: z.string().max(400),
  sessionId: z.string().uuid().nullish(),
  usedHint: z.boolean().optional(),
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
  let persisted = false;
  const clerkUserId = await getSignedInClerkId();
  if (clerkUserId && question.databaseId && parsed.data.sessionId) {
    try {
      persisted = await saveAttempt({
        clerkUserId,
        sessionId: parsed.data.sessionId,
        questionId: question.databaseId,
        response: parsed.data.response,
        correct,
        usedHint: parsed.data.usedHint ?? false,
      });
    } catch {
      console.error("Failed to persist attempt");
      persisted = false;
    }
  }

  return NextResponse.json({
    correct,
    answer: question.answer,
    explanation: question.explanation,
    persisted,
  });
}
