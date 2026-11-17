/**
 * Spaced-repetition knobs. Review is available on Free and Pro; these are not
 * plan limits. A review answer still counts as a normal question against the
 * free daily cap in ./plans.ts.
 *
 * Ease is stored in hundredths (250 = 2.50), matching question_progress.
 *
 * Optional environment overrides:
 * - REVIEW_MAX_PER_SESSION (default 20)
 * - REVIEW_LAPSE_DELAY_MINUTES (default 10; 0 means due immediately)
 * - REVIEW_MASTERY_INTERVAL_DAYS (default 21)
 */

export type ReviewConfig = {
  maxReviewsPerSession: number;
  /** Starting ease factor in hundredths. SM-2's 2.5. */
  initialEase: number;
  /** Floor in hundredths. SM-2's 1.3. */
  minimumEase: number;
  /** A wrong answer is due again after this many minutes. */
  lapseDelayMinutes: number;
  /** Interval after the first successful review in a streak. */
  firstIntervalDays: number;
  /** Interval after the second successful review in a streak. */
  secondIntervalDays: number;
  /** A question is mastered once its interval reaches this many days. */
  masteryIntervalDays: number;
  /** SM-2 qualities below this reset the streak. */
  passingQuality: number;
};

function readInt(name: string, fallback: number, minimum: number): number {
  const raw = process.env[name]?.trim();
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum) return fallback;
  return value;
}

export function getReviewConfig(): ReviewConfig {
  return {
    maxReviewsPerSession: readInt("REVIEW_MAX_PER_SESSION", 20, 1),
    initialEase: 250,
    minimumEase: 130,
    lapseDelayMinutes: readInt("REVIEW_LAPSE_DELAY_MINUTES", 10, 0),
    firstIntervalDays: 1,
    secondIntervalDays: 6,
    masteryIntervalDays: readInt("REVIEW_MASTERY_INTERVAL_DAYS", 21, 1),
    passingQuality: 3,
  };
}
