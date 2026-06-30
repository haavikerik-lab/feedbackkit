# @feedbackkit/react — design (Plan 3: AI-løs widget)

- **Dato:** 2026-06-30
- **Status:** Godkjent (brainstorm) → klar for implementeringsplan (Plan 3)
- **Bygger på:** [feedbackkit — design](./2026-06-26-feedbackkit-design.md), Plan 1 (`@feedbackkit/core`), Plan 2 (`@feedbackkit/server`) — begge merget til main.

## Sammendrag

`@feedbackkit/react` er den embeddbare React-widgeten: en flytende launcher som åpner et
dragbart panel der testeren kan velge et eier-forfattet scenario, peke på elementer på siden,
skrive en tilbakemelding, merke kategorier, og sende. Den gjenbruker den rene logikken i
`@feedbackkit/core` (composer, picker-regler, posisjon) og sender saken via `@feedbackkit/server`
sin submit-kontrakt (route eller `onCase`-callback).

**Denne planen er bevisst AI-løs** — pek + skriv + send er et komplett, shippbart produkt
(specens degraderingssti). AI-intervjuet (chat → kategori-forslag → utkast via assist-route) er
en ren påbygning som kommer i en senere plan (Plan 4).

## Mål

- Gi adoptere én `<FeedbackWidget>`-komponent som dropper rett inn i et React-tre.
- Gjenbruke `@feedbackkit/core` for all ren logikk; holde core DOM-fri.
- Isolere mot ukjent verts-CSS via inline-stiler (ikke Shadow DOM — det er v2).
- Fungere helt uten AI: peke på elementer, skrive fritt, merke kategorier, sende.
- La adopteren eie lagring (`submit` = route eller `onCase`) og identitet (`identity`-prop).

## Ikke-mål (YAGNI for v1 / Plan 3)

- Ingen AI: ingen assist-prop, chat, AI-kategoriforslag eller utkast-generering (Plan 4).
- Ingen Shadow DOM / web-component (v2). Komponenten rendres i vertens React-tre.
- Ingen egen `@feedbackkit/dom`-pakke — DOM-pekeren bor i react-pakka (web-component er v2).
- Ingen skjermbilder/region-utvalg, CSS-selektor-fangst eller analytics (jf. hovedspec).
- Ingen ferdig `dist`-build i denne planen (shipper TS/TSX-kilde som core/server; en
  publiserings-build er en senere bekymring).

## Arkitektur — pakke-grenser

```
core   (ingen runtime-deps — ren logikk + delte typer; DOM-fri)
  ↑              ↑
server         react          ← react gjenbruker composer/picker/position/contract fra core
(+ anthropic)  (+ react peer; DOM)
```

`@feedbackkit/react` er den **eneste** pakka som rører DOM.

**Beslutning D1 — egen tsconfig.** react-pakka extends `tsconfig.base.json` men overstyrer:
`"jsx": "react-jsx"` og `"lib": ["ES2022", "DOM", "DOM.Iterable"]`. core/server beholder
`lib: ["ES2022"]` (DOM-fri). Tester kjøres med **Vitest** (`vitest run`) i **jsdom**-miljø — det
første test-rammeverket utover `node:test`. Peer-dep `react` (≥18); dev-deps `vitest`,
`@testing-library/react`, `@testing-library/user-event`, `jsdom`, `react`, `react-dom`,
`@types/react`.

## Komponent-dekomponering

Små, fokuserte filer med klare grenser:

| Fil | Ansvar |
|---|---|
| `FeedbackWidget` | Rot: tar props, setter opp `useFeedbackSession`, rendrer `Launcher` + `Panel`. |
| `Launcher` | Flytende knapp som åpner/lukker. |
| `Panel` | Dragbart panel (posisjon via core + localStorage); vert for flyten. |
| `ScenarioChips` | Eier-forfattede scenario-chips (valgfri liste; differensiatoren). |
| `PickerToolbar` | Modusvelger Velg/Flervalg/Bla + liste over pekte elementer (fjern enkeltvis). |
| `Composer` | Tekstfelt med inline element-tokens (core composer serialize/parse). |
| `CategoryPicker` | Checkbokser for manuell kategori-merking. |
| `SubmitBar` | Send-knapp + status (idle/sending/sent/error, retry ved feil). |

Hooks/moduler:

| Fil | Ansvar |
|---|---|
| `useFeedbackSession` | Reducer-hook med all state (D3). |
| `useElementPicker` | DOM-pekeren: listeners, interception, outline (D2). |
| `describeElement` | `Element → PickedElement {label, text}` (DOM-lesing, capet). |
| `client` | Innsending: `fetch`(`{url}`) eller `onCase`-callback (D4). |
| `index` | Barrel: `FeedbackWidget` + offentlige prop-/konfig-typer. |

## Offentlig API (props)

```tsx
<FeedbackWidget
  submit={{ url: "/api/feedback/submit" }}   // ELLER: { onCase: async (c) => { … } }
  accent="#f08a5d"                            // tema-farge
  locale="no"                                 // "no" | "en"
  categories={DEFAULT_CATEGORIES}             // fra @feedbackkit/core; konfigurerbar
  scenarios={[{ id, title, prompt }]}         // valgfri; eier-forfattede chips
  identity={{ id?, email?, anonymous? }}      // valgfri; pass-through til saken
/>
```
`assist`/`ai` finnes ikke i Plan 3 (AI er Plan 4).

## DOM-pekeren — `useElementPicker` (D2)

Hooken eier all DOM-interaksjon slik at core forblir ren:

- Legger en **capture-fase `click`-listener** på `document` når modus er `select`/`multi`.
- Bruker core sin **`shouldInterceptClick(mode, insideFeedbackUi, hasModifier)`** for å avgjøre
  `preventDefault()` + `stopPropagation()` — så et «pek»-trykk ikke også følger en lenke. I
  `browse`-modus er siden helt levende. `insideFeedbackUi` = klikk-target ligger innenfor
  widgetens egen DOM (markert med et `data-fbk`-attributt / ref).
- Ved gyldig pek: **`describeElement(el)`** → `PickedElement` (`label` = heuristikk fra
  `aria-label` → `role` → tagName; `text` = trimmet `textContent`, capet) → dispatch til sesjonen.
- **Outline via inline-stiler** (`outline`/`boxShadow`) rett på verts-elementet ved hover og valg
  — tåler ukjent verts-CSS (specens isolasjonsmønster). Original inline-stil restaureres ved
  av-hover/av-valg.
- Rydder alle listeners + restaurerer stiler ved unmount og modusbytte.

## State — `useFeedbackSession` (D3)

Én ren `useReducer` (testbar uten render):

```ts
type SessionState = {
  open: boolean;
  mode: PickerMode;                 // "select" | "multi" | "browse" (fra core)
  elements: PickedElement[];
  text: string;                     // composer-innhold (med element-token-markører)
  scenario: { id: string; title: string } | null;
  categories: string[];             // valgte kategori-koder
  status: "idle" | "sending" | "sent" | "error";
};
// actions: open · close · setMode · addElement · removeElement · setText ·
//          selectScenario · clearScenario · toggleCategory ·
//          sendStart · sendOk · sendError
```

## Innsending — `client` (D4)

`submit`-prop er en union (per hovedspec): `{ url: string }` **eller**
`{ onCase: (c: FeedbackCaseInput) => Promise<void> | void }`.

Ved send bygges en `FeedbackCaseInput` (core-typen) fra state:
- `message` = composer-innhold rendret via core (`toApiContent`),
- `elements` = `dedupeElements(state.elements)` (core, cap 10),
- `page` = `location.pathname`, `url` = `location.href`,
- `scenario`, `categories`, `identity` (fra prop).

`{ url }` → `fetch(url, { method: "POST", body: JSON.stringify(case) })`; ikke-OK respons →
`status: "error"`. `{ onCase }` → kall direkte; kastet feil → `status: "error"`. Suksess →
`status: "sent"`. Feil er retry-bar. **Ingen assist/AI-kall i denne fasen.**

## Styling, persistens, degradering

- **Inline-stiler** overalt (React `style`-objekter); `accent`-prop styrer tema-farge. Ingen
  CSS-filer — full isolasjon mot verts-CSS.
- **Panel-posisjon** persisteres til `localStorage` under core sin `FEEDBACK_POS_STORAGE_KEY`.
  Ved last: `parseStoredPosition` → `clampPosition(x, y, w, h, vw, vh)` til viewport (alt fra
  core). Drag oppdaterer posisjonen; slipp lagrer.
- Widgeten ER pek + skriv + send i Plan 3 — ingen AI-gren å degradere til ennå.

## Testing (Vitest + RTL + jsdom)

- **Rene unit:** `useFeedbackSession`-reducer (hver action gir forventet ny state);
  `describeElement` (jsdom-element med ulike attributter → forventet `{label, text}`, inkl.
  capping).
- **Hook/DOM:** `useElementPicker` — render en vert + widget, simuler klikk i `select`/`multi`,
  assert at interception skjer (capture + `shouldInterceptClick`) og at riktig `PickedElement`
  fanges; at `browse`-modus og klikk *inne i* widgeten IKKE fanges.
- **Integrasjon (RTL):** åpne → velg scenario → pek element → skriv → merk kategori → send;
  mock `fetch` og en `onCase`-callback; assert `FeedbackCaseInput`-formen
  (message/elements/page/url/categories/scenario/identity).
- Vitest-config: `environment: "jsdom"`, RTL-oppsett (cleanup mellom tester).

## Datamodell (saken som sendes)

Gjenbruker `FeedbackCaseInput` fra `@feedbackkit/core` (uendret fra Plan 2):
`{ message, page, url?, scenario?, categories?, elements?, identity? }`. Server stempler
`createdAt`. Widgeten setter aldri `createdAt`.

## Beslutningslogg

- **D1** — egen tsconfig for react (`jsx: react-jsx`, `lib` inkl. DOM); Vitest + RTL + jsdom.
- **D2** — DOM-pekeren som hook (`useElementPicker`) i react-pakka; core forblir DOM-fri;
  `describeElement` for element → `{label, text}`; inline-stil-outline på verts-elementer.
- **D3** — all state i én ren `useFeedbackSession`-reducer (testbar uten render).
- **D4** — `submit` = `{url}` (fetch) | `{onCase}` (callback); bygger `FeedbackCaseInput` via
  core composer/dedupe.
- **D5** — inline-stiler + `accent`; panel-posisjon persistert via core position-helpere.
- Scope: full AI-løs flyt (scenario-chips + picker + composer + manuelle kategorier + send).
  AI-laget (assist: chat/kategori-forslag/utkast) = Plan 4.

## Åpne spørsmål

Ingen blokkerende. `describeElement`-heuristikkens nøyaktige felt-rekkefølge og lengde-cap,
samt panelets eksakte mål/styling, fastsettes i implementeringsplanen (rimelige defaults).
