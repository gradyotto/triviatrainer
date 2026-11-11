import { NextResponse } from "next/server";
import { handleStripeEvent } from "@/lib/billing/sync";
import {
  WebhookConfigError,
  WebhookSignatureError,
  verifyWebhookPayload,
} from "@/lib/billing/webhook-verify";
import { readEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "unknown";
  if (/sk_(test|live)_|whsec_|postgres(ql)?:\/\//i.test(message)) {
    return "redacted";
  }
  return message.slice(0, 300);
}

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  let event;
  try {
    event = verifyWebhookPayload(
      payload,
      signature,
      readEnv("STRIPE_WEBHOOK_SECRET"),
    );
  } catch (error) {
    if (error instanceof WebhookSignatureError) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
    if (error instanceof WebhookConfigError) {
      console.error("Stripe webhook secret is not configured");
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const result = await handleStripeEvent(event);
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    console.error("Stripe webhook handler failed", safeErrorMessage(error));
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }
}
