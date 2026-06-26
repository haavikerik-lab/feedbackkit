# feedbackkit Core (`@feedbackkit/core`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the feedbackkit monorepo and ship `@feedbackkit/core` — the pure, framework-agnostic logic (composer, position, picker predicate) extracted from the LexPulse feedback chat, fully unit-tested.

**Architecture:** An npm-workspaces monorepo. The first package, `@feedbackkit/core`, contains only pure functions (no React, no DOM event wiring, no server). It is the single source of truth for the inline element-token model, the draggable-panel clamp math, and the picker click-intercept predicate. Later plans (`server`, `react`, examples) consume it.

**Tech Stack:** TypeScript (strict, ESM, `moduleResolution: "Bundler"`), npm workspaces, `node:test` run through `tsx` (zero extra test-framework dependencies — matches LexPulse). No bundler/publish config yet (consumers in-repo import the TS source directly).

## Global Constraints

- **Node ≥ 22** — required for the built-in test runner's glob expansion and `tsx` type-stripping. Declared in root `engines`.
- **ESM only** — every `package.json` sets `"type": "module"`; imports are extensionless (`moduleResolution: "Bundler"`), never `.js`-suffixed.
- **Test runner is `node:test` via `node --import tsx --test`** — NOT Vitest in this package (Vitest arrives in the later React-widget plan, where a DOM is needed). Zero extra deps here.
- **npm workspaces** — not pnpm/yarn (matches the user's ecosystem).
- **Ported pure logic stays behaviorally identical to LexPulse** — these functions are battle-tested. The ONLY intentional change is the localStorage key namespace (`lexpulse-feedback-pos` → `feedbackkit:pos`).
- **`@feedbackkit/core` stays DOM-free** — the base TS `lib` is `["ES2022"]` only (no `DOM`), which enforces purity at compile time.
- **No credentials in any committed file.**
- **Commit messages in English**, and every commit ends with the trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **All commands run from the repo root** `C:\Users\haavi\Claude Code\feedbackkit` (PowerShell), unless a `-w` workspace flag sets the cwd.

---

### Task 1: Scaffold monorepo + `@feedbackkit/core` package, port `composer`

**Files:**
- Create: `package.json` (root)
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `README.md`
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/composer.ts`
- Create: `packages/core/src/index.ts`
- Test: `packages/core/test/composer.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces (exported from `@feedbackkit/core`):
  - `ELEMENT_MARKER: string`
  - `type PickedElement = { label: string; text: string }`
  - `type ComposerSegment = { type: "text"; text: string } | { type: "element"; element: PickedElement }`
  - `serialize(segments: ComposerSegment[]): { content: string; elements: PickedElement[] }`
  - `parseContent(content: string, elements?: PickedElement[]): ComposerSegment[]`
  - `toApiContent(content: string, elements?: PickedElement[]): string`
  - `dedupeElements(elements: PickedElement[], cap?: number): PickedElement[]`

- [ ] **Step 1: Create the root scaffold files**

`package.json` (root):

```json
{
  "name": "feedbackkit",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*"],
  "engines": { "node": ">=22" },
  "scripts": {
    "typecheck": "npm run typecheck --workspaces --if-present",
    "test": "npm run test --workspaces --if-present"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "tsx": "^4.19.0"
  }
}
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "declaration": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

`.gitignore`:

```gitignore
node_modules/
dist/
coverage/
*.log
.DS_Store
```

`README.md`:

```markdown
# feedbackkit

Embeddable AI feedback widget — element picker + optional AI interview + owner-authored
test scenarios. Extracted as a standalone project from the LexPulse feedback chat.

- Design spec: `docs/superpowers/specs/2026-06-26-feedbackkit-design.md`
- Implementation plans: `docs/superpowers/plans/`

## Packages

- `@feedbackkit/core` — pure, framework-agnostic logic (composer, position, picker predicate).

## Development

Requires Node ≥ 22.

```sh
npm install
npm test
npm run typecheck
```
```

- [ ] **Step 2: Create the `@feedbackkit/core` package manifest + tsconfig**

`packages/core/package.json`:

```json
{
  "name": "@feedbackkit/core",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "node --import tsx --test \"test/**/*.test.ts\""
  }
}
```

`packages/core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "." },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: Install dependencies**

Run: `npm install`
Expected: workspaces resolve; `node_modules/` created at root with `typescript` and `tsx`. No errors.

- [ ] **Step 4: Write the failing test** (ported verbatim from LexPulse `src/lib/feedback/composer.test.ts`, with the import path pointed at `../src/composer`)

`packages/core/test/composer.test.ts`:

```ts
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
  assert.deepEqual(dedupeElements([A, A, B]), [A, B]);
  assert.equal(dedupeElements([A, B, A, B, A], 2).length, 2);
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npm test -w @feedbackkit/core`
Expected: FAIL — `Cannot find module '../src/composer'` (composer.ts does not exist yet).

- [ ] **Step 6: Implement `composer.ts`** (ported verbatim from LexPulse `src/lib/feedback/composer.ts` — no behavioral change)

`packages/core/src/composer.ts`:

```ts
export type PickedElement = { label: string; text: string };

// Single-char placeholder for an inline element reference in a stored message.
// U+FFFC OBJECT REPLACEMENT CHARACTER — does not collide with normal typed text.
export const ELEMENT_MARKER = "￼";

export type ComposerSegment =
  | { type: "text"; text: string }
  | { type: "element"; element: PickedElement };

/** Collapse ordered composer segments into the stored form: text with one
 *  ELEMENT_MARKER per element, plus the elements in order. */
export function serialize(segments: ComposerSegment[]): {
  content: string;
  elements: PickedElement[];
} {
  let content = "";
  const elements: PickedElement[] = [];
  for (const seg of segments) {
    if (seg.type === "text") content += seg.text;
    else {
      content += ELEMENT_MARKER;
      elements.push(seg.element);
    }
  }
  return { content, elements };
}

/** Inverse of serialize: split stored content on the marker and interleave the
 *  elements in order, for rendering the transcript. A marker with no matching
 *  element (defensive) is dropped. */
export function parseContent(
  content: string,
  elements: PickedElement[] = [],
): ComposerSegment[] {
  const out: ComposerSegment[] = [];
  let idx = 0;
  let buf = "";
  for (const ch of content) {
    if (ch === ELEMENT_MARKER) {
      if (buf) {
        out.push({ type: "text", text: buf });
        buf = "";
      }
      const element = elements[idx++];
      if (element) out.push({ type: "element", element });
    } else {
      buf += ch;
    }
  }
  if (buf) out.push({ type: "text", text: buf });
  return out;
}

/** Plain text Claude reads: each marker → «label» at its position, preserving the
 *  user's order ("denne knappen («Last ned PDF») …"). */
export function toApiContent(
  content: string,
  elements: PickedElement[] = [],
): string {
  let idx = 0;
  let out = "";
  for (const ch of content) {
    if (ch === ELEMENT_MARKER) {
      const element = elements[idx++];
      out += element ? `«${element.label}»` : "";
    } else {
      out += ch;
    }
  }
  return out;
}

/** Deduplicate elements by label+text, preserving first-seen order, capped — the
 *  referenced-element list sent to the model for content context. */
export function dedupeElements(elements: PickedElement[], cap = 10): PickedElement[] {
  const seen = new Set<string>();
  const out: PickedElement[] = [];
  for (const el of elements) {
    const key = `${el.label} ${el.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(el);
    if (out.length >= cap) break;
  }
  return out;
}
```

- [ ] **Step 7: Create the package barrel** exporting composer

`packages/core/src/index.ts`:

```ts
export * from "./composer";
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm test -w @feedbackkit/core`
Expected: PASS — 6 tests pass.

- [ ] **Step 9: Typecheck the package**

Run: `npm run typecheck -w @feedbackkit/core`
Expected: no output, exit 0 (clean).

- [ ] **Step 10: Commit**

```sh
git add package.json tsconfig.base.json .gitignore README.md packages/core
git commit -m "feat(core): scaffold monorepo and port composer with tests"
```

---

### Task 2: Port `position` (draggable-panel clamp math)

**Files:**
- Create: `packages/core/src/position.ts`
- Modify: `packages/core/src/index.ts` (add the position export)
- Test: `packages/core/test/position.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1 (independent module).
- Produces (exported from `@feedbackkit/core`):
  - `FEEDBACK_POS_STORAGE_KEY: string` (value `"feedbackkit:pos"`)
  - `type Point = { x: number; y: number }`
  - `clampPosition(x: number, y: number, w: number, h: number, vw: number, vh: number, margin?: number): Point`
  - `parseStoredPosition(raw: string | null): Point | null`

- [ ] **Step 1: Write the failing test**

`packages/core/test/position.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clampPosition,
  parseStoredPosition,
  FEEDBACK_POS_STORAGE_KEY,
} from "../src/position";

test("clampPosition: a point well inside the viewport is unchanged", () => {
  assert.deepEqual(clampPosition(500, 400, 100, 50, 1000, 800), { x: 500, y: 400 });
});

test("clampPosition: past the right/bottom edge clamps inside (margin 16)", () => {
  // x: 1000 - 100 - 16 = 884 ; y: 800 - 50 - 16 = 734
  assert.deepEqual(clampPosition(2000, 2000, 100, 50, 1000, 800), { x: 884, y: 734 });
});

test("clampPosition: a negative point clamps to the margin", () => {
  assert.deepEqual(clampPosition(-50, -50, 100, 50, 1000, 800), { x: 16, y: 16 });
});

test("clampPosition: a panel larger than the viewport anchors to the margin", () => {
  assert.deepEqual(clampPosition(500, 500, 2000, 2000, 1000, 800), { x: 16, y: 16 });
});

test("parseStoredPosition: a valid JSON point round-trips", () => {
  assert.deepEqual(parseStoredPosition('{"x":10,"y":20}'), { x: 10, y: 20 });
});

test("parseStoredPosition: null / non-JSON / partial / non-finite → null", () => {
  assert.equal(parseStoredPosition(null), null);
  assert.equal(parseStoredPosition("not json"), null);
  assert.equal(parseStoredPosition('{"x":1}'), null);
  assert.equal(parseStoredPosition('{"x":null,"y":2}'), null);
});

test("FEEDBACK_POS_STORAGE_KEY is namespaced to feedbackkit", () => {
  assert.equal(FEEDBACK_POS_STORAGE_KEY, "feedbackkit:pos");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @feedbackkit/core`
Expected: FAIL — `Cannot find module '../src/position'`.

- [ ] **Step 3: Implement `position.ts`** (ported from LexPulse `src/lib/feedback/position.ts`; ONLY the storage-key value changes)

`packages/core/src/position.ts`:

```ts
export const FEEDBACK_POS_STORAGE_KEY = "feedbackkit:pos";

export type Point = { x: number; y: number };

/**
 * Clamp a fixed panel's top-left so the whole panel stays within the viewport,
 * keeping `margin` px clear on every edge. If the panel is larger than the
 * viewport on an axis, the upper bound goes below the lower bound; we let the
 * lower bound (margin) win via Math.max(min, Math.min(max, v)) ordering so the
 * panel anchors to the top/left margin instead of drifting off-screen.
 */
export function clampPosition(
  x: number,
  y: number,
  w: number,
  h: number,
  vw: number,
  vh: number,
  margin = 16,
): Point {
  const clamp = (v: number, size: number, viewport: number) =>
    Math.max(margin, Math.min(v, viewport - size - margin));
  return { x: clamp(x, w, vw), y: clamp(y, h, vh) };
}

/** Parse a stored JSON point; null/invalid/non-finite input → null. */
export function parseStoredPosition(raw: string | null): Point | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (
      typeof v === "object" &&
      v !== null &&
      Number.isFinite((v as Point).x) &&
      Number.isFinite((v as Point).y)
    ) {
      return { x: (v as Point).x, y: (v as Point).y };
    }
  } catch {
    // fall through
  }
  return null;
}
```

- [ ] **Step 4: Add the export to the barrel**

`packages/core/src/index.ts`:

```ts
export * from "./composer";
export * from "./position";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -w @feedbackkit/core`
Expected: PASS — composer (6) + position (7) tests all pass.

- [ ] **Step 6: Commit**

```sh
git add packages/core/src/position.ts packages/core/src/index.ts packages/core/test/position.test.ts
git commit -m "feat(core): port draggable-panel clamp math (position)"
```

---

### Task 3: Port `picker` predicate + finalize the barrel

**Files:**
- Create: `packages/core/src/picker.ts`
- Modify: `packages/core/src/index.ts` (add the picker export)
- Test: `packages/core/test/picker.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (independent module).
- Produces (exported from `@feedbackkit/core`):
  - `type PickerMode = "select" | "multi" | "browse"`
  - `shouldInterceptClick(mode: PickerMode, insideFeedbackUi: boolean, hasModifier: boolean): boolean`

- [ ] **Step 1: Write the failing test**

`packages/core/test/picker.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldInterceptClick } from "../src/picker";

test("blocks the page click while picking a single element (select)", () => {
  assert.equal(shouldInterceptClick("select", false, false), true);
});

test("blocks the page click while multi-picking (multi)", () => {
  assert.equal(shouldInterceptClick("multi", false, false), true);
});

test("never blocks in browse mode (page stays live)", () => {
  assert.equal(shouldInterceptClick("browse", false, false), false);
});

test("never blocks a click inside the feedback UI itself", () => {
  assert.equal(shouldInterceptClick("select", true, false), false);
});

test("never blocks a modifier (cmd/ctrl) click — one-off navigate", () => {
  assert.equal(shouldInterceptClick("select", false, true), false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @feedbackkit/core`
Expected: FAIL — `Cannot find module '../src/picker'`.

- [ ] **Step 3: Implement `picker.ts`** (ported verbatim from LexPulse `src/lib/feedback/picker.ts`)

`packages/core/src/picker.ts`:

```ts
export type PickerMode = "select" | "multi" | "browse";

/**
 * Whether the picker should block a page click. The picker blocks page
 * activation so a "pick" tap doesn't also follow a link — in both select
 * (single) and multi (flervalg) mode. Browse mode keeps the page fully live
 * (navigate, open the menu); a Cmd/Ctrl click is a one-off navigate even while
 * picking; and the feedback UI's own clicks must always work.
 */
export function shouldInterceptClick(
  mode: PickerMode,
  insideFeedbackUi: boolean,
  hasModifier: boolean,
): boolean {
  if (insideFeedbackUi) return false;
  if (mode === "browse") return false;
  if (hasModifier) return false;
  return true;
}
```

- [ ] **Step 4: Finalize the barrel**

`packages/core/src/index.ts`:

```ts
export * from "./composer";
export * from "./position";
export * from "./picker";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -w @feedbackkit/core`
Expected: PASS — composer (6) + position (7) + picker (5) tests all pass.

- [ ] **Step 6: Typecheck the whole package (fresh-eyes integration check)**

Run: `npm run typecheck -w @feedbackkit/core`
Expected: no output, exit 0.

- [ ] **Step 7: Commit**

```sh
git add packages/core/src/picker.ts packages/core/src/index.ts packages/core/test/picker.test.ts
git commit -m "feat(core): port picker click-intercept predicate"
```

---

## Self-Review

**1. Spec coverage (against `2026-06-26-feedbackkit-design.md`):** This plan implements the "Bakgrunn — hva som gjenbrukes fra LexPulse" pure modules (`composer`, `position`, `picker`) and the monorepo scaffold from "Pakke-oppdeling". Deliberately deferred to later plans (out of scope here, by design): the shared contract types (`FeedbackCase`, `AssistRequest`, `Scenario`, `CategoryConfig`) land in Plan 2 (`server`) where they are first consumed and testable — adding them now would be untested, unused code (YAGNI). The React widget, server adapter, AI integration, theming, and examples are Plans 2–4.

**2. Placeholder scan:** No "TBD"/"TODO"/"handle edge cases"/"similar to". Every code step shows complete file contents; every command shows the exact run line and expected result.

**3. Type consistency:** `PickedElement`/`ComposerSegment` defined in `composer.ts` (Task 1) and re-exported via the barrel; `Point`/`clampPosition`/`parseStoredPosition` consistent between Task 2's test and implementation; `PickerMode`/`shouldInterceptClick` consistent between Task 3's test and implementation. The barrel (`index.ts`) grows additively across Task 1 → 2 → 3 with no renames. Storage key value `"feedbackkit:pos"` is asserted in the test and set in the implementation — consistent.

## Next plans (roadmap, not part of this plan)

- **Plan 2 — `@feedbackkit/server`:** shared contract types + `createAssistHandler` (chat/draft, forced `respond` tool, configurable categories/KB/model, server-side key) + `createSubmitHandler` ({ onCase }) + Next.js route wrapper. Vitest-free where possible; mock the Anthropic client.
- **Plan 3 — `@feedbackkit/react`:** `<FeedbackWidget>` — launcher, draggable panel, `ElementPicker` (Velg/Flervalg/Bla), composer UI, chat, configurable categories, scenarios, draft, submit. Introduces Vitest + Testing Library + jsdom.
- **Plan 4 — Integration:** autocv.no example (real e2e, Supabase table) + `supabase`/`webhook` reference adapters.
