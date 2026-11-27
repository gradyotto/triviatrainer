import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapPostHogEvent, posthogProperties } from "./posthog-events";

describe("PostHog event mapping", () => {
  it("renames existing conversion events and keeps the daily names", () => {
    assert.equal(mapPostHogEvent("signup"), "signed_up");
    assert.equal(mapPostHogEvent("upgrade_page_viewed"), "upgrade_viewed");
    assert.equal(mapPostHogEvent("upgrade_completed"), "subscription_activated");
    assert.equal(mapPostHogEvent("daily_challenge_completed"), "daily_challenge_completed");
    assert.equal(mapPostHogEvent("checkout_started"), "checkout_started");
  });

  it("sets username and plan on the person and drops email", () => {
    const properties = posthogProperties({
      score: 1200,
      correctCount: 16,
      email: "person@example.com",
      username: "grady",
      plan: "pro",
    });
    assert.equal(properties.score, 1200);
    assert.equal("email" in properties, false);
    assert.deepEqual(properties.$set, { username: "grady", plan: "pro" });
  });
});