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
