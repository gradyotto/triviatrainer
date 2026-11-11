import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatZonedDate } from "@/lib/stats/metrics";
import type { BasicStats } from "@/lib/stats";

function SummaryStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-2 py-3 text-center">
      <dd className="text-2xl font-semibold tabular-nums tracking-tight">
        {value}
      </dd>
      <dt className="mt-1 text-xs leading-tight text-muted-foreground">
        {label}
      </dt>
    </div>
  );
}

export function StatsDashboard({
  stats,
  timeZone = "UTC",
}: {
  stats: BasicStats;
  timeZone?: string;
}) {
  const hasAnswers = stats.questionsAnswered > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Stats</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Saved answers on your account.
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-2">
        <SummaryStat
          value={String(stats.questionsAnswered)}
          label="Answered"
        />
        <SummaryStat value={`${stats.accuracyPercent}%`} label="Accuracy" />
        <SummaryStat value={String(stats.dayStreak)} label="Day streak" />
      </dl>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Accuracy by category</h2>
        {stats.categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Answer a few questions and category accuracy will show up here.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {stats.categories.map((category) => (
              <li
                key={category.slug}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <span className="min-w-0 truncate text-sm font-medium">
                  {category.name}
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-medium tabular-nums">
                    {category.accuracyPercent}%
                  </span>
                  <span className="block text-xs tabular-nums text-muted-foreground">
                    {category.correct}/{category.answered}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Recent sessions</h2>
        {stats.recentSessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sessions yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {stats.recentSessions.map((session) => (
              <li
                key={session.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {session.setLabel}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {formatZonedDate(session.startedAt, timeZone)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-medium tabular-nums">
                    {session.correct}/{session.answered}
                  </span>
                  <span className="block text-xs tabular-nums text-muted-foreground">
                    {session.accuracyPercent}%
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {hasAnswers ? null : (
        <Button asChild variant="outline" className="h-11 px-4">
          <Link href="/train">Start training</Link>
        </Button>
      )}
    </div>
  );
}
