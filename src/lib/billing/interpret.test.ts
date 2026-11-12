import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { interpretStripeEvent } from "./interpret";

function subscriptionEvent(
  type: string,
  object: Record<string, unknown>,
  previous?: Record<string, unknown>,
) {
  return interpretStripeEvent({
    type,
    data: { object, previous_attributes: previous },
  });
}

const activeSubscription = {
  id: "sub_123",
  customer: "cus_123",
  status: "active",
  cancel_at_period_end: false,
  metadata: { clerkUserId: "user_123" },
  items: {
    data: [
      {
        current_period_end: 1_800_000_000,
        price: {
          lookup_key: "triviatrainer_pro_yearly",
          recurring: { interval: "year" },
        },
      },
    ],
  },
};

describe("interpretStripeEvent", () => {
  it("maps an active subscription to Pro access details and an upgrade", () => {
    const interpreted = subscriptionEvent(
      "customer.subscription.updated",
      activeSubscription,
    );
    assert.equal(interpreted.kind, "subscription");
    if (interpreted.kind !== "subscription") return;
    assert.equal(interpreted.snapshot.stripeSubscriptionId, "sub_123");
    assert.equal(interpreted.snapshot.clerkUserId, "user_123");
    assert.equal(interpreted.snapshot.interval, "year");
    assert.equal(interpreted.snapshot.priceLookupKey, "triviatrainer_pro_yearly");
    assert.equal(
      interpreted.snapshot.currentPeriodEnd?.toISOString(),
      new Date(1_800_000_000 * 1000).toISOString(),
    );
    assert.deepEqual(interpreted.conversions, ["upgrade_completed"]);
  });

  it("records a scheduled cancellation without ending access", () => {
    const interpreted = subscriptionEvent(
      "customer.subscription.updated",
      { ...activeSubscription, cancel_at_period_end: true },
      { cancel_at_period_end: false },
    );
    assert.equal(interpreted.kind, "subscription");
    if (interpreted.kind !== "subscription") return;
    assert.equal(interpreted.snapshot.status, "active");
    assert.equal(interpreted.snapshot.cancelAtPeriodEnd, true);
    assert.deepEqual(interpreted.conversions, [
      "subscription_canceled",
      "upgrade_completed",
    ]);
  });

  it("does not emit another cancellation when the flag was already set", () => {
    const interpreted = subscriptionEvent(
      "customer.subscription.updated",
      { ...activeSubscription, cancel_at_period_end: true },
      { status: "active" },
    );
    assert.equal(interpreted.kind, "subscription");
    if (interpreted.kind !== "subscription") return;
    assert.deepEqual(interpreted.conversions, ["upgrade_completed"]);
  });

  it("ends access when the subscription is deleted", () => {
    const interpreted = subscriptionEvent(
      "customer.subscription.deleted",
      { ...activeSubscription, status: "active" },
    );
    assert.equal(interpreted.kind, "subscription");
    if (interpreted.kind !== "subscription") return;
    assert.equal(interpreted.snapshot.status, "canceled");
    assert.deepEqual(interpreted.conversions, ["subscription_canceled"]);
  });

  it("does not record a cancellation when a charge fails", () => {
    for (const status of ["past_due", "unpaid", "incomplete"]) {
      const interpreted = subscriptionEvent("customer.subscription.updated", {
        ...activeSubscription,
        status,
      });
      assert.equal(interpreted.kind, "subscription");
      if (interpreted.kind !== "subscription") return;
      assert.deepEqual(interpreted.conversions, []);
    }
  });

  it("asks for a subscription refresh when an invoice is paid or fails", () => {
    const failed = interpretStripeEvent({
      type: "invoice.payment_failed",
      data: {
        object: {
          id: "in_failed",
          customer: "cus_123",
          parent: {
            subscription_details: { subscription: "sub_123" },
          },
        },
      },
    });
    assert.deepEqual(failed, {
      kind: "invoice",
      invoice: { subscriptionId: "sub_123", customerId: "cus_123" },
    });

    const paid = interpretStripeEvent({
      type: "invoice.paid",
      data: {
        object: {
          id: "in_paid",
          customer: { id: "cus_123" },
          subscription: "sub_123",
        },
      },
    });
    assert.deepEqual(paid, {
      kind: "invoice",
      invoice: { subscriptionId: "sub_123", customerId: "cus_123" },
    });

    assert.deepEqual(
      interpretStripeEvent({
        type: "invoice.paid",
        data: { object: { id: "in_one_off", customer: "cus_123" } },
      }),
      { kind: "ignore" },
    );
  });

  it("links checkout to the Clerk user without marking the upgrade complete", () => {
    const interpreted = interpretStripeEvent({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_123",
          client_reference_id: "user_123",
          customer: { id: "cus_123" },
          subscription: "sub_123",
        },
      },
    });
    assert.deepEqual(interpreted, {
      kind: "checkout",
      checkout: {
        sessionId: "cs_123",
        clerkUserId: "user_123",
        customerId: "cus_123",
        subscriptionId: "sub_123",
      },
    });
  });

  it("ignores unrelated events and malformed subscriptions", () => {
    assert.deepEqual(
      interpretStripeEvent({ type: "invoice.paid", data: { object: {} } }),
      { kind: "ignore" },
    );
    assert.deepEqual(
      subscriptionEvent("customer.subscription.created", { id: "sub_only" }),
      { kind: "ignore" },
    );
  });

  it("reads a legacy current_period_end on the subscription object", () => {
    const interpreted = subscriptionEvent("customer.subscription.created", {
      id: "sub_legacy",
      customer: "cus_legacy",
      status: "trialing",
      current_period_end: 1_700_000_000,
      metadata: {},
    });
    assert.equal(interpreted.kind, "subscription");
    if (interpreted.kind !== "subscription") return;
    assert.equal(
      interpreted.snapshot.currentPeriodEnd?.toISOString(),
      new Date(1_700_000_000 * 1000).toISOString(),
    );
    assert.deepEqual(interpreted.conversions, ["upgrade_completed"]);
  });
});
