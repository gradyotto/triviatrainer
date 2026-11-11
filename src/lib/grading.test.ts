import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gradeResponse, normalizeFillIn } from "./grading";

describe("multiple choice grading", () => {
  const question = {
    type: "multiple_choice" as const,
    answer: "The Brothers Karamazov",
  };

  it("accepts the option text exactly", () => {
    assert.equal(gradeResponse(question, "The Brothers Karamazov"), true);
  });

  it("rejects case, punctuation, and article differences", () => {
    assert.equal(gradeResponse(question, "the brothers karamazov"), false);
    assert.equal(gradeResponse(question, "The Brothers Karamazov."), false);
    assert.equal(gradeResponse(question, "Brothers Karamazov"), false);
  });

  it("rejects a different option", () => {
    assert.equal(gradeResponse(question, "Crime and Punishment"), false);
  });
});

describe("fill-in grading", () => {
  it("ignores case and surrounding punctuation", () => {
    const question = { type: "fill_in" as const, answer: "Helium" };
    assert.equal(gradeResponse(question, "helium"), true);
    assert.equal(gradeResponse(question, "  Helium!!! "), true);
    assert.equal(gradeResponse(question, "helium?"), true);
  });

  it("drops articles", () => {
    const question = {
      type: "fill_in" as const,
      answer: "The Garden of Earthly Delights",
    };
    assert.equal(gradeResponse(question, "Garden of Earthly Delights"), true);
    assert.equal(gradeResponse(question, "the garden of earthly delights"), true);
    assert.equal(gradeResponse(question, "a psychiatric"), false);
  });

  it("treats a leading article as optional on short answers", () => {
    const question = { type: "fill_in" as const, answer: "psychiatric" };
    assert.equal(gradeResponse(question, "the psychiatric"), true);
    assert.equal(gradeResponse(question, "an psychiatric"), true);
  });

  it("folds accents and number punctuation", () => {
    assert.equal(
      gradeResponse(
        { type: "fill_in", answer: "Wilhelm Röntgen" },
        "Wilhelm Rontgen",
      ),
      true,
    );
    assert.equal(
      gradeResponse(
        { type: "fill_in", answer: "Wilhelm Röntgen" },
        "Wilhelm Roentgen",
      ),
      true,
    );
    assert.equal(gradeResponse({ type: "fill_in", answer: "1900" }, "1,900"), true);
  });

  it("accepts an ampersand as and", () => {
    assert.equal(
      gradeResponse(
        { type: "fill_in", answer: "China and Mongolia" },
        "China & Mongolia",
      ),
      true,
    );
  });

  it("allows a minor typo on longer answers only", () => {
    assert.equal(gradeResponse({ type: "fill_in", answer: "Helium" }, "Helum"), true);
    assert.equal(gradeResponse({ type: "fill_in", answer: "Helium" }, "Hlum"), false);
    assert.equal(gradeResponse({ type: "fill_in", answer: "1900" }, "1901"), false);
    assert.equal(gradeResponse({ type: "fill_in", answer: "skin" }, "skins"), false);
    assert.equal(gradeResponse({ type: "fill_in", answer: "KITT" }, "KIT"), false);
  });

  it("rejects extra words and empty responses", () => {
    assert.equal(
      gradeResponse({ type: "fill_in", answer: "Helium" }, "helium gas"),
      false,
    );
    assert.equal(gradeResponse({ type: "fill_in", answer: "Helium" }, ""), false);
    assert.equal(gradeResponse({ type: "fill_in", answer: "Helium" }, "   "), false);
    assert.equal(gradeResponse({ type: "fill_in", answer: "Helium" }, "the"), false);
  });

  it("accepts configured aliases exactly after normalization", () => {
    const question = {
      type: "fill_in" as const,
      answer: "Helium",
      aliases: ["He"],
    };
    assert.equal(gradeResponse(question, "He"), true);
    assert.equal(gradeResponse(question, "hee"), false);
  });
});

describe("normalizeFillIn", () => {
  it("strips punctuation without splitting numbers", () => {
    assert.equal(normalizeFillIn("U.S.A."), "usa");
    assert.equal(normalizeFillIn("1,900"), "1900");
    assert.equal(normalizeFillIn("don't"), "dont");
  });
});
