import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CATEGORIES } from "../src/index";

test("DEFAULT_CATEGORIES has the five expected codes in order", () => {
  assert.deepEqual(
    DEFAULT_CATEGORIES.map((c) => c.code),
    ["bug", "confusing", "missing", "idea", "other"],
  );
  for (const c of DEFAULT_CATEGORIES) {
    assert.equal(typeof c.label, "string");
    assert.ok(c.label.length > 0);
  }
});
