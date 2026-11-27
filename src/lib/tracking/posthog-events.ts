const POSTHOG_EVENT_NAMES: Record<string, string> = {
  signup: "signed_up",
  upgrade_page_viewed: "upgrade_viewed",
  upgrade_completed: "subscription_activated",
};

const BLOCKED_PROPERTIES = new Set([
  "email",
  "userEmail",
  "user_email",
  "primaryEmail",
]);

export function mapPostHogEvent(event: string): string {
  return POSTHOG_EVENT_NAMES[event] ?? event;
}

export function posthogProperties(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (BLOCKED_PROPERTIES.has(key)) continue;
    properties[key] = value;
  }
  const person: Record<string, string> = {};
  if (typeof metadata.username === "string" && metadata.username) {
    person.username = metadata.username;
  }
  if (typeof metadata.plan === "string" && metadata.plan) {
    person.plan = metadata.plan;
  }
  if (Object.keys(person).length > 0) properties.$set = person;
  return properties;
}
