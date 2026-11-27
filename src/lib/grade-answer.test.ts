import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isBorderlineAnswer } from "./grading";
import { gradeWithSemantics } from "./grade-answer";

describe("semantic grading gate", () => {
  const question = {
    type: "fill_in" as const,
    prompt: "The model is ____.",
    answer: "heliocentric model",
  };

  it("stays off unless a checker is provided", async () => {
    assert.equal(await gradeWithSemantics(question, "geocentric model", null), false);
  });

  it("asks the checker only for a borderline miss", async () => {
    let calls = 0;
    const checker = {
      async equivalent() {
        calls += 1;
        return true;
      },
    };
    assert.equal(isBorderlineAnswer("geocentric model", [question.answer]), true);
    assert.equal(await gradeWithSemantics(question, "geocentric model", checker), true);
    assert.equal(calls, 1);

    calls = 0;
    assert.equal(isBorderlineAnswer("zzzz", [question.answer]), false);
    assert.equal(await gradeWithSemantics(question, "zzzz", checker), false);
    assert.equal(calls, 0);

    calls = 0;
    assert.equal(await gradeWithSemantics(question, "heliocentric model", checker), true);
    assert.equal(calls, 0);
  });
});
