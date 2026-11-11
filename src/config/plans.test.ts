import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_PLAN_CONFIG_VERSION,
  formatUsd,
  getPlanConfig,
  limitFor,
  limitsSnapshot,
  yearlySavings,
} from "./plans";

function withEnv(
  values: Record<string, string | undefined>,
  run: () => void,
): void {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    run();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe("getPlanConfig", () => {
  it("defaults free to 20 questions and 3 AI current-events questions", () => {
    withEnv(
      {
        FREE_QUESTIONS_PER_DAY: undefined,
        FREE_AI_CURRENT_EVENTS_PER_DAY: undefined,
        PLAN_CONFIG_VERSION: undefined,
      },
      () => {
        const config = getPlanConfig();
        assert.equal(config.version, DEFAULT_PLAN_CONFIG_VERSION);
        assert.equal(config.free.questionsPerDay, 20);
        assert.equal(config.free.aiCurrentEventsPerDay, 3);
        assert.equal(config.pro.questionsPerDay, null);
        assert.equal(config.pro.aiCurrentEventsPerDay, null);
        assert.equal(config.pro.prices.month.unitAmount, 1000);
        assert.equal(config.pro.prices.year.unitAmount, 8000);
      },
    );
  });

  it("accepts integer env overrides and ignores invalid ones", () => {
    withEnv(
      {
        FREE_QUESTIONS_PER_DAY: "8",
        FREE_AI_CURRENT_EVENTS_PER_DAY: "1",
        PLAN_CONFIG_VERSION: "test-version",
      },
      () => {
        const config = getPlanConfig();
        assert.equal(config.version, "test-version");
        assert.equal(config.free.questionsPerDay, 8);
        assert.equal(config.free.aiCurrentEventsPerDay, 1);
        assert.deepEqual(limitsSnapshot(config), {
          freeQuestionsPerDay: 8,
          freeAiCurrentEventsPerDay: 1,
          proQuestionsPerDay: null,
          proAiCurrentEventsPerDay: null,
        });
      },
    );

    withEnv(
      {
        FREE_QUESTIONS_PER_DAY: "nope",
        FREE_AI_CURRENT_EVENTS_PER_DAY: "-3",
      },
      () => {
        const config = getPlanConfig();
        assert.equal(config.free.questionsPerDay, 20);
        assert.equal(config.free.aiCurrentEventsPerDay, 3);
      },
    );
  });
});

describe("limitFor", () => {
  it("keeps the AI allowance separate from the question allowance", () => {
    const config = getPlanConfig();
    assert.equal(limitFor("free", "question", config), config.free.questionsPerDay);
    assert.equal(
      limitFor("free", "ai_current_event", config),
      config.free.aiCurrentEventsPerDay,
    );
    assert.equal(limitFor("pro", "question", config), null);
    assert.equal(limitFor("pro", "ai_current_event", config), null);
  });
});

describe("yearlySavings", () => {
  it("prices a year of Pro at $40 less than twelve months", () => {
    const savings = yearlySavings();
    assert.equal(savings.monthlyAnnualCents, 12000);
    assert.equal(savings.yearlyCents, 8000);
    assert.equal(savings.savedCents, 4000);
    assert.equal(savings.percent, 33);
    assert.equal(formatUsd(1000), "$10");
    assert.equal(formatUsd(savings.savedCents), "$40");
  });
});
