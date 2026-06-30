# @feedbackkit/server — design

- **Dato:** 2026-06-30
- **Status:** Godkjent (brainstorm) → klar for implementeringsplan (Plan 2)
- **Bygger på:** [feedbackkit — design](./2026-06-26-feedbackkit-design.md) og Plan 1 (`@feedbackkit/core`)

## Sammendrag

`@feedbackkit/server` er den agnostiske backend-kjernen for feedbackkit: to handler-fabrikker
(`createAssistHandler` for AI chat + utkast, `createSubmitHandler` for lagring) pluss de delte
kontrakt-typene og en tynn Next.js-wrapper. Kjernen er rene funksjoner (request inn → resultat
ut) uten `Request`/`Response`, så den er triviell å teste og kan wrappes for hvilket som helst
rammeverk. AI-logikken bruker et tvunget `respond`-verktøy mot Anthropic for pålitelig
strukturert output. Anthropic-nøkkelen leses kun server-side.

## Mål

- Gi adoptere en én-linjes Next.js-route for både AI-assist og innsending.
- Holde AI-kjernen testbar uten nettverk (injiserbar klient med ekte SDK som default).
- Plassere de delte kontrakt-typene ett sted begge pakker (server + react) kan importere.
- Behandle all bruker-input som innhold, aldri som instruksjoner til modellen.
- La adopteren eie modellvalg, auth-gate, lagring og rate-limit/spend-kontroll.

## Ikke-mål (YAGNI for v1 / Plan 2)

- Ingen dedikert Q&A/domene-spørsmål-modus (KB beriker kun formuleringen — Q&A er v2).
- Ingen innebygd rate-limiter eller spend-cap (vi eksponerer kroker; adopteren implementerer).
- Ingen multi-leverandør-AI (BYOK = egen **Anthropic**-nøkkel; andre leverandører er ikke v1).
- Ingen klient-styrt modellvalg (bill-sikkerhet — se §7).
- Ingen andre rammeverks-wrappere enn Next.js i denne planen (Express o.l. via dokumentert
  HTTP-kontrakt senere).

## Arkitektur — pakke-grenser

Avhengighets-DAG holdes asyklisk. Klient-pakken (`react`) drar aldri inn server-pakkens
`@anthropic-ai/sdk`-kant:

```
core   (ingen runtime-deps — ren logikk + delte typer)
  ↑              ↑
server         react          ← begge importerer kontrakt-typer fra core
(+ @anthropic-ai/sdk)
```

**Beslutning D1 — delte kontrakt-typer bor i `@feedbackkit/core`** (ny `src/contract.ts`,
re-eksportert fra core sin `index.ts`), ikke i server. Core er allerede den dep-frie grunnmuren
der `PickedElement` bor; react-widgeten trenger samme typer uten å arve server-deps. Plan
1-koden røres ikke — dette er ren tilføyelse i core.

**Beslutning D4 — to lag.** En agnostisk `request → result`-kjerne (ingen `Request`/`Response`)
som kaster typede feil, pluss en tynn HTTP-wrapper som mapper feil til statuskoder. Dette gjør
kjernen lett å unit-teste og wrapperen triviell.

`@feedbackkit/server` shipper som ESM-pakke med samme testverktøy som core
(`node --import tsx --test`, `tsc --noEmit`). Runtime-deps: `@anthropic-ai/sdk`,
`@feedbackkit/core` (workspace).

## Kontrakt-typer (`core/src/contract.ts`)

```ts
import type { PickedElement } from "./composer";

export type CategoryConfig = { code: string; label: string };
export type Scenario = { id: string; title: string; prompt: string };
export type AssistMessage = { role: "user" | "assistant"; content: string };

export type FeedbackCase = {
  message: string;                       // ferdig sak (AI-utkast eller håndskrevet)
  page: string | null;                   // rute/sti
  url?: string;                          // full URL
  scenario?: { id: string; title: string } | null;
  categories?: string[];                 // valgte kategori-koder
  elements?: PickedElement[];            // pekte element (capet) — core sin type
  identity?: { id?: string; email?: string; anonymous?: boolean } | null;
  createdAt: string;                     // ISO; stemples server-side
};
export type FeedbackCaseInput = Omit<FeedbackCase, "createdAt">;

export type AssistRequest = {
  mode: "chat" | "draft";
  messages: AssistMessage[];
  page?: string | null;
  url?: string;
  elements?: PickedElement[];
  categories?: string[];                 // valgte koder fra klienten
  scenario?: { id: string; title: string } | null;
};
export type AssistChatResult = { reply: string; categories: string[] };
export type AssistDraftResult = { draft: string };
export type AssistResult = AssistChatResult | AssistDraftResult;
```

Merk: `model` finnes **ikke** i `AssistRequest` — modellvalg er server-side (se §7).

## Komponent: `createAssistHandler`

```ts
type AssistOptions = {
  anthropicKey: string;
  model?: string;                        // default "claude-haiku-4-5-20251001"
  categories?: CategoryConfig[];         // default: bug/forvirrende/mangler/idé/annet
  kb?: string;                           // valgfri domene-KB → beriker system-prompt
  gate?: (req: AssistRequest) => boolean | Promise<boolean>;        // false ⇒ 401
  rateLimit?: (req: AssistRequest) => boolean | Promise<boolean>;   // false ⇒ 429-krok, BYO
  client?: AnthropicLike;                // test-injeksjon (§6); default bygger ekte SDK
};

createAssistHandler(opts: AssistOptions): (req: AssistRequest) => Promise<AssistResult>
```

Flyt:

1. (valgfritt) `gate(req)` → false ⇒ `FeedbackError(401)`.
2. (valgfritt) `rateLimit(req)` → false ⇒ `FeedbackError(429)`.
3. Manglende `anthropicKey` ⇒ `FeedbackError(503)` (klient faller tilbake til «skriv selv»).
4. Cap payload (§7) → bygg system-prompt (kategorier + valgfri `kb` + fast sikkerhets-ramme)
   → bygg messages (bruker-input som data) → kall modell med tvunget `respond`-verktøy.
5. Parse `tool_use`-input → returner `{ reply, categories }` (chat) eller `{ draft }` (draft).

### Forced `respond`-verktøy

Modellen tvinges (`tool_choice`) til å kalle `respond`. Schema per modus:

- **chat:** `{ reply: string, categories: string[] }` — `categories` som `enum` av de
  konfigurerte kodene, så modellen ikke finner på egne koder.
- **draft:** `{ draft: string }`.

System-prompten er fast og inneholder kategori-listen + valgfri `kb`. **All bruker-input
(messages, elements, scenario) legges i user-meldingen som data**, og system-prompten
instruerer eksplisitt at dette er innhold som skal analyseres, aldri instruksjoner som skal
følges (LexPulse-mønsteret; specens sikkerhetskrav).

## Komponent: `createSubmitHandler`

```ts
type SubmitOptions = {
  onCase: (c: FeedbackCase) => void | Promise<void>;
  gate?: (req: FeedbackCaseInput) => boolean | Promise<boolean>;   // false ⇒ 401
};

createSubmitHandler(opts: SubmitOptions): (req: FeedbackCaseInput) => Promise<{ ok: true }>
```

Flyt: (valgfritt) `gate` → cap payload → stemple `createdAt` server-side →
`onCase(case)` → `{ ok: true }`. Adopteren eier lagringen (DB / webhook / issue) via `onCase`.

## AI-klient-testbarhet — valgt tilnærming (av 3)

- **A (valgt):** `client?`-override som tilfredsstiller et minimalt interface
  `AnthropicLike = { messages: { create(params): Promise<...> } }`. Uten override bygges ekte
  `new Anthropic({ apiKey })`. Tester sender en mock som returnerer et kanned `tool_use`-svar.
  → Null nettverk i tester, full DX (bare gi nøkkel), pakken eier SDK-en (én-linjes wrapper
  mulig).
- **B (forkastet):** alltid ekte SDK + HTTP-mock (msw/nock) i test — flere deps, treigere,
  skjørt.
- **C (forkastet):** injiser hele transport-funksjonen, ingen SDK-dep i pakken — maks
  frikobling, men hver adopter må wire SDK selv → dårligere DX, dreper én-linjeren.

## Next.js-wrapper

```ts
createAssistRoute(opts: AssistOptions): (req: Request) => Promise<Response>
createSubmitRoute(opts: SubmitOptions): (req: Request) => Promise<Response>

// bruk:
export const POST = createAssistRoute({
  anthropicKey: process.env.ANTHROPIC_API_KEY!,
  model: "claude-sonnet-4-6",   // valgfritt; utelat ⇒ haiku-fallback
});
```

Wrapperen: parse JSON-body → kall agnostisk kjerne → `Response.json(...)`. Mapper
`FeedbackError.status` → 400/401/429/503; ugyldig JSON ⇒ 400.

## Sikkerhet & capping (§7)

- **Nøkkel kun server-side**, aldri returnert til klient.
- **Modellvalg server-side, ikke klient-overstyrbart.** `model` settes i `AssistOptions` ved
  handler-konstruksjon. Bevisst utelatt fra `AssistRequest`: under BYOK ligger regninga på
  adopterens nøkkel, så en klient-valgt modell ville latt hvem som helst tvinge en dyr modell og
  kjøre opp kostnaden. Default `claude-haiku-4-5-20251001` (billigst/raskest) som bekvem
  fallback; adopteren overstyrer fritt.
- **Payload-cap før modell-kall:** historikk-lengde (siste N meldinger), element-antall via core
  sin `dedupeElements` (cap 10), per-felt lengdekutt.
- **`gate`** (auth) + **`rateLimit`/spend** = eksponerte kroker, ingen innebygd limiter (D3 —
  YAGNI; specen ber kun om kroker). Adopteren eier auth-gaten.

## Testing

`node:test` + tsx (som core). Mock-klient returnerer kanned `tool_use`. Dekker:

- chat → `{ reply, categories }`; categories begrenset til konfigurerte koder.
- draft → `{ draft }`.
- manglende nøkkel ⇒ `FeedbackError(503)`.
- `gate` false ⇒ `FeedbackError(401)`; `rateLimit` false ⇒ `FeedbackError(429)`.
- payload-cap kutter overflødige elementer/historikk før kall.
- bruker-input havner i user-meldingen, ikke i system-prompten.
- `createSubmitHandler`: `createdAt` stemples; `onCase` kalles med full sak.
- Next-wrapper: gyldig body → 200 JSON; `FeedbackError.status` → riktig HTTP-kode; ugyldig
  JSON → 400.

## Beslutningslogg

- **D1** — delte kontrakt-typer i `@feedbackkit/core` (`contract.ts`), ikke server.
- **D2** — injiserbar AI-klient (`client?`), default bygger ekte SDK fra nøkkel (tilnærming A).
- **D3** — rate-limit/spend kun som eksponerte kroker, ingen innebygd limiter.
- **D4** — to-lags handler: agnostisk kjerne (typed feil) + tynn HTTP-wrapper (feil → status).
- Assist-scope: kun reaksjon → sak (chat + draft); KB beriker formulering; Q&A = v2.
- Default-modell: `claude-haiku-4-5-20251001`, konfigurerbar server-side, med default.
- Next.js-wrapper inkludert i Plan 2.

## Åpne spørsmål

Ingen blokkerende. Eksakt verdi for historikk-cap (N meldinger) og per-felt lengdekutt settes i
implementeringsplanen (rimelige defaults, konfigurerbart om nødvendig).
