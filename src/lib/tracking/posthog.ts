import { PostHog } from "posthog-node";
import { getSignedInClerkId } from "@/lib/clerk-user";
import { readEnv } from "@/lib/env";
import {
  analyticsDistinctId,
  distinctIdFromCookies,
  isAnalyticsDistinctId,
} from "./identity";
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

async function browserDistinctIdFromRequest(): Promise<string | null> {
  try {
    const { cookies, headers } = await import("next/headers");
    const headerList = await headers();
    const fromHeader = headerList.get("x-posthog-distinct-id");
    if (isAnalyticsDistinctId(fromHeader)) return fromHeader.trim();
    const jar = await cookies();
    return distinctIdFromCookies(jar.getAll());
  } catch {
    return null;
  }
}

export async function resolveServerDistinctId(
  clerkId: string | null,
): Promise<string | null> {
  const authed = await getSignedInClerkId().catch(() => null);
  const browserDistinctId = await browserDistinctIdFromRequest();
  return analyticsDistinctId({
    clerkId: authed ?? clerkId,
    browserDistinctId,
  });
}

export async function captureServerAnalytics(input: {
  event: string;
  clerkId: string | null;
  metadata: Record<string, unknown>;
  planConfigVersion: string;
}): Promise<void> {
  const posthog = getClient();
  const distinctId = await resolveServerDistinctId(input.clerkId);
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
  if (!posthog || !isAnalyticsDistinctId(guestId) || !isAnalyticsDistinctId(clerkId)) {
    return;
  }
  if (guestId === clerkId) return;
  // This SDK links distinctId (the previous id) to alias (the Clerk user id).
  posthog.alias({ distinctId: guestId, alias: clerkId });
  await posthog.flush();
}

export async function aliasBrowserIdentity(clerkId: string): Promise<void> {
  const browserDistinctId = await browserDistinctIdFromRequest();
  if (!browserDistinctId || browserDistinctId === clerkId) return;
  await aliasPostHogGuest(browserDistinctId, clerkId);
}
