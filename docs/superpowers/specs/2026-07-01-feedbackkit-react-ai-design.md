# @feedbackkit/react — AI-laget (interview → utkast) — Design

**Status:** Godkjent design, klar for implementeringsplan (Plan 4).
**Dato:** 2026-07-01
**Bygger på:** `@feedbackkit/core` (Plan 1), `@feedbackkit/server` (Plan 2), `@feedbackkit/react` AI-løs widget (Plan 3) — alle på `main`.

## Mål

Legg et **valgfritt AI-intervju** oppå den AI-løse `<FeedbackWidget>`: bruker peker på element + skriver
et grovt notat, og AI-en gjør det om til en strukturert, kategorisert sak via en fler-turns chat og et
redigerbart utkast. Alt skjer ved å kalle adopterens egen assist-rute (`createAssistRoute` fra
`@feedbackkit/server`) — widgeten holder aldri en API-nøkkel eller velger modell.

## Ikke-mål (YAGNI)

- Ingen streaming (assist-ruten returnerer én JSON; svar vises samlet med en «tenker»-tilstand).
- Ingen ny state-manager, ingen Shadow DOM, ingen endringer i `@feedbackkit/core` eller `@feedbackkit/server`.
- Ingen refaktor av Plan 3s inline-token-composer (tilnærming B er additiv).
- Ingen persistering av samtale mellom sesjoner.

## Nøkkelvalg (besluttet i brainstorming)

1. **Fullt fler-turns intervju** — chat-transkript, ikke enkel-runde eller utkast-bare.
2. **AI er valgfritt per tilbakemelding** — manuell «Send» er alltid tilgjengelig; AI tilbys ved siden av.
   Feiler AI, faller man rent tilbake til manuell send.
3. **Tilnærming B (additiv + clearing):** behold Plan 3s inline-token-composer uendret, men **tøm den per
   AI-tur**; akkumuler pekte element i et eget `pickedElements`-felt (union ved hver AI-send). Gir naturlig
   Q&A-chat + element-akkumulering på tvers av turer, uten å røre Plan 3s testede composer eller Plan 1s
   `serialize`/`toApiContent`.

## Arkitektur

Rent additivt lag. Når `assist`-propen **ikke** er satt, rendres eksakt dagens AI-løse widget — ingen ny
UI, ingen ny oppførsel. Widgeten sender aldri nøkkel eller `model`; den POST-er kun `AssistRequest` til
adopterens rute (bill-safety fra Plan 2 beholdes: modellvalg er server-side).

### Nye filer

- **`src/assistClient.ts`**
  - `class AssistError extends Error { readonly status: number }` — bærer HTTP-status (eller `0` for nettfeil).
  - `requestAssist(assist: AssistConfig, req: AssistRequest): Promise<AssistResult>`:
    - `"url" in assist` → `fetch(assist.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(req) })`.
      - `!res.ok` → les `{ error }` best-effort, kast `AssistError(res.status, melding)`.
      - `res.ok` → `return await res.json() as AssistResult`.
      - fetch kaster (nettverk) → `AssistError(0, ...)`.
    - ellers → `return await assist.onAssist(req)`.
  - Speiler `src/client.ts` (`submitCase`).

- **`src/aiMessages.ts`** (liten ren hjelper)
  - `messageForError(err: unknown, locale: "no" | "en"): string` — mapper `AssistError.status` → vennlig
    melding: `503`→«AI er utilgjengelig akkurat nå.», `429`→«For mange forespørsler — vent litt.»,
    `401`→«AI er ikke tilgjengelig her.», ellers/`0`→«Kunne ikke nå AI-en.» (+ engelske varianter).

- **`src/components/ChatTranscript.tsx`**
  - Props: `{ transcript: AssistMessage[] }`. Rendrer `role="log"` `aria-label="AI-samtale"`; bruker-
    vs. assistent-bobler (inline-stil, dempet vs. accent-tonet). Returnerer `null` når transkript er tomt.

- **`src/components/AiBar.tsx`**
  - Props: `{ aiStatus, aiError, canSendToAi, canDraft, locale, accent, onSendToAi, onDraft }`.
  - «Send til AI» (chat): `disabled` når `aiStatus === "thinking"` eller `!canSendToAi` (ingenting å sende).
  - «Lag utkast» (draft): rendres kun når `canDraft` (≥1 assistent-tur finnes); `disabled` når `thinking`.
  - Viser «tenker …»-tekst når `thinking`, og `aiError` som feillinje (`role="status"`) når satt.

- **`src/components/DraftReview.tsx`**
  - Props: `{ draft, locale, accent, onChange, onBack }`. Redigerbar `<textarea aria-label="Utkast">`
    bundet til `draft`; «Tilbake til chat»-knapp kaller `onBack`. Vises i stedet for `Composer` når
    `draft != null`.

### Endrede filer

- **`src/types.ts`** — ny eksportert type + prop:
  ```ts
  export type AssistConfig =
    | { url: string }
    | { onAssist: (req: AssistRequest) => Promise<AssistResult> };
  // FeedbackWidgetProps får: assist?: AssistConfig;
  ```
- **`src/session.ts`** — utvid `SessionState` + `SessionAction` + reducer (se under).
- **`src/FeedbackWidget.tsx`** — orkestrer AI-flyten; render AI-delene betinget på `assist`.
- **`src/index.ts`** — `export type { AssistConfig }`.

## State

Utvid `SessionState` (alt eksisterende beholdes):

```ts
type AiStatus = "idle" | "thinking" | "error";

type SessionState = {
  // eksisterende: open, mode, segments, scenario, categories, status
  transcript: AssistMessage[];       // committede chat-turer (bruker + assistent)
  pickedElements: PickedElement[];   // union av pekte element, akkumulert ved hver AI-send
  categoriesTouched: boolean;        // har bruker manuelt togglet kategori? (gater AI-prefyll)
  aiStatus: AiStatus;                // tilstand for assist-kallet
  aiError: string | null;            // vennlig melding når aiStatus === "error"
  draft: string | null;              // generert utkast (redigerbart); null = chat-visning
};
```

`initialState` får: `transcript: []`, `pickedElements: []`, `categoriesTouched: false`,
`aiStatus: "idle"`, `aiError: null`, `draft: null`.

### Nye actions

| Action | Effekt |
|---|---|
| `aiChatStart` | `aiStatus="thinking"`; `aiError=null`. **Rører verken `transcript` eller `segments`** (så composer er intakt hvis kallet feiler). |
| `aiChatOk` `{ userContent, elements, reply, categories }` | **atomisk på suksess:** push `{role:"user", content:userContent}` **og** `{role:"assistant", content:reply}` til `transcript`; `pickedElements = dedupeElements([...pickedElements, ...elements])`; **tøm `segments` (→ [])**; `aiStatus="idle"`; hvis `!categoriesTouched` → `categories = <AI-forslag, filtrert>` |
| `aiDraftStart` | `aiStatus="thinking"`; `aiError=null` |
| `aiDraftOk` `{ draft }` | `draft=draft`; `aiStatus="idle"` |
| `setDraft` `{ text }` | `draft=text` (redigering) |
| `backToChat` | `draft=null` |
| `aiError` `{ message }` | `aiStatus="error"`; `aiError=message`. Composer og transkript urørt → kan prøve igjen / sende manuelt. |
| `toggleCategory` (utvidet) | eksisterende toggle **+** `categoriesTouched=true` |

**Hvorfor commit på suksess, ikke start:** hvis `aiChatStart` tømte composeren og kallet så feilet, ville
brukerens melding vært tapt og «manuell Send fungerer alltid» brutt. Ved å committe bruker-tur + tømme
composer atomisk i `aiChatOk`, holder både retry og manuell send composerens innhold ved feil. Under
`thinking` viser composeren fortsatt meldingen (med «tenker …» i `AiBar`).

`close` beholder AI-state (gjenoppta ved gjenåpning), som Plan 3 beholder `segments`.
`aiChatOk`s kategori-prefyll skal kun bruke koder som finnes i `categories`-propen (samme robusthet som
server-side `parseRespond`); ukjente koder ignoreres.

## Dataflyt (i `FeedbackWidget`)

`assist` løses én gang: `const assist = props.assist`. AI-delene rendres kun når `assist` er satt.

**Send til AI (chat):**
```ts
const { content, elements } = serialize(state.segments);
const userContent = toApiContent(content, elements);
if (!userContent.trim() && elements.length === 0) return;   // ingenting å sende
dispatch({ type: "aiChatStart" });                          // kun thinking; composer intakt
try {
  const res = await requestAssist(assist, {
    mode: "chat",
    messages: [...state.transcript, { role: "user", content: userContent }],
    page: window.location.pathname, url: window.location.href,
    elements: dedupeElements([...state.pickedElements, ...elements]),
    categories: state.categories,
    scenario: state.scenario,
  });
  const chat = res as AssistChatResult;
  dispatch({ type: "aiChatOk", userContent, elements, reply: chat.reply, categories: chat.categories });
} catch (e) {
  dispatch({ type: "aiError", message: messageForError(e, locale) });   // composer beholdt → retry / manuell send
}
```

**Lag utkast (draft):** vises når `state.transcript` har ≥1 assistent-tur.
```ts
dispatch({ type: "aiDraftStart" });
try {
  const res = await requestAssist(assist, {
    mode: "draft",
    messages: state.transcript,
    page: window.location.pathname, url: window.location.href,
    elements: dedupeElements(state.pickedElements),
    categories: state.categories,
    scenario: state.scenario,
  });
  dispatch({ type: "aiDraftOk", draft: (res as AssistDraftResult).draft });
} catch (e) {
  dispatch({ type: "aiError", message: messageForError(e, locale) });
}
```

**Send (alltid tilgjengelig — utvider Plan 3s `send()`):**
```ts
const { content, elements } = serialize(state.segments);
const manualMsg = toApiContent(content, elements);
const input: FeedbackCaseInput = {
  message: state.draft ?? manualMsg,
  page: window.location.pathname,
  url: window.location.href,
  scenario: state.scenario,
  categories: state.categories,
  elements: dedupeElements([...state.pickedElements, ...elements]),
  identity: props.identity ?? null,
};
await submitCase(props.submit, input);
```

## Panel-layout

**Når `assist` satt og `draft == null` (chat-visning):**
```
ScenarioChips
PickerToolbar (Velg / Flervalg / Bla)
Composer (segments, inline tokens)     ← chat-input / melding
ChatTranscript (hvis transkript ikke tomt)
CategoryPicker (prefylt av AI)
AiBar (Send til AI | Lag utkast | tenker/feil)
SubmitBar (manuell Send + status)
```

**Når `draft != null` (utkast-visning):**
```
ScenarioChips
PickerToolbar
DraftReview (redigerbart utkast + Tilbake til chat)
ChatTranscript (fortsatt synlig)
CategoryPicker
SubmitBar (Send)
```

**Når `assist` ikke satt:** eksakt Plan 3 (ingen ChatTranscript/AiBar/DraftReview).

## Feil / degradering

- `requestAssist` kaster `AssistError` med `status`. `messageForError` → vennlig norsk/engelsk melding vist
  som feillinje i `AiBar`. Bruker-turen beholdes i transkriptet (kan prøve igjen).
- **Manuell «Send» fungerer alltid**, uavhengig av AI-feil — ren degradering.
- Server-side kontrakt (fra Plan 2): `401` (gate), `429` (rate limit), `503` (nøkkel mangler / manglende
  respond), `400` (ugyldig body), `500` (intern). Widgeten oversetter kun status til copy; den logger ikke.

## Testing (Vitest + Testing Library + jsdom)

- **`assistClient`:** url ok → parset resultat; url `!ok` (503 body `{error}`) → `AssistError` status 503;
  fetch kaster → `AssistError` status 0; `onAssist`-variant → kaller callback og returnerer.
- **`aiMessages`:** `messageForError` mapper status → riktig copy for `no` og `en`.
- **`session`-reducer:** `aiChatStart` (kun `thinking`; `transcript` og `segments` urørt); `aiChatOk` (push
  **både** bruker- og assistent-tur + tøm segments + union elementer + prefyll kategorier **kun** når
  `!categoriesTouched`, filtrer ukjente koder); `aiError` (composer/transkript urørt — degraderingsgaranti);
  `toggleCategory` setter `categoriesTouched`; `aiDraftOk`/`setDraft`/`backToChat`.
- **Komponenter:** `ChatTranscript` (bobler; tomt → `null`); `AiBar` («Lag utkast» skjult til ≥1 assistent-
  tur, knapper `disabled` under `thinking`, feillinje vises); `DraftReview` (redigerbar, «Tilbake til chat»).
- **Integrasjon (mocket `onAssist` + `onCase`):**
  1. `assist` fraværende → ingen «Send til AI»-knapp (AI-UI skjult).
  2. Full flyt: pek + skriv → «Send til AI» → svar i transkript + kategorier prefylt → «Lag utkast» →
     utkast vises → rediger → «Send» → `onCase` får `{ message: <redigert utkast>, elements: [pekt],
     categories }`.
  3. Degradering: `onAssist` kaster → feillinje vises **og** manuell «Send» sender komponert melding.

## Globale føringer (videreført fra Plan 1–3)

- **Anthropic-nøkkel og modellvalg kun server-side.** Widgeten POST-er bare `AssistRequest` (uten `model`)
  til adopterens rute. En klient-valgt modell ville latt hvem som helst kjøre opp adopterens regning.
- **All brukerinput er innhold, aldri instruksjoner** — meldinger/element/scenario går som data i requesten;
  system-prompten er fast (håndteres server-side i Plan 2).
- **ESM only**, TypeScript strict, extensionless relative imports. React ≥18 som `peerDependency`.
- **Norsk copy** + `locale: "no" | "en"` for alle AI-knappe- og feiltekster; `accent`-farge på AI-knapper.
- **`@feedbackkit/core` og `@feedbackkit/server` røres ikke.** Gjenbruk core-typer (`AssistMessage`,
  `AssistRequest`, `AssistResult`, `PickedElement`) og Plan 3-komponentene.
- **TDD**, hyppige commits, `npm run typecheck` + `npm test` grønt før merge.
