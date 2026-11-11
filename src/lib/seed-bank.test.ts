import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getSeedBank } from "./seed-bank";

describe("seed question bank", () => {
  const bank = getSeedBank();

  it("keeps only multiple choice and fill-in questions from the legacy bank", () => {
    assert.equal(bank.questions.length, 54);
    assert.equal(
      bank.questions.filter((question) => question.type === "multiple_choice")
        .length,
      25,
    );
    assert.equal(
      bank.questions.filter((question) => question.type === "fill_in").length,
      29,
    );
  });

  it("covers every seeded category", () => {
    assert.equal(bank.categories.length, 9);
    for (const category of bank.categories) {
      assert.ok(
        bank.questions.some((question) => question.category === category.slug),
        category.slug,
      );
    }
  });
});
