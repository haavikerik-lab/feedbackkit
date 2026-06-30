# @feedbackkit/react Implementation Plan (Plan 3 — AI-less widget)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@feedbackkit/react` — an embeddable `<FeedbackWidget>` for the AI-less point+write+send flow: launcher → draggable panel → element picker → composer → manual categories → submit.

**Architecture:** A React component library that reuses `@feedbackkit/core` for all pure logic (composer segments, picker interception rules, panel position) and sends a `FeedbackCaseInput` via `@feedbackkit/server`'s submit contract (`{url}` fetch or `{onCase}` callback). All state lives in one pure `useFeedbackSession` reducer; the only DOM-touching unit is `useElementPicker`. No AI/assist (Plan 4).

**Tech Stack:** TypeScript (strict, ESM), React ≥18 (peer), `@feedbackkit/core`, Vitest + @testing-library/react + jsdom.

## Global Constraints

- **Node ≥22**, ESM only (`"type":"module"`), extensionless relative imports.
- **TypeScript strict.** The react package's `tsconfig.json` extends `../../tsconfig.base.json` but overrides `"jsx": "react-jsx"` and `"lib": ["ES2022","DOM","DOM.Iterable"]`, and sets `"types": ["vitest/globals"]`. This is the ONLY package that touches the DOM — core/server keep `lib:["ES2022"]`.
- **Tests:** Vitest in jsdom (`vitest run`), with @testing-library/react. Test globals (`describe`/`it`/`expect`/`vi`) are enabled via `vitest/globals` — do not import them.
- **React is a peerDependency** (`>=18`); it is also a devDependency so tests can render.
- **Reuse `@feedbackkit/core`** — never reimplement composer/picker/position logic. Import `serialize`, `toApiContent`, `dedupeElements`, `shouldInterceptClick`, `clampPosition`, `parseStoredPosition`, `FEEDBACK_POS_STORAGE_KEY`, and the types from it.
- **No AI:** no `assist` prop, no chat/draft/category-suggestion. `submit` is the only network call.
- **All styling is inline** (React `style` objects) themed by `accent` — no CSS files (host-CSS isolation). Default accent `#f08a5d`, default locale `"no"`.
- **Every commit** ends with the trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Work in the worktree `feedbackkit-react-widget` on branch `session/2026-06-30-react-widget`; run commands from the worktree root.

### Core API reference (already on main — consume, don't change)
```ts
// @feedbackkit/core
type PickedElement = { label: string; text: string };
type ComposerSegment = { type:"text"; text:string } | { type:"element"; element:PickedElement };
function serialize(segments: ComposerSegment[]): { content: string; elements: PickedElement[] };
function toApiContent(content: string, elements?: PickedElement[]): string;
function dedupeElements(elements: PickedElement[], cap?: number): PickedElement[]; // cap=10
type PickerMode = "select" | "multi" | "browse";
function shouldInterceptClick(mode: PickerMode, insideFeedbackUi: boolean, hasModifier: boolean): boolean;
type Point = { x: number; y: number };
function clampPosition(x:number,y:number,w:number,h:number,vw:number,vh:number,margin?:number): Point; // margin=16
function parseStoredPosition(raw: string | null): Point | null;
const FEEDBACK_POS_STORAGE_KEY = "feedbackkit:pos";
type CategoryConfig = { code: string; label: string };
type Scenario = { id: string; title: string; prompt: string };
type FeedbackCaseInput = { message:string; page:string|null; url?:string;
  scenario?:{id:string;title:string}|null; categories?:string[];
  elements?:PickedElement[]; identity?:{id?:string;email?:string;anonymous?:boolean}|null };
const DEFAULT_CATEGORIES: CategoryConfig[];
```

### File structure
```
packages/react/package.json · tsconfig.json · vitest.config.ts · test/setup.ts
packages/react/src/types.ts                 – WidgetProps, SubmitConfig, Identity
packages/react/src/session.ts               – SessionState/Action, reducer, initialState, useFeedbackSession
packages/react/src/describeElement.ts       – Element → PickedElement
packages/react/src/useElementPicker.ts      – DOM picker hook
packages/react/src/client.ts                – submitCase
packages/react/src/components/Composer.tsx
packages/react/src/components/Panel.tsx
packages/react/src/components/Launcher.tsx · SubmitBar.tsx
packages/react/src/components/ScenarioChips.tsx · CategoryPicker.tsx
packages/react/src/components/PickerToolbar.tsx
packages/react/src/FeedbackWidget.tsx
packages/react/src/index.ts                 – barrel
```

---

### Task 1: Package scaffold + Vitest/jsdom/RTL setup

**Files:**
- Create: `packages/react/package.json`, `packages/react/tsconfig.json`, `packages/react/vitest.config.ts`, `packages/react/test/setup.ts`, `packages/react/src/index.ts`
- Test: `packages/react/test/smoke.test.tsx`

**Interfaces:**
- Produces: a working `@feedbackkit/react` workspace whose `vitest run` renders React in jsdom.

- [ ] **Step 1: Create the package files**

`packages/react/package.json`:
```json
{
  "name": "@feedbackkit/react",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "peerDependencies": { "react": ">=18" },
  "dependencies": { "@feedbackkit/core": "*" }
}
```

`packages/react/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": ".",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vitest/globals"]
  },
  "include": ["src", "test", "vitest.config.ts"]
}
```

`packages/react/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
  },
});
```

`packages/react/test/setup.ts`:
```ts
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => cleanup());
```

`packages/react/src/index.ts`:
```ts
export {};
```

- [ ] **Step 2: Install dev dependencies**

Run from the worktree root:
`npm install -D -w @feedbackkit/react vitest @testing-library/react @testing-library/user-event jsdom react react-dom @types/react @types/react-dom`
Expected: deps added to `packages/react/package.json` devDependencies; workspace linked.

- [ ] **Step 3: Write the failing smoke test**

`packages/react/test/smoke.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";

function Hello() {
  return <p>feedbackkit</p>;
}

it("renders React in jsdom", () => {
  render(<Hello />);
  expect(screen.getByText("feedbackkit")).toBeTruthy();
});
```

- [ ] **Step 4: Run test to verify the toolchain**

Run: `npm test -w @feedbackkit/react`
Expected: PASS (1 test). If it fails on config, fix the config — the deliverable is a working Vitest+jsdom+RTL setup.

- [ ] **Step 5: Verify typecheck**

Run: `npm run typecheck -w @feedbackkit/react`
Expected: clean (no errors).

- [ ] **Step 6: Commit**

```bash
git add packages/react/package.json packages/react/tsconfig.json packages/react/vitest.config.ts packages/react/test/setup.ts packages/react/src/index.ts packages/react/test/smoke.test.tsx package.json package-lock.json
git commit -m "chore(react): scaffold @feedbackkit/react with Vitest + RTL + jsdom"
```

---

### Task 2: Public types

**Files:**
- Create: `packages/react/src/types.ts`
- Test: `packages/react/test/types.test.ts`

**Interfaces:**
- Produces: `SubmitConfig`, `Identity`, `FeedbackWidgetProps`.

- [ ] **Step 1: Write the failing test**

`packages/react/test/types.test.ts`:
```ts
import type { SubmitConfig, FeedbackWidgetProps } from "../src/types";

// Type-level test: these assignments must compile. A runtime assertion keeps
// the test file non-empty so the runner reports a pass.
it("SubmitConfig accepts both url and onCase shapes", () => {
  const a: SubmitConfig = { url: "/x" };
  const b: SubmitConfig = { onCase: async () => {} };
  const props: FeedbackWidgetProps = { submit: a };
  expect(typeof props.submit).toBe("object");
  expect("onCase" in b).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @feedbackkit/react`
Expected: FAIL — cannot find module `../src/types`.

- [ ] **Step 3: Write the implementation**

`packages/react/src/types.ts`:
```ts
import type { CategoryConfig, Scenario, FeedbackCaseInput } from "@feedbackkit/core";

export type SubmitConfig =
  | { url: string }
  | { onCase: (c: FeedbackCaseInput) => Promise<void> | void };

export type Identity = { id?: string; email?: string; anonymous?: boolean };

export type FeedbackWidgetProps = {
  submit: SubmitConfig;
  accent?: string;
  locale?: "no" | "en";
  categories?: CategoryConfig[];
  scenarios?: Scenario[];
  identity?: Identity;
};
```

- [ ] **Step 4: Run test + typecheck to verify pass**

Run: `npm run typecheck -w @feedbackkit/react && npm test -w @feedbackkit/react`
Expected: clean; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/types.ts packages/react/test/types.test.ts
git commit -m "feat(react): public widget prop + submit-config types"
```

---

### Task 3: `useFeedbackSession` reducer

**Files:**
- Create: `packages/react/src/session.ts`
- Test: `packages/react/test/session.test.ts`

**Interfaces:**
- Consumes: `PickerMode`, `PickedElement`, `ComposerSegment` from `@feedbackkit/core`.
- Produces: `SessionState`, `SessionAction`, `initialState`, `reducer(state, action)`, `useFeedbackSession()` → `[state, dispatch]`.

- [ ] **Step 1: Write the failing test**

`packages/react/test/session.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @feedbackkit/react`
Expected: FAIL — cannot find module `../src/session`.

- [ ] **Step 3: Write the implementation**

`packages/react/src/session.ts`:
```ts
import { useReducer } from "react";
import type { PickerMode, PickedElement, ComposerSegment } from "@feedbackkit/core";

export type SessionStatus = "idle" | "sending" | "sent" | "error";

export type SessionState = {
  open: boolean;
  mode: PickerMode;
  segments: ComposerSegment[];
  scenario: { id: string; title: string } | null;
  categories: string[];
  status: SessionStatus;
};

export type SessionAction =
  | { type: "open" }
  | { type: "close" }
  | { type: "setMode"; mode: PickerMode }
  | { type: "setDraftText"; text: string }
  | { type: "addElement"; element: PickedElement }
  | { type: "removeSegment"; index: number }
  | { type: "selectScenario"; scenario: { id: string; title: string } }
  | { type: "clearScenario" }
  | { type: "toggleCategory"; code: string }
  | { type: "sendStart" }
  | { type: "sendOk" }
  | { type: "sendError" };

export const initialState: SessionState = {
  open: false,
  mode: "browse",
  segments: [],
  scenario: null,
  categories: [],
  status: "idle",
};

export function reducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "open":
      return { ...state, open: true };
    case "close":
      return { ...state, open: false, mode: "browse" };
    case "setMode":
      return { ...state, mode: action.mode };
    case "setDraftText": {
      const segs = [...state.segments];
      const last = segs[segs.length - 1];
      if (last && last.type === "text") {
        segs[segs.length - 1] = { type: "text", text: action.text };
      } else {
        segs.push({ type: "text", text: action.text });
      }
      return { ...state, segments: segs };
    }
    case "addElement":
      return {
        ...state,
        segments: [...state.segments, { type: "element", element: action.element }],
        mode: state.mode === "select" ? "browse" : state.mode,
      };
    case "removeSegment": {
      const segs = state.segments.filter((_, i) => i !== action.index);
      return { ...state, segments: segs };
    }
    case "selectScenario":
      return { ...state, scenario: action.scenario };
    case "clearScenario":
      return { ...state, scenario: null };
    case "toggleCategory": {
      const has = state.categories.includes(action.code);
      return {
        ...state,
        categories: has
          ? state.categories.filter((c) => c !== action.code)
          : [...state.categories, action.code],
      };
    }
    case "sendStart":
      return { ...state, status: "sending" };
    case "sendOk":
      return { ...state, status: "sent" };
    case "sendError":
      return { ...state, status: "error" };
  }
}

export function useFeedbackSession() {
  return useReducer(reducer, initialState);
}
```

- [ ] **Step 4: Run test + typecheck to verify pass**

Run: `npm run typecheck -w @feedbackkit/react && npm test -w @feedbackkit/react`
Expected: clean; reducer tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/session.ts packages/react/test/session.test.ts
git commit -m "feat(react): useFeedbackSession reducer (pure session state)"
```

---

### Task 4: `describeElement`

**Files:**
- Create: `packages/react/src/describeElement.ts`
- Test: `packages/react/test/describeElement.test.ts`

**Interfaces:**
- Consumes: `PickedElement` from `@feedbackkit/core`.
- Produces: `describeElement(el: Element): PickedElement`.

- [ ] **Step 1: Write the failing test**

`packages/react/test/describeElement.test.ts`:
```ts
import { describeElement } from "../src/describeElement";

function el(html: string): Element {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d.firstElementChild as Element;
}

it("prefers aria-label, then role, then tag name for the label", () => {
  expect(describeElement(el(`<button aria-label="Last ned">x</button>`)).label).toBe("Last ned");
  expect(describeElement(el(`<div role="dialog">x</div>`)).label).toBe("dialog");
  expect(describeElement(el(`<section>x</section>`)).label).toBe("section");
});

it("captures trimmed, whitespace-collapsed text capped at 200 chars", () => {
  const r = describeElement(el(`<p>  hello   world  </p>`));
  expect(r.text).toBe("hello world");
  const long = "z".repeat(250);
  expect(describeElement(el(`<p>${long}</p>`)).text.length).toBe(200);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @feedbackkit/react`
Expected: FAIL — cannot find module `../src/describeElement`.

- [ ] **Step 3: Write the implementation**

`packages/react/src/describeElement.ts`:
```ts
import type { PickedElement } from "@feedbackkit/core";

const LABEL_CAP = 60;
const TEXT_CAP = 200;

export function describeElement(el: Element): PickedElement {
  const aria = el.getAttribute("aria-label");
  const role = el.getAttribute("role");
  const label = (aria || role || el.tagName.toLowerCase()).slice(0, LABEL_CAP);
  const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, TEXT_CAP);
  return { label, text };
}
```

- [ ] **Step 4: Run test + typecheck to verify pass**

Run: `npm run typecheck -w @feedbackkit/react && npm test -w @feedbackkit/react`
Expected: clean; describeElement tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/describeElement.ts packages/react/test/describeElement.test.ts
git commit -m "feat(react): describeElement (DOM element -> PickedElement)"
```

---

### Task 5: `useElementPicker` (DOM hook)

**Files:**
- Create: `packages/react/src/useElementPicker.ts`
- Test: `packages/react/test/useElementPicker.test.tsx`

**Interfaces:**
- Consumes: `shouldInterceptClick`, `PickerMode`, `PickedElement` from `@feedbackkit/core`; `describeElement` from `./describeElement`.
- Produces: `useElementPicker(mode, onPick, rootRef, accent): void`.

- [ ] **Step 1: Write the failing test**

`packages/react/test/useElementPicker.test.tsx`:
```tsx
import { useRef } from "react";
import { render } from "@testing-library/react";
import { useElementPicker } from "../src/useElementPicker";
import type { PickerMode, PickedElement } from "@feedbackkit/core";

function Harness({ mode, onPick }: { mode: PickerMode; onPick: (e: PickedElement) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useElementPicker(mode, onPick, ref, "#f08a5d");
  return (
    <div>
      <div ref={ref} data-fbk>
        <button aria-label="inside">in</button>
      </div>
      <button aria-label="outside">out</button>
    </div>
  );
}

it("picks an outside element in select mode and blocks the click", () => {
  const picks: PickedElement[] = [];
  render(<Harness mode="select" onPick={(e) => picks.push(e)} />);
  const outside = document.querySelector('[aria-label="outside"]') as HTMLElement;
  const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
  outside.dispatchEvent(ev);
  expect(picks).toHaveLength(1);
  expect(picks[0].label).toBe("outside");
  expect(ev.defaultPrevented).toBe(true);
});

it("ignores clicks inside the feedback UI and in browse mode", () => {
  const picks: PickedElement[] = [];
  const { rerender } = render(<Harness mode="select" onPick={(e) => picks.push(e)} />);
  (document.querySelector('[aria-label="inside"]') as HTMLElement).click();
  expect(picks).toHaveLength(0);

  rerender(<Harness mode="browse" onPick={(e) => picks.push(e)} />);
  (document.querySelector('[aria-label="outside"]') as HTMLElement).click();
  expect(picks).toHaveLength(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @feedbackkit/react`
Expected: FAIL — cannot find module `../src/useElementPicker`.

- [ ] **Step 3: Write the implementation**

`packages/react/src/useElementPicker.ts`:
```ts
import { useEffect } from "react";
import type { RefObject } from "react";
import { shouldInterceptClick, type PickerMode, type PickedElement } from "@feedbackkit/core";
import { describeElement } from "./describeElement";

export function useElementPicker(
  mode: PickerMode,
  onPick: (el: PickedElement) => void,
  rootRef: RefObject<HTMLElement | null>,
  accent: string,
): void {
  useEffect(() => {
    if (mode === "browse") return;
    let hovered: HTMLElement | null = null;
    let prevOutline = "";
    const isInside = (t: Element | null) =>
      !!(t && rootRef.current && rootRef.current.contains(t));

    const restore = () => {
      if (hovered) {
        hovered.style.outline = prevOutline;
        hovered = null;
      }
    };
    const onOver = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || isInside(t)) return;
      restore();
      hovered = t;
      prevOutline = t.style.outline;
      t.style.outline = `2px solid ${accent}`;
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (!t) return;
      if (!shouldInterceptClick(mode, isInside(t), e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      e.stopPropagation();
      onPick(describeElement(t));
    };

    document.addEventListener("mouseover", onOver, true);
    document.addEventListener("mouseout", restore, true);
    document.addEventListener("click", onClick, true);
    return () => {
      restore();
      document.removeEventListener("mouseover", onOver, true);
      document.removeEventListener("mouseout", restore, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [mode, onPick, rootRef, accent]);
}
```

- [ ] **Step 4: Run test + typecheck to verify pass**

Run: `npm run typecheck -w @feedbackkit/react && npm test -w @feedbackkit/react`
Expected: clean; picker tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/useElementPicker.ts packages/react/test/useElementPicker.test.tsx
git commit -m "feat(react): useElementPicker DOM hook over core shouldInterceptClick"
```

---

### Task 6: `submitCase` client

**Files:**
- Create: `packages/react/src/client.ts`
- Test: `packages/react/test/client.test.ts`

**Interfaces:**
- Consumes: `FeedbackCaseInput` from `@feedbackkit/core`; `SubmitConfig` from `./types`.
- Produces: `submitCase(submit: SubmitConfig, input: FeedbackCaseInput): Promise<void>`.

- [ ] **Step 1: Write the failing test**

`packages/react/test/client.test.ts`:
```ts
import { submitCase } from "../src/client";
import type { FeedbackCaseInput } from "@feedbackkit/core";

const input: FeedbackCaseInput = { message: "hei", page: "/x" };

it("posts JSON to the configured url", async () => {
  const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  await submitCase({ url: "/api/submit" }, input);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, opts] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/submit");
  expect(opts.method).toBe("POST");
  expect(JSON.parse(opts.body)).toEqual(input);
  vi.unstubAllGlobals();
});

it("throws when the url responds non-ok", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));
  await expect(submitCase({ url: "/x" }, input)).rejects.toThrow();
  vi.unstubAllGlobals();
});

it("calls onCase with the input", async () => {
  const onCase = vi.fn(async () => {});
  await submitCase({ onCase }, input);
  expect(onCase).toHaveBeenCalledWith(input);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @feedbackkit/react`
Expected: FAIL — cannot find module `../src/client`.

- [ ] **Step 3: Write the implementation**

`packages/react/src/client.ts`:
```ts
import type { FeedbackCaseInput } from "@feedbackkit/core";
import type { SubmitConfig } from "./types";

export async function submitCase(
  submit: SubmitConfig,
  input: FeedbackCaseInput,
): Promise<void> {
  if ("url" in submit) {
    const res = await fetch(submit.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`Submit failed: ${res.status}`);
    return;
  }
  await submit.onCase(input);
}
```

- [ ] **Step 4: Run test + typecheck to verify pass**

Run: `npm run typecheck -w @feedbackkit/react && npm test -w @feedbackkit/react`
Expected: clean; client tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/client.ts packages/react/test/client.test.ts
git commit -m "feat(react): submitCase client (url fetch | onCase callback)"
```

---

### Task 7: `Composer` component

**Files:**
- Create: `packages/react/src/components/Composer.tsx`
- Test: `packages/react/test/Composer.test.tsx`

**Interfaces:**
- Consumes: `ComposerSegment` from `@feedbackkit/core`.
- Produces: `Composer({ segments, onText, onRemove, accent })`.

- [ ] **Step 1: Write the failing test**

`packages/react/test/Composer.test.tsx`:
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { Composer } from "../src/components/Composer";
import type { ComposerSegment } from "@feedbackkit/core";

const segs: ComposerSegment[] = [
  { type: "text", text: "denne " },
  { type: "element", element: { label: "Last ned", text: "knapp" } },
];

it("renders committed text and an element chip, with an empty trailing textarea", () => {
  render(<Composer segments={segs} onText={() => {}} onRemove={() => {}} accent="#000" />);
  expect(screen.getByText("denne")).toBeTruthy();
  expect(screen.getByText(/Last ned/)).toBeTruthy();
  expect((screen.getByLabelText("Tilbakemelding") as HTMLTextAreaElement).value).toBe("");
});

it("typing fires onText and removing a chip fires onRemove with its index", () => {
  const onText = vi.fn();
  const onRemove = vi.fn();
  render(<Composer segments={segs} onText={onText} onRemove={onRemove} accent="#000" />);
  fireEvent.change(screen.getByLabelText("Tilbakemelding"), { target: { value: "hei" } });
  expect(onText).toHaveBeenCalledWith("hei");
  fireEvent.click(screen.getByRole("button", { name: /Fjern Last ned/ }));
  expect(onRemove).toHaveBeenCalledWith(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @feedbackkit/react`
Expected: FAIL — cannot find module `../src/components/Composer`.

- [ ] **Step 3: Write the implementation**

`packages/react/src/components/Composer.tsx`:
```tsx
import type { ComposerSegment } from "@feedbackkit/core";

export function Composer({
  segments,
  onText,
  onRemove,
  accent,
}: {
  segments: ComposerSegment[];
  onText: (text: string) => void;
  onRemove: (index: number) => void;
  accent: string;
}) {
  const last = segments[segments.length - 1];
  const trailingIsText = !!last && last.type === "text";
  const head = trailingIsText ? segments.slice(0, -1) : segments;
  const trailingText = trailingIsText ? (last as { type: "text"; text: string }).text : "";

  return (
    <div>
      <div style={{ marginBottom: 6, lineHeight: 1.6 }}>
        {head.map((seg, i) =>
          seg.type === "text" ? (
            <span key={i}>{seg.text}</span>
          ) : (
            <button
              key={i}
              type="button"
              aria-label={`Fjern ${seg.element.label}`}
              onClick={() => onRemove(i)}
              style={{
                border: `1px solid ${accent}`,
                borderRadius: 12,
                padding: "1px 8px",
                margin: "0 2px",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              «{seg.element.label}» ×
            </button>
          ),
        )}
      </div>
      <textarea
        aria-label="Tilbakemelding"
        value={trailingText}
        onChange={(e) => onText(e.target.value)}
        rows={3}
        style={{ width: "100%", boxSizing: "border-box" }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test + typecheck to verify pass**

Run: `npm run typecheck -w @feedbackkit/react && npm test -w @feedbackkit/react`
Expected: clean; Composer tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/components/Composer.tsx packages/react/test/Composer.test.tsx
git commit -m "feat(react): Composer with inline element chips + trailing textarea"
```

---

### Task 8: `Panel` (draggable, position-persisted)

**Files:**
- Create: `packages/react/src/components/Panel.tsx`
- Test: `packages/react/test/Panel.test.tsx`

**Interfaces:**
- Consumes: `FEEDBACK_POS_STORAGE_KEY`, `parseStoredPosition`, `clampPosition`, `Point` from `@feedbackkit/core`.
- Produces: `Panel({ accent, children })`.

- [ ] **Step 1: Write the failing test**

`packages/react/test/Panel.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { Panel } from "../src/components/Panel";
import { FEEDBACK_POS_STORAGE_KEY } from "@feedbackkit/core";

it("renders children and a drag handle", () => {
  render(<Panel accent="#000">child-content</Panel>);
  expect(screen.getByText("child-content")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Flytt panel" })).toBeTruthy();
});

it("loads a stored position and clamps it into the viewport", () => {
  localStorage.setItem(FEEDBACK_POS_STORAGE_KEY, JSON.stringify({ x: 5, y: 5 }));
  render(<Panel accent="#000">x</Panel>);
  // jsdom offsetWidth/Height are 0; clampPosition keeps margin=16 minimum.
  const panel = screen.getByRole("dialog");
  expect(panel.style.left).toBe("16px");
  expect(panel.style.top).toBe("16px");
  localStorage.clear();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @feedbackkit/react`
Expected: FAIL — cannot find module `../src/components/Panel`.

- [ ] **Step 3: Write the implementation**

`packages/react/src/components/Panel.tsx`:
```tsx
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  FEEDBACK_POS_STORAGE_KEY,
  parseStoredPosition,
  clampPosition,
  type Point,
} from "@feedbackkit/core";

export function Panel({ accent, children }: { accent: string; children: ReactNode }) {
  const [pos, setPos] = useState<Point>({ x: 24, y: 24 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raw: string | null = null;
    try { raw = localStorage.getItem(FEEDBACK_POS_STORAGE_KEY); } catch {}
    const stored = parseStoredPosition(raw);
    if (stored) {
      const w = ref.current?.offsetWidth ?? 360;
      const h = ref.current?.offsetHeight ?? 480;
      setPos(clampPosition(stored.x, stored.y, w, h, window.innerWidth, window.innerHeight));
    }
  }, []);

  const onDragStart = (e: React.PointerEvent) => {
    const startX = e.clientX;
    const startY = e.clientY;
    const origin = pos;
    const move = (ev: PointerEvent) =>
      setPos({ x: origin.x + (ev.clientX - startX), y: origin.y + (ev.clientY - startY) });
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      setPos((p) => {
        try { localStorage.setItem(FEEDBACK_POS_STORAGE_KEY, JSON.stringify(p)); } catch {}
        return p;
      });
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Tilbakemeldingspanel"
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        width: 360,
        background: "#fff",
        border: `1px solid ${accent}`,
        borderRadius: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        padding: 12,
        zIndex: 2147483000,
      }}
    >
      <div
        role="button"
        aria-label="Flytt panel"
        onPointerDown={onDragStart}
        style={{ height: 14, cursor: "move", marginBottom: 8, background: accent, borderRadius: 4, touchAction: "none" }}
      />
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Run test + typecheck to verify pass**

Run: `npm run typecheck -w @feedbackkit/react && npm test -w @feedbackkit/react`
Expected: clean; Panel tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/components/Panel.tsx packages/react/test/Panel.test.tsx
git commit -m "feat(react): draggable Panel with core position persistence"
```

---

### Task 9: `Launcher` + `SubmitBar`

**Files:**
- Create: `packages/react/src/components/Launcher.tsx`, `packages/react/src/components/SubmitBar.tsx`
- Test: `packages/react/test/Launcher.test.tsx`, `packages/react/test/SubmitBar.test.tsx`

**Interfaces:**
- Consumes: `SessionStatus` from `../session`.
- Produces: `Launcher({ open, onToggle, accent })`, `SubmitBar({ status, onSend, locale })`.

- [ ] **Step 1: Write the failing tests**

`packages/react/test/Launcher.test.tsx`:
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { Launcher } from "../src/components/Launcher";

it("renders a toggle button and fires onToggle on click", () => {
  const onToggle = vi.fn();
  render(<Launcher open={false} onToggle={onToggle} accent="#000" />);
  fireEvent.click(screen.getByRole("button", { name: /Tilbakemelding/ }));
  expect(onToggle).toHaveBeenCalledTimes(1);
});
```

`packages/react/test/SubmitBar.test.tsx`:
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { SubmitBar } from "../src/components/SubmitBar";

it("labels the button by status and disables while sending", () => {
  const { rerender } = render(<SubmitBar status="idle" onSend={() => {}} locale="no" />);
  expect(screen.getByRole("button").textContent).toBe("Send");
  rerender(<SubmitBar status="sending" onSend={() => {}} locale="no" />);
  expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  rerender(<SubmitBar status="sent" onSend={() => {}} locale="no" />);
  expect(screen.getByRole("button").textContent).toBe("Sendt ✓");
});

it("fires onSend when clicked", () => {
  const onSend = vi.fn();
  render(<SubmitBar status="idle" onSend={onSend} locale="no" />);
  fireEvent.click(screen.getByRole("button"));
  expect(onSend).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w @feedbackkit/react`
Expected: FAIL — cannot find the two new modules.

- [ ] **Step 3: Write the implementations**

`packages/react/src/components/Launcher.tsx`:
```tsx
export function Launcher({
  open,
  onToggle,
  accent,
}: {
  open: boolean;
  onToggle: () => void;
  accent: string;
}) {
  return (
    <button
      type="button"
      aria-label={open ? "Lukk Tilbakemelding" : "Åpne Tilbakemelding"}
      aria-expanded={open}
      onClick={onToggle}
      style={{
        position: "fixed",
        right: 24,
        bottom: 24,
        width: 48,
        height: 48,
        borderRadius: 24,
        border: "none",
        background: accent,
        color: "#fff",
        cursor: "pointer",
        zIndex: 2147483000,
      }}
    >
      💬
    </button>
  );
}
```

`packages/react/src/components/SubmitBar.tsx`:
```tsx
import type { SessionStatus } from "../session";

const LABELS: Record<"no" | "en", Record<SessionStatus, string>> = {
  no: { idle: "Send", sending: "Sender…", sent: "Sendt ✓", error: "Prøv igjen" },
  en: { idle: "Send", sending: "Sending…", sent: "Sent ✓", error: "Try again" },
};

export function SubmitBar({
  status,
  onSend,
  locale,
}: {
  status: SessionStatus;
  onSend: () => void;
  locale: "no" | "en";
}) {
  return (
    <button
      type="button"
      onClick={onSend}
      disabled={status === "sending" || status === "sent"}
      style={{ marginTop: 8 }}
    >
      {LABELS[locale][status]}
    </button>
  );
}
```

- [ ] **Step 4: Run tests + typecheck to verify pass**

Run: `npm run typecheck -w @feedbackkit/react && npm test -w @feedbackkit/react`
Expected: clean; Launcher + SubmitBar tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/components/Launcher.tsx packages/react/src/components/SubmitBar.tsx packages/react/test/Launcher.test.tsx packages/react/test/SubmitBar.test.tsx
git commit -m "feat(react): Launcher button + status-aware SubmitBar"
```

---

### Task 10: `ScenarioChips` + `CategoryPicker`

**Files:**
- Create: `packages/react/src/components/ScenarioChips.tsx`, `packages/react/src/components/CategoryPicker.tsx`
- Test: `packages/react/test/ScenarioChips.test.tsx`, `packages/react/test/CategoryPicker.test.tsx`

**Interfaces:**
- Consumes: `Scenario`, `CategoryConfig` from `@feedbackkit/core`.
- Produces: `ScenarioChips({ scenarios, selectedId, onSelect })`, `CategoryPicker({ categories, selected, onToggle })`.

- [ ] **Step 1: Write the failing tests**

`packages/react/test/ScenarioChips.test.tsx`:
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { ScenarioChips } from "../src/components/ScenarioChips";

const scenarios = [
  { id: "cv", title: "Lag en CV", prompt: "..." },
  { id: "job", title: "Finn jobb", prompt: "..." },
];

it("renders a chip per scenario and fires onSelect", () => {
  const onSelect = vi.fn();
  render(<ScenarioChips scenarios={scenarios} selectedId={null} onSelect={onSelect} />);
  fireEvent.click(screen.getByRole("button", { name: "Lag en CV" }));
  expect(onSelect).toHaveBeenCalledWith(scenarios[0]);
});

it("renders nothing when there are no scenarios", () => {
  const { container } = render(<ScenarioChips scenarios={[]} selectedId={null} onSelect={() => {}} />);
  expect(container.firstChild).toBeNull();
});
```

`packages/react/test/CategoryPicker.test.tsx`:
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { CategoryPicker } from "../src/components/CategoryPicker";

const categories = [
  { code: "bug", label: "Feil" },
  { code: "idea", label: "Idé" },
];

it("renders a checkbox per category, reflects selection, and toggles", () => {
  const onToggle = vi.fn();
  render(<CategoryPicker categories={categories} selected={["bug"]} onToggle={onToggle} />);
  const bug = screen.getByLabelText("Feil") as HTMLInputElement;
  const idea = screen.getByLabelText("Idé") as HTMLInputElement;
  expect(bug.checked).toBe(true);
  expect(idea.checked).toBe(false);
  fireEvent.click(idea);
  expect(onToggle).toHaveBeenCalledWith("idea");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w @feedbackkit/react`
Expected: FAIL — cannot find the two new modules.

- [ ] **Step 3: Write the implementations**

`packages/react/src/components/ScenarioChips.tsx`:
```tsx
import type { Scenario } from "@feedbackkit/core";

export function ScenarioChips({
  scenarios,
  selectedId,
  onSelect,
}: {
  scenarios: Scenario[];
  selectedId: string | null;
  onSelect: (s: Scenario) => void;
}) {
  if (!scenarios.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
      {scenarios.map((s) => (
        <button
          key={s.id}
          type="button"
          aria-pressed={selectedId === s.id}
          onClick={() => onSelect(s)}
          style={{ borderRadius: 12, padding: "2px 10px", cursor: "pointer" }}
        >
          {s.title}
        </button>
      ))}
    </div>
  );
}
```

`packages/react/src/components/CategoryPicker.tsx`:
```tsx
import type { CategoryConfig } from "@feedbackkit/core";

export function CategoryPicker({
  categories,
  selected,
  onToggle,
}: {
  categories: CategoryConfig[];
  selected: string[];
  onToggle: (code: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
      {categories.map((c) => (
        <label key={c.code} style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={selected.includes(c.code)}
            onChange={() => onToggle(c.code)}
          />
          {c.label}
        </label>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tests + typecheck to verify pass**

Run: `npm run typecheck -w @feedbackkit/react && npm test -w @feedbackkit/react`
Expected: clean; ScenarioChips + CategoryPicker tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/components/ScenarioChips.tsx packages/react/src/components/CategoryPicker.tsx packages/react/test/ScenarioChips.test.tsx packages/react/test/CategoryPicker.test.tsx
git commit -m "feat(react): ScenarioChips + manual CategoryPicker"
```

---

### Task 11: `PickerToolbar`

**Files:**
- Create: `packages/react/src/components/PickerToolbar.tsx`
- Test: `packages/react/test/PickerToolbar.test.tsx`

**Interfaces:**
- Consumes: `PickerMode` from `@feedbackkit/core`.
- Produces: `PickerToolbar({ mode, onMode })`. (Picked elements are shown/removed in the Composer, not here — avoids duplicate display and index coupling.)

- [ ] **Step 1: Write the failing test**

`packages/react/test/PickerToolbar.test.tsx`:
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { PickerToolbar } from "../src/components/PickerToolbar";

it("renders the three modes, marks the active one, and fires onMode", () => {
  const onMode = vi.fn();
  render(<PickerToolbar mode="select" onMode={onMode} />);
  expect((screen.getByRole("button", { name: "Velg" })).getAttribute("aria-pressed")).toBe("true");
  expect((screen.getByRole("button", { name: "Bla" })).getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(screen.getByRole("button", { name: "Flervalg" }));
  expect(onMode).toHaveBeenCalledWith("multi");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @feedbackkit/react`
Expected: FAIL — cannot find module `../src/components/PickerToolbar`.

- [ ] **Step 3: Write the implementation**

`packages/react/src/components/PickerToolbar.tsx`:
```tsx
import type { PickerMode } from "@feedbackkit/core";

const MODES: { mode: PickerMode; label: string }[] = [
  { mode: "select", label: "Velg" },
  { mode: "multi", label: "Flervalg" },
  { mode: "browse", label: "Bla" },
];

export function PickerToolbar({
  mode,
  onMode,
}: {
  mode: PickerMode;
  onMode: (m: PickerMode) => void;
}) {
  return (
    <div role="group" aria-label="Pekemodus" style={{ display: "flex", gap: 6, marginBottom: 8 }}>
      {MODES.map((m) => (
        <button
          key={m.mode}
          type="button"
          aria-pressed={mode === m.mode}
          onClick={() => onMode(m.mode)}
          style={{ padding: "2px 10px", cursor: "pointer" }}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test + typecheck to verify pass**

Run: `npm run typecheck -w @feedbackkit/react && npm test -w @feedbackkit/react`
Expected: clean; PickerToolbar test passes.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/components/PickerToolbar.tsx packages/react/test/PickerToolbar.test.tsx
git commit -m "feat(react): PickerToolbar mode selector"
```

---

### Task 12: `FeedbackWidget` integration + barrel + final green

**Files:**
- Create: `packages/react/src/FeedbackWidget.tsx`
- Modify: `packages/react/src/index.ts`
- Test: `packages/react/test/FeedbackWidget.test.tsx`

**Interfaces:**
- Consumes: everything above + `serialize`, `toApiContent`, `dedupeElements`, `DEFAULT_CATEGORIES` from `@feedbackkit/core`.
- Produces: `FeedbackWidget(props: FeedbackWidgetProps)`; barrel exports `FeedbackWidget` + all public types.

- [ ] **Step 1: Write the failing integration test**

`packages/react/test/FeedbackWidget.test.tsx`:
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { FeedbackWidget } from "../src/FeedbackWidget";
import type { FeedbackCaseInput } from "@feedbackkit/core";

it("stops intercepting host clicks once the panel is closed", () => {
  render(<FeedbackWidget submit={{ onCase: () => {} }} />);
  fireEvent.click(screen.getByRole("button", { name: /Tilbakemelding/ })); // open
  fireEvent.click(screen.getByRole("button", { name: "Velg" }));            // enter select
  fireEvent.click(screen.getByRole("button", { name: /Tilbakemelding/ })); // close
  const host = document.body.appendChild(
    Object.assign(document.createElement("button"), { textContent: "host", ariaLabel: "host-el" }),
  );
  const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
  host.dispatchEvent(ev);
  expect(ev.defaultPrevented).toBe(false);
});

it("runs the full point+write+category+send flow and builds a FeedbackCaseInput", async () => {
  const cases: FeedbackCaseInput[] = [];
  render(
    <FeedbackWidget
      submit={{ onCase: (c) => { cases.push(c); } }}
      scenarios={[{ id: "cv", title: "Lag en CV", prompt: "..." }]}
      categories={[{ code: "bug", label: "Feil" }]}
    />,
  );

  // open
  fireEvent.click(screen.getByRole("button", { name: /Tilbakemelding/ }));
  // select a scenario
  fireEvent.click(screen.getByRole("button", { name: "Lag en CV" }));
  // enter select mode and point at an outside element
  fireEvent.click(screen.getByRole("button", { name: "Velg" }));
  document.body.appendChild(
    Object.assign(document.createElement("button"), { textContent: "Del", ariaLabel: "Del feed" }),
  );
  fireEvent.click(document.querySelector('[aria-label="Del feed"]') as HTMLElement);
  // write text
  fireEvent.change(screen.getByLabelText("Tilbakemelding"), { target: { value: "for mye" } });
  // tag a category
  fireEvent.click(screen.getByLabelText("Feil"));
  // send
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  await screen.findByRole("button", { name: "Sendt ✓" });
  expect(cases).toHaveLength(1);
  const c = cases[0];
  expect(c.message).toContain("«Del feed»");
  expect(c.message).toContain("for mye");
  expect(c.elements).toEqual([{ label: "Del feed", text: "Del" }]);
  expect(c.categories).toEqual(["bug"]);
  expect(c.scenario).toEqual({ id: "cv", title: "Lag en CV" });
  expect(c.page).toBe(window.location.pathname);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @feedbackkit/react`
Expected: FAIL — cannot find module `../src/FeedbackWidget`.

- [ ] **Step 3: Write the implementation**

`packages/react/src/FeedbackWidget.tsx`:
```tsx
import { useCallback, useRef } from "react";
import {
  serialize,
  toApiContent,
  dedupeElements,
  DEFAULT_CATEGORIES,
  type PickedElement,
  type FeedbackCaseInput,
} from "@feedbackkit/core";
import type { FeedbackWidgetProps } from "./types";
import { useFeedbackSession } from "./session";
import { useElementPicker } from "./useElementPicker";
import { submitCase } from "./client";
import { Launcher } from "./components/Launcher";
import { Panel } from "./components/Panel";
import { ScenarioChips } from "./components/ScenarioChips";
import { PickerToolbar } from "./components/PickerToolbar";
import { Composer } from "./components/Composer";
import { CategoryPicker } from "./components/CategoryPicker";
import { SubmitBar } from "./components/SubmitBar";

export function FeedbackWidget(props: FeedbackWidgetProps) {
  const accent = props.accent ?? "#f08a5d";
  const locale = props.locale ?? "no";
  const categories = props.categories ?? DEFAULT_CATEGORIES;
  const [state, dispatch] = useFeedbackSession();
  const rootRef = useRef<HTMLDivElement>(null);

  const handlePick = useCallback(
    (el: PickedElement) => dispatch({ type: "addElement", element: el }),
    [],
  );
  useElementPicker(state.open ? state.mode : "browse", handlePick, rootRef, accent);

  const send = async () => {
    dispatch({ type: "sendStart" });
    try {
      const { content, elements } = serialize(state.segments);
      const input: FeedbackCaseInput = {
        message: toApiContent(content, elements),
        page: window.location.pathname,
        url: window.location.href,
        scenario: state.scenario,
        categories: state.categories,
        elements: dedupeElements(elements),
        identity: props.identity ?? null,
      };
      await submitCase(props.submit, input);
      dispatch({ type: "sendOk" });
    } catch {
      dispatch({ type: "sendError" });
    }
  };

  return (
    <div ref={rootRef} data-fbk="">
      <Launcher
        open={state.open}
        onToggle={() => dispatch({ type: state.open ? "close" : "open" })}
        accent={accent}
      />
      {state.open && (
        <Panel accent={accent}>
          <ScenarioChips
            scenarios={props.scenarios ?? []}
            selectedId={state.scenario?.id ?? null}
            onSelect={(s) => dispatch({ type: "selectScenario", scenario: { id: s.id, title: s.title } })}
          />
          <PickerToolbar mode={state.mode} onMode={(m) => dispatch({ type: "setMode", mode: m })} />
          <Composer
            segments={state.segments}
            onText={(t) => dispatch({ type: "setDraftText", text: t })}
            onRemove={(i) => dispatch({ type: "removeSegment", index: i })}
            accent={accent}
          />
          <CategoryPicker
            categories={categories}
            selected={state.categories}
            onToggle={(c) => dispatch({ type: "toggleCategory", code: c })}
          />
          <SubmitBar status={state.status} onSend={send} locale={locale} />
        </Panel>
      )}
    </div>
  );
}
```

`packages/react/src/index.ts` (replace the stub):
```ts
export { FeedbackWidget } from "./FeedbackWidget";
export type { FeedbackWidgetProps, SubmitConfig, Identity } from "./types";
```

- [ ] **Step 4: Run the integration test + full workspace green**

Run: `npm run typecheck -w @feedbackkit/react && npm test -w @feedbackkit/react`
Expected: integration test passes; all react tests green.
Then run the FULL workspace: `npm run typecheck && npm test`
Expected: `@feedbackkit/core`, `@feedbackkit/server` (node:test) and `@feedbackkit/react` (vitest) all typecheck clean and pass.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/FeedbackWidget.tsx packages/react/src/index.ts packages/react/test/FeedbackWidget.test.tsx
git commit -m "feat(react): FeedbackWidget integration + public barrel"
```

---

## Self-Review

**1. Spec coverage** — every spec section maps to a task:
- Egen tsconfig (jsx + DOM) + Vitest/RTL/jsdom → Task 1. Props/SubmitConfig → Task 2. `useFeedbackSession` reducer → Task 3. `describeElement` → Task 4. `useElementPicker` (interception via core `shouldInterceptClick`, outline, cleanup) → Task 5. `submitCase` (url|onCase) → Task 6. Composer inline tokens via core serialize → Task 7. Panel drag + core position persistence → Task 8. Launcher/SubmitBar → Task 9. ScenarioChips/CategoryPicker → Task 10. PickerToolbar → Task 11. FeedbackWidget integration building `FeedbackCaseInput` via core `serialize`/`toApiContent`/`dedupeElements` → Task 12. No assist/AI anywhere (Plan 4).

**2. Placeholder scan** — no TBD/TODO; every code step shows complete code; every run step shows the exact command and expected result.

**3. Type consistency** — names match across tasks: `SessionState`/`SessionAction`/`reducer`/`initialState`/`useFeedbackSession`; `SubmitConfig`/`FeedbackWidgetProps`; `describeElement`; `useElementPicker(mode,onPick,rootRef,accent)`; `submitCase(submit,input)`; component prop shapes (`Composer`, `Panel`, `Launcher`, `SubmitBar`, `ScenarioChips`, `CategoryPicker`, `PickerToolbar`) are consumed in Task 12 exactly as defined. Core imports use the verified signatures in the Core API reference.

**Refinements from the spec (intentional, noted):** state holds `segments: ComposerSegment[]` (single source of truth; subsumes the spec's separate `text`+`elements`); picked-element display/removal lives in the Composer (inline chips), so `PickerToolbar` is mode-only — avoids duplicate element lists and index-mapping bugs. Full mid-text editing before a picked element is a v1 limitation (remove the chip to merge runs).
