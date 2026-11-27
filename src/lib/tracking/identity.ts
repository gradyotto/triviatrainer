const DISTINCT_ID = /^[A-Za-z0-9_.:-]{8,200}$/;

/** PostHog distinct ids we are willing to send. Emails never qualify. */
export function isAnalyticsDistinctId(
  value: string | null | undefined,
): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  if (!DISTINCT_ID.test(trimmed)) return false;
  if (trimmed.includes("@")) return false;
  return true;
}

export function analyticsDistinctId(input: {
  clerkId: string | null | undefined;
  browserDistinctId: string | null | undefined;
}): string | null {
  if (isAnalyticsDistinctId(input.clerkId)) return input.clerkId.trim();
  if (isAnalyticsDistinctId(input.browserDistinctId)) {
    return input.browserDistinctId.trim();
  }
  return null;
}

export function distinctIdFromPostHogCookie(value: string | null | undefined): string | null {
  if (!value) return null;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    decoded = value;
  }
  try {
    const parsed = JSON.parse(decoded) as { distinct_id?: unknown };
    if (typeof parsed.distinct_id === "string" && isAnalyticsDistinctId(parsed.distinct_id)) {
      return parsed.distinct_id.trim();
    }
  } catch {
    return null;
  }
  return null;
}

export function distinctIdFromCookies(
  cookies: readonly { name: string; value: string }[],
): string | null {
  const explicit = cookies.find((cookie) => cookie.name === "tt_ph_distinct");
  if (explicit) {
    let value = explicit.value;
    try {
      value = decodeURIComponent(explicit.value);
    } catch {
      value = explicit.value;
    }
    if (isAnalyticsDistinctId(value)) return value.trim();
  }
  for (const cookie of cookies) {
    if (!cookie.name.startsWith("ph_") || !cookie.name.endsWith("_posthog")) continue;
    const id = distinctIdFromPostHogCookie(cookie.value);
    if (id) return id;
  }
  return null;
}

export function disputeEventProperties(input: {
  questionId: string;
  userAnswer: string;
  correctAnswer: string;
  mode: "train" | "review" | "daily";
  plan?: string | null;
  username?: string | null;
}): Record<string, unknown> {
  return {
    questionId: input.questionId,
    userAnswer: input.userAnswer,
    correctAnswer: input.correctAnswer,
    mode: input.mode,
    context: input.mode,
    ...(input.plan ? { plan: input.plan } : {}),
    ...(input.username ? { username: input.username } : {}),
  };
}

export function disputeRowValues(input: {
  userAnswer: string;
  correctAnswer: string;
  mode: "train" | "review" | "daily";
}): { response: string; expectedAnswer: string; context: string } {
  return {
    response: input.userAnswer.trim(),
    expectedAnswer: input.correctAnswer,
    context: input.mode,
  };
}
