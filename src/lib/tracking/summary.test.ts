import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { summarizeConversions } from "./summary";

const limits = {
  freeQuestionsPerDay: 20,
  freeAiCurrentEventsPerDay: 3,
  proQuestionsPerDay: null,
  proAiCurrentEventsPerDay: null,
};

describe("summarizeConversions", () => {
  it("cohorts free-to-Pro conversion by the limits in effect at signup", () => {
    const summary = summarizeConversions([
      {
        event: "signup",
        version: "v1",
        clerkId: "user_a",
        limits,
      },
      {
        event: "signup",
        version: "v1",
        clerkId: "user_b",
        limits,
      },
      {
        event: "upgrade_completed",
        version: "v2",
        clerkId: "user_a",
        limits: { ...limits, freeQuestionsPerDay: 10 },
      },
      {
        event: "signup",
        version: "v2",
        clerkId: "user_c",
        limits: { ...limits, freeQuestionsPerDay: 10 },
      },
      {
        event: "daily_limit_hit",
        version: "v1",
        clerkId: "user_b",
        limits,
      },
      {
        event: "daily_limit_hit",
        version: "v1",
        clerkId: "user_b",
        limits,
      },
    ]);

    assert.deepEqual(
      summary.cohorts.map((cohort) => ({
        version: cohort.version,
        questions: cohort.limits?.freeQuestionsPerDay,
        signups: cohort.signups,
        upgrades: cohort.upgrades,
        conversionRate: cohort.conversionRate,
      })),
      [
        {
          version: "v1",
          questions: 20,
          signups: 2,
          upgrades: 1,
          conversionRate: 0.5,
        },
        {
          version: "v2",
          questions: 10,
          signups: 1,
          upgrades: 0,
          conversionRate: 0,
        },
      ],
    );

    const hits = summary.events.find(
      (event) => event.event === "daily_limit_hit",
    );
    assert.equal(hits?.total, 2);
    assert.equal(hits?.users, 1);
  });
});
