import { isDueToday } from "@/lib/review/schedule";

export type QueueCandidate = {
  questionId: string;
  nextReviewAt: Date | null;
  easeFactor: number;
  correctCount: number;
  seenCount: number;
  incorrectCount: number;
  lastCorrect: boolean | null;
  lastAnsweredAt: Date | null;
};

function accuracy(candidate: QueueCandidate): number {
  if (candidate.seenCount <= 0) return 1;
  return candidate.correctCount / candidate.seenCount;
}

/** Most overdue first, then the weakest ease, accuracy, and miss count. */
function compareDue(left: QueueCandidate, right: QueueCandidate): number {
  const leftDue = left.nextReviewAt?.getTime() ?? 0;
  const rightDue = right.nextReviewAt?.getTime() ?? 0;
  if (leftDue !== rightDue) return leftDue - rightDue;
  if (left.easeFactor !== right.easeFactor) return left.easeFactor - right.easeFactor;
  const leftAccuracy = accuracy(left);
  const rightAccuracy = accuracy(right);
  if (leftAccuracy !== rightAccuracy) return leftAccuracy - rightAccuracy;
  if (left.incorrectCount !== right.incorrectCount) {
    return right.incorrectCount - left.incorrectCount;
  }
  return left.questionId.localeCompare(right.questionId);
}

function compareMissed(left: QueueCandidate, right: QueueCandidate): number {
  const leftAt = left.lastAnsweredAt?.getTime() ?? 0;
  const rightAt = right.lastAnsweredAt?.getTime() ?? 0;
  if (leftAt !== rightAt) return rightAt - leftAt;
  return left.questionId.localeCompare(right.questionId);
}

/**
 * Due questions come first. When at least one is due and the session still
 * has room, recently missed questions that are not due yet fill the rest.
 * An empty due set stays empty so the caller can show the caught-up state.
 */
export function buildReviewSelection(
  candidates: QueueCandidate[],
  now: Date,
  timeZone: string,
  limit: number,
): { orderedIds: string[]; dueCount: number } {
  const due = candidates
    .filter((candidate) => isDueToday(candidate.nextReviewAt, now, timeZone))
    .slice()
    .sort(compareDue);
  const cap = Math.max(0, Math.trunc(limit));
  const chosen = due.slice(0, cap);
  if (chosen.length > 0 && chosen.length < cap) {
    const chosenIds = new Set(chosen.map((candidate) => candidate.questionId));
    const misses = candidates
      .filter(
        (candidate) =>
          candidate.lastCorrect === false && !chosenIds.has(candidate.questionId),
      )
      .slice()
      .sort(compareMissed);
    for (const miss of misses) {
      if (chosen.length >= cap) break;
      chosen.push(miss);
    }
  }
  return {
    orderedIds: chosen.map((candidate) => candidate.questionId),
    dueCount: due.length,
  };
}
