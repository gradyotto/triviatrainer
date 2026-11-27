import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import {
  answerDisputes,
  dailyAnswers,
  dailyAttempts,
  questionProgress,
  questions,
  sessionAnswers,
  sessions,
  users,
} from "@/db/schema";
import {
  aliasesAfterAccept,
  dailyChainScore,
  regradeDailyChain,
  type DailyChainAnswer,
} from "@/lib/disputes/regrade";
import { normalizeFillIn } from "@/lib/grading";

export type OpenDispute = {
  id: string;
  prompt: string | null;
  userAnswer: string;
  correctAnswer: string;
  username: string;
  createdAt: Date;
  mode: string;
};

function asDate(value: Date | string | null | undefined): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date(0);
}

export async function countOpenDisputes(): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  try {
    const rows = await getDb()
      .select({ id: answerDisputes.id })
      .from(answerDisputes)
      .where(eq(answerDisputes.status, "open"));
    return rows.length;
  } catch {
    return 0;
  }
}

export async function listOpenDisputes(): Promise<OpenDispute[]> {
  if (!isDatabaseConfigured()) return [];
  const rows = await getDb()
    .select({
      id: answerDisputes.id,
      response: answerDisputes.response,
      expectedAnswer: answerDisputes.expectedAnswer,
      context: answerDisputes.context,
      createdAt: answerDisputes.createdAt,
      username: users.username,
      prompt: questions.prompt,
      questionAnswer: questions.answer,
    })
    .from(answerDisputes)
    .leftJoin(users, eq(answerDisputes.userId, users.id))
    .leftJoin(questions, eq(answerDisputes.questionId, questions.id))
    .where(eq(answerDisputes.status, "open"))
    .orderBy(desc(answerDisputes.createdAt));

  return rows.map((row) => ({
    id: row.id,
    prompt: row.prompt,
    userAnswer: row.response,
    correctAnswer: row.questionAnswer || row.expectedAnswer,
    username: row.username ?? "Guest",
    createdAt: asDate(row.createdAt),
    mode: row.context,
  }));
}

async function markResolved(
  id: string,
  resolution: "accepted" | "rejected",
): Promise<boolean> {
  const updated = await getDb()
    .update(answerDisputes)
    .set({
      status: "resolved",
      resolution,
      resolvedAt: new Date(),
    })
    .where(and(eq(answerDisputes.id, id), eq(answerDisputes.status, "open")))
    .returning({ id: answerDisputes.id });
  return Boolean(updated[0]);
}

export async function rejectDispute(id: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  return markResolved(id, "rejected");
}

/**
 * Add the disputed response as an alias and regrade the matching attempt.
 * Daily scores are stored on the attempt, which is what the leaderboard reads.
 */
export async function acceptDispute(
  id: string,
): Promise<{ ok: boolean; regraded: boolean } | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDb();
  const rows = await db
    .select()
    .from(answerDisputes)
    .where(and(eq(answerDisputes.id, id), eq(answerDisputes.status, "open")))
    .limit(1);
  const dispute = rows[0];
  if (!dispute) return null;
  const userAnswer = dispute.response.trim();
  if (!userAnswer) return { ok: false, regraded: false };

  if (dispute.questionId) {
    const questionRows = await db
      .select({
        id: questions.id,
        answer: questions.answer,
        aliases: questions.answerAliases,
      })
      .from(questions)
      .where(eq(questions.id, dispute.questionId))
      .limit(1);
    const question = questionRows[0];
    if (question) {
      await db
        .update(questions)
        .set({
          answerAliases: aliasesAfterAccept(
            question.answer,
            question.aliases ?? [],
            userAnswer,
          ),
          updatedAt: new Date(),
        })
        .where(eq(questions.id, question.id));
    }
  }

  const regraded =
    dispute.context === "daily"
      ? await regradeDailyAttempt(dispute)
      : await regradeSessionAttempt(dispute);
  const ok = await markResolved(id, "accepted");
  return { ok, regraded };
}

type DisputeRow = typeof answerDisputes.$inferSelect;

async function regradeDailyAttempt(dispute: DisputeRow): Promise<boolean> {
  if (!dispute.questionId) return false;
  if (!dispute.userId && !dispute.anonymousId) return false;
  const db = getDb();
  const rows = await db
    .select({
      answer: dailyAnswers,
      userId: dailyAttempts.userId,
      anonymousId: dailyAttempts.anonymousId,
    })
    .from(dailyAnswers)
    .innerJoin(dailyAttempts, eq(dailyAnswers.attemptId, dailyAttempts.id))
    .where(eq(dailyAnswers.questionId, dispute.questionId));

  const target = normalizeFillIn(dispute.response);
  const disputeTime = asDate(dispute.createdAt).getTime();
  const matches = rows.filter((row) => {
    if (dispute.userId) {
      if (row.userId !== dispute.userId) return false;
    } else if (row.anonymousId !== dispute.anonymousId) {
      return false;
    }
    return (
      !row.answer.isCorrect && normalizeFillIn(row.answer.response) === target
    );
  });
  matches.sort((left, right) => {
    const leftDelta = Math.abs(asDate(left.answer.answeredAt).getTime() - disputeTime);
    const rightDelta = Math.abs(asDate(right.answer.answeredAt).getTime() - disputeTime);
    return leftDelta - rightDelta;
  });
  const chosen = matches[0];
  if (!chosen) return false;

  const chain = await db
    .select()
    .from(dailyAnswers)
    .where(eq(dailyAnswers.attemptId, chosen.answer.attemptId));
  const ids = [...new Set(chain.map((answer) => answer.questionId))];
  const difficulties = new Map<string, string>();
  if (ids.length > 0) {
    const questionRows = await db
      .select({ id: questions.id, difficulty: questions.difficulty })
      .from(questions)
      .where(inArray(questions.id, ids));
    for (const question of questionRows) {
      difficulties.set(question.id, question.difficulty);
    }
  }
  const input: DailyChainAnswer[] = chain.map((answer) => ({
    id: answer.id,
    ordinal: answer.ordinal,
    isCorrect: answer.isCorrect,
    basePoints: answer.basePoints,
    speedPoints: answer.speedPoints,
    streakPoints: answer.streakPoints,
    points: answer.points,
    elapsedMs: answer.elapsedMs,
    bonusPoints: answer.bonusPoints,
    difficulty: difficulties.get(answer.questionId) ?? "medium",
  }));
  const recomputed = regradeDailyChain(input, chosen.answer.id);
  for (const answer of recomputed) {
    await db
      .update(dailyAnswers)
      .set({
        isCorrect: answer.isCorrect,
        basePoints: answer.basePoints,
        speedPoints: answer.speedPoints,
        streakPoints: answer.streakPoints,
        points: answer.points,
      })
      .where(eq(dailyAnswers.id, answer.id));
  }
  const totals = dailyChainScore(recomputed);
  await db
    .update(dailyAttempts)
    .set({ score: totals.score, correctCount: totals.correctCount })
    .where(eq(dailyAttempts.id, chosen.answer.attemptId));
  return true;
}

async function regradeSessionAttempt(dispute: DisputeRow): Promise<boolean> {
  if (!dispute.questionId || !dispute.userId) return false;
  const db = getDb();
  const rows = await db
    .select({
      id: sessionAnswers.id,
      response: sessionAnswers.response,
      isCorrect: sessionAnswers.isCorrect,
      createdAt: sessionAnswers.createdAt,
      sessionId: sessionAnswers.sessionId,
      userId: sessions.userId,
    })
    .from(sessionAnswers)
    .innerJoin(sessions, eq(sessionAnswers.sessionId, sessions.id))
    .where(
      and(
        eq(sessionAnswers.questionId, dispute.questionId),
        eq(sessions.userId, dispute.userId),
        eq(sessionAnswers.isCorrect, false),
      ),
    );
  const target = normalizeFillIn(dispute.response);
  const disputeTime = asDate(dispute.createdAt).getTime();
  const matches = rows
    .filter((row) => normalizeFillIn(row.response) === target)
    .sort((left, right) => {
      const leftDelta = Math.abs(asDate(left.createdAt).getTime() - disputeTime);
      const rightDelta = Math.abs(asDate(right.createdAt).getTime() - disputeTime);
      return leftDelta - rightDelta;
    });
  const chosen = matches[0];
  if (!chosen) return false;
  const updated = await db
    .update(sessionAnswers)
    .set({ isCorrect: true })
    .where(and(eq(sessionAnswers.id, chosen.id), eq(sessionAnswers.isCorrect, false)))
    .returning({ id: sessionAnswers.id });
  if (!updated[0]) return false;
  await db
    .update(sessions)
    .set({ correctCount: sql`${sessions.correctCount} + 1` })
    .where(eq(sessions.id, chosen.sessionId));
  await db
    .update(questionProgress)
    .set({
      correctCount: sql`${questionProgress.correctCount} + 1`,
      incorrectCount: sql`greatest(${questionProgress.incorrectCount} - 1, 0)`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(questionProgress.userId, dispute.userId),
        eq(questionProgress.questionId, dispute.questionId),
      ),
    );
  return true;
}
