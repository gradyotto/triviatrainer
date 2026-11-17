import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { questionProgress, sessionAnswers, sessions, users } from "@/db/schema";
import {
  planScheduleBackfill,
  type ReviewAttempt,
} from "@/lib/review/schedule";

export type BackfillResult = {
  updated: number;
  inserted: number;
  skipped: number;
};

function asDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

type Group = {
  userId: string;
  questionId: string;
  timeZone: string;
  attempts: ReviewAttempt[];
};

/**
 * Replay stored answers onto question_progress. By default a due date already
 * on the row is kept. `force` recomputes every schedule from the answer log.
 */
export async function backfillReviewSchedules(options?: {
  force?: boolean;
}): Promise<BackfillResult> {
  const force = options?.force === true;
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not set.");
  }
  const db = getDb();
  const [answerRows, progressRows] = await Promise.all([
    db
      .select({
        userId: sessions.userId,
        questionId: sessionAnswers.questionId,
        correct: sessionAnswers.isCorrect,
        usedHint: sessionAnswers.usedHint,
        answeredAt: sessionAnswers.createdAt,
        timeZone: users.timeZone,
      })
      .from(sessionAnswers)
      .innerJoin(sessions, eq(sessionAnswers.sessionId, sessions.id))
      .innerJoin(users, eq(sessions.userId, users.id))
      .orderBy(asc(sessionAnswers.createdAt)),
    db
      .select({
        id: questionProgress.id,
        userId: questionProgress.userId,
        questionId: questionProgress.questionId,
        nextReviewAt: questionProgress.nextReviewAt,
      })
      .from(questionProgress),
  ]);

  const groups = new Map<string, Group>();
  for (const row of answerRows) {
    if (!row.userId) continue;
    const answeredAt = asDate(row.answeredAt);
    if (!answeredAt) continue;
    const key = `${row.userId}:${row.questionId}`;
    const group = groups.get(key) ?? {
      userId: row.userId,
      questionId: row.questionId,
      timeZone: row.timeZone || "UTC",
      attempts: [],
    };
    group.attempts.push({
      correct: row.correct,
      usedHint: row.usedHint,
      answeredAt,
    });
    groups.set(key, group);
  }

  const progressByKey = new Map<
    string,
    { id: string; nextReviewAt: Date | null }
  >();
  for (const row of progressRows) {
    progressByKey.set(`${row.userId}:${row.questionId}`, {
      id: row.id,
      nextReviewAt: asDate(row.nextReviewAt),
    });
  }

  let updated = 0;
  let inserted = 0;
  let skipped = 0;
  const now = new Date();

  for (const [key, group] of groups) {
    const existing = progressByKey.get(key);
    const plan = planScheduleBackfill({
      attempts: group.attempts,
      timeZone: group.timeZone,
      hasProgressRow: Boolean(existing),
      nextReviewAt: force ? null : (existing?.nextReviewAt ?? null),
    });
    if (plan.action === "skip" || !plan.schedule.nextReviewAt) {
      skipped += 1;
      continue;
    }
    const schedule = {
      easeFactor: plan.schedule.easeFactor,
      intervalDays: plan.schedule.intervalDays,
      repetition: plan.schedule.repetition,
      lapses: plan.schedule.lapses,
      nextReviewAt: plan.schedule.nextReviewAt,
      updatedAt: now,
    };
    if (plan.action === "update" && existing) {
      const result = await db
        .update(questionProgress)
        .set(schedule)
        .where(
          force
            ? eq(questionProgress.id, existing.id)
            : and(
                eq(questionProgress.id, existing.id),
                isNull(questionProgress.nextReviewAt),
              ),
        )
        .returning({ id: questionProgress.id });
      if (result[0]) updated += 1;
      else skipped += 1;
      continue;
    }
    const result = await db
      .insert(questionProgress)
      .values({
        userId: group.userId,
        questionId: group.questionId,
        seenCount: plan.seenCount,
        correctCount: plan.correctCount,
        incorrectCount: plan.incorrectCount,
        streak: plan.streak,
        lastAnsweredAt: plan.lastAnsweredAt,
        lastCorrect: plan.lastCorrect,
        ...schedule,
      })
      .onConflictDoNothing()
      .returning({ id: questionProgress.id });
    if (result[0]) inserted += 1;
    else skipped += 1;
  }

  return { updated, inserted, skipped };
}
