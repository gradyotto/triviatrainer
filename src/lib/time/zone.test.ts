import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dayKeyInTimeZone,
  normalizeTimeZone,
  shiftDayKey,
  weekStartKey,
  zonedDayBounds,
} from "./zone";

describe("time zones", () => {
  it("falls back to UTC for missing or unknown zones", () => {
    assert.equal(normalizeTimeZone(null), "UTC");
    assert.equal(normalizeTimeZone("Not/AZone"), "UTC");
    assert.equal(normalizeTimeZone("America/Chicago"), "America/Chicago");
  });

  it("labels an instant with the local calendar day", () => {
    const instant = new Date("2026-11-11T07:30:00.000Z");
    assert.equal(dayKeyInTimeZone(instant, "UTC"), "2026-11-11");
    assert.equal(
      dayKeyInTimeZone(instant, "America/Los_Angeles"),
      "2026-11-10",
    );
  });

  it("bounds a Pacific day and both daylight-saving transition days", () => {
    const pacific = zonedDayBounds("2026-11-11", "America/Los_Angeles");
    assert.equal(pacific?.start.toISOString(), "2026-11-11T08:00:00.000Z");
    assert.equal(pacific?.end.toISOString(), "2026-11-12T08:00:00.000Z");

    const spring = zonedDayBounds("2026-03-08", "America/New_York");
    assert.equal(spring?.start.toISOString(), "2026-03-08T05:00:00.000Z");
    assert.equal(spring?.end.toISOString(), "2026-03-09T04:00:00.000Z");

    const fall = zonedDayBounds("2026-11-01", "America/New_York");
    assert.equal(fall?.start.toISOString(), "2026-11-01T04:00:00.000Z");
    assert.equal(fall?.end.toISOString(), "2026-11-02T05:00:00.000Z");
  });

  it("starts weeks on Monday", () => {
    assert.equal(weekStartKey("2026-11-11"), "2026-11-09");
    assert.equal(shiftDayKey("2026-11-01", -1), "2026-10-31");
    assert.equal(shiftDayKey("2026-13-01", 1), null);
  });
});
