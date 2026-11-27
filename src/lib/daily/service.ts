import { and, asc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { SCORING, scoreAnswer, scoreBonus } from "@/config/scoring";
import { getDb, isDatabaseConfigured } from "@/db";
import {
  categories,
  dailyAnswers,
  dailyAttempts,
  dailyChallenges,
  questions,
} from "@/db/schema";
import {
  answerWithoutBonus,
  containedBonusNote,
  maskBonusText,
} from "@/lib/bonus-reveal";
import { imageBeforeAnswer, toArtworkImage, type ArtworkImage } from "@/lib/artwork/reveal";
import { gradeWithSemantics } from "@/lib/grade-answer";
import { gradeResponse, responseCoversAny } from "@/lib/grading";
import { isClerkConfigured } from "@/lib/env";
import { trackSafely } from "@/lib/tracking/track";
import type { UserRecord } from "@/lib/users";
import { aliasBrowserIdentity, aliasPostHogGuest } from "@/lib/tracking/posthog";
import { challengeRank } from "./leaderboard";
import { dailyGameDate, nextDailyStart, repeatCutoff } from "./day";
import { selectDailyQuestionIds } from "./select";
import { dailyShareText } from "./share";
import type {
  DailyFeedback,
  DailyPageState,
  DailyQuestionView,
  DailyResultView,
} from "./types";

type Actor = {
  user: UserRecord | null;
  guestId: string | null;
};

type PlayQuestion = {
  id: string;
  prompt: string;
  answer: string;
  aliases: string[];
  explanation: string | null;
  difficulty: string;
  hint: string | null;
  categoryName: string;
  bonusPrompt: string | null;
  bonusAnswers: string[];
  imageUrl: string | null;
  imageAlt: string | null;
  imageCredit: string | null;
};

type AttemptRow = typeof dailyAttempts.$inferSelect;
type AnswerRow = typeof dailyAnswers.$inferSelect;

function asDate(value: Date | string | null | undefined): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function actorKey(actor: Actor): string | null {
  return actor.user?.id ?? actor.guestId;
}

function emptyState(actor: Actor, reason: DailyPageState["reason"]): DailyPageState {
  return {
    available: false,
    reason,
    gameDate: null,
    nextStartsAt: null,
    signedIn: Boolean(actor.user),
    needsUsername: Boolean(actor.user && !actor.user.username),
    username: actor.user?.username ?? null,
    accountsEnabled: isClerkConfigured(),
    phase: "unavailable",
    score: 0,
    question: null,
    feedback: null,
    bonusPrompt: null,
    result: null,
  };
}

async function loadPlayQuestions(ids: string[]): Promise<PlayQuestion[]> {
  if (ids.length === 0) return [];
  const db = getDb();
  const rows = await db
    .select({
      id: questions.id,
      prompt: questions.prompt,
      answer: questions.answer,
      aliases: questions.answerAliases,
      explanation: questions.explanation,
      difficulty: questions.difficulty,
      hint: questions.hint,
      categoryName: categories.name,
      bonusPrompt: questions.bonusPrompt,
      bonusAnswers: questions.bonusAnswers,
      imageUrl: questions.imageUrl,
      imageAlt: questions.imageAlt,
      imageCredit: questions.imageCredit,
    })
    .from(questions)
    .innerJoin(categories, eq(questions.categoryId, categories.id))
    .where(inArray(questions.id, ids));

  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    if (!row) return [];
    return [
      {
        id: row.id,
        prompt: row.prompt,
        answer: row.answer,
        aliases: row.aliases ?? [],
        explanation: row.explanation,
        difficulty: row.difficulty,
        hint: row.hint,
        categoryName: row.categoryName,
        bonusPrompt: row.bonusPrompt,
        bonusAnswers: row.bonusAnswers ?? [],
        imageUrl: row.imageUrl,
        imageAlt: row.imageAlt,
        imageCredit: row.imageCredit,
      },
    ];
  });
}

async function ensureChallenge(now: Date): Promise<{
  id: string;
  gameDate: string;
  questions: PlayQuestion[];
} | null> {
  const db = getDb();
  const gameDate = dailyGameDate(now);
  const existing = await db
    .select()
    .from(dailyChallenges)
    .where(eq(dailyChallenges.gameDate, gameDate))
    .limit(1);
  // A day that already exists keeps its stored question list, including sets
  // created when the daily length was 20. New days use SCORING.questionCount.
  if (existing[0]) {
    const questionsForDay = await loadPlayQuestions(existing[0].questionIds ?? []);
    return { id: existing[0].id, gameDate, questions: questionsForDay };
  }

  const eligible = await db
    .select({
      id: questions.id,
      categorySlug: categories.slug,
      difficulty: questions.difficulty,
    })
    .from(questions)
    .innerJoin(categories, eq(questions.categoryId, categories.id))
    .where(and(eq(questions.type, "fill_in"), eq(questions.isActive, true)));
  if (eligible.length === 0) return null;

  const cutoff = repeatCutoff(gameDate, SCORING.repeatWindowDays);
  const recentRows = cutoff
    ? await db
        .select({
          questionIds: dailyChallenges.questionIds,
        })
        .from(dailyChallenges)
        .where(
          and(
            gte(dailyChallenges.gameDate, cutoff),
            lt(dailyChallenges.gameDate, gameDate),
          ),
        )
    : [];
  const recentlyUsedIds = recentRows.flatMap((row) => row.questionIds ?? []);
  const questionIds = selectDailyQuestionIds({
    gameDate,
    candidates: eligible,
    recentlyUsedIds,
  });
  if (questionIds.length === 0) return null;

  const inserted = await db
    .insert(dailyChallenges)
    .values({ gameDate, questionIds })
    .onConflictDoNothing({ target: dailyChallenges.gameDate })
    .returning();
  const challenge =
    inserted[0] ??
    (
      await db
        .select()
        .from(dailyChallenges)
        .where(eq(dailyChallenges.gameDate, gameDate))
        .limit(1)
    )[0];
  if (!challenge) return null;
  const questionsForDay = await loadPlayQuestions(challenge.questionIds ?? []);
  return { id: challenge.id, gameDate, questions: questionsForDay };
}

async function findAttempt(
  challengeId: string,
  actor: Actor,
): Promise<AttemptRow | null> {
  const db = getDb();
  if (actor.user) {
    const rows = await db
      .select()
      .from(dailyAttempts)
      .where(
        and(
          eq(dailyAttempts.challengeId, challengeId),
          eq(dailyAttempts.userId, actor.user.id),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }
  if (!actor.guestId) return null;
  const rows = await db
    .select()
    .from(dailyAttempts)
    .where(
      and(
        eq(dailyAttempts.challengeId, challengeId),
        eq(dailyAttempts.anonymousId, actor.guestId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

async function attemptAnswers(attemptId: string): Promise<AnswerRow[]> {
  return getDb()
    .select()
    .from(dailyAnswers)
    .where(eq(dailyAnswers.attemptId, attemptId))
    .orderBy(asc(dailyAnswers.ordinal));
}

function artworkFor(question: PlayQuestion) {
  return toArtworkImage({
    url: question.imageUrl,
    alt: question.imageAlt,
    credit: question.imageCredit,
    prompt: question.prompt,
    answer: question.answer,
  });
}

function questionView(
  question: PlayQuestion,
  index: number,
  total: number,
): DailyQuestionView {
  return {
    id: question.id,
    prompt: question.prompt,
    categoryName: question.categoryName,
    difficulty: question.difficulty,
    hint: question.hint,
    index,
    total,
    image: imageBeforeAnswer({
      url: question.imageUrl,
      alt: question.imageAlt,
      credit: question.imageCredit,
      prompt: question.prompt,
      answer: question.answer,
    }),
  };
}

function feedbackFor(
  question: PlayQuestion,
  answer: AnswerRow,
  revealBonus: boolean,
): DailyFeedback {
  const pendingBonus = !answer.bonusResolved && question.bonusAnswers.length > 0;
  const revealFull = revealBonus || !pendingBonus;
  const bonusPlayed =
    answer.bonusCorrect !== null ||
    answer.bonusSkipped ||
    Boolean(answer.bonusResponse) ||
    answer.bonusPoints > 0;
  const autoAwarded =
    bonusPlayed &&
    Boolean(answer.bonusCorrect) &&
    !answer.bonusSkipped &&
    !answer.bonusResponse &&
    answer.bonusPoints > 0;
  const bonus =
    revealBonus && bonusPlayed && question.bonusPrompt
      ? {
          prompt: question.bonusPrompt,
          response: answer.bonusResponse,
          correct: Boolean(answer.bonusCorrect),
          skipped: answer.bonusSkipped,
          points: answer.bonusPoints,
          answer: question.bonusAnswers[0] ?? "",
          note: autoAwarded
            ? containedBonusNote(question.bonusPrompt, answer.bonusPoints)
            : null,
        }
      : null;
  const artwork = artworkFor(question);
  const image: ArtworkImage | null =
    artwork && (artwork.timing === "before" || revealFull) ? artwork.image : null;
  return {
    correct: answer.isCorrect,
    answer: revealFull
      ? question.answer
      : answerWithoutBonus(question.answer, question.bonusAnswers),
    explanation: revealFull
      ? question.explanation
      : maskBonusText(question.explanation, question.bonusAnswers),
    response: answer.response,
    points: answer.points,
    basePoints: answer.basePoints,
    speedPoints: answer.speedPoints,
    streakPoints: answer.streakPoints,
    bonus,
    image,
  };
}

async function resultView(
  actor: Actor,
  challengeId: string,
  gameDate: string,
  playQuestions: PlayQuestion[],
  answers: AnswerRow[],
  now: Date,
): Promise<DailyResultView> {
  const byOrdinal = new Map(answers.map((answer) => [answer.ordinal, answer]));
  const marks: boolean[] = [];
  const listed = playQuestions.flatMap((question, index) => {
    const answer = byOrdinal.get(index);
    if (!answer) return [];
    marks.push(answer.isCorrect);
    const autoAwarded =
      Boolean(answer.bonusCorrect) &&
      !answer.bonusSkipped &&
      !answer.bonusResponse &&
      answer.bonusPoints > 0;
    const bonusPlayed =
      answer.bonusCorrect !== null ||
      answer.bonusSkipped ||
      Boolean(answer.bonusResponse) ||
      answer.bonusPoints > 0;
    const artwork = artworkFor(question);
    return [
      {
        prompt: question.prompt,
        response: answer.response,
        correct: answer.isCorrect,
        answer: question.answer,
        points: answer.points + answer.bonusPoints,
        bonusPoints: answer.bonusPoints,
        bonusResponse: bonusPlayed ? answer.bonusResponse : null,
        bonusAnswer: bonusPlayed ? (question.bonusAnswers[0] ?? "") : null,
        bonusNote: autoAwarded
          ? containedBonusNote(question.bonusPrompt, answer.bonusPoints)
          : null,
        image: artwork?.image ?? null,
      },
    ];
  });
  const score = answers.reduce(
    (sum, answer) => sum + answer.points + answer.bonusPoints,
    0,
  );
  const correctCount = answers.filter((answer) => answer.isCorrect).length;
  const posted = Boolean(actor.user?.username);
  const standing =
    actor.user && posted
      ? await challengeRank({
          challengeId,
          userId: actor.user.id,
          username: actor.user.username,
        })
      : null;
  const next = nextDailyStart(now);
  return {
    gameDate,
    score,
    correctCount,
    total: playQuestions.length,
    basePoints: answers.reduce((sum, answer) => sum + answer.basePoints, 0),
    speedPoints: answers.reduce((sum, answer) => sum + answer.speedPoints, 0),
    streakPoints: answers.reduce((sum, answer) => sum + answer.streakPoints, 0),
    bonusPoints: answers.reduce((sum, answer) => sum + answer.bonusPoints, 0),
    rank: standing?.rank ?? null,
    playerCount: standing?.playerCount ?? null,
    shareText: dailyShareText({
      gameDate,
      score,
      correct: correctCount,
      total: playQuestions.length,
      marks,
    }),
    questions: listed,
    nextStartsAt: next?.toISOString() ?? new Date(now.getTime() + 86_400_000).toISOString(),
    posted,
  };
}

async function present(
  actor: Actor,
  challenge: { id: string; gameDate: string; questions: PlayQuestion[] },
  attempt: AttemptRow | null,
  now: Date,
): Promise<DailyPageState> {
  const next = nextDailyStart(now);
  const shared = {
    available: true,
    reason: null,
    gameDate: challenge.gameDate,
    nextStartsAt: next?.toISOString() ?? null,
    signedIn: Boolean(actor.user),
    needsUsername: Boolean(actor.user && !actor.user.username),
    username: actor.user?.username ?? null,
    accountsEnabled: isClerkConfigured(),
    score: attempt?.score ?? 0,
    question: null,
    feedback: null,
    bonusPrompt: null,
    result: null,
  } satisfies Omit<DailyPageState, "phase">;

  if (!attempt) {
    return { ...shared, phase: "ready" };
  }
  if (attempt.status === "completed") {
    const answers = await attemptAnswers(attempt.id);
    return {
      ...shared,
      phase: "results",
      score: attempt.score,
      result: await resultView(
        actor,
        challenge.id,
        challenge.gameDate,
        challenge.questions,
        answers,
        now,
      ),
    };
  }

  const index = Math.min(
    Math.max(attempt.currentIndex, 0),
    Math.max(challenge.questions.length - 1, 0),
  );
  const question = challenge.questions[index];
  if (!question) return { ...shared, phase: "ready" };
  const answers = await attemptAnswers(attempt.id);
  const current = answers.find((answer) => answer.ordinal === index) ?? null;
  const view = questionView(question, index, challenge.questions.length);

  if (attempt.phase === "bonus" && current) {
    return {
      ...shared,
      phase: "bonus",
      question: view,
      feedback: feedbackFor(question, current, false),
      bonusPrompt: question.bonusPrompt,
    };
  }
  if (attempt.phase === "feedback" && current) {
    return {
      ...shared,
      phase: "feedback",
      question: view,
      feedback: feedbackFor(question, current, true),
    };
  }
  return { ...shared, phase: "question", question: view };
}

async function syncScore(attemptId: string): Promise<{
  score: number;
  correctCount: number;
}> {
  const answers = await attemptAnswers(attemptId);
  const score = answers.reduce(
    (sum, answer) => sum + answer.points + answer.bonusPoints,
    0,
  );
  const correctCount = answers.filter((answer) => answer.isCorrect).length;
  await getDb()
    .update(dailyAttempts)
    .set({ score, correctCount })
    .where(eq(dailyAttempts.id, attemptId));
  return { score, correctCount };
}

function trackActor(actor: Actor, challengeGameDate: string) {
  return {
    clerkId: actor.user?.clerkId ?? null,
    userId: actor.user?.id ?? null,
    metadata: {
      gameDate: challengeGameDate,
      ...(actor.user
        ? { plan: actor.user.plan, username: actor.user.username }
        : { anonymousId: actor.guestId }),
    },
  };
}

export async function getDailyState(
  actor: Actor,
  now = new Date(),
): Promise<DailyPageState> {
  if (!isDatabaseConfigured()) return emptyState(actor, "no_database");
  try {
    const challenge = await ensureChallenge(now);
    if (!challenge || challenge.questions.length === 0) {
      return emptyState(actor, "no_questions");
    }
    const attempt = await findAttempt(challenge.id, actor);
    return present(actor, challenge, attempt, now);
  } catch {
    console.error("Failed to load the daily challenge");
    return emptyState(actor, "no_database");
  }
}

export async function startDaily(
  actor: Actor,
  now = new Date(),
): Promise<DailyPageState> {
  const state = await getDailyState(actor, now);
  if (!state.available || !state.gameDate) return state;
  if (state.phase !== "ready") return state;
  if (actor.user && !actor.user.username) return state;
  const key = actorKey(actor);
  if (!key) return state;

  const challenge = await ensureChallenge(now);
  if (!challenge || challenge.questions.length === 0) {
    return emptyState(actor, "no_questions");
  }
  const first = challenge.questions[0];
  if (!first) return emptyState(actor, "no_questions");

  const db = getDb();
  const inserted = await db
    .insert(dailyAttempts)
    .values({
      challengeId: challenge.id,
      userId: actor.user?.id ?? null,
      anonymousId: actor.user ? null : actor.guestId,
      status: "in_progress",
      phase: "question",
      currentIndex: 0,
      currentServedAt: now,
    })
    .onConflictDoNothing({
      target: actor.user
        ? [dailyAttempts.challengeId, dailyAttempts.userId]
        : [dailyAttempts.challengeId, dailyAttempts.anonymousId],
      where: actor.user
        ? sql`${dailyAttempts.userId} is not null`
        : sql`${dailyAttempts.anonymousId} is not null`,
    })
    .returning({ id: dailyAttempts.id });

  if (inserted[0]) {
    const tracked = trackActor(actor, challenge.gameDate);
    await trackSafely({
      event: "daily_challenge_started",
      clerkId: tracked.clerkId,
      userId: tracked.userId,
      dedupeKey: `daily_challenge_started:${key}:${challenge.gameDate}`,
      metadata: tracked.metadata,
    });
  }

  const attempt = await findAttempt(challenge.id, actor);
  return present(actor, challenge, attempt, now);
}

export async function answerDaily(
  actor: Actor,
  response: string,
  now = new Date(),
): Promise<DailyPageState> {
  const challenge = isDatabaseConfigured() ? await ensureChallenge(now) : null;
  if (!challenge) return getDailyState(actor, now);
  const attempt = await findAttempt(challenge.id, actor);
  if (!attempt || attempt.status === "completed" || attempt.phase !== "question") {
    return present(actor, challenge, attempt, now);
  }
  const question = challenge.questions[attempt.currentIndex];
  if (!question) return present(actor, challenge, attempt, now);

  const prior = await attemptAnswers(attempt.id);
  const streak = prior.reduce(
    (run, answer) => (answer.isCorrect ? run + 1 : 0),
    0,
  );
  const servedAt = asDate(attempt.currentServedAt);
  const elapsed = servedAt
    ? Math.max(0, now.getTime() - servedAt.getTime())
    : SCORING.speedWindowMs;
  const correct = await gradeWithSemantics(
    {
      type: "fill_in",
      answer: question.answer,
      aliases: question.aliases,
      prompt: question.prompt,
    },
    response,
  );
  const covered =
    correct &&
    question.bonusAnswers.length > 0 &&
    responseCoversAny(response, question.bonusAnswers);
  const scored = scoreAnswer({
    correct,
    difficulty: question.difficulty,
    elapsedMs: elapsed,
    streakBefore: streak,
  });
  await getDb()
    .insert(dailyAnswers)
    .values({
      attemptId: attempt.id,
      questionId: question.id,
      ordinal: attempt.currentIndex,
      response: response.trim(),
      isCorrect: correct,
      basePoints: scored.basePoints,
      speedPoints: scored.speedPoints,
      streakPoints: scored.streakPoints,
      points: scored.points,
      multiplierHundredths: scored.multiplierHundredths,
      elapsedMs: elapsed,
      servedAt: servedAt ?? now,
      answeredAt: now,
      bonusCorrect: covered ? true : null,
      bonusPoints: covered ? scoreBonus(true) : 0,
      bonusResolved: !(
        correct &&
        !covered &&
        Boolean(question.bonusPrompt) &&
        question.bonusAnswers.length > 0
      ),
    })
    .onConflictDoNothing({
      target: [dailyAnswers.attemptId, dailyAnswers.ordinal],
    });

  const stored = (await attemptAnswers(attempt.id)).find(
    (answer) => answer.ordinal === attempt.currentIndex,
  );
  const offerBonus = Boolean(
    stored &&
      stored.isCorrect &&
      !stored.bonusResolved &&
      !covered &&
      question.bonusPrompt &&
      question.bonusAnswers.length > 0,
  );
  await syncScore(attempt.id);
  await getDb()
    .update(dailyAttempts)
    .set({ phase: offerBonus ? "bonus" : "feedback" })
    .where(
      and(
        eq(dailyAttempts.id, attempt.id),
        eq(dailyAttempts.phase, "question"),
        eq(dailyAttempts.currentIndex, attempt.currentIndex),
      ),
    );

  const next = await findAttempt(challenge.id, actor);
  return present(actor, challenge, next, now);
}

export async function bonusDaily(
  actor: Actor,
  input: { response: string; skip: boolean },
  now = new Date(),
): Promise<DailyPageState> {
  const challenge = isDatabaseConfigured() ? await ensureChallenge(now) : null;
  if (!challenge) return getDailyState(actor, now);
  const attempt = await findAttempt(challenge.id, actor);
  if (!attempt || attempt.phase !== "bonus") {
    return present(actor, challenge, attempt, now);
  }
  const question = challenge.questions[attempt.currentIndex];
  const answers = await attemptAnswers(attempt.id);
  const current = answers.find((answer) => answer.ordinal === attempt.currentIndex);
  if (!question || !current || current.bonusResolved) {
    return present(actor, challenge, attempt, now);
  }

  const skip = input.skip || input.response.trim().length === 0;
  const [primary, ...rest] = question.bonusAnswers;
  const correct =
    !skip &&
    Boolean(primary) &&
    gradeResponse(
      { type: "fill_in", answer: primary ?? "", aliases: rest },
      input.response,
    );
  const points = scoreBonus(correct);
  const updated = await getDb()
    .update(dailyAnswers)
    .set({
      bonusResponse: skip ? null : input.response.trim(),
      bonusCorrect: correct,
      bonusSkipped: skip,
      bonusPoints: points,
      bonusResolved: true,
    })
    .where(
      and(eq(dailyAnswers.id, current.id), eq(dailyAnswers.bonusResolved, false)),
    )
    .returning({ id: dailyAnswers.id });

  if (updated[0]) {
    const tracked = trackActor(actor, challenge.gameDate);
    await trackSafely({
      event: "bonus_answered",
      clerkId: tracked.clerkId,
      userId: tracked.userId,
      metadata: { ...tracked.metadata, correct, skipped: skip },
    });
  }

  await syncScore(attempt.id);
  await getDb()
    .update(dailyAttempts)
    .set({ phase: "feedback" })
    .where(and(eq(dailyAttempts.id, attempt.id), eq(dailyAttempts.phase, "bonus")));

  const next = await findAttempt(challenge.id, actor);
  return present(actor, challenge, next, now);
}

export async function continueDaily(
  actor: Actor,
  now = new Date(),
): Promise<DailyPageState> {
  const challenge = isDatabaseConfigured() ? await ensureChallenge(now) : null;
  if (!challenge) return getDailyState(actor, now);
  const attempt = await findAttempt(challenge.id, actor);
  if (!attempt || attempt.phase !== "feedback" || attempt.status === "completed") {
    return present(actor, challenge, attempt, now);
  }

  const nextIndex = attempt.currentIndex + 1;
  const finished = nextIndex >= challenge.questions.length;
  const totals = await syncScore(attempt.id);
  const updated = await getDb()
    .update(dailyAttempts)
    .set(
      finished
        ? {
            status: "completed",
            phase: "feedback",
            completedAt: now,
            score: totals.score,
            correctCount: totals.correctCount,
          }
        : {
            currentIndex: nextIndex,
            phase: "question",
            currentServedAt: now,
            score: totals.score,
            correctCount: totals.correctCount,
          },
    )
    .where(
      and(
        eq(dailyAttempts.id, attempt.id),
        eq(dailyAttempts.phase, "feedback"),
        eq(dailyAttempts.currentIndex, attempt.currentIndex),
      ),
    )
    .returning({ id: dailyAttempts.id });

  if (updated[0] && finished) {
    const tracked = trackActor(actor, challenge.gameDate);
    const key = actorKey(actor);
    await trackSafely({
      event: "daily_challenge_completed",
      clerkId: tracked.clerkId,
      userId: tracked.userId,
      dedupeKey: key
        ? `daily_challenge_completed:${key}:${challenge.gameDate}`
        : null,
      metadata: {
        ...tracked.metadata,
        score: totals.score,
        correctCount: totals.correctCount,
      },
    });
  }

  const next = await findAttempt(challenge.id, actor);
  return present(actor, challenge, next, now);
}

export async function claimGuestAttempts(
  userId: string,
  guestId: string,
  clerkId?: string | null,
): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDb();
  const guests = await db
    .select()
    .from(dailyAttempts)
    .where(
      and(eq(dailyAttempts.anonymousId, guestId), sql`${dailyAttempts.userId} is null`),
    );
  let claimed = 0;
  for (const guest of guests) {
    const existing = await db
      .select({ id: dailyAttempts.id })
      .from(dailyAttempts)
      .where(
        and(
          eq(dailyAttempts.challengeId, guest.challengeId),
          eq(dailyAttempts.userId, userId),
        ),
      )
      .limit(1);
    if (existing[0]) continue;
    try {
      const moved = await db
        .update(dailyAttempts)
        .set({ userId, anonymousId: null })
        .where(
          and(eq(dailyAttempts.id, guest.id), sql`${dailyAttempts.userId} is null`),
        )
        .returning({ id: dailyAttempts.id });
      if (moved[0]) claimed += 1;
    } catch {
      console.error("Could not attach a guest daily attempt");
    }
  }
  if (clerkId) {
    if (claimed > 0) await aliasPostHogGuest(guestId, clerkId);
    await aliasBrowserIdentity(clerkId);
  }
}
