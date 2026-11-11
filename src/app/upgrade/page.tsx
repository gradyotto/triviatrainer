import type { Metadata } from "next";
import { UpgradePanel } from "@/components/billing/upgrade-panel";
import { getPlanConfig, yearlySavings } from "@/config/plans";
import { isStripeConfigured } from "@/lib/billing/stripe";
import { getSignedInClerkId } from "@/lib/clerk-user";
import { isDatabaseConfigured } from "@/lib/env";
import { dayKeyInTimeZone } from "@/lib/time/zone";
import { trackSafely } from "@/lib/tracking/track";
import { ensureUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Upgrade",
};

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const params = await searchParams;
  const config = getPlanConfig();
  const savings = yearlySavings(config);
  const clerkUserId = await getSignedInClerkId();
  let plan: "free" | "pro" = "free";
  if (clerkUserId && isDatabaseConfigured()) {
    try {
      const user = await ensureUser(clerkUserId);
      plan = user.plan;
      if (plan === "free") {
        const day = dayKeyInTimeZone(new Date(), user.timeZone);
        await trackSafely({
          event: "upgrade_page_viewed",
          clerkId: clerkUserId,
          userId: user.id,
          dedupeKey: `upgrade_page_viewed:${clerkUserId}:${day}`,
        });
      }
    } catch {
      console.error("Failed to record the upgrade page view");
    }
  }

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <UpgradePanel
        signedIn={Boolean(clerkUserId)}
        plan={plan}
        stripeReady={isStripeConfigured()}
        monthlyCents={config.pro.prices.month.unitAmount}
        yearlyCents={config.pro.prices.year.unitAmount}
        savedCents={savings.savedCents}
        savingsPercent={savings.percent}
        freeQuestions={config.free.questionsPerDay}
        freeAi={config.free.aiCurrentEventsPerDay}
        canceled={params.checkout === "canceled"}
      />
    </main>
  );
}
