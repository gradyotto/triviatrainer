import { scoreAnswer } from "@/config/scoring";
import { mergeAccepted } from "@/lib/answers/deterministic";

export type DailyChainAnswer = {
  id: string;
  ordinal: number;
  isCorrect: boolean;
  basePoints: number;
  speedPoints: number;
  streakPoints: number;
  points: number;
  elapsedMs: number | null;
  bonusPoints: number;
  difficulty: string;
};

/**
 * Mark one daily answer correct and rebuild streak points for the rest of
 * that attempt. Base and speed on answers that were already correct stay put.
 * The attempt score is the sum of `points` and `bonusPoints`.
 */
export function regradeDailyChain(
  answers: readonly DailyChainAnswer[],
  correctedId: string,
): DailyChainAnswer[] {
  const ordered = [...answers].sort((left, right) => left.ordinal - right.ordinal);
  let streak = 0;
  return ordered.map((answer) => {
    const correct = answer.id === correctedId ? true : answer.isCorrect;
    if (!correct) {
      streak = 0;
      return {
        ...answer,
        isCorrect: false,
        basePoints: 0,
        speedPoints: 0,
        streakPoints: 0,
        points: 0,
      };
    }
    const scored = scoreAnswer({
      correct: true,
      difficulty: answer.difficulty,
      elapsedMs: answer.elapsedMs ?? 20_000,
      streakBefore: streak,
    });
    streak = scored.streakAfter;
    if (answer.id === correctedId) {
      return {
        ...answer,
        isCorrect: true,
        basePoints: scored.basePoints,
        speedPoints: scored.speedPoints,
        streakPoints: scored.streakPoints,
        points: scored.points,
      };
    }
    return {
      ...answer,
      isCorrect: true,
      streakPoints: scored.streakPoints,
      points: answer.basePoints + answer.speedPoints + scored.streakPoints,
    };
  });
}

export function dailyChainScore(answers: readonly DailyChainAnswer[]): {
  score: number;
  correctCount: number;
} {
  return {
    score: answers.reduce((sum, answer) => sum + answer.points + answer.bonusPoints, 0),
    correctCount: answers.filter((answer) => answer.isCorrect).length,
  };
}

export function aliasesAfterAccept(
  answer: string,
  aliases: readonly string[],
  userAnswer: string,
): string[] {
  return mergeAccepted(answer, [...aliases, userAnswer]);
}
