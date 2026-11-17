import type { ProStats } from "@/lib/stats/pro";
import { formatAnswerTime } from "@/lib/stats/pro-metrics";

function shortDay(day: string): string {
  const date = new Date(`${day}T12:00:00.000Z`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function TrendChart({ stats }: { stats: ProStats }) {
  const points = stats.accuracyTrend;
  const width = 320;
  const height = 120;
  const pad = 12;
  const active = points.filter((point) => point.accuracyPercent != null);
  if (active.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Answer a few questions and the daily accuracy line will show up here.
      </p>
    );
  }
  const coords = points.map((point, index) => {
    const x = pad + (index / Math.max(points.length - 1, 1)) * (width - pad * 2);
    const y =
      point.accuracyPercent == null
        ? null
        : pad + (1 - point.accuracyPercent / 100) * (height - pad * 2);
    return { x, y };
  });
  const segments: string[] = [];
  let current: string[] = [];
  for (const coord of coords) {
    if (coord.y == null) {
      if (current.length > 1) segments.push(current.join(" "));
      current = [];
      continue;
    }
    current.push(`${coord.x},${coord.y}`);
  }
  if (current.length > 1) segments.push(current.join(" "));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Accuracy by day for the last 30 days"
      className="h-32 w-full"
    >
      {[0, 50, 100].map((mark) => {
        const y = pad + (1 - mark / 100) * (height - pad * 2);
        return (
          <line
            key={mark}
            x1={pad}
            x2={width - pad}
            y1={y}
            y2={y}
            stroke="var(--border)"
          />
        );
      })}
      {segments.map((segment) => (
        <polyline
          key={segment}
          fill="none"
          stroke="var(--foreground)"
          strokeWidth="2"
          points={segment}
        />
      ))}
      {coords.map((coord, index) =>
        coord.y == null ? null : (
          <circle
            key={points[index]?.day}
            cx={coord.x}
            cy={coord.y}
            r="2.5"
            fill="var(--foreground)"
          />
        ),
      )}
    </svg>
  );
}

function Heatmap({ stats }: { stats: ProStats }) {
  const max = stats.activity.reduce((highest, day) => Math.max(highest, day.count), 0);
  const weeks: Array<Array<(typeof stats.activity)[number] | null>> = [];
  for (const day of stats.activity) {
    const date = new Date(`${day.day}T12:00:00.000Z`);
    const weekday = date.getUTCDay();
    const mondayIndex = weekday === 0 ? 6 : weekday - 1;
    if (weeks.length === 0 || mondayIndex === 0) weeks.push(Array(7).fill(null));
    const column = weeks[weeks.length - 1];
    if (column) column[mondayIndex] = day;
  }

  return (
    <div
      className="flex gap-1 overflow-x-auto"
      role="img"
      aria-label="Calendar of answers over the last 17 weeks"
    >
      {weeks.map((week, index) => (
        <div key={week[0]?.day ?? `week-${index}`} className="grid grid-rows-7 gap-1">
          {week.map((day, row) => (
            <span
              key={day?.day ?? `empty-${index}-${row}`}
              title={day ? `${day.day}: ${day.count} answers` : ""}
              className="size-3 rounded-[3px]"
              style={{
                background: heatColor(day?.count ?? 0, max),
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function heatColor(count: number, max: number): string {
  if (count <= 0 || max <= 0) return "var(--muted)";
  const level = Math.min(4, Math.max(1, Math.ceil((count / max) * 4)));
  const mix = [35, 55, 75, 100][level - 1] ?? 35;
  return `color-mix(in oklab, var(--foreground) ${mix}%, var(--muted))`;
}

export function ProDashboard({
  stats,
  timeZone,
}: {
  stats: ProStats;
  timeZone: string;
}) {
  const recent = stats.accuracyTrend.filter((point) => point.answered > 0).slice(-8);
  const best = stats.accuracyTrend.reduce<(typeof stats.accuracyTrend)[number] | null>(
    (winner, point) => {
      if (point.accuracyPercent == null) return winner;
      if (!winner || (winner.accuracyPercent ?? -1) < point.accuracyPercent) {
        return point;
      }
      return winner;
    },
    null,
  );

  return (
    <div className="flex flex-col gap-6 border-t border-border pt-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">Pro analytics</h2>
        <p className="text-sm text-muted-foreground">
          Days follow {timeZone}.
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Accuracy trend</h3>
        <TrendChart stats={stats} />
        {best ? (
          <p className="text-xs text-muted-foreground">
            Best day in this window: {shortDay(best.day)} at {best.accuracyPercent}%.
          </p>
        ) : null}
        {recent.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {recent.map((point) => (
              <li
                key={point.day}
                className="flex items-center justify-between text-xs text-muted-foreground"
              >
                <span>{shortDay(point.day)}</span>
                <span className="tabular-nums">
                  {point.accuracyPercent}% · {point.correct}/{point.answered}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Retention</h3>
        {stats.retention.percent == null ? (
          <p className="text-sm text-muted-foreground">
            Retention shows up after a due question is answered again.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {stats.retention.percent}%
            </span>{" "}
            of due reviews answered correctly ({stats.retention.correct}/
            {stats.retention.reviews}).
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Mastery over time</h3>
        <MasteryChart points={stats.masteryTrend} />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Strongest and weakest</h3>
        {stats.strongest || stats.weakest ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {stats.strongest ? (
              <RankCard label="Strongest" rank={stats.strongest} />
            ) : null}
            {stats.weakest ? (
              <RankCard label="Weakest" rank={stats.weakest} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Answer at least five questions in a second category to see a
                weakest topic.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Categories need at least five answers before they&apos;re ranked.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Accuracy by category over time</h3>
        {stats.categoryTrends.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Weekly category accuracy shows up after you answer in a category.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {stats.categoryTrends.map((category) => (
              <li key={category.slug} className="flex flex-col gap-1">
                <span className="text-sm font-medium">{category.name}</span>
                <span className="flex gap-1">
                  {category.weeks.map((week) => (
                    <span
                      key={week.weekStart}
                      title={`${shortDay(week.weekStart)}: ${
                        week.accuracyPercent == null
                          ? "no answers"
                          : `${week.accuracyPercent}% of ${week.answered}`
                      }`}
                      className="flex h-8 flex-1 items-center justify-center rounded-md bg-muted text-[10px] tabular-nums"
                    >
                      {week.accuracyPercent == null ? "–" : week.accuracyPercent}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Each cell is a Monday-start week, oldest first.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Accuracy by difficulty</h3>
        {stats.difficulty.length === 0 ? (
          <p className="text-sm text-muted-foreground">No difficulty data yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {stats.difficulty.map((item) => (
              <li key={item.difficulty} className="flex flex-col gap-1">
                <span className="flex items-center justify-between text-sm">
                  <span className="capitalize">{item.difficulty}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {item.accuracyPercent}% · {item.correct}/{item.answered}
                  </span>
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full bg-foreground"
                    style={{ width: `${item.accuracyPercent}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-1">
        <h3 className="text-sm font-medium">Average answer time</h3>
        {stats.averageAnswerMs == null ? (
          <p className="text-sm text-muted-foreground">
            Timing starts with answers from this update onward.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {formatAnswerTime(stats.averageAnswerMs)}
            </span>{" "}
            across {stats.timedAnswerCount} timed{" "}
            {stats.timedAnswerCount === 1 ? "answer" : "answers"}.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Activity</h3>
        <Heatmap stats={stats} />
        <p className="text-xs text-muted-foreground">
          Last 17 weeks
          {stats.activity[0] ? `, from ${shortDay(stats.activity[0].day)}` : ""}.
          Darker days have more answers.
        </p>
      </section>
    </div>
  );
}

function MasteryChart({
  points,
}: {
  points: ProStats["masteryTrend"];
}) {
  const seen = points.some((point) => point.learning > 0 || point.mastered > 0);
  if (!seen) {
    return (
      <p className="text-sm text-muted-foreground">
        Mastered and learning counts show up after you answer a question.
      </p>
    );
  }
  const width = 320;
  const height = 120;
  const pad = 12;
  const max = Math.max(
    1,
    ...points.map((point) => Math.max(point.learning, point.mastered)),
  );
  const line = (key: "learning" | "mastered") =>
    points
      .map((point, index) => {
        const x = pad + (index / Math.max(points.length - 1, 1)) * (width - pad * 2);
        const y = pad + (1 - point[key] / max) * (height - pad * 2);
        return `${x},${y}`;
      })
      .join(" ");
  const latest = points.at(-1);

  return (
    <div className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Learning and mastered questions over the last 30 days"
        className="h-32 w-full"
      >
        <polyline
          fill="none"
          stroke="var(--muted-foreground)"
          strokeWidth="2"
          strokeDasharray="4 3"
          points={line("learning")}
        />
        <polyline
          fill="none"
          stroke="var(--foreground)"
          strokeWidth="2"
          points={line("mastered")}
        />
      </svg>
      <p className="text-xs text-muted-foreground">
        Solid line is mastered. Dashed line is learning.
        {latest
          ? ` Today: ${latest.mastered} mastered, ${latest.learning} learning.`
          : ""}
      </p>
    </div>
  );
}

function RankCard({
  label,
  rank,
}: {
  label: string;
  rank: NonNullable<ProStats["strongest"]>;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{rank.name}</p>
      <p className="text-sm tabular-nums text-muted-foreground">
        {rank.accuracyPercent}% · {rank.correct}/{rank.answered}
      </p>
    </div>
  );
}
