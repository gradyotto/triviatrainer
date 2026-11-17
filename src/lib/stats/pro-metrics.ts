import {
  masteryTrendFromHistories,
  retentionFromHistories,
  type MasteryPoint,
  type RetentionStats,
  type ReviewAttempt,
} from "@/lib/review/schedule";
import { accuracyPercent } from "./metrics";
import {
  dayKeyInTimeZone,
  eachDayKey,
  shiftDayKey,
  weekStartKey,
} from "@/lib/time/zone";

const TREND_DAYS = 30;
const HEATMAP_WEEKS = 17;
const CATEGORY_WEEKS = 8;
const MIN_CATEGORY_SAMPLE = 5;
const MAX_ANSWER_MS = 10 * 60 * 1000;

export type AnswerFact = {
  createdAt: Date;
  correct: boolean;
  responseMs: number | null;
  difficulty: string;
  categorySlug: string;
  categoryName: string;
  questionId?: string;
  usedHint?: boolean;
};

export type AccuracyTrendPoint = {
  day: string;
  answered: number;
  correct: number;
  accuracyPercent: number | null;
};

export type CategoryRank = {
  slug: string;
  name: string;
  answered: number;
  correct: number;
  accuracyPercent: number;
};

export type CategoryWeekPoint = {
  weekStart: string;
  answered: number;
  correct: number;
  accuracyPercent: number | null;
};

export type CategoryTrend = {
  slug: string;
  name: string;
  weeks: CategoryWeekPoint[];
};

export type DifficultyAccuracy = {
  difficulty: string;
  answered: number;
  correct: number;
  accuracyPercent: number;
};

export type ActivityDay = {
  day: string;
  count: number;
};

export type ProStats = {
  accuracyTrend: AccuracyTrendPoint[];
  categoryTrends: CategoryTrend[];
  weakest: CategoryRank | null;
  strongest: CategoryRank | null;
  difficulty: DifficultyAccuracy[];
  averageAnswerMs: number | null;
  timedAnswerCount: number;
  activity: ActivityDay[];
  retention: RetentionStats;
  masteryTrend: MasteryPoint[];
};

function reviewHistories(facts: AnswerFact[]): ReviewAttempt[][] {
  const grouped = new Map<string, ReviewAttempt[]>();
  for (const fact of facts) {
    if (!fact.questionId || Number.isNaN(fact.createdAt.getTime())) continue;
    const history = grouped.get(fact.questionId) ?? [];
    history.push({
      correct: fact.correct,
      usedHint: fact.usedHint ?? false,
      answeredAt: fact.createdAt,
    });
    grouped.set(fact.questionId, history);
  }
  return [...grouped.values()];
}

const DIFFICULTY_ORDER = ["easy", "medium", "hard"];

function emptyWeek(weekStart: string): CategoryWeekPoint {
  return {
    weekStart,
    answered: 0,
    correct: 0,
    accuracyPercent: null,
  };
}

export function emptyProStats(now = new Date(), timeZone = "UTC"): ProStats {
  return buildProStats([], now, timeZone);
}

export function buildProStats(
  facts: AnswerFact[],
  now = new Date(),
  timeZone = "UTC",
): ProStats {
  const today = dayKeyInTimeZone(now, timeZone);
  const trendStart = shiftDayKey(today, -(TREND_DAYS - 1)) ?? today;
  const trendDays = eachDayKey(trendStart, today);
  const trend = new Map<string, { answered: number; correct: number }>();
  for (const day of trendDays) trend.set(day, { answered: 0, correct: 0 });

  const currentWeek = weekStartKey(today) ?? today;
  const categoryWeekStart =
    shiftDayKey(currentWeek, -(CATEGORY_WEEKS - 1) * 7) ?? currentWeek;
  const categoryWeeks = eachDayKey(categoryWeekStart, currentWeek).filter(
    (day) => weekStartKey(day) === day,
  );
  const categories = new Map<
    string,
    {
      name: string;
      answered: number;
      correct: number;
      weeks: Map<string, { answered: number; correct: number }>;
    }
  >();

  const heatmapStart =
    shiftDayKey(currentWeek, -(HEATMAP_WEEKS - 1) * 7) ?? currentWeek;
  const activityDays = eachDayKey(heatmapStart, today);
  const activity = new Map<string, number>();
  for (const day of activityDays) activity.set(day, 0);

  const difficulties = new Map<string, { answered: number; correct: number }>();
  let timedTotal = 0;
  let timedCount = 0;

  for (const fact of facts) {
    if (Number.isNaN(fact.createdAt.getTime())) continue;
    const day = dayKeyInTimeZone(fact.createdAt, timeZone);
    if (activity.has(day)) activity.set(day, (activity.get(day) ?? 0) + 1);
    const trendBucket = trend.get(day);
    if (trendBucket) {
      trendBucket.answered += 1;
      if (fact.correct) trendBucket.correct += 1;
    }

    const category = categories.get(fact.categorySlug) ?? {
      name: fact.categoryName,
      answered: 0,
      correct: 0,
      weeks: new Map<string, { answered: number; correct: number }>(),
    };
    category.answered += 1;
    if (fact.correct) category.correct += 1;
    const week = weekStartKey(day);
    if (week && categoryWeeks.includes(week)) {
      const bucket = category.weeks.get(week) ?? { answered: 0, correct: 0 };
      bucket.answered += 1;
      if (fact.correct) bucket.correct += 1;
      category.weeks.set(week, bucket);
    }
    categories.set(fact.categorySlug, category);

    const difficultyKey = fact.difficulty.trim().toLowerCase() || "unknown";
    const difficulty = difficulties.get(difficultyKey) ?? {
      answered: 0,
      correct: 0,
    };
    difficulty.answered += 1;
    if (fact.correct) difficulty.correct += 1;
    difficulties.set(difficultyKey, difficulty);

    if (
      fact.responseMs != null &&
      fact.responseMs > 0 &&
      fact.responseMs <= MAX_ANSWER_MS
    ) {
      timedTotal += fact.responseMs;
      timedCount += 1;
    }
  }

  const ranked: CategoryRank[] = [...categories.entries()]
    .filter(([, category]) => category.answered >= MIN_CATEGORY_SAMPLE)
    .map(([slug, category]) => ({
      slug,
      name: category.name,
      answered: category.answered,
      correct: category.correct,
      accuracyPercent: accuracyPercent(category.correct, category.answered),
    }))
    .sort(
      (left, right) =>
        left.accuracyPercent - right.accuracyPercent ||
        left.answered - right.answered ||
        left.name.localeCompare(right.name),
    );

  const categoryTrends: CategoryTrend[] = [...categories.entries()]
    .filter(([, category]) =>
      [...category.weeks.values()].some((week) => week.answered > 0),
    )
    .map(([slug, category]) => ({
      slug,
      name: category.name,
      weeks: categoryWeeks.map((weekStart) => {
        const bucket = category.weeks.get(weekStart);
        if (!bucket || bucket.answered === 0) return emptyWeek(weekStart);
        return {
          weekStart,
          answered: bucket.answered,
          correct: bucket.correct,
          accuracyPercent: accuracyPercent(bucket.correct, bucket.answered),
        };
      }),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  const histories = reviewHistories(facts);
  return {
    accuracyTrend: trendDays.map((day) => {
      const bucket = trend.get(day) ?? { answered: 0, correct: 0 };
      return {
        day,
        answered: bucket.answered,
        correct: bucket.correct,
        accuracyPercent:
          bucket.answered > 0
            ? accuracyPercent(bucket.correct, bucket.answered)
            : null,
      };
    }),
    categoryTrends,
    weakest: ranked.length >= 2 ? (ranked[0] ?? null) : null,
    strongest:
      ranked.length >= 2
        ? (ranked[ranked.length - 1] ?? null)
        : (ranked[0] ?? null),
    difficulty: [...difficulties.entries()]
      .map(([difficulty, bucket]) => ({
        difficulty,
        answered: bucket.answered,
        correct: bucket.correct,
        accuracyPercent: accuracyPercent(bucket.correct, bucket.answered),
      }))
      .sort((left, right) => {
        const leftOrder = DIFFICULTY_ORDER.indexOf(left.difficulty);
        const rightOrder = DIFFICULTY_ORDER.indexOf(right.difficulty);
        return (
          (leftOrder === -1 ? DIFFICULTY_ORDER.length : leftOrder) -
            (rightOrder === -1 ? DIFFICULTY_ORDER.length : rightOrder) ||
          left.difficulty.localeCompare(right.difficulty)
        );
      }),
    averageAnswerMs:
      timedCount > 0 ? Math.round(timedTotal / timedCount) : null,
    timedAnswerCount: timedCount,
    activity: activityDays.map((day) => ({
      day,
      count: activity.get(day) ?? 0,
    })),
    retention: retentionFromHistories(histories, timeZone, now),
    masteryTrend: masteryTrendFromHistories(histories, now, timeZone),
  };
}

export function formatAnswerTime(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder === 0 ? `${minutes}m` : `${minutes}m ${remainder}s`;
}
