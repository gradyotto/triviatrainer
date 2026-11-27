import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { posthogProperties } from "./posthog-events";
import {
  analyticsDistinctId,
  disputeEventProperties,
  disputeRowValues,
  distinctIdFromCookies,
  isAnalyticsDistinctId,
} from "./identity";

describe("PostHog identity", () => {
  it("uses the Clerk id for signed-in events and the browser id for guests", () => {
    assert.equal(
      analyticsDistinctId({
        clerkId: "user_2abcDEF123",
        browserDistinctId: "0123456789abcdef",
      }),
      "user_2abcDEF123",
    );
    assert.equal(
      analyticsDistinctId({
        clerkId: null,
        browserDistinctId: "0123456789abcdef",
      }),
      "0123456789abcdef",
    );
    assert.equal(
      analyticsDistinctId({
        clerkId: null,
        browserDistinctId: "nope",
      }),
      null,
    );
    assert.equal(isAnalyticsDistinctId("person@example.com"), false);
  });

  it("reads the browser distinct id from the cookie jar", () => {
    assert.equal(
      distinctIdFromCookies([
        { name: "tt_guest", value: "a".repeat(32) },
        { name: "tt_ph_distinct", value: "0123456789abcdef" },
      ]),
      "0123456789abcdef",
    );
    const encoded = encodeURIComponent(
      JSON.stringify({ distinct_id: "browser-distinct-id" }),
    );
    assert.equal(
      distinctIdFromCookies([
        { name: "ph_phc_example_posthog", value: encoded },
      ]),
      "browser-distinct-id",
    );
  });

  it("puts the typed answer, correct answer, and mode on a dispute", () => {
    const properties = disputeEventProperties({
      questionId: "q1",
      userAnswer: "mental",
      correctAnswer: "psychiatric",
      mode: "daily",
      username: "grady",
      plan: "pro",
    });
    assert.equal(properties.userAnswer, "mental");
    assert.equal(properties.correctAnswer, "psychiatric");
    assert.equal(properties.mode, "daily");
    assert.equal("email" in properties, false);
    const stored = disputeRowValues({
      userAnswer: " mental ",
      correctAnswer: "psychiatric",
      mode: "daily",
    });
    assert.equal(stored.response, "mental");
    assert.equal(stored.expectedAnswer, "psychiatric");
    const forwarded = posthogProperties(properties);
    assert.deepEqual(forwarded.$set, { username: "grady", plan: "pro" });
    assert.equal(forwarded.userAnswer, "mental");
  });
});
