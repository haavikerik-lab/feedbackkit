import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldInterceptClick } from "../src/picker";

test("blocks the page click while picking a single element (select)", () => {
  assert.equal(shouldInterceptClick("select", false, false), true);
});

test("blocks the page click while multi-picking (multi)", () => {
  assert.equal(shouldInterceptClick("multi", false, false), true);
});

test("never blocks in browse mode (page stays live)", () => {
  assert.equal(shouldInterceptClick("browse", false, false), false);
});

test("never blocks a click inside the feedback UI itself", () => {
  assert.equal(shouldInterceptClick("select", true, false), false);
});

test("never blocks a modifier (cmd/ctrl) click — one-off navigate", () => {
  assert.equal(shouldInterceptClick("select", false, true), false);
});
