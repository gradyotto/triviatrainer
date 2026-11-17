import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ReviewConfig } from "@/config/review";
import { dayKeyInTimeZone, zonedDayBounds } from "@/lib/time/zone";
import { buildReviewSelection } from "./queue";
import {
  applyReview,
  formatReviewWait,
  initialSchedule,
  isDueToday,
  masteryTrendFromHistories,
  planScheduleBackfill,
  replaySchedule,
  retentionFromHistories,
  summarizeMastery,
  type ReviewAttempt,
  type ScheduleState,
} from "./schedule";

const zone = "UTC";
const config: ReviewConfig = {
  maxReviewsPerSession: 20,
  initialEase: 250,
  minimumEase: 130,
  lapseDelayMinutes: 10,
  firstIntervalDays: 1,
  secondIntervalDays: 6,
  masteryIntervalDays: 21,
  passingQuality: 3,
};

function at(iso: string): Date {
  return new Date(iso);
}

function answer(
  state: ScheduleState,
  correct: boolean,
  iso: string,
  timeZone = zone,
  usedHint = false,
): ScheduleState {
  return applyReview(
    state,
    { correct, usedHint, answeredAt: at(iso), timeZone },
    config,
  );
}

describe("SM-2 schedule", () => {
  it("starts at ease 2.50 with nothing due", () => {
    const state = initialSchedule(config);
    assert.equal(state.easeFactor, 250);
    assert.equal(state.intervalDays, 0);
    assert.equal(state.repetition, 0);
    assert.equal(state.lapses, 0);
    assert.equal(state.nextReviewAt, null);
  });

  it("pushes a correct answer out by 1 day, then 6, using the local calendar", () => {
    const first = answer(initialSchedule(config), true, "2026-11-16T18:00:00.000Z");
    assert.equal(first.easeFactor, 250);
    assert.equal(first.intervalDays, 1);
    assert.equal(first.repetition, 1);
    assert.equal(first.lapses, 0);
    assert.equal(first.nextReviewAt?.toISOString(), "2026-11-17T00:00:00.000Z");

    const second = answer(first, true, "2026-11-17T15:00:00.000Z");
    assert.equal(second.intervalDays, 6);
    assert.equal(second.repetition, 2);
    assert.equal(second.nextReviewAt?.toISOString(), "2026-11-23T00:00:00.000Z");
    assert.ok(second.nextReviewAt && first.nextReviewAt);
    assert.ok(second.nextReviewAt.getTime() > first.nextReviewAt.getTime());
  });

  it("multiplies later intervals by the updated ease factor", () => {
    let state = initialSchedule(config);
    state = answer(state, true, "2026-01-01T12:00:00.000Z");
    state = answer(state, true, "2026-01-02T12:00:00.000Z");
    state = answer(state, true, "2026-01-08T12:00:00.000Z");
    assert.equal(state.easeFactor, 250);
    assert.equal(state.intervalDays, 15);
    assert.equal(state.repetition, 3);
    state = answer(state, true, "2026-01-23T12:00:00.000Z");
    assert.equal(state.intervalDays, 38);
    assert.equal(state.repetition, 4);
  });

  it("lowers ease when a hint was needed and still schedules a passing interval", () => {
    const state = answer(
      initialSchedule(config),
      true,
      "2026-11-16T18:00:00.000Z",
      zone,
      true,
    );
    assert.equal(state.easeFactor, 236);
    assert.equal(state.intervalDays, 1);
    assert.equal(state.repetition, 1);
  });

  it("resets a miss so it is due soon, and does not drop ease below 1.30", () => {
    let state = initialSchedule(config);
    state = answer(state, true, "2026-11-01T12:00:00.000Z");
    state = answer(state, true, "2026-11-02T12:00:00.000Z");
    const missedAt = at("2026-11-08T12:00:00.000Z");
    state = applyReview(
      state,
      { correct: false, usedHint: false, answeredAt: missedAt, timeZone: zone },
      config,
    );
    assert.equal(state.repetition, 0);
    assert.equal(state.intervalDays, 0);
    assert.equal(state.lapses, 1);
    assert.equal(state.easeFactor, 196);
    assert.equal(
      state.nextReviewAt?.getTime(),
      missedAt.getTime() + 10 * 60 * 1000,
    );

    for (let index = 0; index < 30; index += 1) {
      state = applyReview(
        state,
        {
          correct: false,
          usedHint: false,
          answeredAt: new Date(missedAt.getTime() + (index + 1) * 60_000),
          timeZone: zone,
        },
        config,
      );
    }
    assert.equal(state.easeFactor, config.minimumEase);
  });

  it("schedules the next local midnight in the user's time zone", () => {
    const timeZone = "America/Los_Angeles";
    const answeredAt = at("2026-11-17T06:30:00.000Z");
    assert.equal(dayKeyInTimeZone(answeredAt, timeZone), "2026-11-16");
    const state = applyReview(
      initialSchedule(config),
      { correct: true, usedHint: false, answeredAt, timeZone },
      config,
    );
    const due = zonedDayBounds("2026-11-17", timeZone);
    assert.ok(due);
    assert.equal(state.nextReviewAt?.getTime(), due.start.getTime());
    assert.equal(dayKeyInTimeZone(state.nextReviewAt ?? answeredAt, timeZone), "2026-11-17");
  });

  it("uses Phoenix local midnight, 07:00 UTC, for the next review and for due today", () => {
    const timeZone = "America/Phoenix";
    // 06:30 UTC is still the previous evening in Phoenix (UTC-7, no daylight saving).
    const answeredAt = at("2026-11-18T06:30:00.000Z");
    assert.equal(dayKeyInTimeZone(answeredAt, timeZone), "2026-11-17");
    assert.equal(dayKeyInTimeZone(answeredAt, "UTC"), "2026-11-18");

    const state = applyReview(
      initialSchedule(config),
      { correct: true, usedHint: false, answeredAt, timeZone },
      config,
    );
    assert.equal(state.intervalDays, 1);
    assert.equal(state.nextReviewAt?.toISOString(), "2026-11-18T07:00:00.000Z");
    assert.notEqual(state.nextReviewAt?.toISOString(), "2026-11-18T00:00:00.000Z");
    assert.notEqual(state.nextReviewAt?.toISOString(), "2026-11-19T00:00:00.000Z");

    const dueAt = state.nextReviewAt;
    // Same instant: already "today" in UTC, still the previous local day in Phoenix.
    assert.equal(isDueToday(dueAt, answeredAt, "UTC"), true);
    assert.equal(isDueToday(dueAt, answeredAt, timeZone), false);
    assert.equal(
      isDueToday(dueAt, at("2026-11-18T07:30:00.000Z"), timeZone),
      true,
    );
    assert.deepEqual(
      summarizeMastery(
        [{ seenCount: 1, intervalDays: 1, nextReviewAt: dueAt }],
        answeredAt,
        timeZone,
        config,
      ),
      { learning: 1, mastered: 0, dueToday: 0 },
    );
    assert.deepEqual(
      summarizeMastery(
        [{ seenCount: 1, intervalDays: 1, nextReviewAt: dueAt }],
        at("2026-11-18T07:30:00.000Z"),
        timeZone,
        config,
      ),
      { learning: 1, mastered: 0, dueToday: 1 },
    );
  });
});

describe("backfill", () => {
  it("replays the answer log in order, matching step-by-step updates", () => {
    const attempts: ReviewAttempt[] = [
      { correct: false, usedHint: false, answeredAt: at("2026-10-01T12:00:00.000Z") },
      { correct: true, usedHint: true, answeredAt: at("2026-10-02T12:00:00.000Z") },
      { correct: true, usedHint: false, answeredAt: at("2026-10-03T18:00:00.000Z") },
    ];
    const replayed = replaySchedule(attempts, zone, config);
    const stepped = attempts.reduce(
      (state, attempt) => applyReview(state, { ...attempt, timeZone: zone }, config),
      initialSchedule(config),
    );
    assert.deepEqual(replayed, stepped);
    assert.equal(replayed.lapses, 1);
    assert.equal(replayed.repetition, 2);
    assert.equal(replayed.intervalDays, 6);
    assert.ok(replayed.nextReviewAt);
    assert.ok(replayed.nextReviewAt.getTime() < at("2026-11-17T00:00:00.000Z").getTime());
  });

  it("skips a question that already has a due date", () => {
    const plan = planScheduleBackfill({
      attempts: [
        { correct: false, usedHint: false, answeredAt: at("2026-10-01T12:00:00.000Z") },
      ],
      timeZone: zone,
      hasProgressRow: true,
      nextReviewAt: at("2026-10-01T12:10:00.000Z"),
      config,
    });
    assert.equal(plan.action, "skip");
  });

  it("updates an existing row that was never scheduled", () => {
    const plan = planScheduleBackfill({
      attempts: [
        { correct: true, usedHint: false, answeredAt: at("2026-11-01T12:00:00.000Z") },
        { correct: false, usedHint: false, answeredAt: at("2026-11-02T12:00:00.000Z") },
      ],
      timeZone: zone,
      hasProgressRow: true,
      nextReviewAt: null,
      config,
    });
    assert.equal(plan.action, "update");
    assert.equal(plan.seenCount, 2);
    assert.equal(plan.correctCount, 1);
    assert.equal(plan.incorrectCount, 1);
    assert.equal(plan.streak, 0);
    assert.equal(plan.lastCorrect, false);
    assert.equal(plan.schedule.lapses, 1);
    assert.equal(plan.schedule.repetition, 0);
    assert.equal(
      plan.schedule.nextReviewAt?.toISOString(),
      "2026-11-02T12:10:00.000Z",
    );
  });

  it("inserts a schedule when attempts exist without a progress row", () => {
    const plan = planScheduleBackfill({
      attempts: [
        { correct: true, usedHint: false, answeredAt: at("2026-11-10T09:00:00.000Z") },
        { correct: true, usedHint: false, answeredAt: at("2026-11-10T09:05:00.000Z") },
      ],
      timeZone: zone,
      hasProgressRow: false,
      nextReviewAt: null,
      config,
    });
    assert.equal(plan.action, "insert");
    assert.equal(plan.streak, 2);
    assert.equal(plan.schedule.repetition, 2);
    assert.equal(plan.lastCorrect, true);
  });

  it("does nothing when there is no answer history", () => {
    const plan = planScheduleBackfill({
      attempts: [],
      timeZone: zone,
      hasProgressRow: true,
      nextReviewAt: null,
      config,
    });
    assert.equal(plan.action, "skip");
  });
});

describe("review queue", () => {
  const now = at("2026-11-17T18:00:00.000Z");

  it("serves the most overdue and weakest due questions, then recent misses", () => {
    const selection = buildReviewSelection(
      [
        {
          questionId: "recent-miss",
          nextReviewAt: at("2026-11-20T00:00:00.000Z"),
          easeFactor: 250,
          correctCount: 1,
          seenCount: 2,
          incorrectCount: 1,
          lastCorrect: false,
          lastAnsweredAt: at("2026-11-16T12:00:00.000Z"),
        },
        {
          questionId: "older-miss",
          nextReviewAt: at("2026-11-19T00:00:00.000Z"),
          easeFactor: 250,
          correctCount: 0,
          seenCount: 1,
          incorrectCount: 1,
          lastCorrect: false,
          lastAnsweredAt: at("2026-11-01T12:00:00.000Z"),
        },
        {
          questionId: "overdue-strong",
          nextReviewAt: at("2026-11-10T00:00:00.000Z"),
          easeFactor: 260,
          correctCount: 4,
          seenCount: 4,
          incorrectCount: 0,
          lastCorrect: true,
          lastAnsweredAt: at("2026-11-09T00:00:00.000Z"),
        },
        {
          questionId: "overdue-weak",
          nextReviewAt: at("2026-11-10T00:00:00.000Z"),
          easeFactor: 150,
          correctCount: 1,
          seenCount: 4,
          incorrectCount: 3,
          lastCorrect: false,
          lastAnsweredAt: at("2026-11-09T00:00:00.000Z"),
        },
        {
          questionId: "due-later-today",
          nextReviewAt: at("2026-11-17T22:00:00.000Z"),
          easeFactor: 250,
          correctCount: 0,
          seenCount: 1,
          incorrectCount: 1,
          lastCorrect: false,
          lastAnsweredAt: at("2026-11-17T21:50:00.000Z"),
        },
        {
          questionId: "not-due",
          nextReviewAt: at("2026-11-18T00:00:00.000Z"),
          easeFactor: 250,
          correctCount: 3,
          seenCount: 3,
          incorrectCount: 0,
          lastCorrect: true,
          lastAnsweredAt: at("2026-11-17T00:00:00.000Z"),
        },
      ],
      now,
      zone,
      4,
    );
    assert.equal(selection.dueCount, 3);
    assert.deepEqual(selection.orderedIds, [
      "overdue-weak",
      "overdue-strong",
      "due-later-today",
      "recent-miss",
    ]);
  });

  it("stays empty when nothing is due, even if something was missed earlier", () => {
    const selection = buildReviewSelection(
      [
        {
          questionId: "miss",
          nextReviewAt: at("2026-11-18T00:00:00.000Z"),
          easeFactor: 200,
          correctCount: 0,
          seenCount: 1,
          incorrectCount: 1,
          lastCorrect: false,
          lastAnsweredAt: at("2026-11-17T12:00:00.000Z"),
        },
      ],
      now,
      zone,
      10,
    );
    assert.equal(selection.dueCount, 0);
    assert.deepEqual(selection.orderedIds, []);
  });
});

describe("mastery and retention", () => {
  const now = at("2026-11-17T18:00:00.000Z");

  it("counts learning, mastered, and due today in the user's day", () => {
    const summary = summarizeMastery(
      [
        {
          seenCount: 4,
          intervalDays: 21,
          nextReviewAt: at("2026-11-17T00:00:00.000Z"),
        },
        {
          seenCount: 1,
          intervalDays: 1,
          nextReviewAt: at("2026-11-18T00:00:00.000Z"),
        },
        {
          seenCount: 0,
          intervalDays: 0,
          nextReviewAt: null,
        },
      ],
      now,
      zone,
      config,
    );
    assert.deepEqual(summary, { learning: 1, mastered: 1, dueToday: 1 });
  });

  it("counts a review only when the question was already due", () => {
    const early: ReviewAttempt[] = [
      { correct: true, usedHint: false, answeredAt: at("2026-11-16T15:00:00.000Z") },
      { correct: true, usedHint: false, answeredAt: at("2026-11-16T16:00:00.000Z") },
    ];
    const onTime: ReviewAttempt[] = [
      { correct: true, usedHint: false, answeredAt: at("2026-11-10T15:00:00.000Z") },
      { correct: false, usedHint: false, answeredAt: at("2026-11-12T15:00:00.000Z") },
    ];
    const stats = retentionFromHistories([early, onTime], zone, now, config);
    assert.equal(stats.reviews, 1);
    assert.equal(stats.correct, 0);
    assert.equal(stats.percent, 0);
  });

  it("builds a mastery trend from replayed history", () => {
    const history: ReviewAttempt[] = [
      { correct: true, usedHint: false, answeredAt: at("2026-11-01T12:00:00.000Z") },
      { correct: true, usedHint: false, answeredAt: at("2026-11-02T12:00:00.000Z") },
      { correct: true, usedHint: false, answeredAt: at("2026-11-08T12:00:00.000Z") },
      { correct: true, usedHint: false, answeredAt: at("2026-11-23T12:00:00.000Z") },
    ];
    const short = {
      ...config,
      masteryIntervalDays: 15,
    };
    const trend = masteryTrendFromHistories([history], now, zone, short);
    assert.equal(trend.length, 30);
    const beforeThird = trend.find((point) => point.day === "2026-11-07");
    const afterThird = trend.find((point) => point.day === "2026-11-08");
    assert.equal(beforeThird?.learning, 1);
    assert.equal(beforeThird?.mastered, 0);
    assert.equal(afterThird?.mastered, 1);
    assert.equal(afterThird?.learning, 0);
    assert.equal(trend.at(-1)?.mastered, 1);
  });

  it("formats the wait until the next review", () => {
    const now = at("2026-11-17T18:00:00.000Z");
    assert.equal(
      formatReviewWait(now, at("2026-11-17T18:10:00.000Z")),
      "10 minutes",
    );
    assert.equal(formatReviewWait(now, at("2026-11-17T20:00:00.000Z")), "2 hours");
    assert.equal(formatReviewWait(now, at("2026-11-18T18:00:00.000Z")), "1 day");
    assert.equal(formatReviewWait(now, at("2026-11-20T18:00:00.000Z")), "3 days");
  });
});
