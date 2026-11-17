import { NextResponse } from "next/server";
import { getStripe, isStripeConfigured } from "@/lib/billing/stripe";
import { getSignedInClerkId } from "@/lib/clerk-user";
import { isDatabaseConfigured } from "@/lib/env";
import { requestOrigin } from "@/lib/request-origin";
import { getUserByClerkId } from "@/lib/users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PORTAL_METADATA_KEY = "triviatrainer";

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

  try {
    const user = await getUserByClerkId(clerkUserId);
    if (!user?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account yet" },
        { status: 409 },
      );
    }
    const stripe = getStripe();
    const configs = await stripe.billingPortal.configurations.list({
      active: true,
      limit: 10,
    });
    const configuration =
      configs.data.find((item) => item.metadata?.[PORTAL_METADATA_KEY] === "portal") ??
      configs.data.find((item) => item.is_default) ??
      configs.data[0];
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${requestOrigin(request)}/account`,
      ...(configuration ? { configuration: configuration.id } : {}),
    });
    return NextResponse.json({ url: session.url });
  } catch {
    console.error("Failed to open the Stripe customer portal");
    return NextResponse.json(
      { error: "Could not open billing" },
      { status: 500 },
    );
  }
}
