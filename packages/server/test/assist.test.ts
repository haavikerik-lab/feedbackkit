import test from "node:test";
import assert from "node:assert/strict";
import type { AnthropicLike, CreateParams } from "../src/anthropic";
import { createAssistHandler, DEFAULT_MODEL } from "../src/assist";
import { FeedbackError } from "../src/errors";

function mockClient(
  input: unknown,
  capture?: (p: CreateParams) => void,
): AnthropicLike {
  return {
    messages: {
      create: async (p) => {
        capture?.(p);
        return { content: [{ type: "tool_use", name: "respond", input }] };
      },
    },
  };
}

const chatReq = { mode: "chat" as const, messages: [{ role: "user" as const, content: "x" }] };

test("chat returns reply and filtered categories", async () => {
  const handler = createAssistHandler({
    anthropicKey: "k",
    client: mockClient({ reply: "hi", categories: ["bug", "nope"] }),
  });
  assert.deepEqual(await handler(chatReq), { reply: "hi", categories: ["bug"] });
});

test("draft returns the draft", async () => {
  const handler = createAssistHandler({
    anthropicKey: "k",
    client: mockClient({ draft: "D" }),
  });
  assert.deepEqual(
    await handler({ mode: "draft", messages: [{ role: "user", content: "x" }] }),
    { draft: "D" },
  );
});

test("missing key throws FeedbackError(503)", async () => {
  const handler = createAssistHandler({ anthropicKey: "", client: mockClient({}) });
  await assert.rejects(
    handler(chatReq),
    (e: unknown) => e instanceof FeedbackError && e.status === 503,
  );
});

test("gate rejection throws FeedbackError(401)", async () => {
  const handler = createAssistHandler({
    anthropicKey: "k",
    client: mockClient({ reply: "x", categories: [] }),
    gate: () => false,
  });
  await assert.rejects(
    handler(chatReq),
    (e: unknown) => e instanceof FeedbackError && e.status === 401,
  );
});

test("rateLimit rejection throws FeedbackError(429)", async () => {
  const handler = createAssistHandler({
    anthropicKey: "k",
    client: mockClient({ reply: "x", categories: [] }),
    rateLimit: () => false,
  });
  await assert.rejects(
    handler(chatReq),
    (e: unknown) => e instanceof FeedbackError && e.status === 429,
  );
});

test("uses default model when none given, and a custom model when set", async () => {
  let seen: CreateParams | undefined;
  const def = createAssistHandler({
    anthropicKey: "k",
    client: mockClient({ reply: "x", categories: [] }, (p) => (seen = p)),
  });
  await def(chatReq);
  assert.equal(seen!.model, DEFAULT_MODEL);
  assert.deepEqual(seen!.tool_choice, { type: "tool", name: "respond" });
  assert.equal(seen!.tools.length, 1);
  assert.equal(seen!.tools[0].name, "respond");

  let seen2: CreateParams | undefined;
  const custom = createAssistHandler({
    anthropicKey: "k",
    model: "claude-sonnet-4-6",
    client: mockClient({ reply: "x", categories: [] }, (p) => (seen2 = p)),
  });
  await custom(chatReq);
  assert.equal(seen2!.model, "claude-sonnet-4-6");
});
