import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { licenseIsFree } from "./commons";
import { artworkSearchTitle, artworkTiming, imageBeforeAnswer } from "./reveal";

describe("artwork images", () => {
  const bosch =
    "The Dutch painter Hieronymus Bosch is best known for his triptych titled ____.";

  it("hides a name-the-artwork image until the answer is in", () => {
    assert.equal(
      artworkTiming(bosch, "The Garden of Earthly Delights"),
      "after",
    );
    assert.equal(
      imageBeforeAnswer({
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Bosch.jpg/960px-Bosch.jpg",
        alt: "The Garden of Earthly Delights",
        credit: "Public domain · Wikimedia Commons",
        prompt: bosch,
        answer: "The Garden of Earthly Delights",
      }),
      null,
    );
  });

  it("can show a painting when the answer is not the title", () => {
    const prompt =
      "The painting 'The Last Supper' was commissioned for a monastery in which Italian city?";
    assert.equal(artworkTiming(prompt, "Milan"), "before");
    assert.equal(artworkSearchTitle(prompt, "Milan"), "The Last Supper");
    assert.equal(artworkSearchTitle(bosch, "The Garden of Earthly Delights"), "The Garden of Earthly Delights");
  });

  it("keeps only public-domain and free licenses", () => {
    assert.equal(licenseIsFree("Public domain"), true);
    assert.equal(licenseIsFree("CC0"), true);
    assert.equal(licenseIsFree("CC BY 4.0"), true);
    assert.equal(licenseIsFree("CC BY-SA 4.0"), true);
    assert.equal(licenseIsFree("CC BY-NC 4.0"), false);
    assert.equal(licenseIsFree("CC BY-ND 2.0"), false);
    assert.equal(licenseIsFree("CC BY 4.0", "Non-commercial"), false);
  });
});
