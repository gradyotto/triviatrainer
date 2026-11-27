import { PostHog } from "posthog-node";
import { readEnv } from "@/lib/env";
import { mapPostHogEvent, posthogProperties } from "./posthog-events";

const DEFAULT_HOST = "https://us.i.posthog.com";

let client: PostHog | null | undefined;

export function isPostHogConfigured(): boolean {
  return Boolean(readEnv("NEXT_PUBLIC_POSTHOG_KEY"));
}

function getClient(): PostHog | null {
  if (client !== undefined) return client;
  const key = readEnv("NEXT_PUBLIC_POSTHOG_KEY");
  if (!key) {
    client = null;
    return null;
  }
  client = new PostHog(key, {
    host: readEnv("NEXT_PUBLIC_POSTHOG_HOST") ?? DEFAULT_HOST,
    flushAt: 1,
    flushInterval: 0,
  });
  return client;
}

function distinctIdFor(input: {
  clerkId: string | null;
  metadata: Record<string, unknown>;
}): string | null {
  if (input.clerkId) return input.clerkId;
  const guest = input.metadata.anonymousId;
  return typeof guest === "string" && guest.length >= 8 ? guest : null;
}

export async function captureServerAnalytics(input: {
  event: string;
  clerkId: string | null;
  metadata: Record<string, unknown>;
  planConfigVersion: string;
}): Promise<void> {
  const posthog = getClient();
  const distinctId = distinctIdFor(input);
  if (!posthog || !distinctId) return;
  posthog.capture({
    distinctId,
    event: mapPostHogEvent(input.event),
    properties: {
      ...posthogProperties(input.metadata),
      plan_config_version: input.planConfigVersion,
    },
  });
  await posthog.flush();
}

export async function setPostHogPerson(
  distinctId: string,
  properties: { username?: string | null; plan?: string | null },
): Promise<void> {
  const posthog = getClient();
  if (!posthog) return;
  const person: Record<string, string> = {};
  if (properties.username) person.username = properties.username;
  if (properties.plan) person.plan = properties.plan;
  if (Object.keys(person).length === 0) return;
  posthog.identify({ distinctId, properties: person });
  await posthog.flush();
}

export async function aliasPostHogGuest(
  guestId: string,
  clerkId: string,
): Promise<void> {
  const posthog = getClient();
  if (!posthog) return;
  posthog.alias({ distinctId: guestId, alias: clerkId });
  await posthog.flush();
}
