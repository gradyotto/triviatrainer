import { dayKeyInTimeZone, normalizeTimeZone, shiftDayKey } from "@/lib/time/zone";
import type { BasicStats, CategoryAccuracy, RecentSession } from "./types";

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_STREAK_DAYS = 10000;

export function accuracyPercent(correct: number, answered: number): number {
  if (answered <= 0 || correct <= 0) return 0;
  return Math.min(100, Math.round((correct / answered) * 100));
}

export function utcDayKey(value: Date): string {
  return dayKeyInTimeZone(value, "UTC");
}

export function previousUtcDay(day: string): string | null {
  return shiftDayKey(day, -1);
}

/**
 * Consecutive calendar days with at least one answer, ending today in
 * `timeZone` (UTC when omitted). Yesterday still counts when today has no
 * answer yet. A gap before yesterday ends it. Days after `now` are ignored.
 */
export function currentDayStreak(
  dayKeys: string[],
  now = new Date(),
  timeZone = "UTC",
): number {
  const days = new Set(dayKeys.filter((day) => DAY.test(day)));
  const today = dayKeyInTimeZone(now, timeZone);
  const yesterday = shiftDayKey(today, -1);
  let cursor: string | null = days.has(today) ? today : yesterday;
  let streak = 0;
  while (cursor && days.has(cursor) && streak < MAX_STREAK_DAYS) {
    streak += 1;
    const previous = shiftDayKey(cursor, -1);
    if (!previous || previous === cursor) break;
    cursor = previous;
  }
  return streak;
}

export function formatZonedDate(value: Date, timeZone = "UTC"): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: normalizeTimeZone(timeZone),
  }).format(value);
}

export function formatUtcDate(value: Date): string {
  return formatZonedDate(value, "UTC");
}

export function emptyBasicStats(): BasicStats {
  return {
    questionsAnswered: 0,
    correctCount: 0,
    accuracyPercent: 0,
    dayStreak: 0,
    categories: [],
    recentSessions: [],
  };
}

export function buildBasicStats(input: {
  answered: number;
  correct: number;
  categories: Array<{
    slug: string;
    name: string;
    sortOrder: number;
    answered: number;
    correct: number;
  }>;
  answeredAt: Date[];
  sessions: Array<{
    id: string;
    startedAt: Date;
    setLabel: string;
    answered: number;
    correct: number;
  }>;
  now?: Date;
  timeZone?: string;
}): BasicStats {
  const answered = Math.max(0, Math.trunc(input.answered));
  const correct = Math.max(0, Math.trunc(input.correct));
  const categories: CategoryAccuracy[] = input.categories
    .filter((category) => category.answered > 0)
    .slice()
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        left.name.localeCompare(right.name),
    )
    .map((category) => ({
      slug: category.slug,
      name: category.name,
      answered: category.answered,
      correct: category.correct,
      accuracyPercent: accuracyPercent(category.correct, category.answered),
    }));
  const recentSessions: RecentSession[] = input.sessions
    .filter(
      (session) =>
        session.answered > 0 && !Number.isNaN(session.startedAt.getTime()),
    )
    .slice()
    .sort(
      (left, right) => right.startedAt.getTime() - left.startedAt.getTime(),
    )
    .slice(0, 10)
    .map((session) => ({
      id: session.id,
      startedAt: session.startedAt,
      setLabel: session.setLabel,
      answered: session.answered,
      correct: session.correct,
      accuracyPercent: accuracyPercent(session.correct, session.answered),
    }));

  return {
    questionsAnswered: answered,
    correctCount: correct,
    accuracyPercent: accuracyPercent(correct, answered),
    dayStreak: currentDayStreak(
      input.answeredAt.map((answeredAt) =>
        dayKeyInTimeZone(answeredAt, input.timeZone ?? "UTC"),
      ),
      input.now,
      input.timeZone ?? "UTC",
    ),
    categories,
    recentSessions,
  };
}
