import { and, eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { categories, questionProgress, questions } from "@/db/schema";
import { toPublicQuestion } from "@/lib/questions";
import { buildReviewSelection, type QueueCandidate } from "@/lib/review/queue";
import {
  formatReviewWait,
  nextScheduledReview,
} from "@/lib/review/schedule";
import type { PublicQuestion, QuestionType } from "@/lib/train-types";
import { getUserByClerkId } from "@/lib/users";

export type ReviewOverview = {
  dueCount: number;
  nextReviewLabel: string | null;
};

type StoredRow = QueueCandidate & {
  type: QuestionType;
  prompt: string;
  options: string[] | null;
  difficulty: string;
  hint: string | null;
  categorySlug: string;
  categoryName: string;
  answer: string;
  imageUrl: string | null;
  imageAlt: string | null;
  imageCredit: string | null;
};

function asDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

async function loadRows(userId: string): Promise<StoredRow[] | null> {
  if (!isDatabaseConfigured()) return null;
  const rows = await getDb()
    .select({
      questionId: questions.id,
      type: questions.type,
      prompt: questions.prompt,
      options: questions.options,
      difficulty: questions.difficulty,
      hint: questions.hint,
      answer: questions.answer,
      imageUrl: questions.imageUrl,
      imageAlt: questions.imageAlt,
      imageCredit: questions.imageCredit,
      categorySlug: categories.slug,
      categoryName: categories.name,
      nextReviewAt: questionProgress.nextReviewAt,
      easeFactor: questionProgress.easeFactor,
      correctCount: questionProgress.correctCount,
      seenCount: questionProgress.seenCount,
      incorrectCount: questionProgress.incorrectCount,
      lastCorrect: questionProgress.lastCorrect,
      lastAnsweredAt: questionProgress.lastAnsweredAt,
    })
    .from(questionProgress)
    .innerJoin(
      questions,
      and(
        eq(questionProgress.questionId, questions.id),
        eq(questions.isActive, true),
      ),
    )
    .innerJoin(categories, eq(questions.categoryId, categories.id))
    .where(eq(questionProgress.userId, userId));

  return rows.map((row) => ({
    questionId: row.questionId,
    nextReviewAt: asDate(row.nextReviewAt),
    easeFactor: row.easeFactor,
    correctCount: row.correctCount,
    seenCount: row.seenCount,
    incorrectCount: row.incorrectCount,
    lastCorrect: row.lastCorrect,
    lastAnsweredAt: asDate(row.lastAnsweredAt),
    type: row.type,
    prompt: row.prompt,
    options: row.options,
    difficulty: row.difficulty,
    hint: row.hint,
    categorySlug: row.categorySlug,
    categoryName: row.categoryName,
    answer: row.answer,
    imageUrl: row.imageUrl,
    imageAlt: row.imageAlt,
    imageCredit: row.imageCredit,
  }));
}

function overviewFrom(
  rows: StoredRow[],
  dueCount: number,
  now: Date,
  timeZone: string,
): ReviewOverview {
  const next = nextScheduledReview(
    rows.map((row) => row.nextReviewAt),
    now,
    timeZone,
  );
  return {
    dueCount,
    nextReviewLabel: next ? formatReviewWait(now, next) : null,
  };
}

export async function getReviewOverview(
  clerkUserId: string,
  now = new Date(),
): Promise<ReviewOverview> {
  const empty: ReviewOverview = { dueCount: 0, nextReviewLabel: null };
  const user = await getUserByClerkId(clerkUserId);
  if (!user) return empty;
  const rows = await loadRows(user.id);
  if (!rows) return empty;
  const selection = buildReviewSelection(rows, now, user.timeZone, rows.length);
  return overviewFrom(rows, selection.dueCount, now, user.timeZone);
}

export async function drawReviewQuestions(
  clerkUserId: string,
  limit: number,
  now = new Date(),
): Promise<{ overview: ReviewOverview; questions: PublicQuestion[] }> {
  const empty = {
    overview: { dueCount: 0, nextReviewLabel: null } satisfies ReviewOverview,
    questions: [] as PublicQuestion[],
  };
  const user = await getUserByClerkId(clerkUserId);
  if (!user) return empty;
  const rows = await loadRows(user.id);
  if (!rows) return empty;
  const selection = buildReviewSelection(rows, now, user.timeZone, limit);
  const byId = new Map(rows.map((row) => [row.questionId, row]));
  return {
    overview: overviewFrom(rows, selection.dueCount, now, user.timeZone),
    questions: selection.orderedIds.flatMap((id) => {
      const row = byId.get(id);
      if (!row) return [];
      return [
        toPublicQuestion({
          id: row.questionId,
          type: row.type,
          prompt: row.prompt,
          options: row.options,
          categorySlug: row.categorySlug,
          categoryName: row.categoryName,
          difficulty: row.difficulty,
          hint: row.hint,
          answer: row.answer,
          imageUrl: row.imageUrl,
          imageAlt: row.imageAlt,
          imageCredit: row.imageCredit,
        }),
      ];
    }),
  };
}
