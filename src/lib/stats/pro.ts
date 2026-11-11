import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import {
  categories,
  questions,
  sessionAnswers,
  sessions,
  users,
} from "@/db/schema";
import {
  buildProStats,
  emptyProStats,
  type AnswerFact,
  type ProStats,
} from "./pro-metrics";

export type {
  AccuracyTrendPoint,
  ActivityDay,
  CategoryRank,
  CategoryTrend,
  CategoryWeekPoint,
  DifficultyAccuracy,
  ProStats,
} from "./pro-metrics";

export { formatAnswerTime } from "./pro-metrics";

function asDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

/**
 * Pro analytics for a signed-in user. The caller decides whether the user's
 * plan may see this. Answer timing comes from session_answers.response_ms,
 * which the train loop records going forward.
 */
export async function getProStats(clerkUserId: string): Promise<ProStats> {
  if (!isDatabaseConfigured()) return emptyProStats();
  const db = getDb();
  const userRows = await db
    .select({ id: users.id, timeZone: users.timeZone })
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);
  const user = userRows[0];
  if (!user) return emptyProStats();

  const rows = await db
    .select({
      createdAt: sessionAnswers.createdAt,
      isCorrect: sessionAnswers.isCorrect,
      responseMs: sessionAnswers.responseMs,
      difficulty: questions.difficulty,
      categorySlug: categories.slug,
      categoryName: categories.name,
    })
    .from(sessionAnswers)
    .innerJoin(sessions, eq(sessionAnswers.sessionId, sessions.id))
    .innerJoin(questions, eq(sessionAnswers.questionId, questions.id))
    .innerJoin(categories, eq(questions.categoryId, categories.id))
    .where(eq(sessions.userId, user.id));

  const facts: AnswerFact[] = rows.flatMap((row) => {
    const createdAt = asDate(row.createdAt);
    if (!createdAt) return [];
    return [
      {
        createdAt,
        correct: row.isCorrect,
        responseMs: row.responseMs,
        difficulty: row.difficulty,
        categorySlug: row.categorySlug,
        categoryName: row.categoryName,
      },
    ];
  });

  return buildProStats(facts, new Date(), user.timeZone);
}
