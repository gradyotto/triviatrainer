import { and, count, eq, gte, lt } from "drizzle-orm";
import type { UsageKind } from "@/config/plans";
import { getDb } from "@/db";
import { sessionAnswers, sessions } from "@/db/schema";
import { evaluateDailyLimit, type LimitDecision } from "@/lib/billing/limits";
import { dayKeyInTimeZone, zonedDayBounds } from "@/lib/time/zone";
import { ensureUser, type UserRecord } from "@/lib/users";

export type DailyLimitCheck = {
  user: UserRecord;
  dayKey: string;
  decision: LimitDecision;
};

/**
 * Server-side daily allowance. `kind: "question"` is the free-plan question
 * cap. Phase 4 should call this with `kind: "ai_current_event"` before serving
 * an AI current-events question; that counter is separate and already enforced
 * by the same path.
 */
export async function checkDailyLimit(input: {
  clerkUserId: string;
  kind: UsageKind;
  timeZone?: string | null;
  now?: Date;
}): Promise<DailyLimitCheck> {
  const user = await ensureUser(input.clerkUserId, {
    timeZone: input.timeZone,
    source: "detect",
  });
  const now = input.now ?? new Date();
  const dayKey = dayKeyInTimeZone(now, user.timeZone);
  const bounds = zonedDayBounds(dayKey, user.timeZone);
  let used = 0;
  if (bounds) {
    const rows = await getDb()
      .select({ total: count() })
      .from(sessionAnswers)
      .innerJoin(sessions, eq(sessionAnswers.sessionId, sessions.id))
      .where(
        and(
          eq(sessions.userId, user.id),
          eq(sessionAnswers.kind, input.kind),
          gte(sessionAnswers.createdAt, bounds.start),
          lt(sessionAnswers.createdAt, bounds.end),
        ),
      );
    const total = rows[0]?.total;
    used = typeof total === "number" ? total : Number(total ?? 0);
    if (!Number.isFinite(used)) used = 0;
  }
  return {
    user,
    dayKey,
    decision: evaluateDailyLimit({
      plan: user.plan,
      kind: input.kind,
      used,
    }),
  };
}

export async function todayUsage(
  user: UserRecord,
  now = new Date(),
): Promise<{ dayKey: string; question: LimitDecision; aiCurrentEvent: LimitDecision }> {
  const dayKey = dayKeyInTimeZone(now, user.timeZone);
  const bounds = zonedDayBounds(dayKey, user.timeZone);
  const totals = new Map<string, number>();
  if (bounds) {
    const rows = await getDb()
      .select({
        kind: sessionAnswers.kind,
        total: count(),
      })
      .from(sessionAnswers)
      .innerJoin(sessions, eq(sessionAnswers.sessionId, sessions.id))
      .where(
        and(
          eq(sessions.userId, user.id),
          gte(sessionAnswers.createdAt, bounds.start),
          lt(sessionAnswers.createdAt, bounds.end),
        ),
      )
      .groupBy(sessionAnswers.kind);
    for (const row of rows) {
      const total = typeof row.total === "number" ? row.total : Number(row.total ?? 0);
      totals.set(row.kind, Number.isFinite(total) ? total : 0);
    }
  }
  return {
    dayKey,
    question: evaluateDailyLimit({
      plan: user.plan,
      kind: "question",
      used: totals.get("question") ?? 0,
    }),
    aiCurrentEvent: evaluateDailyLimit({
      plan: user.plan,
      kind: "ai_current_event",
      used: totals.get("ai_current_event") ?? 0,
    }),
  };
}
