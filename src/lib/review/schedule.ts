import { getReviewConfig, type ReviewConfig } from "@/config/review";
import {
  dayKeyInTimeZone,
  eachDayKey,
  shiftDayKey,
  zonedDayBounds,
} from "@/lib/time/zone";

export type ScheduleState = {
  easeFactor: number;
  intervalDays: number;
  repetition: number;
  lapses: number;
  nextReviewAt: Date | null;
};

export type ReviewAttempt = {
  correct: boolean;
  usedHint: boolean;
  answeredAt: Date;
};

const TREND_DAYS = 30;

export function initialSchedule(config = getReviewConfig()): ScheduleState {
  return {
    easeFactor: config.initialEase,
    intervalDays: 0,
    repetition: 0,
    lapses: 0,
    nextReviewAt: null,
  };
}

/**
 * SM-2 quality from a trivia answer. 4 is a clean correct (ease stays put),
 * 3 is correct with a hint, and 1 is a miss.
 */
export function qualityForAnswer(correct: boolean, usedHint: boolean): number {
  if (!correct) return 1;
  if (usedHint) return 3;
  return 4;
}

function adjustEase(ease: number, quality: number, minimum: number): number {
  const gap = 5 - quality;
  const delta = 10 - gap * (8 + gap * 2);
  return Math.max(minimum, ease + delta);
}

function nextIntervalDays(
  repetition: number,
  intervalDays: number,
  ease: number,
  config: ReviewConfig,
): number {
  if (repetition <= 0) return config.firstIntervalDays;
  if (repetition === 1) return config.secondIntervalDays;
  return Math.max(1, Math.round((intervalDays * ease) / 100));
}

function dueAtLocalDay(
  answeredAt: Date,
  intervalDays: number,
  timeZone: string,
): Date {
  const dueDay = shiftDayKey(dayKeyInTimeZone(answeredAt, timeZone), intervalDays);
  const bounds = dueDay ? zonedDayBounds(dueDay, timeZone) : null;
  if (bounds) return bounds.start;
  return new Date(answeredAt.getTime() + intervalDays * 86_400_000);
}

/**
 * One SM-2 step. A miss resets the streak and is due again after the lapse
 * delay. A pass schedules the next review at the start of a local calendar
 * day `interval` days later, in the user's time zone.
 */
export function applyReview(
  state: ScheduleState,
  input: ReviewAttempt & { timeZone: string },
  config = getReviewConfig(),
): ScheduleState {
  const quality = qualityForAnswer(input.correct, input.usedHint);
  const easeFactor = adjustEase(state.easeFactor, quality, config.minimumEase);
  if (quality < config.passingQuality) {
    return {
      easeFactor,
      intervalDays: 0,
      repetition: 0,
      lapses: state.lapses + 1,
      nextReviewAt: new Date(
        input.answeredAt.getTime() + config.lapseDelayMinutes * 60_000,
      ),
    };
  }
  const intervalDays = nextIntervalDays(
    state.repetition,
    state.intervalDays,
    easeFactor,
    config,
  );
  return {
    easeFactor,
    intervalDays,
    repetition: state.repetition + 1,
    lapses: state.lapses,
    nextReviewAt: dueAtLocalDay(input.answeredAt, intervalDays, input.timeZone),
  };
}

export function replaySchedule(
  attempts: ReviewAttempt[],
  timeZone: string,
  config = getReviewConfig(),
): ScheduleState {
  const ordered = attempts
    .filter((attempt) => !Number.isNaN(attempt.answeredAt.getTime()))
    .slice()
    .sort((left, right) => left.answeredAt.getTime() - right.answeredAt.getTime());
  return ordered.reduce(
    (state, attempt) => applyReview(state, { ...attempt, timeZone }, config),
    initialSchedule(config),
  );
}

export function isMastered(
  intervalDays: number,
  config = getReviewConfig(),
): boolean {
  return intervalDays >= config.masteryIntervalDays;
}

/** Exclusive end of the user's current local day. */
export function endOfLocalDay(now: Date, timeZone: string): Date {
  const bounds = zonedDayBounds(dayKeyInTimeZone(now, timeZone), timeZone);
  if (bounds) return bounds.end;
  return new Date(now.getTime() + 86_400_000);
}

/** Due today includes overdue cards and anything scheduled later today. */
export function isDueToday(
  nextReviewAt: Date | null,
  now: Date,
  timeZone: string,
): boolean {
  if (!nextReviewAt || Number.isNaN(nextReviewAt.getTime())) return false;
  return nextReviewAt.getTime() < endOfLocalDay(now, timeZone).getTime();
}

export function nextScheduledReview(
  dates: Array<Date | null>,
  now: Date,
  timeZone: string,
): Date | null {
  const cutoff = endOfLocalDay(now, timeZone).getTime();
  let best: Date | null = null;
  for (const date of dates) {
    if (!date || Number.isNaN(date.getTime()) || date.getTime() < cutoff) continue;
    if (!best || date.getTime() < best.getTime()) best = date;
  }
  return best;
}

export function formatReviewWait(now: Date, next: Date): string {
  const ms = next.getTime() - now.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (ms < hour) {
    const minutes = Math.max(1, Math.round(ms / minute));
    return minutes === 1 ? "1 minute" : `${minutes} minutes`;
  }
  if (ms < day) {
    const hours = Math.max(1, Math.round(ms / hour));
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  const days = Math.max(1, Math.round(ms / day));
  return days === 1 ? "1 day" : `${days} days`;
}

export function summarizeMastery(
  rows: Array<{
    seenCount: number;
    intervalDays: number;
    nextReviewAt: Date | null;
  }>,
  now: Date,
  timeZone: string,
  config = getReviewConfig(),
): { learning: number; mastered: number; dueToday: number } {
  let learning = 0;
  let mastered = 0;
  let dueToday = 0;
  for (const row of rows) {
    if (row.seenCount <= 0) continue;
    if (isMastered(row.intervalDays, config)) mastered += 1;
    else learning += 1;
    if (isDueToday(row.nextReviewAt, now, timeZone)) dueToday += 1;
  }
  return { learning, mastered, dueToday };
}

export type RetentionStats = {
  reviews: number;
  correct: number;
  percent: number | null;
};

function ratioPercent(correct: number, total: number): number | null {
  if (total <= 0) return null;
  if (correct <= 0) return 0;
  return Math.min(100, Math.round((correct / total) * 100));
}

/**
 * Retention is the share of answers given when that question was already due.
 * The first time someone sees a question is practice, not a review.
 */
export function retentionFromHistories(
  histories: ReviewAttempt[][],
  timeZone: string,
  now = new Date(),
  config = getReviewConfig(),
): RetentionStats {
  let reviews = 0;
  let correct = 0;
  for (const history of histories) {
    const ordered = history
      .filter(
        (attempt) =>
          !Number.isNaN(attempt.answeredAt.getTime()) &&
          attempt.answeredAt.getTime() <= now.getTime(),
      )
      .slice()
      .sort((left, right) => left.answeredAt.getTime() - right.answeredAt.getTime());
    let state = initialSchedule(config);
    for (const attempt of ordered) {
      const due =
        state.nextReviewAt != null &&
        state.nextReviewAt.getTime() <= attempt.answeredAt.getTime();
      if (due) {
        reviews += 1;
        if (attempt.correct) correct += 1;
      }
      state = applyReview(state, { ...attempt, timeZone }, config);
    }
  }
  return { reviews, correct, percent: ratioPercent(correct, reviews) };
}

export type MasteryPoint = {
  day: string;
  learning: number;
  mastered: number;
};

export function masteryTrendFromHistories(
  histories: ReviewAttempt[][],
  now: Date,
  timeZone: string,
  config = getReviewConfig(),
): MasteryPoint[] {
  const today = dayKeyInTimeZone(now, timeZone);
  const start = shiftDayKey(today, -(TREND_DAYS - 1)) ?? today;
  const days = eachDayKey(start, today);
  const orderedHistories = histories.map((history) =>
    history
      .filter((attempt) => !Number.isNaN(attempt.answeredAt.getTime()))
      .slice()
      .sort((left, right) => left.answeredAt.getTime() - right.answeredAt.getTime()),
  );

  return days.map((day) => {
    const bounds = zonedDayBounds(day, timeZone);
    const cutoff = bounds?.end.getTime() ?? Number.POSITIVE_INFINITY;
    let learning = 0;
    let mastered = 0;
    for (const history of orderedHistories) {
      let state = initialSchedule(config);
      let seen = false;
      for (const attempt of history) {
        if (attempt.answeredAt.getTime() >= cutoff) break;
        if (attempt.answeredAt.getTime() > now.getTime()) break;
        state = applyReview(state, { ...attempt, timeZone }, config);
        seen = true;
      }
      if (!seen) continue;
      if (isMastered(state.intervalDays, config)) mastered += 1;
      else learning += 1;
    }
    return { day, learning, mastered };
  });
}

export type BackfillPlan = {
  action: "skip" | "update" | "insert";
  schedule: ScheduleState;
  seenCount: number;
  correctCount: number;
  incorrectCount: number;
  streak: number;
  lastAnsweredAt: Date | null;
  lastCorrect: boolean | null;
};

function countAttempts(attempts: ReviewAttempt[]): Omit<
  BackfillPlan,
  "action" | "schedule"
> {
  let correctCount = 0;
  let streak = 0;
  for (const attempt of attempts) {
    if (attempt.correct) {
      correctCount += 1;
      streak += 1;
    } else {
      streak = 0;
    }
  }
  const last = attempts[attempts.length - 1];
  return {
    seenCount: attempts.length,
    correctCount,
    incorrectCount: attempts.length - correctCount,
    streak,
    lastAnsweredAt: last?.answeredAt ?? null,
    lastCorrect: last ? last.correct : null,
  };
}

/**
 * Rows that already have a due date are left alone so a re-run does not
 * overwrite schedules the live train loop has moved. Everything else is
 * replayed from the answer log.
 */
export function planScheduleBackfill(input: {
  attempts: ReviewAttempt[];
  timeZone: string;
  hasProgressRow: boolean;
  nextReviewAt: Date | null;
  config?: ReviewConfig;
}): BackfillPlan {
  const attempts = input.attempts
    .filter((attempt) => !Number.isNaN(attempt.answeredAt.getTime()))
    .slice()
    .sort((left, right) => left.answeredAt.getTime() - right.answeredAt.getTime());
  const schedule = replaySchedule(attempts, input.timeZone, input.config);
  const counts = countAttempts(attempts);
  if (attempts.length === 0 || (input.hasProgressRow && input.nextReviewAt)) {
    return { action: "skip", schedule, ...counts };
  }
  return {
    action: input.hasProgressRow ? "update" : "insert",
    schedule,
    ...counts,
  };
}
