import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Stripe from "stripe";
import {
  WebhookConfigError,
  WebhookSignatureError,
  verifyWebhookPayload,
} from "./webhook-verify";

const secret = "whsec_unit_test_secret";
const payload = JSON.stringify({
  id: "evt_test",
  object: "event",
  type: "customer.subscription.updated",
  data: { object: { id: "sub_test" } },
});

describe("verifyWebhookPayload", () => {
  it("accepts a signature from the Stripe library", () => {
    const stripe = new Stripe("sk_test_webhook_verifier");
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret,
    });
    const event = verifyWebhookPayload(payload, signature, secret);
    assert.equal(event.id, "evt_test");
    assert.equal(event.type, "customer.subscription.updated");
  });

  it("rejects a missing secret, a missing signature, and a bad signature", () => {
    assert.throws(
      () => verifyWebhookPayload(payload, "t=1,v1=deadbeef", undefined),
      WebhookConfigError,
    );
    assert.throws(
      () => verifyWebhookPayload(payload, null, secret),
      WebhookSignatureError,
    );
    assert.throws(
      () => verifyWebhookPayload(payload, "t=1,v1=deadbeef", secret),
      WebhookSignatureError,
    );
  });
});
