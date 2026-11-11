import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clerkKeysAreUsable } from "./env";

describe("clerkKeysAreUsable", () => {
  it("accepts test and live key pairs", () => {
    assert.equal(
      clerkKeysAreUsable("pk_test_example", "sk_test_example"),
      true,
    );
    assert.equal(
      clerkKeysAreUsable("pk_live_example", "sk_live_example"),
      true,
    );
  });

  it("rejects missing keys and values that are not Clerk key strings", () => {
    assert.equal(clerkKeysAreUsable(undefined, undefined), false);
    assert.equal(clerkKeysAreUsable("pk_test_example", undefined), false);
    assert.equal(
      clerkKeysAreUsable("not-a-publishable-key", "sk_test_example"),
      false,
    );
    assert.equal(
      clerkKeysAreUsable("pk_test_example", "not-a-secret-key"),
      false,
    );
  });
});
