# packages/common — shared types

## Purpose

`@common/types`: shared TypeScript + zod types used across `apps/api` and `apps/web`.
Entry `index.ts` re-exports `src/types.ts`.

## Ownership

Owns cross-app domain type definitions and their zod schemas. Keep it dependency-light
(only `zod`) and framework-free — it must import cleanly into both the Express API and
the Next.js frontend.

## Local Contracts

- This is a contract boundary between the two apps. Changing a shared type here can
  break both consumers — update call sites in `apps/api` and `apps/web` together.
- Type names should track the ubiquitous language in root `CONTEXT.md` and the
  Prisma enums in `packages/database`.
