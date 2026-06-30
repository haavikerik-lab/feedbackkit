import test from "node:test";
import assert from "node:assert/strict";
import { FeedbackError } from "../src/errors";

test("FeedbackError carries status + message and is an Error", () => {
  const err = new FeedbackError(503, "AI unavailable");
  assert.ok(err instanceof Error);
  assert.equal(err.status, 503);
  assert.equal(err.message, "AI unavailable");
  assert.equal(err.name, "FeedbackError");
});
