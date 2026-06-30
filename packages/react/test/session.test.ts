import { reducer, initialState } from "../src/session";

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
