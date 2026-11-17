import { and, eq, sql } from "drizzle-orm";
import type { UsageKind } from "@/config/plans";
import { getDb, isDatabaseConfigured } from "@/db";
import {
  categories,
  questionProgress,
  questions,
  sessionAnswers,
  sessions,
} from "@/db/schema";
import { applyReview, initialSchedule } from "@/lib/review/schedule";
import { ensureUser } from "@/lib/users";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_RESPONSE_MS = 30 * 60 * 1000;

export async function openTrainingSession(input: {
  clerkUserId: string;
  categorySlug: string | null;
  timeZone?: string | null;
  mode?: "train" | "review";
}): Promise<string | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDb();
  const user = await ensureUser(input.clerkUserId, {
    timeZone: input.timeZone,
    source: "detect",
  });
  const mode = input.mode === "review" ? "review" : "train";
  let categoryIds: string[] = [];
  if (mode === "train" && input.categorySlug) {
    const categoryRows = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, input.categorySlug))
      .limit(1);
    if (categoryRows[0]) categoryIds = [categoryRows[0].id];
  }

  const inserted = await db
    .insert(sessions)
    .values({
      userId: user.id,
      categoryIds,
      categorySlug: mode === "review" ? null : input.categorySlug,
      durationSeconds: 0,
      planSnapshot: user.plan,
      mode,
    })
    .returning({ id: sessions.id });
  return inserted[0]?.id ?? null;
}

export async function saveAttempt(input: {
  clerkUserId: string;
  sessionId: string;
  questionId: string;
  response: string;
  correct: boolean;
  usedHint: boolean;
  responseMs?: number | null;
  kind?: UsageKind;
}): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  if (!UUID_RE.test(input.sessionId) || !UUID_RE.test(input.questionId)) {
    return false;
  }

  const db = getDb();
  const user = await ensureUser(input.clerkUserId);
  const userId = user.id;
  const responseMs =
    typeof input.responseMs === "number" &&
    Number.isFinite(input.responseMs) &&
    input.responseMs >= 0 &&
    input.responseMs <= MAX_RESPONSE_MS
      ? Math.round(input.responseMs)
      : null;
  const sessionRows = await db
    .select({ id: sessions.id, userId: sessions.userId })
    .from(sessions)
    .where(eq(sessions.id, input.sessionId))
    .limit(1);
  const session = sessionRows[0];
  if (!session || session.userId !== userId) return false;

  const questionRows = await db
    .select({ id: questions.id })
    .from(questions)
    .where(eq(questions.id, input.questionId))
    .limit(1);
  if (!questionRows[0]) return false;

  const priorAnswers = await db
    .select({ attempt: sessionAnswers.attempt })
    .from(sessionAnswers)
    .where(
      and(
        eq(sessionAnswers.sessionId, input.sessionId),
        eq(sessionAnswers.questionId, input.questionId),
      ),
    );
  const attempt =
    priorAnswers.reduce((max, row) => Math.max(max, row.attempt), 0) + 1;

  await db.insert(sessionAnswers).values({
    sessionId: input.sessionId,
    questionId: input.questionId,
    attempt,
    response: input.response,
    isCorrect: input.correct,
    usedHint: input.usedHint,
    responseMs,
    kind: input.kind ?? "question",
  });

  await db
    .update(sessions)
    .set({
      answeredCount: sql`${sessions.answeredCount} + 1`,
      correctCount: sql`${sessions.correctCount} + ${input.correct ? 1 : 0}`,
    })
    .where(eq(sessions.id, input.sessionId));

  const progressRows = await db
    .select()
    .from(questionProgress)
    .where(
      and(
        eq(questionProgress.userId, userId),
        eq(questionProgress.questionId, input.questionId),
      ),
    )
    .limit(1);
  const progress = progressRows[0];
  const now = new Date();
  const schedule = applyReview(
    progress
      ? {
          easeFactor: progress.easeFactor,
          intervalDays: progress.intervalDays,
          repetition: progress.repetition,
          lapses: progress.lapses,
          nextReviewAt: progress.nextReviewAt,
        }
      : initialSchedule(),
    {
      correct: input.correct,
      usedHint: input.usedHint,
      answeredAt: now,
      timeZone: user.timeZone,
    },
  );
  if (!progress) {
    await db.insert(questionProgress).values({
      userId,
      questionId: input.questionId,
      seenCount: 1,
      correctCount: input.correct ? 1 : 0,
      incorrectCount: input.correct ? 0 : 1,
      streak: input.correct ? 1 : 0,
      lastAnsweredAt: now,
      lastCorrect: input.correct,
      easeFactor: schedule.easeFactor,
      intervalDays: schedule.intervalDays,
      repetition: schedule.repetition,
      lapses: schedule.lapses,
      nextReviewAt: schedule.nextReviewAt,
      updatedAt: now,
    });
  } else {
    await db
      .update(questionProgress)
      .set({
        seenCount: progress.seenCount + 1,
        correctCount: progress.correctCount + (input.correct ? 1 : 0),
        incorrectCount: progress.incorrectCount + (input.correct ? 0 : 1),
        streak: input.correct ? progress.streak + 1 : 0,
        lastAnsweredAt: now,
        lastCorrect: input.correct,
        easeFactor: schedule.easeFactor,
        intervalDays: schedule.intervalDays,
        repetition: schedule.repetition,
        lapses: schedule.lapses,
        nextReviewAt: schedule.nextReviewAt,
        updatedAt: now,
      })
      .where(eq(questionProgress.id, progress.id));
  }

  return true;
}

export async function finishTrainingSession(input: {
  clerkUserId: string;
  sessionId: string;
  durationSeconds: number;
}): Promise<boolean> {
  if (!isDatabaseConfigured() || !UUID_RE.test(input.sessionId)) return false;
  const db = getDb();
  const user = await ensureUser(input.clerkUserId);
  const duration = Math.max(
    0,
    Math.min(60 * 60 * 6, Math.round(input.durationSeconds)),
  );
  const updated = await db
    .update(sessions)
    .set({
      endedAt: new Date(),
      durationSeconds: duration,
    })
    .where(and(eq(sessions.id, input.sessionId), eq(sessions.userId, user.id)))
    .returning({ id: sessions.id });
  return Boolean(updated[0]);
}
