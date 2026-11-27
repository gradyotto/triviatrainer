"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import posthog from "posthog-js";
import { Button } from "@/components/ui/button";
import { syncPostHogIdentity } from "@/lib/tracking/browser";

const DEFAULT_CTA = "Play today's challenge";

export function PostHogIdentity({
  clerkId,
  username,
  plan,
}: {
  clerkId: string | null;
  username: string | null;
  plan: string | null;
}) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    let stopped = false;
    const apply = () => {
      if (stopped || !posthog.__loaded) return false;
      syncPostHogIdentity({ clerkId, username, plan });
      return true;
    };
    if (apply()) return;
    const timer = window.setInterval(() => {
      if (apply()) window.clearInterval(timer);
    }, 250);
    const stop = window.setTimeout(() => window.clearInterval(timer), 5000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, [clerkId, username, plan]);

  return null;
}

export function DailyCta() {
  const [label, setLabel] = useState(DEFAULT_CTA);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    const apply = () => {
      if (!posthog.__loaded) return;
      const flag = posthog.getFeatureFlag("homepage-daily-cta");
      setLabel(
        flag === "beat-today" || flag === true ? "Beat today's 10" : DEFAULT_CTA,
      );
    };
    apply();
    return posthog.onFeatureFlags(apply);
  }, []);

  return (
    <Button asChild className="h-11 px-4">
      <Link href="/daily">{label}</Link>
    </Button>
  );
}
