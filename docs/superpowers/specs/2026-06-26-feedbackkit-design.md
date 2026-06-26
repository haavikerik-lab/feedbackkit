# feedbackkit — design

- **Dato:** 2026-06-26
- **Status:** Godkjent (brainstorm) → klar for implementeringsplan
- **Arbeidsnavn:** `feedbackkit` (lett å bytte; ikke låst)

## Sammendrag

En gjenbrukbar, embeddbar **feedback-widget for nettsider/apper**, trukket ut som et
selvstendig open-source-prosjekt fra LexPulse sin tilbakemeldingschat. Kjernen er en
kombinasjon som i dag ikke er vanlig i feedback-verktøy:

1. **Element-peker** — testeren peker på hva som helst på siden (Velg / Flervalg / Bla),
   og det rir med som kontekst.
2. **AI-intervju (valgfritt)** — en chat som gjør en vag reaksjon («for mye tekst») om til
   en strukturert, kategorisert sak med tittel og konkrete mål.
3. **Eier-forfattede scenarier («ferdiglagde prompter»)** — differensiatoren: den som
   bygger siden forhåndsskriver oppgaver venner/bekjente skal teste, så testeren slipper å
   tenke ut hva de skal si. Guidet brukertesting, ikke bare en feedback-innboks.

Førstebruker er **autocv.no** (Next.js/React). Samtidig publiseres det på **GitHub** slik at
andre kan klone, sette inn **egen Anthropic-nøkkel** og koble **egen database**.

## Mål

- Gi autocv.no en fungerende feedback-widget raskt, ved å gjenbruke LexPulse-mønstrene.
- Pakke det som en React-komponent + en server-adapter andre enkelt kan ta i bruk.
- Holde Anthropic-nøkkelen **kun server-side** — aldri i nettleseren.
- La adopteren eie lagring (BYO database) og innlogging (BYO auth).
- Fungere **uten** AI også (degrader til pek + skriv + send).

## Ikke-mål (YAGNI for v1)

- Ingen multi-tenant SaaS, dashboard eller billing (det er et eget, større produkt).
- Ingen framework-agnostisk web-component ennå (React-først; web-component vurderes i v2).
- Ingen skjermbilder / region-utvalg (LexPulse bruker label + tekst — holder for v1).
- Ingen analytics / session-replay.
- Ingen robust CSS-selektor-fangst (basic label+tekst nå; selektor vurderes i v2).

## Bakgrunn — hva som gjenbrukes fra LexPulse

LexPulse-chatten er allerede bygget på en måte som nesten inviterer til uttrekk:

- `composer.ts` (inline element-tokens, serialize/parse) er **ren** — ingen domene-avhengigheter.
- `ElementPicker` er nesten 100 % generisk DOM-kode og markerer valgte elementer med
  **inline-stiler** (`outline`/`boxShadow`) rett på vertselementene — ikke via Tailwind. Det er
  akkurat riktig for en fremmed side hvor man ikke vet noe om CSS-en.
- AI-SDK-et holdes **ute av klient-bundelen**; all Anthropic-logikk lever bak en server-route.
- All domenekunnskap er isolert i én fil (`lexpulse-kb.ts`) — byttes ut per adopter.
- Den tvungne `respond`-verktøykallet (chat + draft) er generisk maskineri; kun kategoriene
  og kunnskapsbasen er LexPulse-spesifikke.

Ca. 80 % av verdien sitter altså allerede i moduler som ikke vet at de er i LexPulse. Disse
trekkes ut og av-LexPulse-es (konfigurerbare kategorier, injiserbar KB, tema-tokens, locale).

## Arkitektur

Valgt tilnærming: **agnostisk server-kjerne + tynn Next.js-wrapper + dokumentert HTTP-kontrakt.**

- Vi shipper en framework-uavhengig handler-kjerne (ren funksjon: request inn → respons ut).
- En ettlinjes Next.js-route-wrapper for autocv.no og de fleste adoptere.
- HTTP-kontrakten er dokumentert, så ikke-Next-adoptere kan skrive sin egen route.
- **Lagring = en callback** adopteren oppgir (`onCase`), så de bruker hvilken DB de vil.

Forkastede alternativer:
- *Tynn kontrakt (frontend + alt selv):* maks fleksibelt, men for mye oppsett for adopteren.
- *Drop-in adapter låst til ett rammeverk:* best DX, men ekskluderer ikke-Next-adoptere.

## Pakke-oppdeling (monorepo)

```
feedbackkit/
  packages/
    widget/      React-komponenten (klient)
    server/      agnostisk handler-kjerne + Next.js-wrapper
  examples/
    autocv/      ekte e2e-integrasjon (førstebruker)
    supabase/    referanse: lagring i Supabase-tabell
    webhook/     referanse: lagring via webhook / e-post
  docs/
```

### `widget` (React, klient)

Flytende launcher → dragbart panel → `ElementPicker` (Velg/Flervalg/Bla) → `composer` med
inline element-tokens → chat-transkript → kategori-bokser → «Lag tilbakemelding»-utkast → send.

Offentlig API (props):

```tsx
<FeedbackWidget
  // submit kan være en route ELLER en ren-klient-callback (onCase):
  submit={{ url: "/api/feedback/submit" }}   // eller: onCase={async (c) => { /* lagre */ }}
  // assist (AI) MÅ være en server-route — nøkkelen er server-side og kan aldri ligge i
  // nettleseren. Utelat den (eller sett ai={false}) for ren pek + skriv + send.
  assist={{ url: "/api/feedback/assist" }}
  accent="#f08a5d"                 // tema-farge, matcher vertsappen
  locale="no"                      // "no" | "en"
  categories={DEFAULT_CATEGORIES}  // konfigurerbar; default bug/forvirrende/mangler/idé/annet
  scenarios={[                     // differensiatoren — kan utelates
    { id: "find-cv", title: "Lag en CV", prompt: "Prøv å lage en CV fra bunnen av." },
  ]}
  identity={{ id?, email?, anonymous? }} // valgfri; adopteren bestemmer
  ai={true}                        // krever assist-route; av ⇒ pek + skriv + send
/>
```

**Klient/server-regel:** `submit` kan være en route eller en `onCase`-callback (ren klient).
`assist` (AI) må alltid være en server-route — uten den kan AI ikke kjøre, og widgeten faller
tilbake til pek + skriv + send. «Ren klient uten routes» er altså kun mulig med `ai={false}`.

Isolasjon i v1: komponenten rendres i vertens React-tre (som i LexPulse). Picker-markeringen
bruker inline-stiler, så den tåler ukjent verts-CSS. (Shadow-DOM-isolasjon = v2, sammen med
web-component-varianten.)

### `server` (adapter)

- `createAssistHandler({ anthropicKey, kb?, categories?, model? })` — håndterer AI chat + draft
  med tvunget `respond`-verktøy. Nøkkel leses server-side. Mangler nøkkel ⇒ 503, klienten faller
  tilbake til «skriv selv».
- `createSubmitHandler({ onCase })` — validerer + capper payload, kaller adopterens lagring.
- Next.js-wrapper: `export const POST = createAssistHandler({...})` i én linje.
- Input-capping og rate-limit-kroker (LexPulse flagget at en delt per-bruker-grense + spend-cap
  må på plass før bred rollout — vi eksponerer kroker for det her).

### `examples`

- `autocv/` — ekte integrasjon (e2e mot førstebruker), lagrer til ny Supabase-tabell.
- `supabase/` — minimal referanse for Supabase-lagring (RLS-mønster, som LexPulse).
- `webhook/` — referanse som POSTer saken videre / sender e-post.

## Differensiator — eier-forfattede scenarier

`scenarios` er en liste oppgaver eieren forhåndsskriver. Når en tester åpner widgeten kan de
velge et scenario (vist som chips) eller frikjøre. Et valgt scenario:

1. **seeder samtalen** (AI-en vet hva testeren ble bedt om å gjøre), og
2. **kontekstualiserer saken**: «Testeren ble bedt om å gjøre X — de opplevde Y.»

Dette er LexPulse sine intent-bokser snudd på hodet: eier-forfattet i stedet for AI-generert.
v1 holder det enkelt (en flat liste prompter som start-chips); rikere scenarier (steg, mål,
mål-element) er en mulig v2.

## Dataflyt

1. Åpne → (valgfritt) velg scenario → pek element(er) → skriv.
2. (Med AI) `POST /assist` (mode `chat`) → `{ reply, categories }`. «Lag tilbakemelding» →
   `POST /assist` (mode `draft`) → redigerbart utkast.
3. Send → `POST /submit` → `onCase(case)` → adopterens DB / webhook / issue.

## Datamodell (saken som lagres)

```ts
type FeedbackCase = {
  message: string;            // den ferdige saken (AI-utkast eller håndskrevet)
  page: string | null;        // rute/sti
  url?: string;               // full URL
  scenario?: { id: string; title: string } | null;
  categories?: string[];      // valgte kategori-koder
  elements?: { label: string; text: string }[]; // pekte element (capet)
  identity?: { id?: string; email?: string; anonymous?: boolean } | null;
  createdAt: string;          // ISO; stemples server-side
};
```

HTTP-kontrakt (dokumentert så ikke-Next-adoptere kan implementere selv):

- `POST {assist}` body `{ mode: "chat"|"draft", messages, page, elements, categories }`
  → `{ reply, categories }` (chat) / `{ draft }` (draft). 401 hvis adopterens gate avviser,
  503 hvis AI utilgjengelig (mangler nøkkel / no credits / upstream nede).
- `POST {submit}` body `FeedbackCase` (uten `createdAt`) → `{ ok: true }`.

## AI-integrasjon

- Modell konfigurerbar (default en rimelig Claude-modell, slik LexPulse bruker en billig
  modell til chat). Tvunget `respond`-verktøy gir pålitelig strukturert kategori-output.
- KB injiserbar per adopter (`kb`-streng). Uten KB: AI-en hjelper fortsatt å formulere
  saken, men svarer ikke domene-spørsmål — eller Q&A-modus skrus av.
- Nøkkel kun server-side. Klient-bundelen inneholder aldri Anthropic-SDK-et.

## Sikkerhet

- API-nøkkel server-side, aldri i nettleseren.
- All bruker-input behandles som innhold, aldri som instruksjoner til modellen (LexPulse-mønster).
- Payload-capping (historikk, element-antall/-lengde) før modell-kall.
- Kroker for rate-limit + spend-cap (må settes før offentlig/anonym rollout).
- Adopteren eier auth-gaten; widgeten antar ikke at hvem som helst får sende.

## Testing

- `composer` + picker-logikk er rene → unit-tester (LexPulse `composer.test.ts` som mal).
- Server-handlere → unit-tester med mocket Anthropic-klient.
- `examples/autocv` → ekte e2e mot førstebruker.

## v1-scope vs. utsatt (v2+)

| Område | v1 | v2+ |
|---|---|---|
| Form | React npm-pakke | Framework-agnostisk web-component + Shadow DOM |
| Isolasjon | Inline-stiler (verts-React-tre) | Shadow DOM |
| Element-kontekst | label + tekst | + CSS-selektor, + skjermbilde/region |
| Scenarier | flat prompt-liste | steg/mål/mål-element |
| Backend | callback + Next.js-wrapper | flere rammeverks-wrappere |
| Drift | BYO DB/nøkkel | evt. valgfri hosted-modus |

## Åpne spørsmål (avklares ved behov, ikke blokkerende)

- Endelig pakkenavn (npm-scope).
- Default Claude-modell-id (settes når vi skriver implementeringsplanen, jf. claude-api-skill).
- Om Q&A-modus (svare på spørsmål om appen) skal med i v1, eller kun «reaksjon → sak».
