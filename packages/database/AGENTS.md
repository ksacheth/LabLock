# packages/database — data schema & Prisma client

## Purpose

`@repo/database`: the single source of truth for LabLock's data model. Exports a
configured Prisma 7 client (Postgres via `@prisma/adapter-pg`) from `src/index.ts`.
Consumed by `apps/api`.

## Ownership

Owns the schema (`prisma/schema.prisma`), migrations (`prisma/migrations/`), the
generated client (`prisma/generated/`), and the seed (`prisma/seed.ts`). No other
package may define tables or run migrations.

## Local Contracts

- **Schema is the data contract.** Models: `Department`, `Batch`, `ExamEligibility`,
  `User`, `Exam`, `ExamAttempt`, `Question`, `TestCase`, `Submission`,
  `SubmissionTestCaseResult`, `ProctoringLog`. Enums: `UserRole`, `ExamAttemptStatus`,
  `SubmissionStatus`, `ViolationType`, `ProgrammingLanguage`. These names are the
  ubiquitous language (see root `CONTEXT.md`).
- Any schema change must go through a migration (`db:migrate`), not a hand edit of
  generated code. `prisma/generated/` is generated output — never edit.
- Seed (`db:seed` → `bun prisma/seed.ts`) reads `ADMIN_EMAIL` / `ADMIN_NAME` /
  `ADMIN_PASSWORD` from the root `.env`.
- `DATABASE_URL` (root `.env`) is required for all db scripts.

## Work Guidance

Scripts (run from this package or via root `turbo run <task>`):
`db:generate` (regenerate client), `db:migrate` (dev migration), `db:push`,
`db:studio`, `db:seed`. Run `db:generate` after any schema edit so `apps/api`'s types
stay in sync.

## Verification

`bunx prisma validate` / `db:generate` succeeds; downstream `apps/api` `check-types` passes.
