import type { BillingInterval } from "@/config/plans";
import type { ConversionEventName } from "@/lib/tracking/events";

export type SubscriptionSnapshot = {
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  clerkUserId: string | null;
  status: string;
  interval: BillingInterval | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  priceLookupKey: string | null;
};

export type CheckoutSnapshot = {
  sessionId: string;
  clerkUserId: string | null;
  customerId: string | null;
  subscriptionId: string | null;
};

export type InvoiceSnapshot = {
  subscriptionId: string;
  customerId: string | null;
};

export type WebhookInterpretation =
  | { kind: "ignore" }
  | {
      kind: "checkout";
      checkout: CheckoutSnapshot;
    }
  | {
      kind: "invoice";
      invoice: InvoiceSnapshot;
    }
  | {
      kind: "subscription";
      snapshot: SubscriptionSnapshot;
      conversions: ConversionEventName[];
    };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function idOf(value: unknown): string | null {
  const direct = asString(value);
  if (direct) return direct;
  return asString(asRecord(value)?.id);
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function unixDate(value: unknown): Date | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const date = new Date(value * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

function intervalOf(value: unknown): BillingInterval | null {
  return value === "month" || value === "year" ? value : null;
}

export function conversionEventsForSubscription(input: {
  eventType: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  previousCancelAtPeriodEnd: boolean | null;
}): ConversionEventName[] {
  const events: ConversionEventName[] = [];
  const ended =
    input.eventType === "customer.subscription.deleted" ||
    input.status === "canceled" ||
    input.status === "incomplete_expired";
  if (ended) {
    events.push("subscription_canceled");
  } else if (
    input.cancelAtPeriodEnd &&
    input.previousCancelAtPeriodEnd === false
  ) {
    events.push("subscription_canceled");
  }
  if (!ended && (input.status === "active" || input.status === "trialing")) {
    events.push("upgrade_completed");
  }
  return events;
}

export function parseSubscriptionSnapshot(
  value: unknown,
  eventType: string,
): SubscriptionSnapshot | null {
  const object = asRecord(value);
  const stripeSubscriptionId = asString(object?.id);
  const stripeCustomerId = idOf(object?.customer);
  if (!object || !stripeSubscriptionId || !stripeCustomerId) return null;

  const items = asRecord(object.items);
  const firstItem = Array.isArray(items?.data)
    ? asRecord(items.data[0])
    : null;
  const price = asRecord(firstItem?.price) ?? asRecord(object.price);
  const recurring = asRecord(price?.recurring);
  const metadata = asRecord(object.metadata);
  const status =
    eventType === "customer.subscription.deleted"
      ? "canceled"
      : (asString(object.status) ?? "incomplete");

  return {
    stripeSubscriptionId,
    stripeCustomerId,
    clerkUserId: asString(metadata?.clerkUserId),
    status,
    interval: intervalOf(recurring?.interval),
    currentPeriodEnd:
      unixDate(firstItem?.current_period_end) ??
      unixDate(object.current_period_end),
    cancelAtPeriodEnd: object.cancel_at_period_end === true,
    priceLookupKey: asString(price?.lookup_key),
  };
}

function invoiceSubscriptionId(object: Record<string, unknown>): string | null {
  const direct = idOf(object.subscription);
  if (direct) return direct;
  const parent = asRecord(object.parent);
  const details = asRecord(parent?.subscription_details);
  return idOf(details?.subscription);
}

export function interpretStripeEvent(event: {
  type: string;
  data: { object: unknown; previous_attributes?: unknown };
}): WebhookInterpretation {
  if (event.type === "checkout.session.completed") {
    const object = asRecord(event.data.object);
    const sessionId = asString(object?.id);
    if (!object || !sessionId) return { kind: "ignore" };
    const metadata = asRecord(object.metadata);
    return {
      kind: "checkout",
      checkout: {
        sessionId,
        clerkUserId:
          asString(object.client_reference_id) ??
          asString(metadata?.clerkUserId),
        customerId: idOf(object.customer),
        subscriptionId: idOf(object.subscription),
      },
    };
  }

  if (
    event.type === "invoice.payment_failed" ||
    event.type === "invoice.paid"
  ) {
    const object = asRecord(event.data.object);
    const subscriptionId = object ? invoiceSubscriptionId(object) : null;
    if (!object || !subscriptionId) return { kind: "ignore" };
    return {
      kind: "invoice",
      invoice: {
        subscriptionId,
        customerId: idOf(object.customer),
      },
    };
  }

  if (
    event.type !== "customer.subscription.created" &&
    event.type !== "customer.subscription.updated" &&
    event.type !== "customer.subscription.deleted"
  ) {
    return { kind: "ignore" };
  }

  const snapshot = parseSubscriptionSnapshot(event.data.object, event.type);
  if (!snapshot) return { kind: "ignore" };
  const previous = asRecord(event.data.previous_attributes);
  const previousFlag = asBoolean(previous?.cancel_at_period_end);
  const previousCancelAtPeriodEnd =
    previousFlag ??
    (event.type === "customer.subscription.created" ? false : null);

  return {
    kind: "subscription",
    snapshot,
    conversions: conversionEventsForSubscription({
      eventType: event.type,
      status: snapshot.status,
      cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
      previousCancelAtPeriodEnd,
    }),
  };
}
