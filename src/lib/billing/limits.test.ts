import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getPlanConfig } from "@/config/plans";
import {
  evaluateDailyLimit,
  isPaymentFailureStatus,
  planForSubscriptionStatus,
} from "./limits";

describe("evaluateDailyLimit", () => {
  const config = getPlanConfig();

  it("allows a free user under the question cap and blocks the next one", () => {
    const under = evaluateDailyLimit({
      plan: "free",
      kind: "question",
      used: 19,
      config,
    });
    assert.equal(under.allowed, true);
    assert.equal(under.remaining, 1);
    assert.equal(under.limit, config.free.questionsPerDay);

    const atCap = evaluateDailyLimit({
      plan: "free",
      kind: "question",
      used: config.free.questionsPerDay,
      config,
    });
    assert.equal(atCap.allowed, false);
    assert.equal(atCap.remaining, 0);
  });

  it("does not let AI current-events answers consume the question allowance", () => {
    const questions = evaluateDailyLimit({
      plan: "free",
      kind: "question",
      used: 0,
      config,
    });
    const ai = evaluateDailyLimit({
      plan: "free",
      kind: "ai_current_event",
      used: config.free.aiCurrentEventsPerDay,
      config,
    });
    assert.equal(questions.allowed, true);
    assert.equal(questions.limit, config.free.questionsPerDay);
    assert.equal(ai.allowed, false);
    assert.equal(ai.limit, config.free.aiCurrentEventsPerDay);
  });

  it("treats Pro as unlimited for both allowances", () => {
    const decision = evaluateDailyLimit({
      plan: "pro",
      kind: "question",
      used: 10_000,
      config,
    });
    assert.equal(decision.allowed, true);
    assert.equal(decision.limit, null);
    assert.equal(decision.remaining, null);
    assert.equal(
      evaluateDailyLimit({
        plan: "pro",
        kind: "ai_current_event",
        used: 10_000,
        config,
      }).allowed,
      true,
    );
  });

  it("grants Pro only while the subscription is active or trialing", () => {
    assert.equal(planForSubscriptionStatus("active"), "pro");
    assert.equal(planForSubscriptionStatus("trialing"), "pro");
    assert.equal(planForSubscriptionStatus("past_due"), "free");
    assert.equal(planForSubscriptionStatus("unpaid"), "free");
    assert.equal(planForSubscriptionStatus("incomplete"), "free");
    assert.equal(planForSubscriptionStatus("canceled"), "free");
    assert.equal(planForSubscriptionStatus("incomplete_expired"), "free");
  });

  it("treats a failed charge as something the customer can still fix", () => {
    assert.equal(isPaymentFailureStatus("past_due"), true);
    assert.equal(isPaymentFailureStatus("unpaid"), true);
    assert.equal(isPaymentFailureStatus("incomplete"), true);
    assert.equal(isPaymentFailureStatus("active"), false);
    assert.equal(isPaymentFailureStatus("trialing"), false);
    assert.equal(isPaymentFailureStatus("canceled"), false);
  });
});
