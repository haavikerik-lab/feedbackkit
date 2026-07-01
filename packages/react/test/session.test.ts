import { reducer, initialState } from "../src/session";
import type { SessionState } from "../src/session";

it("setDraftText replaces the trailing text segment (no duplicate runs)", () => {
  let s = reducer(initialState, { type: "setDraftText", text: "a" });
  s = reducer(s, { type: "setDraftText", text: "ab" });
  expect(s.segments).toEqual([{ type: "text", text: "ab" }]);
});

it("addElement appends an element segment after the text", () => {
  let s = reducer(initialState, { type: "setDraftText", text: "hi" });
  s = reducer(s, { type: "addElement", element: { label: "Btn", text: "Last ned" } });
  expect(s.segments).toEqual([
    { type: "text", text: "hi" },
    { type: "element", element: { label: "Btn", text: "Last ned" } },
  ]);
});

it("setDraftText after an element starts a new text run", () => {
  let s = reducer(initialState, { type: "addElement", element: { label: "B", text: "t" } });
  s = reducer(s, { type: "setDraftText", text: "more" });
  expect(s.segments).toEqual([
    { type: "element", element: { label: "B", text: "t" } },
    { type: "text", text: "more" },
  ]);
});

it("removeSegment splices by index", () => {
  let s = reducer(initialState, { type: "setDraftText", text: "x" });
  s = reducer(s, { type: "addElement", element: { label: "B", text: "t" } });
  s = reducer(s, { type: "removeSegment", index: 1 });
  expect(s.segments).toEqual([{ type: "text", text: "x" }]);
});

it("toggleCategory adds then removes a code", () => {
  let s = reducer(initialState, { type: "toggleCategory", code: "bug" });
  expect(s.categories).toEqual(["bug"]);
  s = reducer(s, { type: "toggleCategory", code: "bug" });
  expect(s.categories).toEqual([]);
});

it("close, clearScenario, and sendError transitions", () => {
  expect(reducer({ ...initialState, open: true }, { type: "close" }).open).toBe(false);
  expect(
    reducer({ ...initialState, scenario: { id: "1", title: "X" } }, { type: "clearScenario" }).scenario,
  ).toBeNull();
  expect(reducer({ ...initialState, status: "sending" }, { type: "sendError" }).status).toBe("error");
});

it("addElement reverts select mode to browse (single pick) but keeps multi", () => {
  expect(
    reducer({ ...initialState, mode: "select" }, { type: "addElement", element: { label: "B", text: "t" } }).mode,
  ).toBe("browse");
  expect(
    reducer({ ...initialState, mode: "multi" }, { type: "addElement", element: { label: "B", text: "t" } }).mode,
  ).toBe("multi");
});

it("close resets mode to browse", () => {
  expect(reducer({ ...initialState, open: true, mode: "select" }, { type: "close" }).mode).toBe("browse");
});

it("aiChatStart only sets thinking; transcript and segments untouched", () => {
  const start: SessionState = {
    ...initialState,
    segments: [{ type: "text", text: "hei" }],
    transcript: [{ role: "user", content: "x" }],
  };
  const s = reducer(start, { type: "aiChatStart" });
  expect(s.aiStatus).toBe("thinking");
  expect(s.aiError).toBeNull();
  expect(s.segments).toEqual(start.segments);
  expect(s.transcript).toEqual(start.transcript);
});

it("aiChatOk commits both turns, clears segments, unions elements, prefills categories", () => {
  const start: SessionState = {
    ...initialState,
    segments: [{ type: "text", text: "hei" }],
    pickedElements: [{ label: "A", text: "a" }],
    aiStatus: "thinking",
  };
  const s = reducer(start, {
    type: "aiChatOk",
    userContent: "hei «B»",
    elements: [{ label: "B", text: "b" }],
    reply: "Hvilken side?",
    categories: ["bug"],
  });
  expect(s.transcript).toEqual([
    { role: "user", content: "hei «B»" },
    { role: "assistant", content: "Hvilken side?" },
  ]);
  expect(s.segments).toEqual([]);
  expect(s.pickedElements).toEqual([{ label: "A", text: "a" }, { label: "B", text: "b" }]);
  expect(s.categories).toEqual(["bug"]);
  expect(s.aiStatus).toBe("idle");
});

it("aiChatOk does not override categories once the user has touched them", () => {
  const start: SessionState = { ...initialState, categoriesTouched: true, categories: ["idea"] };
  const s = reducer(start, {
    type: "aiChatOk", userContent: "x", elements: [], reply: "r", categories: ["bug"],
  });
  expect(s.categories).toEqual(["idea"]);
});

it("toggleCategory marks categoriesTouched", () => {
  const s = reducer(initialState, { type: "toggleCategory", code: "bug" });
  expect(s.categoriesTouched).toBe(true);
});

it("draft lifecycle: aiDraftOk sets draft, setDraft edits, backToChat clears", () => {
  let s = reducer({ ...initialState, aiStatus: "thinking" }, { type: "aiDraftOk", draft: "Utkast" });
  expect(s.draft).toBe("Utkast");
  expect(s.aiStatus).toBe("idle");
  s = reducer(s, { type: "setDraft", text: "Redigert" });
  expect(s.draft).toBe("Redigert");
  s = reducer(s, { type: "backToChat" });
  expect(s.draft).toBeNull();
});

it("sendStart clears a stale AI error (degradation → manual send)", () => {
  const start = { ...initialState, aiStatus: "error" as const, aiError: "Kunne ikke nå AI-en." };
  const s = reducer(start, { type: "sendStart" });
  expect(s.status).toBe("sending");
  expect(s.aiStatus).toBe("idle");
  expect(s.aiError).toBeNull();
});

it("aiError sets error without touching segments or transcript", () => {
  const start: SessionState = {
    ...initialState,
    segments: [{ type: "text", text: "behold" }],
    transcript: [{ role: "user", content: "x" }],
    aiStatus: "thinking",
  };
  const s = reducer(start, { type: "aiError", message: "Kunne ikke nå AI-en." });
  expect(s.aiStatus).toBe("error");
  expect(s.aiError).toBe("Kunne ikke nå AI-en.");
  expect(s.segments).toEqual(start.segments);
  expect(s.transcript).toEqual(start.transcript);
});

it("open/close, setMode, scenario, and send status transitions", () => {
  let s = reducer(initialState, { type: "open" });
  expect(s.open).toBe(true);
  s = reducer(s, { type: "setMode", mode: "select" });
  expect(s.mode).toBe("select");
  s = reducer(s, { type: "selectScenario", scenario: { id: "1", title: "Lag CV" } });
  expect(s.scenario).toEqual({ id: "1", title: "Lag CV" });
  s = reducer(s, { type: "sendStart" });
  expect(s.status).toBe("sending");
  s = reducer(s, { type: "sendOk" });
  expect(s.status).toBe("sent");
});
