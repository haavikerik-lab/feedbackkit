import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ELEMENT_MARKER,
  serialize,
  parseContent,
  toApiContent,
  dedupeElements,
  type ComposerSegment,
} from "../src/composer";

const A = { label: "Last ned PDF", text: "Knapp som laster ned feeden" };
const B = { label: "Marker alle lest", text: "Knapp" };

test("serialize: text only → content, no elements", () => {
  const segs: ComposerSegment[] = [{ type: "text", text: "hei" }];
  assert.deepEqual(serialize(segs), { content: "hei", elements: [] });
});

test("serialize: alternating text/element/text keeps order", () => {
  const segs: ComposerSegment[] = [
    { type: "text", text: "denne " },
    { type: "element", element: A },
    { type: "text", text: " lik denne " },
    { type: "element", element: B },
  ];
  const { content, elements } = serialize(segs);
  assert.equal(content, `denne ${ELEMENT_MARKER} lik denne ${ELEMENT_MARKER}`);
  assert.deepEqual(elements, [A, B]);
});

test("parseContent: round-trips serialize", () => {
  const segs: ComposerSegment[] = [
    { type: "text", text: "a " },
    { type: "element", element: A },
    { type: "text", text: " b" },
  ];
  const { content, elements } = serialize(segs);
  assert.deepEqual(parseContent(content, elements), segs);
});

test("parseContent: a marker with no matching element is dropped", () => {
  assert.deepEqual(parseContent(`x${ELEMENT_MARKER}`, []), [{ type: "text", text: "x" }]);
});

test("toApiContent: markers become «label» in order", () => {
  const content = `denne ${ELEMENT_MARKER} lik denne ${ELEMENT_MARKER}`;
  assert.equal(toApiContent(content, [A, B]), "denne «Last ned PDF» lik denne «Marker alle lest»");
});

test("dedupeElements: dedupes by label+text, preserves order, caps", () => {
  const C = { label: "Del feed", text: "Knapp" };
  assert.deepEqual(dedupeElements([A, A, B]), [A, B]);
  // dedup collapses repeats before the cap is hit; order preserved
  assert.deepEqual(dedupeElements([A, B, A, B, A], 2), [A, B]);
  // cap must drop DISTINCT overflow — more distinct elements than the cap.
  // (Guards the `out.length >= cap` break against off-by-one / removal: with 3
  //  distinct and cap 2, a `> cap` regression would return [A, B, C].)
  assert.deepEqual(dedupeElements([A, B, C], 2), [A, B]);
});
