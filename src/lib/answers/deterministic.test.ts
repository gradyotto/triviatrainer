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
    assert.equal(draft.bonus?.prompt, "What was Copernicus's first name?");
    assert.deepEqual(draft.bonus?.answers, ["Nicolaus"]);
  });

  it("names a particle surname and skips a title's last word", () => {
    const gogh = deterministicDraft({
      prompt: "The painter who cut off part of his ear was ____.",
      answer: "Vincent van Gogh",
    });
    assert.equal(gogh.bonus?.prompt, "What was van Gogh's first name?");
    assert.deepEqual(gogh.bonus?.answers, ["Vincent"]);

    const bosch = deterministicDraft({
      prompt:
        "The Dutch painter Hieronymus Bosch is best known for his triptych titled ____.",
      answer: "The Garden of Earthly Delights",
    });
    assert.equal(bosch.bonus, null);
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
    const withBonus = planned.filter((item) => item.bonusPrompt);
    const ratio = withBonus.length / questions.length;
    assert.ok(ratio <= 0.3, `bonus ratio ${ratio}`);
    assert.ok(withBonus.length > 0);
    for (const item of withBonus) {
      assert.match(item.bonusPrompt ?? "", /^What was .+ first name\?$/);
      assert.notEqual(item.bonusPrompt, "What was their first name?");
    }
    const bosch = planned.find(
      (item) => item.accepted.length >= 0 && questions.find((question) => question.id === item.id)?.answer === "The Garden of Earthly Delights",
    );
    assert.equal(bosch?.bonusPrompt, null);
    const copernicusId = questions.find(
      (question) => question.answer === "Nicolaus Copernicus",
    )?.id;
    const named = planned.find((item) => item.id === copernicusId);
    assert.equal(named?.bonusPrompt, "What was Copernicus's first name?");
    assert.ok(named?.bonusAnswers.includes("Nicolaus"));
    assert.ok(
      named?.accepted.some((value) => normalizeFillIn(value) === "copernicus"),
    );
  });
});
