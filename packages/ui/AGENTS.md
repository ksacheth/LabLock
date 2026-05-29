# packages/ui — shared React components

## Purpose

`@repo/ui`: a small shared React 19 component library (`src/button.tsx`, `card.tsx`,
`code.tsx`), exported per-file via `./*` → `./src/*.tsx`.

## Ownership

Owns reusable, app-agnostic presentational components.

## Local Contracts

- **Currently unused by `apps/web`** (which styles inline with Tailwind and does not
  import `@repo/ui`). Before expanding this package, confirm a real consumer exists —
  otherwise it accretes dead weight.
- New components: `bun run generate:component` (turbo generator).

## Verification

`bun run lint` (`eslint . --max-warnings 0`) and `bun run check-types` (`tsc --noEmit`).
