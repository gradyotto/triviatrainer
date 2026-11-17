import { desc, eq } from "drizzle-orm";
import { todayUsage } from "@/lib/billing/usage";
import { planForSubscriptionStatus } from "@/lib/billing/limits";
import { getDb } from "@/db";
import { subscriptions } from "@/db/schema";
import { getUserByClerkId, type UserRecord } from "@/lib/users";

export type AccountSubscription = {
  status: string;
  interval: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  grantsPro: boolean;
};

export type AccountSnapshot = {
  user: UserRecord;
  dayKey: string;
  questionsUsed: number;
  questionsLimit: number | null;
  aiUsed: number;
  aiLimit: number | null;
  subscription: AccountSubscription | null;
};

export async function getAccountSnapshot(
  clerkUserId: string,
): Promise<AccountSnapshot | null> {
  const user = await getUserByClerkId(clerkUserId);
  if (!user) return null;
  const usage = await todayUsage(user);
  const rows = await getDb()
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, user.id))
    .orderBy(desc(subscriptions.updatedAt));
  const current =
    rows.find((row) => planForSubscriptionStatus(row.status) === "pro") ??
    rows[0] ??
    null;
  return {
    user,
    dayKey: usage.dayKey,
    questionsUsed: usage.question.used,
    questionsLimit: usage.question.limit,
    aiUsed: usage.aiCurrentEvent.used,
    aiLimit: usage.aiCurrentEvent.limit,
    subscription: current
      ? {
          status: current.status,
          interval: current.interval,
          currentPeriodEnd: current.currentPeriodEnd,
          cancelAtPeriodEnd: current.cancelAtPeriodEnd,
          grantsPro: planForSubscriptionStatus(current.status) === "pro",
        }
      : null,
  };
}
