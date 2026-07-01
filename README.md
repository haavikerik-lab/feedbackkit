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
import { createSubmitRoute } from "@feedbackkit/server";
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
