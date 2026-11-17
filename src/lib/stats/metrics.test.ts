import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  accuracyPercent,
  buildBasicStats,
  currentDayStreak,
  formatUtcDate,
} from "./metrics";

const now = new Date("2026-11-11T18:00:00.000Z");

describe("accuracyPercent", () => {
  it("rounds to the nearest percent and treats an empty tally as zero", () => {
    assert.equal(accuracyPercent(0, 0), 0);
    assert.equal(accuracyPercent(1, 3), 33);
    assert.equal(accuracyPercent(2, 3), 67);
    assert.equal(accuracyPercent(1, 2), 50);
    assert.equal(accuracyPercent(4, 4), 100);
  });

  it("does not report more than 100 percent", () => {
    assert.equal(accuracyPercent(5, 4), 100);
  });
});

describe("currentDayStreak", () => {
  it("counts consecutive days through today", () => {
    assert.equal(
      currentDayStreak(["2026-11-09", "2026-11-10", "2026-11-11"], now),
      3,
    );
  });

  it("keeps the streak when today has no answer yet", () => {
    assert.equal(currentDayStreak(["2026-11-10", "2026-11-09"], now), 2);
  });

  it("ends the streak when the latest day is older than yesterday", () => {
    assert.equal(currentDayStreak(["2026-11-09", "2026-11-08"], now), 0);
    assert.equal(currentDayStreak([], now), 0);
  });

  it("counts each day once and ignores days in the future", () => {
    assert.equal(
      currentDayStreak(
        ["2026-11-11", "2026-11-11", "2026-11-12", "not-a-day"],
        now,
      ),
      1,
    );
  });

  it("uses the viewer's calendar instead of UTC when a time zone is set", () => {
    const early = new Date("2026-11-11T06:00:00.000Z");
    assert.equal(
      currentDayStreak(["2026-11-11"], early, "UTC"),
      1,
    );
    assert.equal(
      currentDayStreak(["2026-11-10", "2026-11-09"], early, "America/Los_Angeles"),
      2,
    );
    assert.equal(
      currentDayStreak(["2026-11-11"], early, "America/Los_Angeles"),
      0,
    );
  });

  it("crosses month and leap-day boundaries", () => {
    assert.equal(
      currentDayStreak(["2026-01-01", "2025-12-31"], new Date("2026-01-01T00:30:00.000Z")),
      2,
    );
    assert.equal(
      currentDayStreak(
        ["2028-02-28", "2028-02-29", "2028-03-01"],
        new Date("2028-03-01T12:00:00.000Z"),
      ),
      3,
    );
  });
});

describe("formatUtcDate", () => {
  it("formats the UTC calendar day", () => {
    assert.equal(formatUtcDate(new Date("2026-11-11T03:30:00.000Z")), "Nov 11, 2026");
  });
});

describe("buildBasicStats", () => {
  it("rolls up accuracy, the day streak, and the latest sessions", () => {
    const stats = buildBasicStats({
      answered: 4,
      correct: 3,
      categories: [
        {
          slug: "science",
          name: "Science",
          sortOrder: 1,
          answered: 1,
          correct: 1,
        },
        {
          slug: "history",
          name: "History",
          sortOrder: 0,
          answered: 3,
          correct: 2,
        },
        {
          slug: "art",
          name: "Art",
          sortOrder: 6,
          answered: 0,
          correct: 0,
        },
      ],
      answeredAt: [
        new Date("2026-11-11T02:00:00.000Z"),
        new Date("2026-11-11T02:05:00.000Z"),
        new Date("2026-11-10T23:00:00.000Z"),
      ],
      sessions: [
        {
          id: "older",
          startedAt: new Date("2026-11-10T23:00:00.000Z"),
          setLabel: "History",
          answered: 1,
          correct: 1,
        },
        {
          id: "empty",
          startedAt: new Date("2026-11-11T04:00:00.000Z"),
          setLabel: "Sports",
          answered: 0,
          correct: 0,
        },
        {
          id: "newer",
          startedAt: new Date("2026-11-11T02:00:00.000Z"),
          setLabel: "Mixed",
          answered: 3,
          correct: 2,
        },
      ],
      now,
    });

    assert.equal(stats.questionsAnswered, 4);
    assert.equal(stats.correctCount, 3);
    assert.equal(stats.accuracyPercent, 75);
    assert.equal(stats.dayStreak, 2);
    assert.deepEqual(
      stats.categories.map((category) => ({
        slug: category.slug,
        accuracyPercent: category.accuracyPercent,
        correct: category.correct,
        answered: category.answered,
      })),
      [
        { slug: "history", accuracyPercent: 67, correct: 2, answered: 3 },
        { slug: "science", accuracyPercent: 100, correct: 1, answered: 1 },
      ],
    );
    assert.deepEqual(
      stats.recentSessions.map((session) => session.id),
      ["newer", "older"],
    );
    assert.equal(stats.recentSessions[0]?.setLabel, "Mixed");
    assert.equal(stats.recentSessions[0]?.accuracyPercent, 67);
    assert.deepEqual(stats.mastery, { learning: 0, mastered: 0, dueToday: 0 });
  });

  it("rolls mastery into the basic stats", () => {
    const stats = buildBasicStats({
      answered: 2,
      correct: 2,
      categories: [],
      answeredAt: [],
      sessions: [],
      progress: [
        {
          seenCount: 4,
          intervalDays: 21,
          nextReviewAt: new Date("2026-11-11T00:00:00.000Z"),
        },
        {
          seenCount: 1,
          intervalDays: 1,
          nextReviewAt: new Date("2026-11-12T00:00:00.000Z"),
        },
      ],
      now,
      timeZone: "UTC",
    });
    assert.deepEqual(stats.mastery, { learning: 1, mastered: 1, dueToday: 1 });
  });
});
