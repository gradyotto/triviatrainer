import posthog from "posthog-js";
import { isAnalyticsDistinctId } from "@/lib/tracking/identity";

export function syncPostHogIdentity(input: {
  clerkId: string | null;
  username: string | null;
  plan: string | null;
}): void {
  if (typeof window === "undefined" || !posthog.__loaded) return;
  if (input.clerkId) {
    const properties: Record<string, string> = {};
    if (input.username) properties.username = input.username;
    if (input.plan) properties.plan = input.plan;
    posthog.identify(input.clerkId, properties);
    window.sessionStorage.setItem("tt_ph_identified", input.clerkId);
    writeDistinctCookie(input.clerkId);
    return;
  }
  if (window.sessionStorage.getItem("tt_ph_identified")) {
    posthog.reset();
    window.sessionStorage.removeItem("tt_ph_identified");
  }
  const current = posthog.get_distinct_id();
  if (isAnalyticsDistinctId(current)) writeDistinctCookie(current);
}

export function writeDistinctCookie(id: string): void {
  if (typeof document === "undefined" || !isAnalyticsDistinctId(id)) return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `tt_ph_distinct=${encodeURIComponent(id)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

export function analyticsHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  if (typeof window === "undefined" || !posthog.__loaded) return headers;
  const id = posthog.get_distinct_id();
  if (isAnalyticsDistinctId(id)) headers.set("x-posthog-distinct-id", id);
  return headers;
}
