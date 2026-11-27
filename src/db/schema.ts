import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const questionTypeEnum = pgEnum("question_type", [
  "multiple_choice",
  "fill_in",
]);

export const planEnum = pgEnum("plan", ["free", "pro"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkId: varchar("clerk_id", { length: 128 }).notNull().unique(),
  email: varchar("email", { length: 320 }),
  username: varchar("username", { length: 20 }),
  displayName: varchar("display_name", { length: 120 }),
  plan: planEnum("plan").notNull().default("free"),
  stripeCustomerId: varchar("stripe_customer_id", { length: 128 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 128 }),
  timeZone: varchar("time_zone", { length: 64 }).notNull().default("UTC"),
  timeZoneConfirmed: boolean("time_zone_confirmed").notNull().default(false),
  adFree: boolean("ad_free").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  uniqueIndex("users_stripe_customer_idx").on(table.stripeCustomerId),
  uniqueIndex("users_username_lower_idx").on(sql`lower(${table.username})`),
]);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 64 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    isPremium: boolean("is_premium").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("categories_slug_idx").on(table.slug)],
);

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    type: questionTypeEnum("type").notNull(),
    prompt: text("prompt").notNull(),
    answer: text("answer").notNull(),
    // Accepted answers. Each entry is fully correct after normalization.
    answerAliases: jsonb("answer_aliases")
      .$type<string[]>()
      .notNull()
      .default([]),
    bonusPrompt: text("bonus_prompt"),
    bonusAnswers: jsonb("bonus_answers").$type<string[]>().notNull().default([]),
    answersGeneratedAt: timestamp("answers_generated_at", { withTimezone: true }),
    options: jsonb("options").$type<string[] | null>(),
    difficulty: varchar("difficulty", { length: 32 })
      .notNull()
      .default("medium"),
    hint: text("hint"),
    explanation: text("explanation"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    source: varchar("source", { length: 240 }),
    legacyId: integer("legacy_id"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("questions_category_idx").on(table.categoryId),
    index("questions_type_idx").on(table.type),
    uniqueIndex("questions_legacy_id_idx").on(table.legacyId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    anonymousId: varchar("anonymous_id", { length: 64 }),
    categoryIds: jsonb("category_ids").$type<string[]>().notNull().default([]),
    categorySlug: varchar("category_slug", { length: 64 }),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    planSnapshot: planEnum("plan_snapshot").notNull().default("free"),
    // "train" is a category or mixed set. "review" is the spaced-repetition queue.
    mode: varchar("mode", { length: 16 }).notNull().default("train"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    correctCount: integer("correct_count").notNull().default(0),
    answeredCount: integer("answered_count").notNull().default(0),
  },
  (table) => [
    index("sessions_user_idx").on(table.userId),
    index("sessions_anon_idx").on(table.anonymousId),
    index("sessions_category_slug_idx").on(table.categorySlug),
  ],
);

export const sessionAnswers = pgTable(
  "session_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    attempt: integer("attempt").notNull().default(1),
    response: text("response").notNull(),
    isCorrect: boolean("is_correct").notNull(),
    usedHint: boolean("used_hint").notNull().default(false),
    responseMs: integer("response_ms"),
    // "question" counts against the daily question allowance.
    // "ai_current_event" is reserved for Phase 4 and has its own allowance.
    kind: varchar("kind", { length: 32 }).notNull().default("question"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("session_answers_session_idx").on(table.sessionId),
    index("session_answers_question_idx").on(table.questionId),
  ],
);

/**
 * Per-user memory of a question. Counts, streak, and the SM-2 schedule
 * (ease, interval, repetition, lapses, nextReviewAt) update on every
 * signed-in answer. nextReviewAt stays null until the first answer or backfill.
 */
export const questionProgress = pgTable(
  "question_progress",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    seenCount: integer("seen_count").notNull().default(0),
    correctCount: integer("correct_count").notNull().default(0),
    incorrectCount: integer("incorrect_count").notNull().default(0),
    streak: integer("streak").notNull().default(0),
    lastAnsweredAt: timestamp("last_answered_at", { withTimezone: true }),
    lastCorrect: boolean("last_correct"),
    easeFactor: integer("ease_factor").notNull().default(250),
    intervalDays: integer("interval_days").notNull().default(0),
    repetition: integer("repetition").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    nextReviewAt: timestamp("next_review_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("question_progress_user_question_idx").on(
      table.userId,
      table.questionId,
    ),
    index("question_progress_due_idx").on(table.userId, table.nextReviewAt),
  ],
);

export const usageCounters = pgTable(
  "usage_counters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    anonymousId: varchar("anonymous_id", { length: 64 }),
    weekKey: varchar("week_key", { length: 16 }).notNull(),
    sessionCount: integer("session_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("usage_user_week_idx").on(table.userId, table.weekKey),
    index("usage_anon_week_idx").on(table.anonymousId, table.weekKey),
  ],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stripeCustomerId: varchar("stripe_customer_id", { length: 128 }).notNull(),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 128 })
      .notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    interval: varchar("interval", { length: 16 }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    priceLookupKey: varchar("price_lookup_key", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("subscriptions_stripe_id_idx").on(table.stripeSubscriptionId),
    index("subscriptions_user_idx").on(table.userId),
  ],
);

export const conversionEvents = pgTable(
  "conversion_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    clerkId: varchar("clerk_id", { length: 128 }),
    event: varchar("event", { length: 64 }).notNull(),
    planConfigVersion: varchar("plan_config_version", { length: 64 }).notNull(),
    limits: jsonb("limits").$type<Record<string, number | null>>().notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    dedupeKey: varchar("dedupe_key", { length: 200 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("conversion_events_event_idx").on(table.event),
    index("conversion_events_clerk_idx").on(table.clerkId),
    uniqueIndex("conversion_events_dedupe_idx").on(table.dedupeKey),
  ],
);

export const stripeEvents = pgTable("stripe_events", {
  id: varchar("id", { length: 255 }).primaryKey(),
  type: varchar("type", { length: 128 }).notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const answerDisputes = pgTable(
  "answer_disputes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    anonymousId: varchar("anonymous_id", { length: 64 }),
    questionId: uuid("question_id").references(() => questions.id, {
      onDelete: "set null",
    }),
    questionKey: varchar("question_key", { length: 80 }).notNull(),
    response: text("response").notNull(),
    expectedAnswer: text("expected_answer").notNull(),
    context: varchar("context", { length: 16 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("answer_disputes_question_idx").on(table.questionId),
    index("answer_disputes_created_idx").on(table.createdAt),
  ],
);

export const dailyChallenges = pgTable(
  "daily_challenges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gameDate: varchar("game_date", { length: 10 }).notNull(),
    questionIds: jsonb("question_ids").$type<string[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("daily_challenges_date_idx").on(table.gameDate)],
);

export const dailyAttempts = pgTable(
  "daily_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => dailyChallenges.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    anonymousId: varchar("anonymous_id", { length: 64 }),
    status: varchar("status", { length: 16 }).notNull().default("in_progress"),
    phase: varchar("phase", { length: 16 }).notNull().default("question"),
    currentIndex: integer("current_index").notNull().default(0),
    score: integer("score").notNull().default(0),
    correctCount: integer("correct_count").notNull().default(0),
    currentServedAt: timestamp("current_served_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("daily_attempts_user_idx")
      .on(table.challengeId, table.userId)
      .where(sql`${table.userId} is not null`),
    uniqueIndex("daily_attempts_guest_idx")
      .on(table.challengeId, table.anonymousId)
      .where(sql`${table.anonymousId} is not null`),
    index("daily_attempts_status_idx").on(table.status, table.challengeId),
  ],
);

export const dailyAnswers = pgTable(
  "daily_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => dailyAttempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    response: text("response").notNull(),
    isCorrect: boolean("is_correct").notNull(),
    basePoints: integer("base_points").notNull().default(0),
    speedPoints: integer("speed_points").notNull().default(0),
    streakPoints: integer("streak_points").notNull().default(0),
    points: integer("points").notNull().default(0),
    multiplierHundredths: integer("multiplier_hundredths").notNull().default(100),
    elapsedMs: integer("elapsed_ms"),
    servedAt: timestamp("served_at", { withTimezone: true }).notNull(),
    answeredAt: timestamp("answered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    bonusResponse: text("bonus_response"),
    bonusCorrect: boolean("bonus_correct"),
    bonusSkipped: boolean("bonus_skipped").notNull().default(false),
    bonusPoints: integer("bonus_points").notNull().default(0),
    bonusResolved: boolean("bonus_resolved").notNull().default(false),
  },
  (table) => [
    uniqueIndex("daily_answers_ordinal_idx").on(table.attemptId, table.ordinal),
    index("daily_answers_attempt_idx").on(table.attemptId),
  ],
);

export type Question = typeof questions.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type QuestionProgress = typeof questionProgress.$inferSelect;
export type User = typeof users.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
