import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutRefresh } from "@/components/account/checkout-refresh";
import { ManageBillingButton } from "@/components/account/manage-billing-button";
import { TimezoneForm } from "@/components/account/timezone-form";
import { Button } from "@/components/ui/button";
import { isPaymentFailureStatus } from "@/lib/billing/limits";
import { getAccountSnapshot } from "@/lib/account";
import { getSignedInClerkId } from "@/lib/clerk-user";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";
import { formatZonedDate } from "@/lib/stats/metrics";
import { ensureUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account",
};

function Message({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { href: string; label: string };
}) {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-lg flex-col justify-center gap-4 px-5 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      {action ? (
        <Button asChild className="h-11 w-fit px-4">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      ) : null}
    </main>
  );
}

function usageLine(used: number, limit: number | null): string {
  if (limit == null) return `${used} today · unlimited`;
  return `${used} of ${limit} today`;
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const params = await searchParams;
  if (!isClerkConfigured()) {
    return (
      <Message
        title="Account"
        body="Sign-in isn't configured, so there isn't an account to show."
        action={{ href: "/train", label: "Train as a guest" }}
      />
    );
  }
  const clerkUserId = await getSignedInClerkId();
  if (!clerkUserId) {
    return (
      <Message
        title="Account"
        body="Sign in to see your plan, today's usage, and billing."
        action={{ href: "/sign-in?redirect_url=/account", label: "Sign in" }}
      />
    );
  }
  if (!isDatabaseConfigured()) {
    return (
      <Message
        title="Account"
        body="Your account is signed in, but plan details need a database connection."
      />
    );
  }

  let snapshot = await getAccountSnapshot(clerkUserId);
  if (!snapshot) {
    try {
      await ensureUser(clerkUserId);
      snapshot = await getAccountSnapshot(clerkUserId);
    } catch {
      snapshot = null;
    }
  }
  if (!snapshot) {
    return (
      <Message
        title="Account"
        body="Your account couldn't be loaded. Try again in a moment."
      />
    );
  }

  const { user, subscription } = snapshot;
  const paymentFailed = Boolean(
    subscription && isPaymentFailureStatus(subscription.status),
  );
  const waitingForPro =
    params.checkout === "success" && user.plan !== "pro" && !paymentFailed;
  const renewal = subscription?.currentPeriodEnd
    ? formatZonedDate(subscription.currentPeriodEnd, user.timeZone)
    : null;
  const renewalText = renewal
    ? subscription?.cancelAtPeriodEnd
      ? `Access through ${renewal}`
      : `Renews ${renewal}`
    : null;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <CheckoutRefresh pending={waitingForPro} />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="text-sm text-muted-foreground">
          Plan, usage, and billing for this sign-in.
        </p>
      </div>

      {waitingForPro ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          Payment received. Pro shows up as soon as Stripe confirms the
          subscription.
        </p>
      ) : null}
      {params.checkout === "success" && user.plan === "pro" ? (
        <p className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success-foreground">
          Welcome to TriviaTrainer Pro. You&apos;ve unlocked unlimited access
          to questions, current events, and Pro Analytics.
        </p>
      ) : null}
      {paymentFailed ? (
        <div
          className="flex flex-col gap-3 rounded-xl border border-destructive bg-destructive-soft px-4 py-4"
          role="status"
        >
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium">Payment didn&apos;t go through</h2>
            <p className="text-sm leading-relaxed">
              This account is on the Free plan, with Free limits and stats,
              until the payment succeeds. Update the card and Pro comes back.
            </p>
          </div>
          {user.stripeCustomerId ? (
            <ManageBillingButton
              label="Update payment method"
              variant="default"
            />
          ) : null}
        </div>
      ) : null}

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium">Plan</h2>
          <span className="text-sm font-semibold">
            {user.plan === "pro" ? "Pro" : "Free"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Questions: {usageLine(snapshot.questionsUsed, snapshot.questionsLimit)}
        </p>
        <p className="text-sm text-muted-foreground">
          AI current events:{" "}
          {usageLine(snapshot.aiUsed, snapshot.aiLimit)}
          {user.plan === "free" ? " · ships in a later update" : ""}
        </p>
        {renewalText && !paymentFailed ? (
          <p className="text-sm text-muted-foreground">
            {subscription?.interval === "year"
              ? "Yearly"
              : subscription?.interval === "month"
                ? "Monthly"
                : "Subscription"}
            {" · "}
            {renewalText}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {user.stripeCustomerId ? <ManageBillingButton /> : null}
          {user.plan === "free" && !paymentFailed ? (
            <Button asChild className="h-11 px-4">
              <Link href="/upgrade">Upgrade to Pro</Link>
            </Button>
          ) : null}
        </div>
      </section>

      <TimezoneForm timeZone={user.timeZone} />
    </main>
  );
}
