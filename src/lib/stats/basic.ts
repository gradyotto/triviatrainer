import { and, desc, eq, gt, sum } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import {
  categories,
  questionProgress,
  questions,
  sessionAnswers,
  sessions,
  users,
} from "@/db/schema";
import { buildBasicStats, emptyBasicStats } from "./metrics";
import type { BasicStats } from "./types";

/**
 * Basic stats for /stats.
 *
 * - question_progress holds the lifetime rollup: questions answered, overall
 *   accuracy, and accuracy by category.
 * - session_answers is the event log. Its timestamps are the days that count
 *   toward the streak. question_progress only stores the latest answer per
 *   question, so it cannot reconstruct a day streak.
 * - sessions supplies the recent list (date, set, stored score).
 *
 * The day streak uses the user's saved IANA time zone. Trends and category
 * ranks over time belong in ./pro.
 */

function asCount(value: unknown): number {
  if (value == null) return 0;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.trunc(numeric));
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function setLabel(slug: string | null, name: string | null): string {
  if (!slug) return "Mixed";
  const trimmed = name?.trim();
  return trimmed ? trimmed : slug;
}

async function findUser(
  clerkUserId: string,
): Promise<{ id: string; timeZone: string } | null> {
  const rows = await getDb()
    .select({ id: users.id, timeZone: users.timeZone })
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getBasicStats(clerkUserId: string): Promise<BasicStats> {
  if (!isDatabaseConfigured()) return emptyBasicStats();
  const user = await findUser(clerkUserId);
  if (!user) return emptyBasicStats();
  const userId = user.id;

  const db = getDb();
  const [totalRows, categoryRows, answerRows, sessionRows] = await Promise.all([
    db
      .select({
        answered: sum(questionProgress.seenCount),
        correct: sum(questionProgress.correctCount),
      })
      .from(questionProgress)
      .where(eq(questionProgress.userId, userId)),
    db
      .select({
        slug: categories.slug,
        name: categories.name,
        sortOrder: categories.sortOrder,
        answered: sum(questionProgress.seenCount),
        correct: sum(questionProgress.correctCount),
      })
      .from(questionProgress)
      .innerJoin(questions, eq(questionProgress.questionId, questions.id))
      .innerJoin(categories, eq(questions.categoryId, categories.id))
      .where(eq(questionProgress.userId, userId))
      .groupBy(
        categories.id,
        categories.slug,
        categories.name,
        categories.sortOrder,
      )
      .orderBy(categories.sortOrder),
    db
      .select({ answeredAt: sessionAnswers.createdAt })
      .from(sessionAnswers)
      .innerJoin(sessions, eq(sessionAnswers.sessionId, sessions.id))
      .where(eq(sessions.userId, userId)),
    db
      .select({
        id: sessions.id,
        startedAt: sessions.startedAt,
        categorySlug: sessions.categorySlug,
        categoryName: categories.name,
        answered: sessions.answeredCount,
        correct: sessions.correctCount,
      })
      .from(sessions)
      .leftJoin(categories, eq(sessions.categorySlug, categories.slug))
      .where(and(eq(sessions.userId, userId), gt(sessions.answeredCount, 0)))
      .orderBy(desc(sessions.startedAt))
      .limit(10),
  ]);

  const totals = totalRows[0];
  return buildBasicStats({
    answered: asCount(totals?.answered),
    correct: asCount(totals?.correct),
    categories: categoryRows.map((row) => ({
      slug: row.slug,
      name: row.name,
      sortOrder: row.sortOrder,
      answered: asCount(row.answered),
      correct: asCount(row.correct),
    })),
    answeredAt: answerRows.flatMap((row) => {
      const answeredAt = asDate(row.answeredAt);
      return answeredAt ? [answeredAt] : [];
    }),
    sessions: sessionRows.flatMap((row) => {
      const startedAt = asDate(row.startedAt);
      if (!startedAt) return [];
      return [
        {
          id: row.id,
          startedAt,
          setLabel: setLabel(row.categorySlug, row.categoryName),
          answered: row.answered,
          correct: row.correct,
        },
      ];
    }),
    timeZone: user.timeZone,
  });
}
