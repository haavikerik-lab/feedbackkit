import test from "node:test";
import assert from "node:assert/strict";
import { defaultClient } from "../src/anthropic";

test("defaultClient builds an AnthropicLike without making a network call", () => {
  const client = defaultClient("sk-test-key");
  assert.equal(typeof client.messages.create, "function");
});
