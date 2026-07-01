# feedbackkit — Fundamentet / publiserbarhet — Design (Plan 5)

**Status:** Godkjent design, klar for implementeringsplan.
**Dato:** 2026-07-01
**Bygger på:** alle tre pakker på `main` (`@feedbackkit/core`, `/server`, `/react`).
**Grunnlag:** adoption-audit (2026-07-01) som fant fem harde blokkere for adopsjon.

## Mål

Gjøre alle tre pakkene bygg- og publiserbare slik at
`npm install @feedbackkit/react @feedbackkit/server` bare virker for en utenforstående — ingen
`transpilePackages`, ingen vendor-in, ingen manuelle hacks. Levere publiserbare artefakter +
en dokumentert manuell publish-flyt + en Quickstart-README.

## Ikke-mål (YAGNI / defereres)

- **Ingen faktisk `npm publish` i denne planen.** Publisering krever brukerens npm-konto og at
  `@feedbackkit`-organisasjonen opprettes — brukeren gjør det manuelt når klar. Planen leverer
  *publish-READY* pakker + release-dokumentasjon.
- **Ingen `examples/next-app`** og ingen AutoCV-wiring — defereres til Plan 6 (integrasjon).
- **Ingen CI-automatisert publish** (ingen changesets, ingen `NPM_TOKEN`-hemmelighet). Manuell
  `npm publish --workspaces` er valgt.
- Ingen endringer i kjerne-adferd, komponenter eller kontrakt.

## Besluttede valg (fra brainstorming)

1. **Build-verktøy:** `tsup` (esbuild-basert, null-config-nær).
2. **Format:** **dual ESM + CJS** + `.d.ts` per pakke (maksimal forbruker-kompatibilitet).
3. **Versjonering:** enkel **synkronisert** versjon (alle tre til `0.1.0`, bump i lås). Ingen changesets.
4. **Publish:** manuell `npm publish --workspaces --access public`, rekkefølge core → server → react,
   med `prepublishOnly`-build. Brukeren kjører det.
5. **Lisens:** **MIT**.
6. **Dev vs publish-resolusjon:** publiserte pakker resolver til bygd `dist/`; lokal utvikling resolver
   fortsatt til `src/` (rask TDD-loop) via en `development`-export-condition + tooling-config (se under).

## Arkitektur: dev vs. publish-resolusjon (den ene ikke-trivielle biten)

Problemet: hvis `exports`/`types` peker på `dist/`, må alt bygges før tsc/tester kan resolve interne
pakker — det ødelegger den umiddelbare TDD-loopen. Løsning: en `development`-export-condition som
peker på `src/`, som **kun** dev-tooling aktiverer.

Hver pakkes `package.json`:
```jsonc
{
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "development": "./src/index.ts",   // kun aktiv i dev-tooling
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "files": ["dist"]
}
```
En forbruker (uten `development`-condition) får `types`/`import`/`require` → bygd `dist/`.

Dev-tooling aktiverer `development` → `src/` i tre kontekster:
- **tsc:** `tsconfig.base.json` → `"customConditions": ["development"]` (TS 5.7 + `moduleResolution:
  "Bundler"` støtter dette). Typecheck resolver `@feedbackkit/core` → `src/index.ts`.
- **node:test (core, server):** test-script legger til `--conditions development`:
  `node --conditions development --import tsx --test "test/**/*.test.ts"`. Node-resolveren velger
  `development`-grenen → `src`.
- **vitest (react):** **`resolve.alias`** i `vitest.config.ts` (utvetydig på tvers av Vite-versjoner,
  til forskjell fra `resolve.conditions`):
  ```ts
  import { defineConfig } from "vitest/config";
  import { fileURLToPath } from "node:url";
  export default defineConfig({
    resolve: { alias: { "@feedbackkit/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)) } },
    test: { environment: "jsdom", globals: true, setupFiles: ["./test/setup.ts"] },
  });
  ```

**tsup eksternaliserer deps** (inkl. `@feedbackkit/core` og `@anthropic-ai/sdk`) som standard, så
`dist/`-dts refererer de publiserte typene — ingen inlining. Ingen build-steg trengs for dev-loopen.

## Build (tsup)

Hver pakke får en `tsup.config.ts`:
```ts
import { defineConfig } from "tsup";
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
});
```
- Utdata per pakke: `dist/index.js` (ESM), `dist/index.cjs` (CJS), `dist/index.d.ts`.
- Rot `package.json` får `"build": "npm run build --workspaces"`. Hver pakke får `"build": "tsup"`
  og `"prepublishOnly": "tsup"`.
- **Build-rekkefølge:** tsup eksternaliserer deps, så `.d.ts`-generering for server/react refererer
  `@feedbackkit/core` som bare specifier uten å inline eller resolve core sitt bygde dts — bygget er
  dermed rekkefølge-uavhengig. Verifiseres; skulle en ordnings-avhengighet dukke opp, sekvenser
  rot-`build` eksplisitt core → server → react.
- `.gitignore` inneholder allerede `dist/` — bygde artefakter committes ikke.
- **`@feedbackkit/react` — "use client":** legg `"use client";` som første linje i `src/index.ts`
  (før imports/eksports). tsup må **bevare direktivet** øverst i `dist/index.js` og `dist/index.cjs`.
  Bruk `esbuildOptions` med en JS-banner som fallback hvis tsup ikke bevarer det automatisk:
  ```ts
  // i react sin tsup.config.ts
  banner: { js: '"use client";' },
  ```
  Verifiser at begge react-dist-entryene starter med `"use client"`. Dette gjør at widgeten kan
  droppes rett inn i en Next.js Server Component-layout med `{url}`-props (strenger krysser RSC-
  grensen; en egen klient-wrapper trengs ikke lenger).

## Fiks de fem blokkerne

1. **Publiser-klar versjon:** bump `core`, `server`, `react` fra `0.0.0` → **`0.1.0`**.
2. **Build:** tsup + `exports`/`main`/`module`/`types` → `dist/` (over).
3. **Intern dep:** i `server` og `react`, bytt `"@feedbackkit/core": "*"` → **`"^0.1.0"`**
   (npm-native eksplisitt range — npm støtter *ikke* `workspace:`-protokollen). npm symlinker den
   lokale workspace-core når `0.1.0` tilfredsstiller `^0.1.0`; ved publish resolver den til publisert core.
4. **LICENSE:** MIT (se under).
5. **"use client":** i react-entryet (over).

## LICENSE + pakke-metadata

- Rot **`LICENSE`** (MIT, copyright «2026 Erik Haavik»). `"license": "MIT"` i hver pakke.
- Hver publiserbar pakke får: `description`, `keywords`, `author` («Erik Haavik»),
  `repository` (`{ "type": "git", "url": "git+https://github.com/haavikerik-lab/feedbackkit.git",
  "directory": "packages/<navn>" }`), `homepage`, `"files": ["dist"]`,
  `"publishConfig": { "access": "public" }` (scoped pakker er ellers `restricted`).
  `"sideEffects": false` for `core` og `server` (rene moduler; **ikke** react pga. `"use client"`).
- Beskrivelser:
  - core: «Framework-agnostic core for feedbackkit — composer, element-picker, posisjon og feedback/assist-kontrakten.»
  - server: «Server-handlere og rammeverk-ruter for feedbackkit — Anthropic-drevet AI-assist + feedback-innsending.»
  - react: «Embeddbar React feedback-widget for feedbackkit — element-picker + valgfritt AI-intervju.»

## Publish-flyt (dokumenteres i README, kjøres av bruker)

```bash
npm login                       # brukerens npm-konto
# opprett @feedbackkit-org på npmjs.com (engangs)
npm run build                   # bygger alle tre til dist/
npm publish -w @feedbackkit/core --access public
npm publish -w @feedbackkit/server --access public
npm publish -w @feedbackkit/react --access public
```
Rekkefølge core → server → react så `^0.1.0`-avhengigheten resolver. `prepublishOnly` bygger som
sikkerhetsnett.

**CI:** typecheck + test forblir `src`-baserte og uendrede (dev-conditionen resolver til `src`, ingen
build kreves der). Men CI får ett nytt steg **etter** test: `npm run build` + røyktest/`publint`, slik
at en ødelagt build eller ikke-publiserbar pakke fanges på hver push i stedet for først ved publish.

## Quickstart-README (skriv om rot `README.md`)

Behold arkitektur-/pakke-oversikten, men gjør README til en ekte getting-started:
- Én-linjes hva-det-er + pakke-tabell som lister **alle tre** pakkene (ikke bare core).
- **Install:** `npm install @feedbackkit/react @feedbackkit/server`.
- **Widget** (Next.js App Router — direkte i en Server Component-layout, siden pakken er et klient-
  modul via `"use client"`):
  ```tsx
  // app/layout.tsx
  import { FeedbackWidget } from "@feedbackkit/react";
  // ... i <body>:
  <FeedbackWidget submit={{ url: "/api/feedback/submit" }} assist={{ url: "/api/feedback/assist" }} locale="no" />
  ```
- **Assist-rute:**
  ```ts
  // app/api/feedback/assist/route.ts
  import { createAssistRoute } from "@feedbackkit/server";
  export const runtime = "nodejs";
  export const POST = createAssistRoute({ anthropicKey: process.env.ANTHROPIC_API_KEY! });
  ```
- **Submit-rute** (med eksempel-lagring):
  ```ts
  // app/api/feedback/submit/route.ts
  import { createSubmitRoute } from "@feedbackkit/server";
  export const runtime = "nodejs";
  export const POST = createSubmitRoute({ onCase: async (c) => { /* lagre c, f.eks. Supabase-insert */ } });
  ```
- **Env:** `ANTHROPIC_API_KEY` (kun server-side — aldri `NEXT_PUBLIC`).
- **Valgfri Supabase-DDL** for en `feedback_cases`-tabell (som referanse).
- **Releasing**-seksjon: publish-flyten over.

## Verifikasjon

- `npm run build` produserer per pakke: `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts` (+ maps).
- `dist/index.js` og `dist/index.cjs` for **react** starter med `"use client"`.
- En røyktest at en bygd pakke faktisk resolver/importeres (f.eks. importér `@feedbackkit/core` sitt
  bygde CJS + ESM i et lite node-steg, eller `publint`/`@arethetypeswrong/cli` mot pakkene).
- **De eksisterende 105 testene + typecheck fortsatt grønt** under den nye exports/condition-
  oppsettet (core 19 + react 58 + server 28). Dette er den kritiske regresjonssjekken — dev-loopen må
  fortsatt resolve interne pakker til `src/` uten build.

## Globale føringer

- ESM-first (`"type": "module"`) beholdes; CJS legges til via tsup for kompatibilitet.
- Node ≥ 22, TypeScript strict, tsup som eneste nye build-dep (per pakke eller rot-devDep).
- Ingen endring i kjerne-/server-/react-kjøretidsadferd — kun pakking, metadata, docs, og
  dev/publish-resolusjon.
- Alle interne pakke-referanser via eksplisitt semver (`^0.1.0`), aldri `workspace:`-protokoll (npm).
