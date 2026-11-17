export type CategoryAccuracy = {
  slug: string;
  name: string;
  answered: number;
  correct: number;
  accuracyPercent: number;
};

export type RecentSession = {
  id: string;
  startedAt: Date;
  setLabel: string;
  answered: number;
  correct: number;
  accuracyPercent: number;
};

export type MasteryStats = {
  learning: number;
  mastered: number;
  dueToday: number;
};

export type BasicStats = {
  questionsAnswered: number;
  correctCount: number;
  accuracyPercent: number;
  dayStreak: number;
  categories: CategoryAccuracy[];
  recentSessions: RecentSession[];
  mastery: MasteryStats;
};
