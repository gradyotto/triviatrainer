import { NextResponse } from "next/server";
import { z } from "zod";
import { getStripe, isStripeConfigured, priceIdForInterval } from "@/lib/billing/stripe";
import { getSignedInClerkId } from "@/lib/clerk-user";
import { isDatabaseConfigured } from "@/lib/env";
import { requestOrigin } from "@/lib/request-origin";
import { trackSafely } from "@/lib/tracking/track";
import { ensureUser } from "@/lib/users";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  interval: z.enum(["month", "year"]),
});

export async function POST(request: Request) {
  if (!isStripeConfigured() || !isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "Billing is not configured" },
      { status: 503 },
    );
  }
  const clerkUserId = await getSignedInClerkId();
  if (!clerkUserId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose monthly or yearly" }, { status: 400 });
  }

  try {
    const user = await ensureUser(clerkUserId);
    const stripe = getStripe();
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          email: user.email ?? undefined,
          metadata: { clerkUserId },
        },
        { idempotencyKey: `triviatrainer_customer_${clerkUserId}` },
      );
      customerId = customer.id;
      await getDb()
        .update(users)
        .set({ stripeCustomerId: customerId, updatedAt: new Date() })
        .where(eq(users.id, user.id));
    }

    const price = await priceIdForInterval(parsed.data.interval);
    const origin = requestOrigin(request);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: clerkUserId,
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/account?checkout=success`,
      cancel_url: `${origin}/upgrade?checkout=canceled`,
      metadata: { clerkUserId },
      subscription_data: {
        metadata: { clerkUserId },
      },
    });
    if (!session.url) {
      return NextResponse.json(
        { error: "Checkout did not return a URL" },
        { status: 502 },
      );
    }
    await trackSafely({
      event: "checkout_started",
      clerkId: clerkUserId,
      userId: user.id,
      dedupeKey: `checkout_started:${session.id}`,
      metadata: { interval: parsed.data.interval, sessionId: session.id },
    });
    return NextResponse.json({ url: session.url });
  } catch {
    console.error("Failed to start Stripe checkout");
    return NextResponse.json(
      { error: "Could not start checkout" },
      { status: 500 },
    );
  }
}
