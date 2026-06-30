import test from "node:test";
import assert from "node:assert/strict";
import type { FeedbackCase } from "@feedbackkit/core";
import { createSubmitHandler } from "../src/submit";
import { FeedbackError } from "../src/errors";

const baseInput = { message: "hei", page: "/x" as string | null };

test("stamps createdAt server-side and passes the full case to onCase", async () => {
  let saved: FeedbackCase | undefined;
  const handler = createSubmitHandler({
    onCase: (c) => {
      saved = c;
    },
    now: () => new Date("2026-01-01T00:00:00Z"),
  });
  const out = await handler(baseInput);
  assert.deepEqual(out, { ok: true });
  assert.equal(saved!.createdAt, "2026-01-01T00:00:00.000Z");
  assert.equal(saved!.message, "hei");
  assert.equal(saved!.page, "/x");
});

test("gate rejection throws FeedbackError(401)", async () => {
  const handler = createSubmitHandler({ onCase: () => {}, gate: () => false });
  await assert.rejects(
    handler(baseInput),
    (e: unknown) => e instanceof FeedbackError && e.status === 401,
  );
});

test("caps elements to 10 before saving", async () => {
  let saved: FeedbackCase | undefined;
  const handler = createSubmitHandler({ onCase: (c) => { saved = c; } });
  await handler({
    ...baseInput,
    elements: Array.from({ length: 14 }, (_, i) => ({ label: `L${i}`, text: `T${i}` })),
  });
  assert.equal(saved!.elements!.length, 10);
});
