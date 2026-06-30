import test from "node:test";
import assert from "node:assert/strict";
import type { AnthropicLike } from "../src/anthropic";
import type { FeedbackCase } from "@feedbackkit/core";
import { createAssistRoute, createSubmitRoute } from "../src/next";

const okClient: AnthropicLike = {
  messages: {
    create: async () => ({
      content: [{ type: "tool_use", name: "respond", input: { reply: "hi", categories: [] } }],
    }),
  },
};

function jsonRequest(body: string): Request {
  return new Request("http://test/assist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

test("assist route returns 200 with JSON body", async () => {
  const route = createAssistRoute({ anthropicKey: "k", client: okClient });
  const res = await route(
    jsonRequest(JSON.stringify({ mode: "chat", messages: [{ role: "user", content: "x" }] })),
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { reply: "hi", categories: [] });
});

test("FeedbackError status maps to HTTP status (gate -> 401)", async () => {
  const route = createAssistRoute({ anthropicKey: "k", client: okClient, gate: () => false });
  const res = await route(
    jsonRequest(JSON.stringify({ mode: "chat", messages: [{ role: "user", content: "x" }] })),
  );
  assert.equal(res.status, 401);
});

test("invalid JSON returns 400", async () => {
  const route = createSubmitRoute({ onCase: () => {} });
  const res = await route(jsonRequest("{not json"));
  assert.equal(res.status, 400);
});

test("assist route returns 400 on a structurally invalid body", async () => {
  const route = createAssistRoute({ anthropicKey: "k", client: okClient });
  const res = await route(jsonRequest(JSON.stringify({ messages: "not-an-array" })));
  assert.equal(res.status, 400);
});

test("submit route returns 400 when message is missing", async () => {
  const route = createSubmitRoute({ onCase: () => {} });
  const res = await route(jsonRequest(JSON.stringify({ page: "/x" })));
  assert.equal(res.status, 400);
});

test("submit route returns 200 with { ok: true }", async () => {
  let saved: FeedbackCase | undefined;
  const route = createSubmitRoute({
    onCase: (c) => {
      saved = c;
    },
    now: () => new Date("2026-01-01T00:00:00Z"),
  });
  const res = await route(
    new Request("http://test/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "hei", page: "/x" }),
    }),
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(saved!.createdAt, "2026-01-01T00:00:00.000Z");
});
