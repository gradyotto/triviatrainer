import type { Metadata } from "next";
import Link from "next/link";
import { getSignedInClerkId } from "@/lib/clerk-user";
import { loadLeaderboard, type LeaderboardViewName } from "@/lib/daily/leaderboard";
import { isDatabaseConfigured } from "@/lib/env";
import { getUserByClerkId } from "@/lib/users";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leaderboard",
};

const VIEWS: { id: LeaderboardViewName; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "all", label: "All-time" },
];

function viewFrom(value: string | undefined): LeaderboardViewName {
  if (value === "weekly" || value === "all") return value;
  return "daily";
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const params = await searchParams;
  const view = viewFrom(params.view);
  const clerkId = await getSignedInClerkId();
  const user =
    clerkId && isDatabaseConfigured() ? await getUserByClerkId(clerkId) : null;
  const board = await loadLeaderboard({
    view,
    viewerId: user?.id ?? null,
  });
  const viewerInTop = board.rows.some((row) => row.userId === user?.id);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
        <p className="text-sm text-muted-foreground">
          Daily Challenge scores only. {board.label}. Weeks run Monday through
          Sunday, Phoenix time.
        </p>
      </div>
      <nav className="flex gap-2" aria-label="Leaderboard range">
        {VIEWS.map((item) => {
          const active = item.id === view;
          const href = item.id === "daily" ? "/leaderboard" : `/leaderboard?view=${item.id}`;
          return (
            <Link
              key={item.id}
              href={href}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      {board.rows.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          No posted scores yet. Finish today&apos;s challenge with a username to
          be first.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {board.rows.map((row) => (
            <li
              key={row.userId}
              className={`flex items-baseline justify-between gap-3 rounded-xl border px-4 py-3 ${
                row.userId === user?.id
                  ? "border-primary bg-muted"
                  : "border-border"
              }`}
            >
              <p className="text-sm">
                <span className="mr-2 font-medium tabular-nums">{row.rank}</span>
                {row.username}
              </p>
              <p className="text-sm font-semibold tabular-nums">{row.score}</p>
            </li>
          ))}
        </ol>
      )}
      {board.viewer && board.viewerOutsideTop && !viewerInTop ? (
        <p className="rounded-xl border border-primary bg-muted px-4 py-3 text-sm">
          You are {board.viewer.rank} with {board.viewer.score} pts as{" "}
          {board.viewer.username}.
        </p>
      ) : null}
      <Link href="/daily" className="text-sm font-medium underline underline-offset-4">
        Play the daily challenge
      </Link>
    </main>
  );
}
