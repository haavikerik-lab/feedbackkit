import test from "node:test";
import assert from "node:assert/strict";
import { capAssistRequest, capCaseInput, DEFAULT_CAP } from "../src/cap";

test("capAssistRequest keeps the last maxTurns messages and caps elements to 10", () => {
  const messages = Array.from({ length: 25 }, (_, i) => ({
    role: "user" as const,
    content: `m${i}`,
  }));
  const elements = Array.from({ length: 15 }, (_, i) => ({
    label: `L${i}`,
    text: `T${i}`,
  }));
  const out = capAssistRequest({ mode: "chat", messages, elements });
  assert.equal(out.messages.length, DEFAULT_CAP.maxTurns);
  assert.equal(out.messages[0].content, "m5"); // last 20 of 25 starts at m5
  assert.equal(out.elements!.length, 10);
});

test("capAssistRequest truncates over-long message content", () => {
  const long = "x".repeat(DEFAULT_CAP.maxFieldLen + 50);
  const out = capAssistRequest({
    mode: "chat",
    messages: [{ role: "user", content: long }],
  });
  assert.equal(out.messages[0].content.length, DEFAULT_CAP.maxFieldLen);
});

test("capAssistRequest truncates long element label and text to maxElementLen", () => {
  const long = "z".repeat(DEFAULT_CAP.maxElementLen + 50);
  const out = capAssistRequest({
    mode: "chat",
    messages: [{ role: "user", content: "hi" }],
    elements: [{ label: long, text: long }],
  });
  assert.equal(out.elements![0].label.length, DEFAULT_CAP.maxElementLen);
  assert.equal(out.elements![0].text.length, DEFAULT_CAP.maxElementLen);
});

test("capCaseInput truncates message and caps elements", () => {
  const out = capCaseInput({
    message: "y".repeat(DEFAULT_CAP.maxFieldLen + 10),
    page: "/x",
    elements: Array.from({ length: 12 }, (_, i) => ({ label: `L${i}`, text: `T${i}` })),
  });
  assert.equal(out.message.length, DEFAULT_CAP.maxFieldLen);
  assert.equal(out.elements!.length, 10);
});
