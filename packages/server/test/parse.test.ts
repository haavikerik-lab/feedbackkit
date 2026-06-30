import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CATEGORIES } from "@feedbackkit/core";
import { parseRespond } from "../src/parse";
import { FeedbackError } from "../src/errors";
import type { MessageResponse } from "../src/anthropic";

const toolRes = (input: unknown): MessageResponse => ({
  content: [{ type: "tool_use", name: "respond", input }],
});

test("parseRespond chat returns reply and drops unknown category codes", () => {
  const out = parseRespond(
    toolRes({ reply: "hei", categories: ["bug", "nope"] }),
    "chat",
    DEFAULT_CATEGORIES,
  );
  assert.deepEqual(out, { reply: "hei", categories: ["bug"] });
});

test("parseRespond draft returns the draft string", () => {
  const out = parseRespond(toolRes({ draft: "Utkast" }), "draft", DEFAULT_CATEGORIES);
  assert.deepEqual(out, { draft: "Utkast" });
});

test("parseRespond throws FeedbackError(503) when no respond tool_use block", () => {
  const res: MessageResponse = { content: [{ type: "text" }] };
  assert.throws(
    () => parseRespond(res, "chat", DEFAULT_CATEGORIES),
    (e: unknown) => e instanceof FeedbackError && e.status === 503,
  );
});
