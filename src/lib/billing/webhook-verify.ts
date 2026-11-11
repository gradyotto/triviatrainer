import Stripe from "stripe";

export class WebhookConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookConfigError";
  }
}

export class WebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookSignatureError";
  }
}

let verifier: Stripe | null = null;

function verifierClient(): Stripe {
  if (!verifier) {
    verifier = new Stripe("sk_test_webhook_verifier");
  }
  return verifier;
}

export function verifyWebhookPayload(
  payload: string,
  signature: string | null | undefined,
  secret: string | undefined,
): Stripe.Event {
  if (!secret) {
    throw new WebhookConfigError("Stripe webhook secret is not set.");
  }
  if (!signature) {
    throw new WebhookSignatureError("Missing Stripe signature.");
  }
  try {
    return verifierClient().webhooks.constructEvent(payload, signature, secret);
  } catch {
    throw new WebhookSignatureError("Invalid Stripe signature.");
  }
}
