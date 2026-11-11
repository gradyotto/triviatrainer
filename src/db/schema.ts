import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  index,
  uniqueIndex,
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
  displayName: varchar("display_name", { length: 120 }),
  plan: planEnum("plan").notNull().default("free"),
  stripeCustomerId: varchar("stripe_customer_id", { length: 128 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 128 }),
  adFree: boolean("ad_free").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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
      .references(() => categories.id),
    type: questionTypeEnum("type").notNull(),
    prompt: text("prompt").notNull(),
    answer: text("answer").notNull(),
    answerAliases: jsonb("answer_aliases")
      .$type<string[]>()
      .notNull()
      .default([]),
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
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id),
    anonymousId: varchar("anonymous_id", { length: 64 }),
    categoryIds: jsonb("category_ids").$type<string[]>().notNull(),
    durationSeconds: integer("duration_seconds").notNull(),
    planSnapshot: planEnum("plan_snapshot").notNull().default("free"),
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
  ],
);

export const sessionAnswers = pgTable(
  "session_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id),
    attempt: integer("attempt").notNull().default(1),
    response: text("response").notNull(),
    isCorrect: boolean("is_correct").notNull(),
    usedHint: boolean("used_hint").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("session_answers_session_idx").on(table.sessionId)],
);

export const usageCounters = pgTable(
  "usage_counters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id),
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

export type Question = typeof questions.$inferSelect;
export type Category = typeof categories.$inferSelect;