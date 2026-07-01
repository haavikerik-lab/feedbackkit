# feedbackkit Fundament / publiserbarhet — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gjøre `@feedbackkit/core`, `/server` og `/react` npm-installerbare (bygde, publiserbare pakker) uten å røre kjøretidsadferd, slik at `npm install @feedbackkit/react @feedbackkit/server` bare virker.

**Architecture:** tsup bygger hver pakke til dual ESM+CJS + `.d.ts` i `dist/`. `exports`/`main`/`types` peker på `dist/`, men en egendefinert `feedbackkit-dev`-export-condition + tooling-config (tsc `customConditions`, node:test `--conditions`, react-vitest `resolve.alias`) holder dev-loopen på `src/` så ingen build trengs for tester/typecheck. Pluss `"use client"` i react-bygget, `^0.1.0` interne deps, MIT + metadata, og en Quickstart-README.

**Tech Stack:** npm workspaces, TypeScript strict (5.7), tsup (esbuild), publint. Node ≥ 22.

## Global Constraints

- **Format:** dual **ESM (`dist/index.js`) + CJS (`dist/index.cjs`) + `dist/index.d.ts`** per pakke (via tsup).
- **Dev-resolusjon:** dev-tooling MÅ resolve interne pakker til `src/` via en egendefinert `feedbackkit-dev`-condition (**ikke** `development` — Vite/Vitest aktiverer den som default og ville lekket `src` til forbrukere). **De eksisterende 105 testene (core 19 + react 58 + server 28) + typecheck MÅ være grønne UTEN en forutgående build.** Dette er den kritiske regresjonssjekken.
- **Interne deps via eksplisitt semver `^0.1.0`** — aldri `workspace:`-protokollen (npm støtter den ikke).
- **Versjon:** alle tre pakker til `0.1.0` (synkronisert).
- **Lisens:** MIT. **`publishConfig.access: "public"`** per pakke.
- **`"use client"`** MÅ stå øverst i react sitt bygde `dist/index.js` OG `dist/index.cjs`.
- **Ingen `npm publish`** i denne planen (bruker publiserer manuelt). **Ingen `examples/next-app`** (Plan 6).
- **Ingen endring i kjøretidsadferd** — kun pakking, metadata, docs, dev/publish-resolusjon.
- Kommandoer kjøres fra **worktree-roten** (`feedbackkit-packaging`).

## File Structure

| Fil | Endring | Task |
|---|---|---|
| `package.json` (rot) | `build`-script, tsup+publint devDeps | 1, 5 |
| `packages/{core,server,react}/tsup.config.ts` | Create — build-config | 1 |
| `packages/{core,server,react}/package.json` | `build`/`prepublishOnly`-scripts | 1 |
| `packages/{core,server,react}/package.json` | `exports`/`main`/`module`/`types`/`files` → dist | 2 |
| `tsconfig.base.json` | `customConditions: ["feedbackkit-dev"]` | 2 |
| `packages/{core,server}/package.json` | test-script `--conditions feedbackkit-dev` | 2 |
| `packages/react/vitest.config.ts` | `resolve.alias` → core/src | 2 |
| `packages/{core,server,react}/package.json` | `version` 0.1.0, deps `^0.1.0`, metadata | 3 |
| `LICENSE` (rot) | Create — MIT | 3 |
| `README.md` (rot) | Quickstart | 4 |
| `.github/workflows/ci.yml` | build + publint-steg | 5 |

---

### Task 1: tsup-build + `"use client"` (dev uendret)

Legger build UTEN å endre resolusjon: `exports` blir stående på `src`, så de 105 testene + typecheck er upåvirket. Leverer bygde `dist/`-artefakter per pakke.

**Files:**
- Modify: `package.json` (rot) — legg til tsup som devDep + rot-`build`-script
- Create: `packages/core/tsup.config.ts`, `packages/server/tsup.config.ts`, `packages/react/tsup.config.ts`
- Modify: `packages/core/package.json`, `packages/server/package.json`, `packages/react/package.json` — `build` + `prepublishOnly`-scripts

**Interfaces:**
- Produces: `dist/index.js` (ESM), `dist/index.cjs` (CJS), `dist/index.d.ts` per pakke; react-dist starter med `"use client";`. Rot-`build`-script `npm run build`.

- [ ] **Step 1: Installer tsup som rot-devDependency**

Run: `npm install -D tsup`
Expected: tsup legges i rot `package.json` `devDependencies`; `npm install` fullfører uten feil.

- [ ] **Step 2: Legg til rot-`build`-script**

I `package.json` (rot), legg til i `"scripts"` (ved siden av `typecheck`/`test`):

```json
    "build": "npm run build --workspaces --if-present",
```

- [ ] **Step 3: Skriv tsup-config for core og server**

`packages/core/tsup.config.ts`:

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

`packages/server/tsup.config.ts`:

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

- [ ] **Step 4: Skriv tsup-config for react (med `"use client"`-banner + eksterne peers)**

`packages/react/tsup.config.ts`:

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["react", "react-dom"],
  banner: { js: '"use client";' },
});
```

Merk: `"use client"` legges KUN via banneren (ikke i `src/index.ts`) — da havner den garantert øverst i begge dist-formater uten duplikat, og vår egen `src`-baserte dev/test-vei (som ikke trenger direktivet) forblir uendret.

- [ ] **Step 5: Legg `build`/`prepublishOnly`-scripts i hver pakke**

I `"scripts"` i `packages/core/package.json`, `packages/server/package.json` og `packages/react/package.json`, legg til:

```json
    "build": "tsup",
    "prepublishOnly": "tsup"
```

- [ ] **Step 6: Bygg og verifiser artefakter + `"use client"`**

Run: `npm run build`
Expected: tsup kjører i alle tre pakker uten feil.

Run: `ls packages/core/dist packages/server/dist packages/react/dist`
Expected: hver `dist/` inneholder `index.js`, `index.cjs`, `index.d.ts` (+ `.map`-filer).

Run: `head -n 1 packages/react/dist/index.js; head -n 1 packages/react/dist/index.cjs`
Expected: begge linjer er `"use client";`.

- [ ] **Step 7: Verifiser at eksisterende tester + typecheck fortsatt er grønne (uendret, `src`)**

Run: `npm test`
Expected: core 19 + react 58 + server 28 = 105 grønne.

Run: `npm run typecheck`
Expected: alle tre pakker typecheck-rene (ingen feil).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json packages/core/tsup.config.ts packages/server/tsup.config.ts packages/react/tsup.config.ts packages/core/package.json packages/server/package.json packages/react/package.json
git commit -m "build: tsup dual ESM+CJS + use client for @feedbackkit-pakkene"
```

---

### Task 2: `exports` → dist + `feedbackkit-dev`-condition (tester grønne uten build)

Flipper pakke-inngangene til `dist/` og wirer dev-tooling til å resolve interne pakker til `src/` via en egendefinert `feedbackkit-dev`-condition. **Den kritiske testen:** de 105 testene + typecheck er grønne selv når `dist/` er slettet.

**Files:**
- Modify: `packages/core/package.json`, `packages/server/package.json`, `packages/react/package.json` — `main`/`module`/`types`/`exports`/`files`
- Modify: `tsconfig.base.json` — `customConditions`
- Modify: `packages/core/package.json`, `packages/server/package.json` — test-script `--conditions feedbackkit-dev`
- Modify: `packages/react/vitest.config.ts` — `resolve.alias`

**Interfaces:**
- Consumes: dist-artefaktene fra Task 1.
- Produces: publiserte pakker resolver til `dist/`; dev-tooling resolver til `src/`.

- [ ] **Step 1: Sett dist-innganger + `feedbackkit-dev`-condition i hver pakke**

I `packages/core/package.json`, `packages/server/package.json` og `packages/react/package.json`, ERSTATT de eksisterende `main`/`types`/`exports`-feltene med (og legg til `module` + `files`):

```json
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "feedbackkit-dev": "./src/index.ts",
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    }
  },
  "files": ["dist", "src"],
```

Nested `types` per `import`/`require` (tsup emitter både `index.d.ts` og `index.d.cts`) gir korrekt type-resolusjon for både ESM- og CJS-forbrukere (attw/publint-ren). `"feedbackkit-dev"` MÅ stå først i `exports["."]` (første match vinner). Navnet er bevisst egendefinert — **ikke** `development`, som Vite/Vitest aktiverer som default og som da ville resolvet forbrukere til vår rå `src` i stedet for `dist`. Kun vår egen tooling (stegene under) aktiverer `feedbackkit-dev`. `src` shippes (Task 3) så conditionen peker på en fil som finnes i pakken.

- [ ] **Step 2: Legg `customConditions` i base-tsconfig**

I `tsconfig.base.json`, legg til i `compilerOptions`:

```json
    "customConditions": ["feedbackkit-dev"],
```

- [ ] **Step 3: Legg `--conditions feedbackkit-dev` i core og server sine test-script**

I `packages/core/package.json` og `packages/server/package.json`, endre `"test"`-scriptet til:

```json
    "test": "node --conditions feedbackkit-dev --import tsx --test \"test/**/*.test.ts\""
```

- [ ] **Step 4: Legg `resolve.alias` i react sin vitest-config**

ERSTATT `packages/react/vitest.config.ts` med:

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@feedbackkit/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
  },
});
```

- [ ] **Step 5: Slett dist og verifiser at tester + typecheck er grønne UTEN build**

Run: `rm -rf packages/core/dist packages/server/dist packages/react/dist`
Expected: ingen `dist/`-mapper igjen.

Run: `npm test`
Expected: 105 grønne (core 19 + react 58 + server 28) — beviser at dev-tooling resolver interne pakker til `src/` uten en build.

Run: `npm run typecheck`
Expected: alle tre pakker rene — beviser at `customConditions` resolver `@feedbackkit/core` til `src/`.

- [ ] **Step 6: Verifiser at build fortsatt fungerer med de nye inngangene**

Run: `npm run build`
Expected: alle tre bygger uten feil (dts-gen resolver `@feedbackkit/core` til `src` via `customConditions`, eksternaliserer den i output).

Run: `head -n 1 packages/react/dist/index.js`
Expected: `"use client";`.

- [ ] **Step 7: Commit**

```bash
git add packages/core/package.json packages/server/package.json packages/react/package.json tsconfig.base.json packages/react/vitest.config.ts
git commit -m "build: dist-exports med feedbackkit-dev-condition (rask dev-loop bevart)"
```

---

### Task 3: Publish-metadata (versjon, interne deps, LICENSE, metadata)

Gjør package.json-ene publiseringsklare: `0.1.0`, `^0.1.0`-deps, MIT-lisens og full metadata.

**Files:**
- Create: `LICENSE` (rot)
- Modify: `packages/core/package.json`, `packages/server/package.json`, `packages/react/package.json`

**Interfaces:**
- Consumes: dist-inngangene fra Task 2.
- Produces: `0.1.0`-pakker med komplett publiserings-metadata.

- [ ] **Step 1: Opprett rot-`LICENSE` (MIT)**

`LICENSE`:

```
MIT License

Copyright (c) 2026 Erik Haavik

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: Bump versjoner og interne deps**

I `packages/core/package.json`, `packages/server/package.json`, `packages/react/package.json`: sett `"version": "0.1.0"`.

I `packages/server/package.json` OG `packages/react/package.json`, endre dependency:

```json
    "@feedbackkit/core": "^0.1.0"
```

- [ ] **Step 3: Legg publiserings-metadata i hver pakke**

Legg til disse feltene i hver pakkes `package.json` (verdier per pakke under). Felles for alle tre:

```json
  "license": "MIT",
  "author": "Erik Haavik",
  "homepage": "https://github.com/haavikerik-lab/feedbackkit#readme",
  "publishConfig": { "access": "public" },
```

`repository` per pakke (bytt `<navn>` med `core`/`server`/`react`):

```json
  "repository": { "type": "git", "url": "git+https://github.com/haavikerik-lab/feedbackkit.git", "directory": "packages/<navn>" },
```

`description` + `keywords` per pakke:

- core:
```json
  "description": "Framework-agnostic core for feedbackkit — composer, element-picker, position, and the feedback/assist contract.",
  "keywords": ["feedback", "feedbackkit", "widget", "composer"],
  "sideEffects": false,
```
- server:
```json
  "description": "Server handlers and framework routes for feedbackkit — Anthropic-backed AI assist + feedback submission.",
  "keywords": ["feedback", "feedbackkit", "ai", "anthropic", "server"],
  "sideEffects": false,
```
- react (INGEN `sideEffects` — `"use client"`-direktivet skal ikke tree-shakes bort):
```json
  "description": "Embeddable React feedback widget for feedbackkit — element picker + optional AI interview.",
  "keywords": ["feedback", "feedbackkit", "widget", "react", "ai", "embeddable"],
```

- [ ] **Step 4: Reinstaller og verifiser at tester + typecheck er grønne**

Run: `npm install`
Expected: npm relenker `@feedbackkit/core` (lokal `0.1.0` tilfredsstiller `^0.1.0`); ingen 404/feil.

Run: `npm test`
Expected: 105 grønne.

Run: `npm run typecheck`
Expected: alle tre rene.

- [ ] **Step 5: Verifiser publiserings-shape (`npm pack --dry-run`)**

Run: `npm run build && npm pack --dry-run -w @feedbackkit/core -w @feedbackkit/server -w @feedbackkit/react`
Expected: hver tarball inneholder `dist/`, `src/`, `package.json` og `LICENSE` (IKKE `test/` eller `tsconfig.json`). `src/` shippes bevisst så `feedbackkit-dev`-conditionen og sourcemaps peker på filer som finnes i pakken (holder publint ren). `LICENSE` inkluderes automatisk av npm.

- [ ] **Step 6: Commit**

```bash
git add LICENSE packages/core/package.json packages/server/package.json packages/react/package.json package-lock.json
git commit -m "chore: publiserings-metadata + MIT-lisens + 0.1.0"
```

---

### Task 4: Quickstart-README

Gjør rot-README til en ekte getting-started og list alle tre pakkene.

**Files:**
- Modify: `README.md` (rot)

- [ ] **Step 1: Skriv om `README.md`**

ERSTATT hele `README.md` med:

````markdown
# feedbackkit

Embeddable AI feedback widget — element picker + optional AI interview + owner-authored
test scenarios. Extracted as a standalone project from the LexPulse feedback chat.

## Packages

| Package | What it does |
|---|---|
| [`@feedbackkit/core`](packages/core) | Framework-agnostic core — composer, element picker, position, and the feedback/assist contract. |
| [`@feedbackkit/server`](packages/server) | Server handlers + framework routes — Anthropic-backed AI assist + feedback submission. |
| [`@feedbackkit/react`](packages/react) | Embeddable React `<FeedbackWidget>` — element picker + optional AI interview. |

## Quickstart (Next.js App Router)

```sh
npm install @feedbackkit/react @feedbackkit/server
```

**1. Mount the widget.** `@feedbackkit/react` ships `"use client"`, so you can render it directly
in a Server Component layout using the `{url}` config (only strings cross the boundary):

```tsx
// app/layout.tsx
import { FeedbackWidget } from "@feedbackkit/react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        {children}
        <FeedbackWidget
          submit={{ url: "/api/feedback/submit" }}
          assist={{ url: "/api/feedback/assist" }}
          locale="no"
        />
      </body>
    </html>
  );
}
```

**2. Add the assist route** (AI interview — server-side Anthropic key):

```ts
// app/api/feedback/assist/route.ts
import { createAssistRoute } from "@feedbackkit/server";

export const runtime = "nodejs";
export const POST = createAssistRoute({ anthropicKey: process.env.ANTHROPIC_API_KEY! });
```

**3. Add the submit route** (store the finished case however you like):

```ts
// app/api/feedback/submit/route.ts
import { createSubmitRoute } from "@feedbackkit/server";

export const runtime = "nodejs";
export const POST = createSubmitRoute({
  onCase: async (c) => {
    // c: { message, page, url, scenario, categories, elements, identity, createdAt }
    // e.g. insert into your database
  },
});
```

**4. Set the environment variable** (server-side only — never `NEXT_PUBLIC`):

```
ANTHROPIC_API_KEY=sk-ant-...
```

Without `assist`, the widget still works as a point + write + send form (no AI).

### Example: store to Supabase

```sql
create table feedback_cases (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  page text,
  url text,
  scenario jsonb,
  categories text[] default '{}',
  elements jsonb default '[]',
  identity jsonb,
  created_at timestamptz not null default now()
);
```

```ts
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
export const POST = createSubmitRoute({
  onCase: async (c) => {
    await supabase.from("feedback_cases").insert({
      message: c.message, page: c.page, url: c.url ?? null, scenario: c.scenario ?? null,
      categories: c.categories ?? [], elements: c.elements ?? [], identity: c.identity ?? null,
      created_at: c.createdAt,
    });
  },
});
```

## Development

Requires Node ≥ 22.

```sh
npm install
npm test         # 105 tests (core + react + server)
npm run typecheck
npm run build    # tsup → dist/ per package
```

The dev loop resolves internal packages to `src/` via a custom `feedbackkit-dev` export condition, so tests
and typecheck run without a build.

## Releasing (maintainers)

Packages publish as public scoped packages. Publish core first (the others depend on it):

```sh
npm login
npm run build
npm publish -w @feedbackkit/core --access public
npm publish -w @feedbackkit/server --access public
npm publish -w @feedbackkit/react --access public
```

## Design docs

- Specs: `docs/superpowers/specs/`
- Plans: `docs/superpowers/plans/`
````

- [ ] **Step 2: Verifiser at README rendrer (ingen kode-påvirkning)**

Run: `git diff --stat README.md`
Expected: `README.md` endret; ingen andre filer berørt.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: Quickstart-README med install + widget + ruter + env"
```

---

### Task 5: CI build + publint-verifikasjon

Legg til et build + `publint`-steg i CI så en ødelagt build eller ikke-publiserbar pakke fanges på hver push.

**Files:**
- Modify: `package.json` (rot) — publint devDep
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Installer publint som rot-devDependency**

Run: `npm install -D publint`
Expected: publint legges i rot-devDeps.

- [ ] **Step 2: Legg build + publint etter test i CI**

I `.github/workflows/ci.yml`, legg til etter `- run: npm test`-linjen:

```yaml
      - run: npm run build
      - run: npx publint packages/core
      - run: npx publint packages/server
      - run: npx publint packages/react
```

- [ ] **Step 3: Verifiser build + publint lokalt**

Run: `npm run build`
Expected: alle tre bygger uten feil.

Run: `npx publint packages/core && npx publint packages/server && npx publint packages/react`
Expected: hver pakke rapporterer «All good!» (eller kun ikke-blokkerende `suggestions`; ingen `errors`). Hvis publint melder en `error` (f.eks. feil `exports`-peker), fiks package.json-en til feilen er borte før commit.

- [ ] **Step 4: Verifiser full suite fortsatt grønn**

Run: `npm test && npm run typecheck`
Expected: 105 grønne + typecheck rent.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .github/workflows/ci.yml
git commit -m "ci: build + publint-verifikasjon av publiserbarhet"
```

---

## Ferdigstilling

Etter Task 5, fra worktree-roten:

```bash
rm -rf packages/*/dist   # bevis at dev-loopen ikke trenger build
npm test && npm run typecheck
npm run build && npx publint packages/core && npx publint packages/server && npx publint packages/react
```

Forventet: 105 tester grønne + typecheck rent UTEN build; deretter build + publint rene. Da er pakkene publiserings-klare (brukeren kjører `npm publish` når `@feedbackkit`-org er opprettet). Klar for final whole-branch review + `session-branch AVSLUTT`.
