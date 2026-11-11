import { and, eq, sql } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import {
  categories,
  questionProgress,
  questions,
  sessionAnswers,
  sessions,
  users,
} from "@/db/schema";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ensureUser(
  clerkId: string,
): Promise<{ id: string; plan: "free" | "pro" }> {
  const db = getDb();
  await db.insert(users).values({ clerkId }).onConflictDoNothing({
    target: users.clerkId,
  });
  const rows = await db
    .select({ id: users.id, plan: users.plan })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  const user = rows[0];
  if (!user) {
    throw new Error("Could not load the signed-in user.");
  }
  return user;
}

export async function openTrainingSession(input: {
  clerkUserId: string;
  categorySlug: string | null;
}): Promise<string | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDb();
  const user = await ensureUser(input.clerkUserId);
  let categoryIds: string[] = [];
  if (input.categorySlug) {
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
      categorySlug: input.categorySlug,
      durationSeconds: 0,
      planSnapshot: user.plan,
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
}): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  if (!UUID_RE.test(input.sessionId) || !UUID_RE.test(input.questionId)) {
    return false;
  }

  const db = getDb();
  const user = await ensureUser(input.clerkUserId);
  const userId = user.id;
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
