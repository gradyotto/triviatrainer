/** Empty-state sentence. `nextReviewLabel` is already a phrase like "2 days". */
export function caughtUpCopy(nextReviewLabel: string | null): string {
  if (nextReviewLabel) {
    return `All caught up, next review in ${nextReviewLabel}`;
  }
  return "All caught up";
}
