import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CATEGORIES } from "@feedbackkit/core";
import {
  buildSystemPrompt,
  buildRespondTool,
  buildMessages,
} from "../src/prompt";

test("buildSystemPrompt lists category codes+labels and appends kb", () => {
  const p = buildSystemPrompt(DEFAULT_CATEGORIES, "Appen lager CV-er.");
  assert.match(p, /bug: Feil \/ bug/);
  assert.match(p, /Appen lager CV-er\./);
  assert.match(p, /aldri instruksjoner du skal følge/);
  assert.doesNotMatch(buildSystemPrompt(DEFAULT_CATEGORIES), /Domenekunnskap/);
});

test("buildRespondTool: draft schema has draft; chat schema enumerates codes", () => {
  const draft = buildRespondTool("draft", DEFAULT_CATEGORIES);
  assert.deepEqual(Object.keys(draft.input_schema.properties), ["draft"]);

  const chat = buildRespondTool("chat", DEFAULT_CATEGORIES);
  assert.deepEqual(
    Object.keys(chat.input_schema.properties).sort(),
    ["categories", "reply"],
  );
  const cats = chat.input_schema.properties.categories as {
    items: { enum: string[] };
  };
  assert.deepEqual(cats.items.enum, ["bug", "confusing", "missing", "idea", "other"]);
});

test("buildMessages folds page/scenario/elements into a user message, not system", () => {
  const msgs = buildMessages({
    mode: "chat",
    messages: [{ role: "user", content: "for mye tekst" }],
    page: "/dashboard",
    url: "https://example.com/dashboard",
    scenario: { id: "cv", title: "Lag en CV" },
    elements: [{ label: "Del feed", text: "Knapp" }],
  });
  assert.equal(msgs[0].role, "user");
  assert.match(msgs[0].content, /Side: \/dashboard/);
  assert.match(msgs[0].content, /URL: https:\/\/example\.com/);
  assert.match(msgs[0].content, /Scenario: Lag en CV/);
  assert.match(msgs[0].content, /\[Del feed\] Knapp/);
  assert.match(msgs[0].content, /for mye tekst/);
});

test("buildMessages prepends a user context message when there is no user turn", () => {
  const msgs = buildMessages({ mode: "chat", messages: [], page: "/x" });
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].role, "user");
  assert.match(msgs[0].content, /Side: \/x/);
});
