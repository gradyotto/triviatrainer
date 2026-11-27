import { getPlanConfig, limitsSnapshot, type PlanLimitsSnapshot } from "@/config/plans";
import { getDb, isDatabaseConfigured } from "@/db";
import { conversionEvents } from "@/db/schema";
import type { ConversionEventName } from "./events";
import { captureServerAnalytics } from "./posthog";

export type TrackInput = {
  event: ConversionEventName;
  clerkId?: string | null;
  userId?: string | null;
  dedupeKey?: string | null;
  metadata?: Record<string, unknown>;
};

export type RecordedConversion = {
  event: ConversionEventName;
  clerkId: string | null;
  userId: string | null;
  planConfigVersion: string;
  limits: PlanLimitsSnapshot;
  metadata: Record<string, unknown>;
};

export type AnalyticsAdapter = {
  track: (event: RecordedConversion) => Promise<void>;
};

const adapters: AnalyticsAdapter[] = [];

/** A PostHog (or other) sink can register here later. Postgres remains the log. */
export function addAnalyticsAdapter(adapter: AnalyticsAdapter): void {
  adapters.push(adapter);
}

async function fanOut(record: RecordedConversion): Promise<void> {
  try {
    await captureServerAnalytics({
      event: record.event,
      clerkId: record.clerkId,
      metadata: record.metadata,
      planConfigVersion: record.planConfigVersion,
    });
  } catch {
    console.error("Analytics adapter failed");
  }
  for (const adapter of adapters) {
    try {
      await adapter.track(record);
    } catch {
      console.error("Analytics adapter failed");
    }
  }
}

export async function track(input: TrackInput): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const config = getPlanConfig();
  const limits = limitsSnapshot(config);
  const metadata = input.metadata ?? {};
  const db = getDb();
  const values = {
    event: input.event,
    clerkId: input.clerkId ?? null,
    userId: input.userId ?? null,
    planConfigVersion: config.version,
    limits,
    metadata,
    dedupeKey: input.dedupeKey ?? null,
  };
  const inserted = input.dedupeKey
    ? await db
        .insert(conversionEvents)
        .values(values)
        .onConflictDoNothing({ target: conversionEvents.dedupeKey })
        .returning({ id: conversionEvents.id })
    : await db
        .insert(conversionEvents)
        .values(values)
        .returning({ id: conversionEvents.id });
  if (inserted.length === 0) return;
  await fanOut({
    event: input.event,
    clerkId: values.clerkId,
    userId: values.userId,
    planConfigVersion: config.version,
    limits,
    metadata,
  });
}

export async function trackSafely(input: TrackInput): Promise<void> {
  try {
    await track(input);
  } catch {
    console.error("Failed to record conversion event");
  }
}
