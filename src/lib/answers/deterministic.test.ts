import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getSeedBank } from "@/lib/seed-bank";
import { normalizeFillIn } from "@/lib/grading";
import { deterministicDraft, planDeterministicAnswers } from "./deterministic";

describe("deterministic accepted answers", () => {
  const copernicus = {
    id: "copernicus",
    prompt:
      "The scientist who proposed the heliocentric model of the solar system was ____.",
    answer: "Nicolaus Copernicus",
  };

  it("adds the last name and a first-name bonus for Copernicus", () => {
    const draft = deterministicDraft(copernicus);
    assert.ok(
      draft.accepted.some((value) => normalizeFillIn(value) === "copernicus"),
    );
    assert.equal(draft.bonus?.prompt, "What was their first name?");
    assert.deepEqual(draft.bonus?.answers, ["Nicolaus"]);
  });

  it("adds a spelling variant for a diaeresis", () => {
    const draft = deterministicDraft({
      prompt: "The first Nobel Prize in Physics was awarded in 1901 to ____.",
      answer: "Wilhelm Röntgen",
    });
    assert.ok(draft.accepted.includes("Röntgen"));
    assert.ok(draft.accepted.includes("Wilhelm Roentgen"));
  });

  it("assigns bonuses to roughly a quarter of the seed fill-in bank", () => {
    const questions = getSeedBank()
      .questions.filter((question) => question.type === "fill_in")
      .map((question) => ({
        id: String(question.legacyId),
        prompt: question.prompt,
        answer: question.answer,
      }));
    const planned = planDeterministicAnswers(questions);
    const withBonus = planned.filter((item) => item.bonusPrompt).length;
    const ratio = withBonus / questions.length;
    assert.ok(ratio >= 0.2 && ratio <= 0.3, `bonus ratio ${ratio}`);
    const copernicusId = questions.find(
      (question) => question.answer === "Nicolaus Copernicus",
    )?.id;
    const named = planned.find((item) => item.id === copernicusId);
    assert.equal(named?.bonusPrompt, "What was their first name?");
    assert.ok(named?.bonusAnswers.includes("Nicolaus"));
    assert.ok(
      named?.accepted.some((value) => normalizeFillIn(value) === "copernicus"),
    );
  });
});
