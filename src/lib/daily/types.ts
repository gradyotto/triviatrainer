export type DailyPhase =
  | "unavailable"
  | "ready"
  | "question"
  | "feedback"
  | "bonus"
  | "results";

export type DailyQuestionView = {
  id: string;
  prompt: string;
  categoryName: string;
  difficulty: string;
  hint: string | null;
  index: number;
  total: number;
};

export type DailyBonusFeedback = {
  prompt: string;
  response: string | null;
  correct: boolean;
  skipped: boolean;
  points: number;
  answer: string;
};

export type DailyFeedback = {
  correct: boolean;
  answer: string;
  explanation: string | null;
  response: string;
  points: number;
  basePoints: number;
  speedPoints: number;
  streakPoints: number;
  bonus: DailyBonusFeedback | null;
};

export type DailyResultQuestion = {
  prompt: string;
  response: string;
  correct: boolean;
  answer: string;
  points: number;
  bonusPoints: number;
};

export type DailyResultView = {
  gameDate: string;
  score: number;
  correctCount: number;
  total: number;
  basePoints: number;
  speedPoints: number;
  streakPoints: number;
  bonusPoints: number;
  rank: number | null;
  playerCount: number | null;
  shareText: string;
  questions: DailyResultQuestion[];
  nextStartsAt: string;
  posted: boolean;
};

export type DailyPageState = {
  available: boolean;
  reason: "no_database" | "no_questions" | null;
  gameDate: string | null;
  nextStartsAt: string | null;
  signedIn: boolean;
  needsUsername: boolean;
  username: string | null;
  accountsEnabled: boolean;
  phase: DailyPhase;
  score: number;
  question: DailyQuestionView | null;
  feedback: DailyFeedback | null;
  bonusPrompt: string | null;
  result: DailyResultView | null;
};
