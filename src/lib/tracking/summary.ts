import type { PlanLimitsSnapshot } from "@/config/plans";
import { getDb, isDatabaseConfigured } from "@/db";
import { conversionEvents } from "@/db/schema";
import { isConversionEvent, type ConversionEventName } from "./events";

export type ConversionEventCount = {
  event: ConversionEventName;
  version: string;
  total: number;
  users: number;
};

export type ConversionCohort = {
  version: string;
  limits: PlanLimitsSnapshot | null;
  signups: number;
  upgrades: number;
  conversionRate: number | null;
};

export type ConversionSummary = {
  cohorts: ConversionCohort[];
  events: ConversionEventCount[];
};

type SummaryRow = {
  event: string;
  version: string;
  clerkId: string | null;
  limits: PlanLimitsSnapshot | null;
};

function asLimits(value: unknown): PlanLimitsSnapshot | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const questions = record.freeQuestionsPerDay;
  const ai = record.freeAiCurrentEventsPerDay;
  if (typeof questions !== "number" || typeof ai !== "number") return null;
  return {
    freeQuestionsPerDay: questions,
    freeAiCurrentEventsPerDay: ai,
    proQuestionsPerDay:
      record.proQuestionsPerDay === null ||
      typeof record.proQuestionsPerDay === "number"
        ? (record.proQuestionsPerDay as number | null)
        : null,
    proAiCurrentEventsPerDay:
      record.proAiCurrentEventsPerDay === null ||
      typeof record.proAiCurrentEventsPerDay === "number"
        ? (record.proAiCurrentEventsPerDay as number | null)
        : null,
  };
}

function cohortKey(version: string, limits: PlanLimitsSnapshot | null): string {
  if (!limits) return version;
  return [
    version,
    limits.freeQuestionsPerDay,
    limits.freeAiCurrentEventsPerDay,
    limits.proQuestionsPerDay ?? "unlimited",
    limits.proAiCurrentEventsPerDay ?? "unlimited",
  ].join("|");
}

export function summarizeConversions(rows: SummaryRow[]): ConversionSummary {
  const eventMap = new Map<string, { total: number; users: Set<string> }>();
  const signupCohorts = new Map<
    string,
    { version: string; limits: PlanLimitsSnapshot | null; users: Set<string> }
  >();
  const upgraded = new Set<string>();

  for (const row of rows) {
    if (!isConversionEvent(row.event)) continue;
    const eventKey = `${row.event}|${row.version}`;
    const eventBucket = eventMap.get(eventKey) ?? {
      total: 0,
      users: new Set<string>(),
    };
    eventBucket.total += 1;
    if (row.clerkId) eventBucket.users.add(row.clerkId);
    eventMap.set(eventKey, eventBucket);

    if (row.event === "upgrade_completed" && row.clerkId) {
      upgraded.add(row.clerkId);
    }
    if (row.event === "signup" && row.clerkId) {
      const key = cohortKey(row.version, row.limits);
      const cohort = signupCohorts.get(key) ?? {
        version: row.version,
        limits: row.limits,
        users: new Set<string>(),
      };
      cohort.users.add(row.clerkId);
      signupCohorts.set(key, cohort);
    }
  }

  const cohorts: ConversionCohort[] = [...signupCohorts.values()]
    .map((cohort) => {
      const signups = cohort.users.size;
      let upgrades = 0;
      for (const clerkId of cohort.users) {
        if (upgraded.has(clerkId)) upgrades += 1;
      }
      return {
        version: cohort.version,
        limits: cohort.limits,
        signups,
        upgrades,
        conversionRate: signups === 0 ? null : upgrades / signups,
      };
    })
    .sort((left, right) => left.version.localeCompare(right.version));

  const events: ConversionEventCount[] = [...eventMap.entries()]
    .map(([key, bucket]) => {
      const separator = key.indexOf("|");
      const event = key.slice(0, separator);
      const version = key.slice(separator + 1);
      return {
        event: event as ConversionEventName,
        version,
        total: bucket.total,
        users: bucket.users.size,
      };
    })
    .sort(
      (left, right) =>
        left.version.localeCompare(right.version) ||
        left.event.localeCompare(right.event),
    );

  return { cohorts, events };
}

export async function getConversionSummary(): Promise<ConversionSummary> {
  if (!isDatabaseConfigured()) return { cohorts: [], events: [] };
  const rows = await getDb()
    .select({
      event: conversionEvents.event,
      version: conversionEvents.planConfigVersion,
      clerkId: conversionEvents.clerkId,
      limits: conversionEvents.limits,
    })
    .from(conversionEvents);
  return summarizeConversions(
    rows.map((row) => ({
      event: row.event,
      version: row.version,
      clerkId: row.clerkId,
      limits: asLimits(row.limits),
    })),
  );
}
