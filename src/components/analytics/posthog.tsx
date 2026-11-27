"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import posthog from "posthog-js";
import { Button } from "@/components/ui/button";

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
    if (!posthog.__loaded) return;
    if (clerkId) {
      const properties: Record<string, string> = {};
      if (username) properties.username = username;
      if (plan) properties.plan = plan;
      posthog.identify(clerkId, properties);
      sessionStorage.setItem("tt_ph_identified", "1");
      return;
    }
    if (sessionStorage.getItem("tt_ph_identified")) {
      posthog.reset();
      sessionStorage.removeItem("tt_ph_identified");
    }
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
        flag === "beat-today" || flag === true ? "Beat today's 20" : DEFAULT_CTA,
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
