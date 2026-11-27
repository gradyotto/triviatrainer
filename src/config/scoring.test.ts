import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scoreAnswer, scoreBonus, SCORING, speedBonus } from "./scoring";

describe("daily scoring", () => {
  it("pays full speed on an instant correct answer and steps the streak", () => {
    const easy = scoreAnswer({
      correct: true,
      difficulty: "easy",
      elapsedMs: 0,
      streakBefore: 0,
    });
    assert.equal(easy.points, 160);
    assert.equal(easy.basePoints, 100);
    assert.equal(easy.speedPoints, 50);
    assert.equal(easy.streakPoints, 10);
    assert.equal(easy.streakAfter, 1);

    const medium = scoreAnswer({
      correct: true,
      difficulty: "medium",
      elapsedMs: 0,
      streakBefore: 0,
    });
    assert.equal(medium.points, 235);
    assert.equal(medium.basePoints + medium.speedPoints + medium.streakPoints, 235);

    const hard = scoreAnswer({
      correct: true,
      difficulty: "hard",
      elapsedMs: 0,
      streakBefore: 4,
    });
    assert.equal(hard.streakPoints, SCORING.streakBonusCap);
    assert.equal(hard.points, 350);
  });

  it("drops the speed bonus linearly to zero at 20 seconds", () => {
    assert.equal(speedBonus(0), 50);
    assert.equal(speedBonus(10_000), 25);
    assert.equal(speedBonus(20_000), 0);
    assert.equal(speedBonus(45_000), 0);
    const midway = scoreAnswer({
      correct: true,
      difficulty: "medium",
      elapsedMs: 10_000,
      streakBefore: 0,
    });
    assert.equal(midway.points, 198);
    assert.equal(
      midway.basePoints + midway.speedPoints + midway.streakPoints,
      midway.points,
    );
  });

  it("scores a miss as zero and resets the streak", () => {
    const missed = scoreAnswer({
      correct: false,
      difficulty: "hard",
      elapsedMs: 1000,
      streakBefore: 4,
    });
    assert.equal(missed.points, 0);
    assert.equal(missed.streakAfter, 0);
    assert.equal(scoreBonus(true), SCORING.bonusPoints);
    assert.equal(scoreBonus(false), 0);
  });
});
