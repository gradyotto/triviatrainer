/**
 * Free and Pro limits live in this module so they can be tuned without
 * touching the train loop. Optional environment overrides:
 *
 * - FREE_QUESTIONS_PER_DAY (default 20)
 * - FREE_AI_CURRENT_EVENTS_PER_DAY (default 3; enforced, unused until Phase 4)
 * - PLAN_CONFIG_VERSION (bump this when you change limits so conversion
 *   cohorts stay comparable)
 *
 * Pro is unlimited. Dollar amounts are what `scripts/stripe-setup.ts` creates
 * in Stripe; checkout loads the live prices by lookup key.
 *
 * Review scheduling (session size and SM-2 constants) lives in ./review.ts.
 * Review is on both plans, and each review answer uses the question allowance.
 */

export const DEFAULT_PLAN_CONFIG_VERSION = "2026-11-11.1";

export const PRO_MONTHLY_LOOKUP_KEY = "triviatrainer_pro_monthly";
export const PRO_YEARLY_LOOKUP_KEY = "triviatrainer_pro_yearly";

export type PlanId = "free" | "pro";
export type UsageKind = "question" | "ai_current_event";
export type BillingInterval = "month" | "year";

export type PlanLimitsSnapshot = {
  freeQuestionsPerDay: number;
  freeAiCurrentEventsPerDay: number;
  proQuestionsPerDay: number | null;
  proAiCurrentEventsPerDay: number | null;
};

export type PlanPrice = {
  unitAmount: number;
  currency: "usd";
  interval: BillingInterval;
  lookupKey: string;
};

export type PlanConfig = {
  version: string;
  free: {
    id: "free";
    name: "Free";
    questionsPerDay: number;
    aiCurrentEventsPerDay: number;
  };
  pro: {
    id: "pro";
    name: "Pro";
    questionsPerDay: null;
    aiCurrentEventsPerDay: null;
    prices: {
      month: PlanPrice;
      year: PlanPrice;
    };
  };
};

function readOverride(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw)) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) return fallback;
  return value;
}

export function getPlanConfig(): PlanConfig {
  const version =
    process.env.PLAN_CONFIG_VERSION?.trim() || DEFAULT_PLAN_CONFIG_VERSION;
  return {
    version,
    free: {
      id: "free",
      name: "Free",
      questionsPerDay: readOverride("FREE_QUESTIONS_PER_DAY", 20),
      aiCurrentEventsPerDay: readOverride("FREE_AI_CURRENT_EVENTS_PER_DAY", 3),
    },
    pro: {
      id: "pro",
      name: "Pro",
      questionsPerDay: null,
      aiCurrentEventsPerDay: null,
      prices: {
        month: {
          unitAmount: 1000,
          currency: "usd",
          interval: "month",
          lookupKey: PRO_MONTHLY_LOOKUP_KEY,
        },
        year: {
          unitAmount: 8000,
          currency: "usd",
          interval: "year",
          lookupKey: PRO_YEARLY_LOOKUP_KEY,
        },
      },
    },
  };
}

export function limitsSnapshot(config = getPlanConfig()): PlanLimitsSnapshot {
  return {
    freeQuestionsPerDay: config.free.questionsPerDay,
    freeAiCurrentEventsPerDay: config.free.aiCurrentEventsPerDay,
    proQuestionsPerDay: config.pro.questionsPerDay,
    proAiCurrentEventsPerDay: config.pro.aiCurrentEventsPerDay,
  };
}

export function limitFor(
  plan: PlanId,
  kind: UsageKind,
  config = getPlanConfig(),
): number | null {
  const source = plan === "pro" ? config.pro : config.free;
  return kind === "ai_current_event"
    ? source.aiCurrentEventsPerDay
    : source.questionsPerDay;
}

export function yearlySavings(config = getPlanConfig()): {
  monthlyAnnualCents: number;
  yearlyCents: number;
  savedCents: number;
  percent: number;
} {
  const monthlyAnnualCents = config.pro.prices.month.unitAmount * 12;
  const yearlyCents = config.pro.prices.year.unitAmount;
  const savedCents = monthlyAnnualCents - yearlyCents;
  const percent =
    monthlyAnnualCents > 0
      ? Math.round((savedCents / monthlyAnnualCents) * 100)
      : 0;
  return { monthlyAnnualCents, yearlyCents, savedCents, percent };
}

export function formatUsd(cents: number, digits: 0 | 2 = 0): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(cents / 100);
}
