import { config as loadEnv } from "dotenv";
import Stripe from "stripe";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

function safeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (!message || /sk_(test|live)_|whsec_|postgres(ql)?:\/\//i.test(message)) {
    return "Stripe setup failed.";
  }
  return message;
}

async function main() {
  const { getPlanConfig } = await import("../src/config/plans");
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key || !key.startsWith("sk_test_")) {
    console.error(
      "STRIPE_SECRET_KEY must be a Stripe test key. This script does not create live prices.",
    );
    process.exit(1);
  }

  const stripe = new Stripe(key);
  const plan = getPlanConfig();
  const specs = [plan.pro.prices.month, plan.pro.prices.year];
  const listed = await stripe.prices.list({
    lookup_keys: specs.map((spec) => spec.lookupKey),
    limit: 10,
  });

  function productIdOf(price: Stripe.Price): string | null {
    if (typeof price.product === "string") return price.product;
    if (price.product && !price.product.deleted) return price.product.id;
    return null;
  }

  function matches(price: Stripe.Price, spec: (typeof specs)[number]): boolean {
    return (
      price.active &&
      price.currency === spec.currency &&
      price.unit_amount === spec.unitAmount &&
      price.recurring?.interval === spec.interval
    );
  }

  let productId =
    specs
      .map((spec) =>
        listed.data.find((price) => price.lookup_key === spec.lookupKey),
      )
      .map((price) => (price ? productIdOf(price) : null))
      .find((id): id is string => Boolean(id)) ?? null;

  if (!productId) {
    const products = await stripe.products.list({ active: true, limit: 100 });
    productId =
      products.data.find(
        (product) => product.metadata.triviatrainer_plan === "pro",
      )?.id ?? null;
  }

  if (!productId) {
    const product = await stripe.products.create({
      name: "TriviaTrainer Pro",
      description: "Unlimited trivia training and Pro stats.",
      metadata: { triviatrainer_plan: "pro" },
    });
    productId = product.id;
    console.log(`Created product ${product.id}`);
  } else {
    console.log(`Reusing product ${productId}`);
  }

  const priceIds = new Map<string, string>();
  for (const spec of specs) {
    const existing = listed.data.find(
      (price) => price.lookup_key === spec.lookupKey,
    );
    if (existing && matches(existing, spec)) {
      priceIds.set(spec.interval, existing.id);
      console.log(
        `Reusing ${spec.interval} price ${existing.id} (${spec.lookupKey}, ${spec.unitAmount} ${spec.currency})`,
      );
      continue;
    }
    const created = await stripe.prices.create({
      product: productId,
      currency: spec.currency,
      unit_amount: spec.unitAmount,
      recurring: { interval: spec.interval },
      lookup_key: spec.lookupKey,
      transfer_lookup_key: true,
      nickname: `TriviaTrainer Pro ${spec.interval}`,
    });
    priceIds.set(spec.interval, created.id);
    if (existing && existing.id !== created.id) {
      await stripe.prices.update(existing.id, { active: false });
    }
    console.log(
      `Created ${spec.interval} price ${created.id} (${spec.lookupKey}, ${spec.unitAmount} ${spec.currency})`,
    );
  }

  const configs = await stripe.billingPortal.configurations.list({
    active: true,
    limit: 20,
  });
  const portal = configs.data.find(
    (item) => item.metadata?.triviatrainer === "portal",
  );
  if (portal) {
    console.log(`Reusing portal configuration ${portal.id}`);
  } else {
    const monthly = priceIds.get("month");
    const yearly = priceIds.get("year");
    const created = await stripe.billingPortal.configurations.create({
      name: "TriviaTrainer",
      metadata: { triviatrainer: "portal" },
      business_profile: {
        headline: "Manage your TriviaTrainer subscription",
      },
      features: {
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        customer_update: {
          enabled: true,
          allowed_updates: ["email", "name"],
        },
        subscription_cancel: {
          enabled: true,
          mode: "at_period_end",
          proration_behavior: "none",
        },
        subscription_update: {
          enabled: true,
          default_allowed_updates: ["price"],
          proration_behavior: "create_prorations",
          products: [
            {
              product: productId,
              prices: [monthly, yearly].filter((id): id is string => Boolean(id)),
            },
          ],
        },
      },
    });
    console.log(`Created portal configuration ${created.id}`);
  }
}

main().catch((error: unknown) => {
  console.error(safeMessage(error));
  process.exit(1);
});
