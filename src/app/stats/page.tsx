import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProDashboard } from "@/components/stats/pro-dashboard";
import { ProTeaser } from "@/components/stats/pro-teaser";
import { StatsDashboard } from "@/components/stats/stats-dashboard";
import { getSignedInClerkId } from "@/lib/clerk-user";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";
import { getBasicStats, getProStats } from "@/lib/stats";
import { getUserByClerkId } from "@/lib/users";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stats",
};

function StatsMessage({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { href: string; label: string };
}) {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-lg flex-col justify-center gap-4 px-5 py-12 pb-[max(3rem,env(safe-area-inset-bottom))]">
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

export default async function StatsPage() {
  if (!isClerkConfigured()) {
    return (
      <StatsMessage
        title="Stats"
        body="Sign-in isn't configured, so there isn't an account to attach stats to. You can still train as a guest."
        action={{ href: "/train", label: "Start training" }}
      />
    );
  }

  const clerkUserId = await getSignedInClerkId();
  if (!clerkUserId) {
    return (
      <StatsMessage
        title="Stats"
        body="Sign in to see how many questions you've answered, your accuracy, your day streak, and recent sessions."
        action={{ href: "/sign-in", label: "Sign in" }}
      />
    );
  }

  if (!isDatabaseConfigured()) {
    return (
      <StatsMessage
        title="Stats"
        body="Your account is signed in, but stats need a database connection."
      />
    );
  }

  try {
    const user = await getUserByClerkId(clerkUserId);
    const stats = await getBasicStats(clerkUserId);
    const pro = user?.plan === "pro" ? await getProStats(clerkUserId) : null;
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-8 px-4 py-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <StatsDashboard stats={stats} timeZone={user?.timeZone ?? "UTC"} />
        {pro ? (
          <ProDashboard stats={pro} timeZone={user?.timeZone ?? "UTC"} />
        ) : (
          <ProTeaser />
        )}
      </main>
    );
  } catch {
    console.error("Failed to load stats");
    return (
      <StatsMessage
        title="Stats"
        body="Stats couldn't be loaded. Try again in a moment."
      />
    );
  }
}
