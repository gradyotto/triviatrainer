import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

const PRO_CHECKOUT_SUCCESS_BANNER =
  "Welcome to TriviaTrainer Pro. You've unlocked unlimited access to questions, current events, and Pro Analytics.";

const PREVIOUS_PRO_CHECKOUT_SUCCESS_BANNER =
  "You're on Pro. Today's question cap is off.";

function jsxText(source: string): string {
  return source
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

describe("account checkout success banner", () => {
  it("welcomes a Pro subscriber after checkout", () => {
    const match = pageSource.match(
      /params\.checkout === "success" && user\.plan === "pro" \? \(\s*<p[^>]*>([\s\S]*?)<\/p>/,
    );
    assert.ok(match, "expected a checkout success banner on the account page");
    assert.equal(jsxText(match[1]), PRO_CHECKOUT_SUCCESS_BANNER);
  });

  it("replaces the previous question-cap confirmation", () => {
    assert.equal(jsxText(pageSource).includes(PREVIOUS_PRO_CHECKOUT_SUCCESS_BANNER), false);
    assert.equal(pageSource.includes("question cap is off"), false);
  });
});
