import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildProStats, formatAnswerTime, type AnswerFact } from "./pro-metrics";

const now = new Date("2026-11-11T18:00:00.000Z");

function fact(
  day: string,
  correct: boolean,
  category: string,
  extra: Partial<AnswerFact> = {},
): AnswerFact {
  return {
    createdAt: new Date(`${day}T15:00:00.000Z`),
    correct,
    responseMs: 8_000,
    difficulty: "medium",
    categorySlug: category,
    categoryName: category[0]?.toUpperCase() + category.slice(1),
    ...extra,
  };
}

describe("buildProStats", () => {
  it("builds a daily trend, category weeks, ranks, difficulty, timing, and a heatmap", () => {
    const facts: AnswerFact[] = [
      fact("2026-11-11", true, "history"),
      fact("2026-11-11", false, "history"),
      fact("2026-11-10", true, "science", { difficulty: "hard", responseMs: 12_000 }),
      fact("2026-11-09", true, "history", { difficulty: "easy", responseMs: 4_000 }),
      fact("2026-11-08", false, "science", { responseMs: 11 * 60 * 1000 }),
      fact("2026-11-08", false, "science"),
      fact("2026-11-07", true, "history"),
      fact("2026-11-06", true, "history"),
      fact("2026-11-05", false, "science"),
      fact("2026-11-04", false, "science", { responseMs: null }),
    ];

    const stats = buildProStats(facts, now, "UTC");
    const today = stats.accuracyTrend.at(-1);
    assert.equal(today?.day, "2026-11-11");
    assert.equal(today?.answered, 2);
    assert.equal(today?.accuracyPercent, 50);
    assert.equal(stats.accuracyTrend.length, 30);
    assert.equal(stats.accuracyTrend[0]?.answered, 0);
    assert.equal(stats.accuracyTrend[0]?.accuracyPercent, null);

    assert.equal(stats.weakest?.slug, "science");
    assert.equal(stats.strongest?.slug, "history");
    assert.equal(stats.weakest?.accuracyPercent, 20);
    assert.equal(stats.strongest?.accuracyPercent, 80);

    const history = stats.categoryTrends.find((category) => category.slug === "history");
    const currentWeek = history?.weeks.at(-1);
    assert.equal(currentWeek?.weekStart, "2026-11-09");
    assert.equal(currentWeek?.answered, 3);
    assert.ok(history && history.weeks.length === 8);

    assert.deepEqual(
      stats.difficulty.map((item) => item.difficulty),
      ["easy", "medium", "hard"],
    );
    assert.equal(stats.averageAnswerMs, 8_000);
    assert.equal(stats.timedAnswerCount, 8);
    assert.equal(stats.activity.at(-1)?.count, 2);
    assert.equal(formatAnswerTime(8_800), "9s");
    assert.equal(formatAnswerTime(75_000), "1m 15s");
  });

  it("needs two sampled categories before naming a weakest one", () => {
    const facts = Array.from({ length: 5 }, () =>
      fact("2026-11-11", true, "history"),
    );
    const stats = buildProStats(facts, now, "UTC");
    assert.equal(stats.weakest, null);
    assert.equal(stats.strongest?.slug, "history");
  });

  it("uses the supplied time zone for the trend day", () => {
    const stats = buildProStats(
      [
        {
          createdAt: new Date("2026-11-11T07:30:00.000Z"),
          correct: true,
          responseMs: 1000,
          difficulty: "medium",
          categorySlug: "history",
          categoryName: "History",
        },
      ],
      now,
      "America/Los_Angeles",
    );
    const nov10 = stats.accuracyTrend.find((point) => point.day === "2026-11-10");
    const nov11 = stats.accuracyTrend.find((point) => point.day === "2026-11-11");
    assert.equal(nov10?.answered, 1);
    assert.equal(nov11?.answered, 0);
  });
});
