/**
 * Future Pro analytics. Nothing in the app calls these yet, and this module
 * does not read `users.plan`. When a Pro tier exists, implement the reads
 * here and decide who can see them at the call site.
 *
 * accuracyTrend — one point per day from `session_answers.created_at`.
 * weakestTopics — lowest-accuracy categories from `question_progress`
 *   (seen_count / correct_count) joined to questions and categories, after a
 *   category has enough answers to be meaningful.
 */
export type AccuracyTrendPoint = {
  day: string;
  answered: number;
  correct: number;
  accuracyPercent: number;
};

export type WeakTopic = {
  slug: string;
  name: string;
  answered: number;
  correct: number;
  accuracyPercent: number;
};

export type ProStats = {
  accuracyTrend: AccuracyTrendPoint[];
  weakestTopics: WeakTopic[];
};
