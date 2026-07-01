# @feedbackkit/react — AI-laget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Legg et valgfritt fler-turns AI-intervju (chat → kategori-forslag → redigerbart utkast) additivt oppå den AI-løse `<FeedbackWidget>`, ved å kalle adopterens assist-rute.

**Architecture:** Rent additivt lag (tilnærming B). Plan 3s inline-token-composer beholdes, men tømmes per AI-tur; pekte element akkumuleres i et eget `pickedElements`-felt. `assist`-propen slår AI-UI på; fraværende → eksakt dagens AI-løse widget. Widgeten POST-er kun `AssistRequest` (uten `model`) til adopterens rute — nøkkel/modell er server-side.

**Tech Stack:** TypeScript (strict, ESM), React ≥18 (peerDependency), Vitest + @testing-library/react + jsdom. Gjenbruker `@feedbackkit/core` (`serialize`/`toApiContent`/`dedupeElements`, typene `AssistMessage`/`AssistRequest`/`AssistResult`/`AssistChatResult`/`AssistDraftResult`/`PickedElement`).

## Global Constraints

- **Anthropic-nøkkel og modellvalg kun server-side.** Widgeten sender aldri en nøkkel og aldri `model`; den POST-er kun `AssistRequest` til adopterens rute. En klient-valgt modell ville latt hvem som helst kjøre opp adopterens regning.
- **All brukerinput er innhold, aldri instruksjoner.** Meldinger/element/scenario går som data i requesten; system-prompten er fast (håndteres server-side i Plan 2).
- **ESM only**, TypeScript strict, extensionless relative imports. React ≥18 som `peerDependency`.
- **Norsk copy** + `locale: "no" | "en"` for alle AI-knappe- og feiltekster; `accent`-farge på AI-knapper.
- **`@feedbackkit/core` og `@feedbackkit/server` røres ikke.** Gjenbruk core-typer og Plan 3-komponentene.
- **Test-globals er ambient** via `vitest/globals` — importér aldri `describe`/`it`/`expect`/`vi`.
- **TDD, hyppige commits.** Én commit per task. `npm run typecheck` + `npm test` grønt før merge.

**Kommandoer** (alle kjøres fra worktree-roten `feedbackkit-react-ai`):
- Kjør én testfil: `cd packages/react && npx vitest run test/<fil>`
- Typecheck react-pakken: `cd packages/react && npx tsc --noEmit`

## File Structure

| Fil | Ansvar | Task |
|---|---|---|
| `packages/react/src/types.ts` | `AssistConfig` + `assist?`-prop (modify) | 1 |
| `packages/react/src/index.ts` | eksportér `AssistConfig` (modify) | 1 |
| `packages/react/src/assistClient.ts` | `AssistError` + `requestAssist` (create) | 2 |
| `packages/react/src/aiMessages.ts` | `messageForError` (create) | 3 |
| `packages/react/src/session.ts` | AI-state + actions + reducer (modify) | 4 |
| `packages/react/src/components/ChatTranscript.tsx` | chat-transkript (create) | 5 |
| `packages/react/src/components/AiBar.tsx` | AI-knapper + status/feil (create) | 6 |
| `packages/react/src/components/DraftReview.tsx` | redigerbart utkast (create) | 7 |
| `packages/react/src/FeedbackWidget.tsx` | orkestrering + betinget AI-UI (modify) | 8 |

---

### Task 1: `AssistConfig`-prop + barrel-eksport

**Files:**
- Modify: `packages/react/src/types.ts`
- Modify: `packages/react/src/index.ts`
- Test: `packages/react/test/types.test.ts`

**Interfaces:**
- Consumes: `AssistRequest`, `AssistResult` fra `@feedbackkit/core`.
- Produces: `type AssistConfig = { url: string } | { onAssist: (req: AssistRequest) => Promise<AssistResult> }`; `FeedbackWidgetProps` får `assist?: AssistConfig`. Begge eksporteres fra `./types` og re-eksporteres fra `./index`.

- [ ] **Step 1: Skriv den feilende testen**

Legg til i `packages/react/test/types.test.ts` (behold eksisterende test; endre importlinjen slik at den også henter `AssistConfig`):

```ts
import type { SubmitConfig, AssistConfig, FeedbackWidgetProps } from "../src/types";

// eksisterende SubmitConfig-test beholdes uendret over/under denne.

it("AssistConfig accepts both url and onAssist shapes", () => {
  const a: AssistConfig = { url: "/assist" };
  const b: AssistConfig = { onAssist: async () => ({ reply: "hei", categories: [] }) };
  const props: FeedbackWidgetProps = { submit: { url: "/s" }, assist: a };
  expect("url" in a).toBe(true);
  expect("onAssist" in b).toBe(true);
  expect(props.assist).toBeDefined();
});
```

- [ ] **Step 2: Kjør testen — verifiser at den feiler**

Run: `cd packages/react && npx vitest run test/types.test.ts`
Expected: FAIL — TypeScript/kompileringsfeil «`AssistConfig` is not exported» (typen finnes ikke ennå).

- [ ] **Step 3: Implementér typen + prop + eksport**

`packages/react/src/types.ts` (hele filen):

```ts
import type {
  CategoryConfig,
  Scenario,
  FeedbackCaseInput,
  AssistRequest,
  AssistResult,
} from "@feedbackkit/core";

export type SubmitConfig =
  | { url: string }
  | { onCase: (c: FeedbackCaseInput) => Promise<void> | void };

export type AssistConfig =
  | { url: string }
  | { onAssist: (req: AssistRequest) => Promise<AssistResult> };

export type Identity = { id?: string; email?: string; anonymous?: boolean };

export type FeedbackWidgetProps = {
  submit: SubmitConfig;
  assist?: AssistConfig;
  accent?: string;
  locale?: "no" | "en";
  categories?: CategoryConfig[];
  scenarios?: Scenario[];
  identity?: Identity;
};
```

`packages/react/src/index.ts` (hele filen):

```ts
export { FeedbackWidget } from "./FeedbackWidget";
export type { FeedbackWidgetProps, SubmitConfig, AssistConfig, Identity } from "./types";
```

- [ ] **Step 4: Kjør testen — verifiser at den passerer**

Run: `cd packages/react && npx vitest run test/types.test.ts`
Expected: PASS (begge tester).

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/types.ts packages/react/src/index.ts packages/react/test/types.test.ts
git commit -m "feat(react): AssistConfig-prop for AI-laget"
```

---

### Task 2: `assistClient` — `AssistError` + `requestAssist`

**Files:**
- Create: `packages/react/src/assistClient.ts`
- Test: `packages/react/test/assistClient.test.ts`

**Interfaces:**
- Consumes: `AssistConfig` fra `./types` (Task 1); `AssistRequest`, `AssistResult` fra `@feedbackkit/core`.
- Produces: `class AssistError extends Error { readonly status: number }`; `requestAssist(assist: AssistConfig, req: AssistRequest): Promise<AssistResult>`.

- [ ] **Step 1: Skriv den feilende testen**

`packages/react/test/assistClient.test.ts`:

```ts
import { requestAssist, AssistError } from "../src/assistClient";
import type { AssistRequest } from "@feedbackkit/core";

const req: AssistRequest = { mode: "chat", messages: [{ role: "user", content: "hei" }] };

it("posts JSON to the url and returns the parsed result", async () => {
  const fetchMock = vi.fn<typeof fetch>(
    async () => new Response(JSON.stringify({ reply: "hallo", categories: ["bug"] }), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const res = await requestAssist({ url: "/assist" }, req);
  expect(res).toEqual({ reply: "hallo", categories: ["bug"] });
  const [url, opts] = fetchMock.mock.calls[0];
  expect(url).toBe("/assist");
  expect(opts?.method).toBe("POST");
  expect(JSON.parse(opts?.body as string)).toEqual(req);
  vi.unstubAllGlobals();
});

it("throws AssistError with the http status on non-ok", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ error: "AI er ikke tilgjengelig." }), { status: 503 })),
  );
  const err = await requestAssist({ url: "/x" }, req).catch((e) => e);
  expect(err).toBeInstanceOf(AssistError);
  expect((err as AssistError).status).toBe(503);
  vi.unstubAllGlobals();
});

it("throws AssistError with status 0 when fetch rejects", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("boom"); }));
  const err = await requestAssist({ url: "/x" }, req).catch((e) => e);
  expect(err).toBeInstanceOf(AssistError);
  expect((err as AssistError).status).toBe(0);
  vi.unstubAllGlobals();
});

it("calls onAssist and returns its result", async () => {
  const onAssist = vi.fn(async () => ({ draft: "utkast" }));
  const res = await requestAssist({ onAssist }, { mode: "draft", messages: [] });
  expect(onAssist).toHaveBeenCalledTimes(1);
  expect(res).toEqual({ draft: "utkast" });
});
```

- [ ] **Step 2: Kjør testen — verifiser at den feiler**

Run: `cd packages/react && npx vitest run test/assistClient.test.ts`
Expected: FAIL — «Cannot find module '../src/assistClient'».

- [ ] **Step 3: Implementér `assistClient.ts`**

`packages/react/src/assistClient.ts`:

```ts
import type { AssistRequest, AssistResult } from "@feedbackkit/core";
import type { AssistConfig } from "./types";

export class AssistError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AssistError";
    this.status = status;
  }
}

export async function requestAssist(
  assist: AssistConfig,
  req: AssistRequest,
): Promise<AssistResult> {
  if ("url" in assist) {
    let res: Response;
    try {
      res = await fetch(assist.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(req),
      });
    } catch {
      throw new AssistError(0, "Kunne ikke nå AI-en.");
    }
    if (!res.ok) {
      let detail = "";
      try {
        const body = (await res.json()) as { error?: string };
        detail = body?.error ?? "";
      } catch {
        detail = "";
      }
      throw new AssistError(res.status, detail || `Assist failed: ${res.status}`);
    }
    return (await res.json()) as AssistResult;
  }
  return assist.onAssist(req);
}
```

- [ ] **Step 4: Kjør testen — verifiser at den passerer**

Run: `cd packages/react && npx vitest run test/assistClient.test.ts`
Expected: PASS (4 tester).

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/assistClient.ts packages/react/test/assistClient.test.ts
git commit -m "feat(react): requestAssist + AssistError"
```

---

### Task 3: `aiMessages` — `messageForError`

**Files:**
- Create: `packages/react/src/aiMessages.ts`
- Test: `packages/react/test/aiMessages.test.ts`

**Interfaces:**
- Consumes: `AssistError` fra `./assistClient` (Task 2).
- Produces: `messageForError(err: unknown, locale: "no" | "en"): string`.

- [ ] **Step 1: Skriv den feilende testen**

`packages/react/test/aiMessages.test.ts`:

```ts
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
```

- [ ] **Step 2: Kjør testen — verifiser at den feiler**

Run: `cd packages/react && npx vitest run test/aiMessages.test.ts`
Expected: FAIL — «Cannot find module '../src/aiMessages'».

- [ ] **Step 3: Implementér `aiMessages.ts`**

`packages/react/src/aiMessages.ts`:

```ts
import { AssistError } from "./assistClient";

const COPY: Record<"no" | "en", Record<"503" | "429" | "401" | "other", string>> = {
  no: {
    "503": "AI er utilgjengelig akkurat nå.",
    "429": "For mange forespørsler — vent litt.",
    "401": "AI er ikke tilgjengelig her.",
    other: "Kunne ikke nå AI-en.",
  },
  en: {
    "503": "AI is unavailable right now.",
    "429": "Too many requests — please wait.",
    "401": "AI is not available here.",
    other: "Could not reach the AI.",
  },
};

export function messageForError(err: unknown, locale: "no" | "en"): string {
  const status = err instanceof AssistError ? err.status : -1;
  const key = status === 503 ? "503" : status === 429 ? "429" : status === 401 ? "401" : "other";
  return COPY[locale][key];
}
```

- [ ] **Step 4: Kjør testen — verifiser at den passerer**

Run: `cd packages/react && npx vitest run test/aiMessages.test.ts`
Expected: PASS (3 tester).

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/aiMessages.ts packages/react/test/aiMessages.test.ts
git commit -m "feat(react): messageForError for AI-feil"
```

---

### Task 4: `session` — AI-state + actions + reducer

**Files:**
- Modify: `packages/react/src/session.ts`
- Test: `packages/react/test/session.test.ts`

**Interfaces:**
- Consumes: `dedupeElements`, typene `PickedElement`, `AssistMessage`, `ComposerSegment`, `PickerMode` fra `@feedbackkit/core`.
- Produces: utvidet `SessionState` (nye felt `transcript`, `pickedElements`, `categoriesTouched`, `aiStatus`, `aiError`, `draft`); `type AiStatus = "idle" | "thinking" | "error"`; nye actions `aiChatStart`, `aiChatOk`, `aiDraftStart`, `aiDraftOk`, `setDraft`, `backToChat`, `aiError`; `toggleCategory` setter nå `categoriesTouched=true`.

- [ ] **Step 1: Skriv de feilende testene**

Legg til i `packages/react/test/session.test.ts` (behold alle eksisterende tester; legg til import av `SessionState`-typen øverst):

```ts
import type { SessionState } from "../src/session";

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
```

- [ ] **Step 2: Kjør testene — verifiser at de feiler**

Run: `cd packages/react && npx vitest run test/session.test.ts`
Expected: FAIL — TypeScript-feil på ukjente felt (`transcript`, `pickedElements`, …) og ukjente action-typer.

- [ ] **Step 3: Implementér utvidet `session.ts`**

`packages/react/src/session.ts` (hele filen):

```ts
import { useReducer } from "react";
import { dedupeElements } from "@feedbackkit/core";
import type { PickerMode, PickedElement, ComposerSegment, AssistMessage } from "@feedbackkit/core";

export type SessionStatus = "idle" | "sending" | "sent" | "error";
export type AiStatus = "idle" | "thinking" | "error";

export type SessionState = {
  open: boolean;
  mode: PickerMode;
  segments: ComposerSegment[];
  scenario: { id: string; title: string } | null;
  categories: string[];
  status: SessionStatus;
  transcript: AssistMessage[];
  pickedElements: PickedElement[];
  categoriesTouched: boolean;
  aiStatus: AiStatus;
  aiError: string | null;
  draft: string | null;
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
  | { type: "sendError" }
  | { type: "aiChatStart" }
  | { type: "aiChatOk"; userContent: string; elements: PickedElement[]; reply: string; categories: string[] }
  | { type: "aiDraftStart" }
  | { type: "aiDraftOk"; draft: string }
  | { type: "setDraft"; text: string }
  | { type: "backToChat" }
  | { type: "aiError"; message: string };

export const initialState: SessionState = {
  open: false,
  mode: "browse",
  segments: [],
  scenario: null,
  categories: [],
  status: "idle",
  transcript: [],
  pickedElements: [],
  categoriesTouched: false,
  aiStatus: "idle",
  aiError: null,
  draft: null,
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
        categoriesTouched: true,
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
    case "aiChatStart":
      return { ...state, aiStatus: "thinking", aiError: null };
    case "aiChatOk":
      return {
        ...state,
        transcript: [
          ...state.transcript,
          { role: "user", content: action.userContent },
          { role: "assistant", content: action.reply },
        ],
        pickedElements: dedupeElements([...state.pickedElements, ...action.elements]),
        segments: [],
        aiStatus: "idle",
        categories: state.categoriesTouched ? state.categories : action.categories,
      };
    case "aiDraftStart":
      return { ...state, aiStatus: "thinking", aiError: null };
    case "aiDraftOk":
      return { ...state, draft: action.draft, aiStatus: "idle" };
    case "setDraft":
      return { ...state, draft: action.text };
    case "backToChat":
      return { ...state, draft: null };
    case "aiError":
      return { ...state, aiStatus: "error", aiError: action.message };
  }
}

export function useFeedbackSession() {
  return useReducer(reducer, initialState);
}
```

- [ ] **Step 4: Kjør testene — verifiser at de passerer**

Run: `cd packages/react && npx vitest run test/session.test.ts`
Expected: PASS (alle eksisterende + 6 nye tester).

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/session.ts packages/react/test/session.test.ts
git commit -m "feat(react): AI-state + reducer-actions for intervjuet"
```

---

### Task 5: `ChatTranscript`-komponent

**Files:**
- Create: `packages/react/src/components/ChatTranscript.tsx`
- Test: `packages/react/test/ChatTranscript.test.tsx`

**Interfaces:**
- Consumes: `AssistMessage` fra `@feedbackkit/core`.
- Produces: `ChatTranscript({ transcript: AssistMessage[] })` — `role="log"` `aria-label="AI-samtale"`; returnerer `null` når tomt.

- [ ] **Step 1: Skriv den feilende testen**

`packages/react/test/ChatTranscript.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { ChatTranscript } from "../src/components/ChatTranscript";

it("returns nothing when the transcript is empty", () => {
  const { container } = render(<ChatTranscript transcript={[]} />);
  expect(container.firstChild).toBeNull();
});

it("renders one bubble per message inside a log region", () => {
  render(
    <ChatTranscript
      transcript={[
        { role: "user", content: "for mye tekst" },
        { role: "assistant", content: "Hvilken side var du på?" },
      ]}
    />,
  );
  expect(screen.getByRole("log", { name: "AI-samtale" })).toBeTruthy();
  expect(screen.getByText("for mye tekst")).toBeTruthy();
  expect(screen.getByText("Hvilken side var du på?")).toBeTruthy();
});
```

- [ ] **Step 2: Kjør testen — verifiser at den feiler**

Run: `cd packages/react && npx vitest run test/ChatTranscript.test.tsx`
Expected: FAIL — «Cannot find module '../src/components/ChatTranscript'».

- [ ] **Step 3: Implementér `ChatTranscript.tsx`**

`packages/react/src/components/ChatTranscript.tsx`:

```tsx
import type { AssistMessage } from "@feedbackkit/core";

export function ChatTranscript({ transcript }: { transcript: AssistMessage[] }) {
  if (transcript.length === 0) return null;
  return (
    <div
      role="log"
      aria-label="AI-samtale"
      style={{ margin: "8px 0", display: "flex", flexDirection: "column", gap: 6 }}
    >
      {transcript.map((m, i) => (
        <div
          key={i}
          style={{
            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
            maxWidth: "85%",
            padding: "4px 8px",
            borderRadius: 8,
            background: m.role === "user" ? "#eee" : "#f5f5f5",
            whiteSpace: "pre-wrap",
          }}
        >
          {m.content}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Kjør testen — verifiser at den passerer**

Run: `cd packages/react && npx vitest run test/ChatTranscript.test.tsx`
Expected: PASS (2 tester).

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/components/ChatTranscript.tsx packages/react/test/ChatTranscript.test.tsx
git commit -m "feat(react): ChatTranscript-komponent"
```

---

### Task 6: `AiBar`-komponent

**Files:**
- Create: `packages/react/src/components/AiBar.tsx`
- Test: `packages/react/test/AiBar.test.tsx`

**Interfaces:**
- Consumes: `AiStatus` fra `../session` (Task 4).
- Produces: `AiBar({ aiStatus, aiError, canSendToAi, canDraft, locale, accent, onSendToAi, onDraft })`. «Send til AI» alltid; «Lag utkast» kun når `canDraft`; begge `disabled` når `thinking`; «Send til AI» også `disabled` når `!canSendToAi`; `aiError` vist med `role="status"`.

- [ ] **Step 1: Skriv den feilende testen**

`packages/react/test/AiBar.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { AiBar } from "../src/components/AiBar";

const base = {
  aiStatus: "idle" as const,
  aiError: null,
  canSendToAi: true,
  canDraft: false,
  locale: "no" as const,
  accent: "#f08a5d",
  onSendToAi: () => {},
  onDraft: () => {},
};

it("shows Send til AI but hides Lag utkast until canDraft", () => {
  const { rerender } = render(<AiBar {...base} />);
  expect(screen.getByRole("button", { name: "Send til AI" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Lag utkast" })).toBeNull();
  rerender(<AiBar {...base} canDraft />);
  expect(screen.getByRole("button", { name: "Lag utkast" })).toBeTruthy();
});

it("disables buttons while thinking and shows the thinking hint", () => {
  render(<AiBar {...base} canDraft aiStatus="thinking" />);
  expect((screen.getByRole("button", { name: "Send til AI" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Lag utkast" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText("AI tenker…")).toBeTruthy();
});

it("disables Send til AI when there is nothing to send", () => {
  render(<AiBar {...base} canSendToAi={false} />);
  expect((screen.getByRole("button", { name: "Send til AI" }) as HTMLButtonElement).disabled).toBe(true);
});

it("shows the error as a status message and fires callbacks", () => {
  const onSendToAi = vi.fn();
  render(<AiBar {...base} aiError="Kunne ikke nå AI-en." onSendToAi={onSendToAi} />);
  expect(screen.getByRole("status").textContent).toBe("Kunne ikke nå AI-en.");
  fireEvent.click(screen.getByRole("button", { name: "Send til AI" }));
  expect(onSendToAi).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Kjør testen — verifiser at den feiler**

Run: `cd packages/react && npx vitest run test/AiBar.test.tsx`
Expected: FAIL — «Cannot find module '../src/components/AiBar'».

- [ ] **Step 3: Implementér `AiBar.tsx`**

`packages/react/src/components/AiBar.tsx`:

```tsx
import type { AiStatus } from "../session";

const LABELS = {
  no: { send: "Send til AI", draft: "Lag utkast", thinking: "AI tenker…" },
  en: { send: "Ask AI", draft: "Draft it", thinking: "AI thinking…" },
} as const;

export function AiBar({
  aiStatus,
  aiError,
  canSendToAi,
  canDraft,
  locale,
  accent,
  onSendToAi,
  onDraft,
}: {
  aiStatus: AiStatus;
  aiError: string | null;
  canSendToAi: boolean;
  canDraft: boolean;
  locale: "no" | "en";
  accent: string;
  onSendToAi: () => void;
  onDraft: () => void;
}) {
  const t = LABELS[locale];
  const thinking = aiStatus === "thinking";
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 8 }}>
      <button
        type="button"
        onClick={onSendToAi}
        disabled={thinking || !canSendToAi}
        style={{
          border: `1px solid ${accent}`,
          borderRadius: 6,
          padding: "4px 10px",
          background: "transparent",
          cursor: "pointer",
        }}
      >
        {t.send}
      </button>
      {canDraft && (
        <button
          type="button"
          onClick={onDraft}
          disabled={thinking}
          style={{
            border: "none",
            borderRadius: 6,
            padding: "4px 10px",
            background: accent,
            color: "#fff",
            cursor: "pointer",
          }}
        >
          {t.draft}
        </button>
      )}
      {thinking && <span style={{ opacity: 0.7 }}>{t.thinking}</span>}
      {aiError && (
        <span role="status" style={{ color: "#b00", flexBasis: "100%" }}>
          {aiError}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Kjør testen — verifiser at den passerer**

Run: `cd packages/react && npx vitest run test/AiBar.test.tsx`
Expected: PASS (4 tester).

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/components/AiBar.tsx packages/react/test/AiBar.test.tsx
git commit -m "feat(react): AiBar-komponent (Send til AI / Lag utkast)"
```

---

### Task 7: `DraftReview`-komponent

**Files:**
- Create: `packages/react/src/components/DraftReview.tsx`
- Test: `packages/react/test/DraftReview.test.tsx`

**Interfaces:**
- Consumes: ingenting fra andre tasks (kun React).
- Produces: `DraftReview({ draft, locale, accent, onChange, onBack })` — `<textarea aria-label="Utkast">` bundet til `draft`; «Tilbake til chat»-knapp.

- [ ] **Step 1: Skriv den feilende testen**

`packages/react/test/DraftReview.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { DraftReview } from "../src/components/DraftReview";

it("renders the draft as an editable field and fires onChange", () => {
  const onChange = vi.fn();
  render(
    <DraftReview draft="Første utkast" locale="no" accent="#f08a5d" onChange={onChange} onBack={() => {}} />,
  );
  const ta = screen.getByLabelText("Utkast") as HTMLTextAreaElement;
  expect(ta.value).toBe("Første utkast");
  fireEvent.change(ta, { target: { value: "Redigert" } });
  expect(onChange).toHaveBeenCalledWith("Redigert");
});

it("fires onBack from the back button", () => {
  const onBack = vi.fn();
  render(<DraftReview draft="x" locale="no" accent="#f08a5d" onChange={() => {}} onBack={onBack} />);
  fireEvent.click(screen.getByRole("button", { name: "Tilbake til chat" }));
  expect(onBack).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Kjør testen — verifiser at den feiler**

Run: `cd packages/react && npx vitest run test/DraftReview.test.tsx`
Expected: FAIL — «Cannot find module '../src/components/DraftReview'».

- [ ] **Step 3: Implementér `DraftReview.tsx`**

`packages/react/src/components/DraftReview.tsx`:

```tsx
const LABELS = {
  no: { label: "Utkast", back: "Tilbake til chat" },
  en: { label: "Draft", back: "Back to chat" },
} as const;

export function DraftReview({
  draft,
  locale,
  accent,
  onChange,
  onBack,
}: {
  draft: string;
  locale: "no" | "en";
  accent: string;
  onChange: (text: string) => void;
  onBack: () => void;
}) {
  const t = LABELS[locale];
  return (
    <div>
      <textarea
        aria-label={t.label}
        value={draft}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        style={{ width: "100%", boxSizing: "border-box" }}
      />
      <button
        type="button"
        onClick={onBack}
        style={{
          marginTop: 6,
          border: `1px solid ${accent}`,
          borderRadius: 6,
          padding: "2px 8px",
          background: "transparent",
          cursor: "pointer",
        }}
      >
        {t.back}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Kjør testen — verifiser at den passerer**

Run: `cd packages/react && npx vitest run test/DraftReview.test.tsx`
Expected: PASS (2 tester).

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/components/DraftReview.tsx packages/react/test/DraftReview.test.tsx
git commit -m "feat(react): DraftReview-komponent"
```

---

### Task 8: `FeedbackWidget` — orkestrering + betinget AI-UI

**Files:**
- Modify: `packages/react/src/FeedbackWidget.tsx`
- Test: `packages/react/test/FeedbackWidget.test.tsx`

**Interfaces:**
- Consumes: `requestAssist` (Task 2), `messageForError` (Task 3), reducer-actions (Task 4), `ChatTranscript` (Task 5), `AiBar` (Task 6), `DraftReview` (Task 7), `AssistConfig` (Task 1); `serialize`/`toApiContent`/`dedupeElements` + typene `AssistChatResult`/`AssistDraftResult`/`AssistRequest`/`FeedbackCaseInput`/`PickedElement` fra `@feedbackkit/core`.
- Produces: full AI-orkestrering. `sendToAi`/`makeDraft` bygger `AssistRequest` (uten `model`), dispatcher `aiChatOk`/`aiDraftOk`/`aiError`. AI-kategori-forslag filtreres mot `categories`-propen før dispatch. AI-UI (`AiBar`/`ChatTranscript`/`DraftReview`) rendres kun når `assist` er satt.

- [ ] **Step 1: Skriv de feilende integrasjonstestene**

Legg til i `packages/react/test/FeedbackWidget.test.tsx` (behold de to eksisterende testene; utvid importlinjen for core-typer til også å hente `AssistRequest`, `AssistResult`):

```tsx
import type { FeedbackCaseInput, AssistRequest, AssistResult } from "@feedbackkit/core";

it("shows no AI controls when assist is not configured", () => {
  render(<FeedbackWidget submit={{ onCase: () => {} }} />);
  fireEvent.click(screen.getByRole("button", { name: /Tilbakemelding/ }));
  expect(screen.queryByRole("button", { name: "Send til AI" })).toBeNull();
});

it("runs the AI interview: chat → categories → draft → edit → send", async () => {
  const cases: FeedbackCaseInput[] = [];
  const onAssist = vi.fn(
    async (req: AssistRequest): Promise<AssistResult> =>
      req.mode === "chat"
        ? { reply: "Hvilken side?", categories: ["bug", "nonsense"] } // "nonsense" må filtreres bort
        : { draft: "Knappen er ødelagt på forsiden." },
  );
  render(
    <FeedbackWidget
      submit={{ onCase: (c) => { cases.push(c); } }}
      assist={{ onAssist }}
      categories={[{ code: "bug", label: "Feil" }]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Tilbakemelding/ }));      // open
  fireEvent.click(screen.getByRole("button", { name: "Velg" }));                // select mode
  document.body.appendChild(
    Object.assign(document.createElement("button"), { textContent: "Kjøp", ariaLabel: "Kjøp-knapp" }),
  );
  fireEvent.click(document.querySelector('[aria-label="Kjøp-knapp"]') as HTMLElement); // point
  fireEvent.change(screen.getByLabelText("Tilbakemelding"), { target: { value: "funker ikke" } });
  fireEvent.click(screen.getByRole("button", { name: "Send til AI" }));

  await screen.findByText("Hvilken side?");
  expect((screen.getByLabelText("Feil") as HTMLInputElement).checked).toBe(true);

  fireEvent.click(screen.getByRole("button", { name: "Lag utkast" }));
  const ta = (await screen.findByLabelText("Utkast")) as HTMLTextAreaElement;
  expect(ta.value).toBe("Knappen er ødelagt på forsiden.");
  fireEvent.change(ta, { target: { value: "Kjøp-knappen er ødelagt." } });

  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByRole("button", { name: "Sendt ✓" });

  expect(cases).toHaveLength(1);
  const c = cases[0];
  expect(c.message).toBe("Kjøp-knappen er ødelagt.");
  expect(c.elements).toEqual([{ label: "Kjøp-knapp", text: "Kjøp" }]);
  expect(c.categories).toEqual(["bug"]);
  const chatReq = onAssist.mock.calls[0][0];
  expect(chatReq.mode).toBe("chat");
  expect(chatReq.elements).toEqual([{ label: "Kjøp-knapp", text: "Kjøp" }]);
});

it("degrades to manual send when the AI call fails", async () => {
  const cases: FeedbackCaseInput[] = [];
  const onAssist = vi.fn(async (): Promise<AssistResult> => { throw new Error("down"); });
  render(<FeedbackWidget submit={{ onCase: (c) => { cases.push(c); } }} assist={{ onAssist }} />);
  fireEvent.click(screen.getByRole("button", { name: /Tilbakemelding/ }));
  fireEvent.change(screen.getByLabelText("Tilbakemelding"), { target: { value: "noe er galt" } });
  fireEvent.click(screen.getByRole("button", { name: "Send til AI" }));

  await screen.findByRole("status");
  expect((screen.getByLabelText("Tilbakemelding") as HTMLTextAreaElement).value).toBe("noe er galt");

  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByRole("button", { name: "Sendt ✓" });
  expect(cases).toHaveLength(1);
  expect(cases[0].message).toBe("noe er galt");
});
```

- [ ] **Step 2: Kjør testene — verifiser at de feiler**

Run: `cd packages/react && npx vitest run test/FeedbackWidget.test.tsx`
Expected: FAIL — «Unable to find role/button "Send til AI"» (AI-UI ikke koblet inn).

- [ ] **Step 3: Implementér orkestreringen**

`packages/react/src/FeedbackWidget.tsx` (hele filen):

```tsx
import { useCallback, useRef } from "react";
import {
  serialize,
  toApiContent,
  dedupeElements,
  DEFAULT_CATEGORIES,
  type PickedElement,
  type FeedbackCaseInput,
  type AssistChatResult,
  type AssistDraftResult,
} from "@feedbackkit/core";
import type { FeedbackWidgetProps } from "./types";
import { useFeedbackSession } from "./session";
import { useElementPicker } from "./useElementPicker";
import { submitCase } from "./client";
import { requestAssist } from "./assistClient";
import { messageForError } from "./aiMessages";
import { Launcher } from "./components/Launcher";
import { Panel } from "./components/Panel";
import { ScenarioChips } from "./components/ScenarioChips";
import { PickerToolbar } from "./components/PickerToolbar";
import { Composer } from "./components/Composer";
import { CategoryPicker } from "./components/CategoryPicker";
import { SubmitBar } from "./components/SubmitBar";
import { ChatTranscript } from "./components/ChatTranscript";
import { AiBar } from "./components/AiBar";
import { DraftReview } from "./components/DraftReview";

export function FeedbackWidget(props: FeedbackWidgetProps) {
  const accent = props.accent ?? "#f08a5d";
  const locale = props.locale ?? "no";
  const categories = props.categories ?? DEFAULT_CATEGORIES;
  const assist = props.assist;
  const [state, dispatch] = useFeedbackSession();
  const rootRef = useRef<HTMLDivElement>(null);

  const handlePick = useCallback(
    (el: PickedElement) => dispatch({ type: "addElement", element: el }),
    [],
  );
  useElementPicker(state.open ? state.mode : "browse", handlePick, rootRef, accent);

  const sendToAi = async () => {
    if (!assist) return;
    const { content, elements } = serialize(state.segments);
    const userContent = toApiContent(content, elements);
    if (!userContent.trim() && elements.length === 0) return;
    dispatch({ type: "aiChatStart" });
    try {
      const res = (await requestAssist(assist, {
        mode: "chat",
        messages: [...state.transcript, { role: "user", content: userContent }],
        page: window.location.pathname,
        url: window.location.href,
        elements: dedupeElements([...state.pickedElements, ...elements]),
        categories: state.categories,
        scenario: state.scenario,
      })) as AssistChatResult;
      const valid = res.categories.filter((c) => categories.some((cfg) => cfg.code === c));
      dispatch({ type: "aiChatOk", userContent, elements, reply: res.reply, categories: valid });
    } catch (e) {
      dispatch({ type: "aiError", message: messageForError(e, locale) });
    }
  };

  const makeDraft = async () => {
    if (!assist) return;
    dispatch({ type: "aiDraftStart" });
    try {
      const res = (await requestAssist(assist, {
        mode: "draft",
        messages: state.transcript,
        page: window.location.pathname,
        url: window.location.href,
        elements: dedupeElements(state.pickedElements),
        categories: state.categories,
        scenario: state.scenario,
      })) as AssistDraftResult;
      dispatch({ type: "aiDraftOk", draft: res.draft });
    } catch (e) {
      dispatch({ type: "aiError", message: messageForError(e, locale) });
    }
  };

  const send = async () => {
    dispatch({ type: "sendStart" });
    try {
      const { content, elements } = serialize(state.segments);
      const input: FeedbackCaseInput = {
        message: state.draft ?? toApiContent(content, elements),
        page: window.location.pathname,
        url: window.location.href,
        scenario: state.scenario,
        categories: state.categories,
        elements: dedupeElements([...state.pickedElements, ...elements]),
        identity: props.identity ?? null,
      };
      await submitCase(props.submit, input);
      dispatch({ type: "sendOk" });
    } catch {
      dispatch({ type: "sendError" });
    }
  };

  const hasAssistantTurn = state.transcript.some((m) => m.role === "assistant");
  const composed = serialize(state.segments);
  const canSendToAi =
    toApiContent(composed.content, composed.elements).trim().length > 0 || composed.elements.length > 0;

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
          {state.draft === null ? (
            <>
              <PickerToolbar mode={state.mode} onMode={(m) => dispatch({ type: "setMode", mode: m })} />
              <Composer
                segments={state.segments}
                onText={(t) => dispatch({ type: "setDraftText", text: t })}
                onRemove={(i) => dispatch({ type: "removeSegment", index: i })}
                accent={accent}
              />
            </>
          ) : (
            <DraftReview
              draft={state.draft}
              locale={locale}
              accent={accent}
              onChange={(t) => dispatch({ type: "setDraft", text: t })}
              onBack={() => dispatch({ type: "backToChat" })}
            />
          )}
          <ChatTranscript transcript={state.transcript} />
          <CategoryPicker
            categories={categories}
            selected={state.categories}
            onToggle={(c) => dispatch({ type: "toggleCategory", code: c })}
          />
          {assist && state.draft === null && (
            <AiBar
              aiStatus={state.aiStatus}
              aiError={state.aiError}
              canSendToAi={canSendToAi}
              canDraft={hasAssistantTurn}
              locale={locale}
              accent={accent}
              onSendToAi={sendToAi}
              onDraft={makeDraft}
            />
          )}
          <SubmitBar status={state.status} onSend={send} locale={locale} />
        </Panel>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Kjør hele react-suiten — verifiser grønt**

Run: `cd packages/react && npx vitest run`
Expected: PASS — alle eksisterende + de 3 nye integrasjonstestene (de to opprinnelige AI-løse testene passerer uendret, siden `assist` er fraværende der).

- [ ] **Step 5: Typecheck + commit**

Run: `cd packages/react && npx tsc --noEmit`
Expected: ingen feil.

```bash
git add packages/react/src/FeedbackWidget.tsx packages/react/test/FeedbackWidget.test.tsx
git commit -m "feat(react): koble AI-intervjuet inn i FeedbackWidget"
```

---

## Ferdigstilling

Etter Task 8, kjør hele suiten fra worktree-roten for å bekrefte at core + server + react alle er grønne:

```bash
npm run typecheck
npm test
```

Forventet: alle tre pakker typecheck-rene; react-suiten grønn (Plan 3s 32 + de nye AI-testene). Deretter klar for `session-branch AVSLUTT` (squash-merge til main) etter final whole-branch review.
