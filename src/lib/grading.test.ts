import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { answerWithoutBonus, maskBonusText } from "./bonus-reveal";
import { gradeResponse, normalizeFillIn, responseCoversAnswer } from "./grading";

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

  it("allows one typo on 4–7 character answers and two on longer ones", () => {
    assert.equal(gradeResponse({ type: "fill_in", answer: "Helium" }, "Helum"), true);
    assert.equal(gradeResponse({ type: "fill_in", answer: "Helium" }, "Hlum"), false);
    assert.equal(gradeResponse({ type: "fill_in", answer: "skin" }, "skins"), true);
    assert.equal(gradeResponse({ type: "fill_in", answer: "KITT" }, "KIT"), true);
    assert.equal(
      gradeResponse(
        { type: "fill_in", answer: "Constantinople" },
        "Constantinopel",
      ),
      true,
    );
    assert.equal(gradeResponse({ type: "fill_in", answer: "cat" }, "car"), false);
    assert.equal(gradeResponse({ type: "fill_in", answer: "USA" }, "USB"), false);
  });

  it("requires numbers and years to match exactly", () => {
    assert.equal(gradeResponse({ type: "fill_in", answer: "1900" }, "1901"), false);
    assert.equal(gradeResponse({ type: "fill_in", answer: "1900" }, "1,900"), true);
    assert.equal(gradeResponse({ type: "fill_in", answer: "1920s" }, "1920"), false);
    assert.equal(
      gradeResponse({ type: "fill_in", answer: "Apollo 11" }, "Apollo 12"),
      false,
    );
    assert.equal(
      gradeResponse({ type: "fill_in", answer: "Apollo 11" }, "Apolo 11"),
      false,
    );
  });

  it("accepts a listed last name for Nicolaus Copernicus", () => {
    const question = {
      type: "fill_in" as const,
      answer: "Nicolaus Copernicus",
      aliases: ["Copernicus"],
    };
    assert.equal(gradeResponse(question, "Copernicus"), true);
    assert.equal(gradeResponse(question, "  copernicus "), true);
    assert.equal(gradeResponse(question, "Nicolaus Copernicus"), true);
    assert.equal(gradeResponse(question, "Galileo"), false);
  });

  it("strips leading articles and keeps articles in the middle", () => {
    assert.equal(
      gradeResponse(
        { type: "fill_in", answer: "Battle of the Bulge" },
        "battle of bulge",
      ),
      false,
    );
    assert.equal(
      gradeResponse(
        { type: "fill_in", answer: "Battle of the Bulge" },
        "the battle of the bulge",
      ),
      true,
    );
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

  it("accepts curated synonyms, including mental for psychiatric", () => {
    const hospital = { type: "fill_in" as const, answer: "psychiatric" };
    assert.equal(gradeResponse(hospital, "mental"), true);
    assert.equal(gradeResponse(hospital, "mentel"), true);
    assert.equal(gradeResponse(hospital, "hospital"), false);
    assert.equal(
      gradeResponse({ type: "fill_in", answer: "United States" }, "USA"),
      true,
    );
    assert.equal(
      gradeResponse({ type: "fill_in", answer: "United States" }, "U.S."),
      true,
    );
    assert.equal(
      gradeResponse({ type: "fill_in", answer: "United Kingdom" }, "Britain"),
      true,
    );
    assert.equal(
      gradeResponse({ type: "fill_in", answer: "United Kingdom" }, "England"),
      false,
    );
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

describe("bonus redundancy", () => {
  it("treats a full name as already containing the first-name bonus", () => {
    assert.equal(responseCoversAnswer("Walter White", "Walter"), true);
    assert.equal(responseCoversAnswer("Waltr White", "Walter"), true);
    assert.equal(responseCoversAnswer("White", "Walter"), false);
    assert.equal(responseCoversAnswer("Nicolaus Copernicus", "Nicolaus"), true);
  });

  it("hides the bonus portion until the follow-up is resolved", () => {
    assert.equal(
      answerWithoutBonus("Nicolaus Copernicus", ["Nicolaus"]),
      "Copernicus",
    );
    const masked = maskBonusText(
      "Nicolaus Copernicus published his heliocentric theory in 1543.",
      ["Nicolaus"],
    );
    assert.match(masked ?? "", /____/);
    assert.match(masked ?? "", /Copernicus/);
    assert.equal((masked ?? "").includes("Nicolaus"), false);
  });
});

describe("normalizeFillIn", () => {
  it("strips punctuation without splitting numbers", () => {
    assert.equal(normalizeFillIn("U.S.A."), "usa");
    assert.equal(normalizeFillIn("1,900"), "1900");
    assert.equal(normalizeFillIn("don't"), "dont");
  });
});

describe("multi-part fill-in grading", () => {
  const gobi = { type: "fill_in" as const, answer: "China and Mongolia" };

  it("accepts either order, separators, and a small typo in either part", () => {
    assert.equal(gradeResponse(gobi, "China and Mongolia"), true);
    assert.equal(gradeResponse(gobi, "Mongolia and China"), true);
    assert.equal(gradeResponse(gobi, "China, Mongolia"), true);
    assert.equal(gradeResponse(gobi, "China, and Mongolia"), true);
    assert.equal(gradeResponse(gobi, "china & mongolia"), true);
    assert.equal(gradeResponse(gobi, "Mongolia/China"), true);
    assert.equal(gradeResponse(gobi, "China + Mongolia"), true);
    assert.equal(gradeResponse(gobi, "Mongolia and Chna"), true);
    assert.equal(gradeResponse(gobi, "Mongola and China"), true);
  });

  it("accepts a reversed order", () => {
    assert.equal(gradeResponse(gobi, "Mongolia, China"), true);
    assert.equal(gradeResponse(gobi, "Mongolia / China"), true);
  });

  it("rejects a partial answer", () => {
    assert.equal(gradeResponse(gobi, "China"), false);
    assert.equal(gradeResponse(gobi, "Mongolia"), false);
    assert.equal(gradeResponse(gobi, "both China"), false);
  });

  it("rejects an extra part and a wrong substitute", () => {
    assert.equal(gradeResponse(gobi, "China, Mongolia, and Japan"), false);
    assert.equal(gradeResponse(gobi, "China and Japan"), false);
  });

  it("ignores filler such as both and the", () => {
    assert.equal(gradeResponse(gobi, "both China and Mongolia"), true);
    assert.equal(gradeResponse(gobi, "the China and the Mongolia"), true);
    assert.equal(gradeResponse(gobi, "China and Mongolia both"), true);
  });

  it("accepts per-part aliases without widening a reordered duplicate", () => {
    const question = {
      type: "fill_in" as const,
      answer: "China and Mongolia",
      aliases: ["PRC and Outer Mongolia", "Mongolia and China"],
    };
    assert.equal(gradeResponse(question, "PRC and Mongolia"), true);
    assert.equal(gradeResponse(question, "Outer Mongolia / China"), true);
    assert.equal(gradeResponse(question, "Mongolia and PRC"), true);
    assert.equal(gradeResponse(question, "PRC"), false);
    assert.equal(gradeResponse(question, "China and China"), false);
  });

  it("keeps a listed whole-answer alias exact", () => {
    const question = {
      type: "fill_in" as const,
      answer: "China and Mongolia",
      aliases: ["the Gobi countries"],
    };
    assert.equal(gradeResponse(question, "Gobi countries"), true);
    assert.equal(gradeResponse(question, "countries and Gobi"), false);
  });

  it("does not split a number that only contains a thousands separator", () => {
    const question = { type: "fill_in" as const, answer: "1,900" };
    assert.equal(gradeResponse(question, "1900"), true);
    assert.equal(gradeResponse(question, "1,900"), true);
    assert.equal(gradeResponse(question, "900, 1"), false);
    assert.equal(gradeResponse(question, "900 and 1"), false);
  });

  it("does not split single entities that contain and", () => {
    const entities = [
      "Trinidad and Tobago",
      "Bosnia and Herzegovina",
      "Antigua and Barbuda",
      "Saint Kitts and Nevis",
      "Procter & Gamble",
      "Romeo and Juliet",
    ];
    for (const answer of entities) {
      const question = { type: "fill_in" as const, answer };
      const [left, right] = answer.split(/\s+(?:and|&)\s+/i);
      assert.equal(gradeResponse(question, answer), true, answer);
      assert.equal(
        gradeResponse(question, `${right} and ${left}`),
        false,
        `${answer} reversed`,
      );
      assert.equal(gradeResponse(question, left ?? ""), false, `${answer} partial`);
    }
    assert.equal(
      gradeResponse(
        { type: "fill_in", answer: "Procter & Gamble" },
        "Procter and Gamble",
      ),
      true,
    );
    assert.equal(
      gradeResponse(
        { type: "fill_in", answer: "Romeo and Juliet" },
        "Romeo & Juliet",
      ),
      true,
    );
    assert.equal(
      gradeResponse(
        { type: "fill_in", answer: "St. Kitts and Nevis" },
        "Nevis and St. Kitts",
      ),
      false,
    );
  });

  it("keeps a protected entity intact inside a longer answer", () => {
    const question = {
      type: "fill_in" as const,
      answer: "Trinidad and Tobago and Jamaica",
    };
    assert.equal(
      gradeResponse(question, "Jamaica and Trinidad and Tobago"),
      true,
    );
    assert.equal(gradeResponse(question, "Trinidad & Tobago, Jamaica"), true);
    assert.equal(gradeResponse(question, "Trinidad, Tobago, and Jamaica"), false);
    assert.equal(gradeResponse(question, "Trinidad and Tobago"), false);
  });

  it("grades three parts as an unordered set", () => {
    const question = {
      type: "fill_in" as const,
      answer: "France, Germany, and Italy",
    };
    assert.equal(gradeResponse(question, "Italy and Germany and France"), true);
    assert.equal(gradeResponse(question, "France and Germany"), false);
    assert.equal(
      gradeResponse(question, "France, Germany, Italy, and Spain"),
      false,
    );
  });
});
