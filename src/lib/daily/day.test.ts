import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dayKeyInTimeZone } from "@/lib/time/zone";
import { dailyGameDate, dailyWeekRange, nextDailyStart } from "./day";

describe("Phoenix daily boundaries", () => {
  it("rolls the game day at midnight America/Phoenix, including in summer", () => {
    assert.equal(dailyGameDate(new Date("2026-01-15T06:59:59.000Z")), "2026-01-14");
    assert.equal(dailyGameDate(new Date("2026-01-15T07:00:00.000Z")), "2026-01-15");
    assert.equal(dailyGameDate(new Date("2026-07-15T06:59:59.000Z")), "2026-07-14");
    assert.equal(dailyGameDate(new Date("2026-07-15T07:00:00.000Z")), "2026-07-15");
    assert.equal(
      dayKeyInTimeZone(new Date("2026-01-15T07:00:00.000Z"), "America/Los_Angeles"),
      "2026-01-14",
    );
  });

  it("ends the game day at the next Phoenix midnight", () => {
    const end = nextDailyStart(new Date("2026-11-27T18:00:00.000Z"));
    assert.equal(end?.toISOString(), "2026-11-28T07:00:00.000Z");
    const summer = nextDailyStart(new Date("2026-07-15T18:00:00.000Z"));
    assert.equal(summer?.toISOString(), "2026-07-16T07:00:00.000Z");
  });

  it("treats a week as Monday through Sunday in Phoenix", () => {
    const beforeMonday = dailyWeekRange(new Date("2026-11-23T06:59:59.000Z"));
    assert.deepEqual(beforeMonday, { start: "2026-11-16", end: "2026-11-22" });
    const monday = dailyWeekRange(new Date("2026-11-23T07:00:00.000Z"));
    assert.deepEqual(monday, { start: "2026-11-23", end: "2026-11-29" });
    const friday = dailyWeekRange(new Date("2026-11-27T20:00:00.000Z"));
    assert.deepEqual(friday, { start: "2026-11-23", end: "2026-11-29" });
  });
});
