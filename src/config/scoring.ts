/**
 * Daily Challenge scoring. Every knob used by the scorer lives here.
 * A correct answer is (base + speed bonus) × difficulty, plus a streak bonus.
 * Speed falls linearly from `speedBonusMax` to 0 across `speedWindowMs`.
 * The streak bonus is 10 points times the current run of correct answers,
 * including the answer just scored, and it stops growing at `streakBonusCap`.
 * A wrong answer scores 0 and resets the streak. Bonus follow-ups are flat.
 */

export const SCORING = {
  basePoints: 100,
  speedBonusMax: 50,
  speedWindowMs: 20_000,
  multipliers: {
    easy: 1,
    medium: 1.5,
    hard: 2,
  },
  streakBonusPerCorrect: 10,
  streakBonusCap: 50,
  bonusPoints: 50,
  questionCount: 10,
  repeatWindowDays: 60,
  timeZone: "America/Phoenix",
} as const;

export type ScoringConfig = {
  basePoints: number;
  speedBonusMax: number;
  speedWindowMs: number;
  multipliers: { easy: number; medium: number; hard: number };
  streakBonusPerCorrect: number;
  streakBonusCap: number;
  bonusPoints: number;
  questionCount: number;
  repeatWindowDays: number;
  timeZone: string;
};

export type DifficultyBand = keyof typeof SCORING.multipliers;

export function getScoringConfig(): ScoringConfig {
  return SCORING;
}

export function difficultyMultiplier(
  difficulty: string,
  config: ScoringConfig = SCORING,
): number {
  const key = difficulty.trim().toLowerCase();
  if (key === "easy" || key === "medium" || key === "hard") {
    return config.multipliers[key];
  }
  return config.multipliers.medium;
}

export function speedBonus(
  elapsedMs: number,
  config: ScoringConfig = SCORING,
): number {
  const elapsed = Number.isFinite(elapsedMs)
    ? Math.max(0, elapsedMs)
    : config.speedWindowMs;
  if (elapsed >= config.speedWindowMs) return 0;
  return config.speedBonusMax * (1 - elapsed / config.speedWindowMs);
}

export type AnswerScore = {
  points: number;
  basePoints: number;
  speedPoints: number;
  streakPoints: number;
  multiplierHundredths: number;
  streakAfter: number;
};

/**
 * `streakBefore` is the number of correct answers in a row immediately
 * before this one. Components are rounded so they sum to `points`.
 */
export function scoreAnswer(
  input: {
    correct: boolean;
    difficulty: string;
    elapsedMs: number;
    streakBefore: number;
  },
  config: ScoringConfig = SCORING,
): AnswerScore {
  const multiplier = difficultyMultiplier(input.difficulty, config);
  const multiplierHundredths = Math.round(multiplier * 100);
  if (!input.correct) {
    return {
      points: 0,
      basePoints: 0,
      speedPoints: 0,
      streakPoints: 0,
      multiplierHundredths,
      streakAfter: 0,
    };
  }

  const streakAfter = Math.max(0, input.streakBefore) + 1;
  const streakAward = Math.min(
    config.streakBonusCap,
    streakAfter * config.streakBonusPerCorrect,
  );
  const baseAward = config.basePoints * multiplier;
  const speedAward = speedBonus(input.elapsedMs, config) * multiplier;
  const points = Math.round(baseAward + speedAward + streakAward);
  const basePoints = Math.round(baseAward);
  const streakPoints = Math.round(streakAward);
  const speedPoints = points - basePoints - streakPoints;
  return {
    points,
    basePoints,
    speedPoints,
    streakPoints,
    multiplierHundredths,
    streakAfter,
  };
}

export function scoreBonus(
  correct: boolean,
  config: ScoringConfig = SCORING,
): number {
  return correct ? config.bonusPoints : 0;
}
