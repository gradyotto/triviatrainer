import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { usernameIssue } from "./username";

describe("usernames", () => {
  it("accepts a normal handle and rejects shape, reserved words, and profanity", () => {
    assert.equal(usernameIssue("grady_1"), null);
    assert.equal(usernameIssue("ab"), "format");
    assert.equal(usernameIssue("has-dash"), "format");
    assert.equal(usernameIssue("Admin"), "reserved");
    assert.equal(usernameIssue("ohshit"), "profanity");
  });
});
