import { NextResponse } from "next/server";
import { checkDailyLimit } from "@/lib/billing/usage";
import { getSignedInClerkId } from "@/lib/clerk-user";
import { isDatabaseConfigured } from "@/lib/env";
import { drawQuestions, UnknownCategoryError } from "@/lib/questions";
import { trackSafely } from "@/lib/tracking/track";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_LIMIT = 10;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") ?? "mixed";
  if (category !== "mixed" && !/^[a-z0-9-]{1,64}$/.test(category)) {
    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  }

  const requested = Number(searchParams.get("limit") ?? DEFAULT_LIMIT);
  let limit = Number.isFinite(requested)
    ? Math.min(20, Math.max(1, Math.floor(requested)))
    : DEFAULT_LIMIT;
  const timeZone = searchParams.get("timeZone");

  let allowance: {
    limit: number | null;
    used: number;
    remaining: number | null;
  } | null = null;

  const clerkUserId = await getSignedInClerkId();
  if (clerkUserId && isDatabaseConfigured()) {
    try {
      const gate = await checkDailyLimit({
        clerkUserId,
        kind: "question",
        timeZone,
      });
      allowance = {
        limit: gate.decision.limit,
        used: gate.decision.used,
        remaining: gate.decision.remaining,
      };
      if (!gate.decision.allowed) {
        await trackSafely({
          event: "daily_limit_hit",
          clerkId: clerkUserId,
          userId: gate.user.id,
          dedupeKey: `daily_limit_hit:${clerkUserId}:${gate.dayKey}:question`,
          metadata: {
            kind: "question",
            used: gate.decision.used,
            limit: gate.decision.limit,
          },
        });
        return NextResponse.json({
          source: "database",
          questions: [],
          limitReached: true,
          limit: gate.decision.limit,
          used: gate.decision.used,
          remaining: 0,
        });
      }
      if (gate.decision.remaining != null) {
        limit = Math.min(limit, gate.decision.remaining);
      }
    } catch {
      console.error("Failed to check the daily question limit");
      return NextResponse.json(
        { error: "Could not check today's allowance" },
        { status: 503 },
      );
    }
  }

  try {
    const result = await drawQuestions(category, limit);
    return NextResponse.json({
      ...result,
      limitReached: false,
      limit: allowance?.limit ?? null,
      used: allowance?.used ?? null,
      remaining: allowance?.remaining ?? null,
    });
  } catch (error) {
    if (error instanceof UnknownCategoryError) {
      return NextResponse.json({ error: "Unknown category" }, { status: 404 });
    }
    console.error("Failed to draw questions");
    return NextResponse.json(
      { error: "Could not load questions" },
      { status: 500 },
    );
  }
}
