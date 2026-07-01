import { messageForError } from "../src/aiMessages";
import { AssistError } from "../src/assistClient";

it("maps known statuses to Norwegian copy", () => {
  expect(messageForError(new AssistError(503, "x"), "no")).toBe("AI er utilgjengelig akkurat nå.");
  expect(messageForError(new AssistError(429, "x"), "no")).toBe("For mange forespørsler — vent litt.");
  expect(messageForError(new AssistError(401, "x"), "no")).toBe("AI er ikke tilgjengelig her.");
});

it("falls back to the generic message for unknown status and non-AssistError", () => {
  expect(messageForError(new AssistError(0, "x"), "no")).toBe("Kunne ikke nå AI-en.");
  expect(messageForError(new Error("boom"), "no")).toBe("Kunne ikke nå AI-en.");
});

it("supports english copy", () => {
  expect(messageForError(new AssistError(503, "x"), "en")).toBe("AI is unavailable right now.");
  expect(messageForError(new Error("x"), "en")).toBe("Could not reach the AI.");
});
