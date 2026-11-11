import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { getDb } from "@/db";
import { stripeEvents, subscriptions, users } from "@/db/schema";
import { planForSubscriptionStatus } from "@/lib/billing/limits";
import {
  interpretStripeEvent,
  type CheckoutSnapshot,
  type SubscriptionSnapshot,
} from "@/lib/billing/interpret";
import { getStripe } from "@/lib/billing/stripe";
import type { ConversionEventName } from "@/lib/tracking/events";
import { track } from "@/lib/tracking/track";
import { ensureUser, type UserRecord } from "@/lib/users";

async function alreadyProcessed(eventId: string): Promise<boolean> {
  const rows = await getDb()
    .select({ id: stripeEvents.id })
    .from(stripeEvents)
    .where(eq(stripeEvents.id, eventId))
    .limit(1);
  return Boolean(rows[0]);
}

async function markProcessed(eventId: string, type: string): Promise<void> {
  await getDb()
    .insert(stripeEvents)
    .values({ id: eventId, type })
    .onConflictDoNothing({ target: stripeEvents.id });
}

async function userForSnapshot(
  snapshot: SubscriptionSnapshot,
): Promise<UserRecord | null> {
  if (snapshot.clerkUserId) {
    return ensureUser(snapshot.clerkUserId);
  }
  const rows = await getDb()
    .select()
    .from(users)
    .where(eq(users.stripeCustomerId, snapshot.stripeCustomerId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    clerkId: row.clerkId,
    email: row.email,
    plan: row.plan,
    timeZone: row.timeZone,
    timeZoneConfirmed: row.timeZoneConfirmed,
    stripeCustomerId: row.stripeCustomerId,
    stripeSubscriptionId: row.stripeSubscriptionId,
  };
}

async function rememberCustomer(
  clerkUserId: string,
  customerId: string | null,
): Promise<UserRecord | null> {
  const user = await ensureUser(clerkUserId);
  if (!customerId || user.stripeCustomerId === customerId) return user;
  await getDb()
    .update(users)
    .set({ stripeCustomerId: customerId, updatedAt: new Date() })
    .where(eq(users.id, user.id));
  return { ...user, stripeCustomerId: customerId };
}

export async function applyCheckout(checkout: CheckoutSnapshot): Promise<void> {
  if (!checkout.clerkUserId) return;
  await rememberCustomer(checkout.clerkUserId, checkout.customerId);
}

export async function applySubscription(
  snapshot: SubscriptionSnapshot,
  conversions: ConversionEventName[],
): Promise<void> {
  const user = await userForSnapshot(snapshot);
  if (!user) {
    throw new Error("Stripe subscription is not linked to a user.");
  }
  const db = getDb();
  const now = new Date();
  await db
    .insert(subscriptions)
    .values({
      userId: user.id,
      stripeCustomerId: snapshot.stripeCustomerId,
      stripeSubscriptionId: snapshot.stripeSubscriptionId,
      status: snapshot.status,
      interval: snapshot.interval,
      currentPeriodEnd: snapshot.currentPeriodEnd,
      cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
      priceLookupKey: snapshot.priceLookupKey,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: subscriptions.stripeSubscriptionId,
      set: {
        userId: user.id,
        stripeCustomerId: snapshot.stripeCustomerId,
        status: snapshot.status,
        interval: snapshot.interval,
        currentPeriodEnd: snapshot.currentPeriodEnd,
        cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
        priceLookupKey: snapshot.priceLookupKey,
        updatedAt: now,
      },
    });

  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, user.id));
  const current =
    rows.find((row) => planForSubscriptionStatus(row.status) === "pro") ??
    rows[0];
  const plan = rows.some((row) => planForSubscriptionStatus(row.status) === "pro")
    ? "pro"
    : "free";
  await db
    .update(users)
    .set({
      plan,
      stripeCustomerId: snapshot.stripeCustomerId,
      stripeSubscriptionId: current?.stripeSubscriptionId ?? null,
      updatedAt: now,
    })
    .where(eq(users.id, user.id));

  for (const event of conversions) {
    const dedupeKey =
      event === "upgrade_completed"
        ? `upgrade_completed:${snapshot.stripeSubscriptionId}`
        : `subscription_canceled:${snapshot.stripeSubscriptionId}`;
    await track({
      event,
      clerkId: user.clerkId,
      userId: user.id,
      dedupeKey,
      metadata: {
        stripeSubscriptionId: snapshot.stripeSubscriptionId,
        status: snapshot.status,
        interval: snapshot.interval,
      },
    });
  }
}

async function subscriptionFromCheckout(
  event: Stripe.Event,
  subscriptionId: string,
): Promise<void> {
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  const interpreted = interpretStripeEvent({
    type: "customer.subscription.updated",
    data: { object: subscription },
  });
  if (interpreted.kind !== "subscription") {
    throw new Error("Checkout subscription could not be read.");
  }
  if (!interpreted.snapshot.clerkUserId) {
    const reference =
      event.type === "checkout.session.completed"
        ? event.data.object.client_reference_id
        : null;
    interpreted.snapshot.clerkUserId =
      typeof reference === "string" ? reference : null;
  }
  await applySubscription(interpreted.snapshot, interpreted.conversions);
}

export async function handleStripeEvent(
  event: Stripe.Event,
): Promise<{ duplicate: boolean; kind: string }> {
  if (await alreadyProcessed(event.id)) {
    return { duplicate: true, kind: "duplicate" };
  }
  const interpreted = interpretStripeEvent(event);
  if (interpreted.kind === "checkout") {
    await applyCheckout(interpreted.checkout);
    if (interpreted.checkout.subscriptionId) {
      await subscriptionFromCheckout(event, interpreted.checkout.subscriptionId);
    }
  } else if (interpreted.kind === "subscription") {
    await applySubscription(interpreted.snapshot, interpreted.conversions);
  }
  await markProcessed(event.id, event.type);
  return { duplicate: false, kind: interpreted.kind };
}
