import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clampPosition,
  parseStoredPosition,
  FEEDBACK_POS_STORAGE_KEY,
} from "../src/position";

test("clampPosition: a point well inside the viewport is unchanged", () => {
  assert.deepEqual(clampPosition(500, 400, 100, 50, 1000, 800), { x: 500, y: 400 });
});

test("clampPosition: past the right/bottom edge clamps inside (margin 16)", () => {
  // x: 1000 - 100 - 16 = 884 ; y: 800 - 50 - 16 = 734
  assert.deepEqual(clampPosition(2000, 2000, 100, 50, 1000, 800), { x: 884, y: 734 });
});

test("clampPosition: a negative point clamps to the margin", () => {
  assert.deepEqual(clampPosition(-50, -50, 100, 50, 1000, 800), { x: 16, y: 16 });
});

test("clampPosition: a panel larger than the viewport anchors to the margin", () => {
  assert.deepEqual(clampPosition(500, 500, 2000, 2000, 1000, 800), { x: 16, y: 16 });
});

test("parseStoredPosition: a valid JSON point round-trips", () => {
  assert.deepEqual(parseStoredPosition('{"x":10,"y":20}'), { x: 10, y: 20 });
});

test("parseStoredPosition: null / non-JSON / partial / non-finite → null", () => {
  assert.equal(parseStoredPosition(null), null);
  assert.equal(parseStoredPosition("not json"), null);
  assert.equal(parseStoredPosition('{"x":1}'), null);
  assert.equal(parseStoredPosition('{"x":null,"y":2}'), null);
});

test("FEEDBACK_POS_STORAGE_KEY is namespaced to feedbackkit", () => {
  assert.equal(FEEDBACK_POS_STORAGE_KEY, "feedbackkit:pos");
});
