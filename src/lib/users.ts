import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { users } from "@/db/schema";
import { resolveTimeZone } from "@/lib/time/zone";
import { trackSafely } from "@/lib/tracking/track";

export type UserRecord = {
  id: string;
  clerkId: string;
  email: string | null;
  username: string | null;
  plan: "free" | "pro";
  timeZone: string;
  timeZoneConfirmed: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

function toRecord(row: typeof users.$inferSelect): UserRecord {
  return {
    id: row.id,
    clerkId: row.clerkId,
    email: row.email,
    username: row.username,
    plan: row.plan,
    timeZone: row.timeZone,
    timeZoneConfirmed: row.timeZoneConfirmed,
    stripeCustomerId: row.stripeCustomerId,
    stripeSubscriptionId: row.stripeSubscriptionId,
  };
}

export async function getUserByClerkId(
  clerkId: string,
): Promise<UserRecord | null> {
  if (!isDatabaseConfigured()) return null;
  const rows = await getDb()
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return rows[0] ? toRecord(rows[0]) : null;
}

export async function ensureUser(
  clerkId: string,
  options?: { timeZone?: string | null; source?: "detect" | "manual" },
): Promise<UserRecord> {
  const db = getDb();
  const requested = resolveTimeZone(options?.timeZone);
  const source = options?.source ?? "detect";
  let existing = await getUserByClerkId(clerkId);
  if (!existing) {
    const inserted = await db
      .insert(users)
      .values({
        clerkId,
        timeZone: requested ?? "UTC",
        timeZoneConfirmed: source === "manual" && Boolean(requested),
      })
      .onConflictDoNothing({ target: users.clerkId })
      .returning();
    if (inserted[0]) {
      const created = toRecord(inserted[0]);
      await trackSafely({
        event: "signup",
        clerkId,
        userId: created.id,
        dedupeKey: `signup:${clerkId}`,
        metadata: { source: "first_sign_in", plan: created.plan },
      });
      return created;
    }
    existing = await getUserByClerkId(clerkId);
  }
  if (!existing) {
    throw new Error("Could not load the signed-in user.");
  }
  if (!requested) return existing;

  const manual = source === "manual";
  if (manual) {
    if (existing.timeZone === requested && existing.timeZoneConfirmed) {
      return existing;
    }
  } else if (existing.timeZoneConfirmed || existing.timeZone === requested) {
    return existing;
  }

  const updated = await db
    .update(users)
    .set({
      timeZone: requested,
      timeZoneConfirmed: manual,
      updatedAt: new Date(),
    })
    .where(eq(users.id, existing.id))
    .returning();
  return updated[0] ? toRecord(updated[0]) : existing;
}
