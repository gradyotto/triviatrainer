import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { difficultyQuotas, selectDailyQuestionIds, type DailyCandidate } from "./select";

function pool(count = 30): DailyCandidate[] {
  const bands = ["easy", "medium", "hard"] as const;
  const categories = ["history", "science", "art", "sports", "geography"];
  return Array.from({ length: count }, (_, index) => ({
    id: `q${String(index).padStart(2, "0")}`,
    categorySlug: categories[index % categories.length] ?? "history",
    difficulty: bands[index % bands.length] ?? "medium",
  }));
}

describe("daily question selection", () => {
  it("is stable for a date and ignores input order", () => {
    const candidates = pool();
    const first = selectDailyQuestionIds({
      gameDate: "2026-11-27",
      candidates,
    });
    const reversed = selectDailyQuestionIds({
      gameDate: "2026-11-27",
      candidates: [...candidates].reverse(),
    });
    assert.equal(first.length, 20);
    assert.deepEqual(first, reversed);
    assert.equal(new Set(first).size, 20);
  });

  it("changes with the date and avoids recent questions when it can", () => {
    const candidates = pool(40);
    const today = selectDailyQuestionIds({
      gameDate: "2026-11-27",
      candidates,
    });
    const tomorrow = selectDailyQuestionIds({
      gameDate: "2026-11-28",
      candidates,
    });
    assert.notDeepEqual(today, tomorrow);

    const avoided = selectDailyQuestionIds({
      gameDate: "2026-12-01",
      candidates,
      recentlyUsedIds: today,
    });
    assert.equal(avoided.length, 20);
    assert.equal(avoided.some((id) => today.includes(id)), false);
  });

  it("repeats only when the fresh pool cannot fill the set", () => {
    const candidates = pool(20);
    const ids = candidates.map((item) => item.id);
    const selected = selectDailyQuestionIds({
      gameDate: "2026-11-27",
      candidates,
      recentlyUsedIds: ids,
    });
    assert.equal(selected.length, 20);
    assert.deepEqual(new Set(selected), new Set(ids));
  });

  it("mixes difficulties and more than one category", () => {
    const selectedIds = selectDailyQuestionIds({
      gameDate: "2026-11-27",
      candidates: pool(30),
    });
    const selected = pool(30).filter((item) => selectedIds.includes(item.id));
    const quotas = difficultyQuotas(20);
    for (const band of ["easy", "medium", "hard"] as const) {
      assert.equal(
        selected.filter((item) => item.difficulty === band).length,
        quotas[band],
      );
    }
    assert.ok(new Set(selected.map((item) => item.categorySlug)).size > 1);
  });
});
