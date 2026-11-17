import Stripe from "stripe";
import type { BillingInterval } from "@/config/plans";
import { getPlanConfig } from "@/config/plans";
import { readEnv } from "@/lib/env";

let client: Stripe | null = null;

export function isStripeConfigured(): boolean {
  const key = readEnv("STRIPE_SECRET_KEY");
  return Boolean(key && /^sk_(test|live)_/.test(key));
}

export function getStripe(): Stripe {
  const key = readEnv("STRIPE_SECRET_KEY");
  if (!key || !/^sk_(test|live)_/.test(key)) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }
  if (!client) client = new Stripe(key);
  return client;
}

export async function priceIdForInterval(
  interval: BillingInterval,
): Promise<string> {
  const lookupKey = getPlanConfig().pro.prices[interval].lookupKey;
  const prices = await getStripe().prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  const price = prices.data[0];
  if (!price) {
    throw new Error(`No active Stripe price for ${lookupKey}.`);
  }
  return price.id;
}
