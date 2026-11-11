import type { BasicStats, CategoryAccuracy, RecentSession } from "./types";

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_STREAK_DAYS = 10000;

const sessionDateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function accuracyPercent(correct: number, answered: number): number {
  if (answered <= 0 || correct <= 0) return 0;
  return Math.min(100, Math.round((correct / answered) * 100));
}

export function utcDayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function previousUtcDay(day: string): string | null {
  const match = DAY.exec(day);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, date));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== date
  ) {
    return null;
  }
  utc.setUTCDate(utc.getUTCDate() - 1);
  return utc.toISOString().slice(0, 10);
}

/**
 * Consecutive UTC days with at least one answer, ending today. Yesterday
 * still counts when today has no answer yet. A gap before yesterday ends it.
 * Days after `now` are ignored.
 */
export function currentDayStreak(dayKeys: string[], now = new Date()): number {
  const days = new Set(dayKeys.filter((day) => DAY.test(day)));
  const today = utcDayKey(now);
  const yesterday = previousUtcDay(today);
  let cursor: string | null = days.has(today) ? today : yesterday;
  let streak = 0;
  while (cursor && days.has(cursor) && streak < MAX_STREAK_DAYS) {
    streak += 1;
    const previous = previousUtcDay(cursor);
    if (!previous || previous === cursor) break;
    cursor = previous;
  }
  return streak;
}

export function formatUtcDate(value: Date): string {
  return sessionDateFormat.format(value);
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
      input.answeredAt.map((answeredAt) => utcDayKey(answeredAt)),
      input.now,
    ),
    categories,
    recentSessions,
  };
}
