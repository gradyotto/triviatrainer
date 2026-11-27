import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aliasesAfterAccept,
  dailyChainScore,
  regradeDailyChain,
  type DailyChainAnswer,
} from "./regrade";

function row(
  id: string,
  ordinal: number,
  correct: boolean,
  points: Partial<DailyChainAnswer> = {},
): DailyChainAnswer {
  return {
    id,
    ordinal,
    isCorrect: correct,
    basePoints: correct ? 100 : 0,
    speedPoints: correct ? 50 : 0,
    streakPoints: correct ? 10 : 0,
    points: correct ? 160 : 0,
    elapsedMs: 0,
    bonusPoints: 0,
    difficulty: "easy",
    ...points,
  };
}

describe("dispute accept and regrade", () => {
  it("adds the disputed response as an alias once", () => {
    assert.deepEqual(
      aliasesAfterAccept("psychiatric", [], "mental"),
      ["mental"],
    );
    assert.deepEqual(
      aliasesAfterAccept("psychiatric", ["mental"], "Mental"),
      ["mental"],
    );
    assert.deepEqual(aliasesAfterAccept("psychiatric", [], "psychiatric"), []);
  });

  it("regrades the missed daily answer and rebuilds the day's score", () => {
    const before = [
      row("miss", 0, false),
      row("next", 1, true),
      row("after-miss", 2, false),
      row("later", 3, true, { streakPoints: 10, points: 160 }),
    ];
    const after = regradeDailyChain(before, "miss");
    assert.equal(after[0]?.isCorrect, true);
    assert.equal(after[0]?.points, 160);
    assert.equal(after[0]?.streakPoints, 10);
    assert.equal(after[1]?.streakPoints, 20);
    assert.equal(after[1]?.points, 170);
    assert.equal(after[2]?.points, 0);
    assert.equal(after[3]?.streakPoints, 10);
    assert.equal(after[3]?.points, 160);
    const totals = dailyChainScore(after);
    assert.equal(totals.correctCount, 3);
    assert.equal(totals.score, 160 + 170 + 160);
    assert.equal(dailyChainScore(before).score, 320);
  });
});
