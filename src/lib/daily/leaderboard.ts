import { and, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { dailyAttempts, dailyChallenges, users } from "@/db/schema";
import { dailyGameDate, dailyWeekRange, formatGameDate } from "@/lib/daily/day";

export type LeaderboardViewName = "daily" | "weekly" | "all";

export type LeaderboardRow = {
  rank: number;
  userId: string;
  username: string;
  score: number;
};

export type LeaderboardSnapshot = {
  view: LeaderboardViewName;
  label: string;
  rows: LeaderboardRow[];
  viewer: LeaderboardRow | null;
  viewerOutsideTop: boolean;
};

type Aggregate = {
  userId: string;
  username: string;
  score: number;
  tie: number;
};

function asNumber(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function asTime(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string" || typeof value === "number") {
    const time = new Date(value).getTime();
    if (Number.isFinite(time)) return time;
  }
  return Number.POSITIVE_INFINITY;
}

function rankRows(items: Aggregate[]): LeaderboardRow[] {
  const sorted = [...items].sort((left, right) => {
    if (left.score !== right.score) return right.score - left.score;
    if (left.tie !== right.tie) return left.tie - right.tie;
    return left.username.localeCompare(right.username);
  });
  return sorted.map((item, index) => ({
    rank: index + 1,
    userId: item.userId,
    username: item.username,
    score: item.score,
  }));
}

function present(
  view: LeaderboardViewName,
  label: string,
  ranked: LeaderboardRow[],
  viewerId: string | null,
): LeaderboardSnapshot {
  const viewer = viewerId
    ? (ranked.find((row) => row.userId === viewerId) ?? null)
    : null;
  const top = ranked.slice(0, 50);
  const viewerOutsideTop = Boolean(viewer && viewer.rank > 50);
  return { view, label, rows: top, viewer, viewerOutsideTop };
}

async function completedScores(filter?: {
  gameDate?: string;
  from?: string;
  to?: string;
}): Promise<Aggregate[]> {
  const db = getDb();
  const conditions = [
    eq(dailyAttempts.status, "completed"),
    isNotNull(users.username),
    isNotNull(dailyAttempts.userId),
  ];
  if (filter?.gameDate) conditions.push(eq(dailyChallenges.gameDate, filter.gameDate));
  if (filter?.from) conditions.push(gte(dailyChallenges.gameDate, filter.from));
  if (filter?.to) conditions.push(lte(dailyChallenges.gameDate, filter.to));

  const rows = await db
    .select({
      userId: users.id,
      username: users.username,
      score: sql<number>`sum(${dailyAttempts.score})`,
      tie: sql<Date | null>`min(${dailyAttempts.completedAt})`,
    })
    .from(dailyAttempts)
    .innerJoin(users, eq(dailyAttempts.userId, users.id))
    .innerJoin(dailyChallenges, eq(dailyAttempts.challengeId, dailyChallenges.id))
    .where(and(...conditions))
    .groupBy(users.id, users.username);

  return rows.flatMap((row) => {
    if (!row.username || !row.userId) return [];
    return [
      {
        userId: row.userId,
        username: row.username,
        score: asNumber(row.score),
        tie: asTime(row.tie),
      },
    ];
  });
}

export async function challengeRank(input: {
  challengeId: string;
  userId: string;
  username: string | null;
}): Promise<{ rank: number; playerCount: number } | null> {
  if (!input.username || !isDatabaseConfigured()) return null;
  const db = getDb();
  const rows = await db
    .select({
      userId: users.id,
      username: users.username,
      score: dailyAttempts.score,
      completedAt: dailyAttempts.completedAt,
    })
    .from(dailyAttempts)
    .innerJoin(users, eq(dailyAttempts.userId, users.id))
    .where(
      and(
        eq(dailyAttempts.challengeId, input.challengeId),
        eq(dailyAttempts.status, "completed"),
        isNotNull(users.username),
      ),
    );
  const ranked = rankRows(
    rows.flatMap((row) => {
      if (!row.username) return [];
      return [
        {
          userId: row.userId,
          username: row.username,
          score: row.score,
          tie: asTime(row.completedAt),
        },
      ];
    }),
  );
  const mine = ranked.find((row) => row.userId === input.userId);
  if (!mine) return null;
  return { rank: mine.rank, playerCount: ranked.length };
}

export async function loadLeaderboard(input: {
  view: LeaderboardViewName;
  viewerId: string | null;
  now?: Date;
}): Promise<LeaderboardSnapshot> {
  const now = input.now ?? new Date();
  const gameDate = dailyGameDate(now);
  if (!isDatabaseConfigured()) {
    return present(input.view, "Leaderboard", [], null);
  }

  if (input.view === "weekly") {
    const range = dailyWeekRange(now);
    const label = range
      ? `${formatGameDate(range.start)} – ${formatGameDate(range.end)}`
      : "This week";
    const ranked = rankRows(
      range ? await completedScores({ from: range.start, to: range.end }) : [],
    );
    return present("weekly", label, ranked, input.viewerId);
  }

  if (input.view === "all") {
    const ranked = rankRows(await completedScores());
    return present("all", "All time", ranked, input.viewerId);
  }

  const ranked = rankRows(await completedScores({ gameDate }));
  return present("daily", formatGameDate(gameDate), ranked, input.viewerId);
}
