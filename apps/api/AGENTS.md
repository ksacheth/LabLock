# apps/api — LabLock backend

## Purpose

REST API for LabLock (lab-exam proctoring + online compiler). Express 4 on the Bun
runtime. Serves auth, exam/question/test-case CRUD, and the student exam-room flow
(enter → draft → run → submit → report violations). Entry point: `src/index.ts`
(builds the app, wires global middleware, registers route modules, listens on `PORT`).

Depends on `@repo/database` (Prisma client) and `@common/types` (shared zod types).

## Ownership

Owns all HTTP request handling, authentication, authorization, exam-time gating,
code execution/judging, and rate limiting. Does **not** own the data schema
(that is `packages/database`) or the shared domain types (`packages/common`).

## Local Contracts

- **Seam pattern (repo-wide idiom).** Every domain module is a *pure decision core*
  (no I/O; `(inputs) → typed discriminated-union result` driven by a policy table)
  plus a thin *Express+Prisma adapter* that loads data, calls the core, and on
  failure writes the HTTP response and returns `null`/falsy. Honor this split; the
  core is the test surface. Each seam file cites its ADR in a header comment.
- **Directory map:**
  - `authorization/` — `authorize(actor, action, resource?) → Decision` (pure, ADR-0003)
    + `authorize-request.ts` adapter. Owns the 401/403/404 distinction.
  - `exam-session/` — `evaluateSession(intent, snapshot) → Session | Refusal` (pure,
    read-only, ADR-0004) + `open-session.ts` adapter. See child doc.
  - `execution/` — Runner + Judge code-judging engine (ADR-0001/0002/0006). See child doc.
  - `rate-limit/` — token-bucket throttling seam (ADR-0005). See child doc.
  - `routes/` — one `registerXRoutes(app)` module per resource area; `student.routes.ts`
    composes `authorizeRequest → rateLimitRequest → openSession → judge` in that order.
  - `middleware/auth.ts` — the only middleware: verifies `Authorization: Bearer <jwt>`
    against `JWT_SECRET`, sets `req.userId`.
  - `lib/` — non-seam utilities: `exam-status.ts`, `logging.ts` (`logApiEvent`),
    `scoring.ts`, `submissions.ts`.
  - `types.ts` + `types/express.d.ts` — shared domain types/guards and the
    `Express.Request.userId` ambient augmentation.
- **Response shape:** deny responses are `{ error, code? }`. The `code` strings are
  **client contracts** the web app branches on (e.g. `FACULTY_PENDING_APPROVAL`,
  `RATE_LIMITED`, `ALREADY_SUBMITTED`, `DISQUALIFIED`, `WINDOW_CLOSED`, `INELIGIBLE`).
  Do not rename a `code` without updating `apps/web`.
- **Dependency injection via default parameter** — `judge(..., runner = hostRunner)`,
  `rateLimitRequest(..., store = defaultStore)`. Tests pass fakes; call sites unchanged.
- **Env vars:** `JWT_SECRET` (required, throws if unset), `PORT` (default 4000),
  `CORS_ORIGIN` (default `http://localhost:3000`). Loaded via `bun --env-file=../../.env`
  in `dev` only — `build`/`start` do not load `.env`.
- `dist/` is a build artifact — never edit. `scripts/reset-attempt.ts` is a dev-only
  Prisma ops utility (dry-run unless `--apply`); not wired into `package.json`.

## Work Guidance

- Read `CONTEXT.md` (glossary/ubiquitous language) and the relevant `docs/adr/` file
  before changing any seam. Put new policy in the pure core's table, not the adapter.
- Prefer Bun APIs per root AGENTS.md, but this app deliberately keeps `express` + `cors`.
- Use `logApiEvent` for denial/refusal/exceeded events; do not invent ad-hoc logging.

## Verification

- `bun test` — 8 `__tests__` suites cover the pure cores (`bun:test`).
- `tsc --noEmit` (`bun run check-types`) and `eslint .` (`bun run lint`).

## Child DOX Index

- [`src/execution/`](src/execution/AGENTS.md) — Runner/Judge engine; Runner↔Judge blindness invariants
- [`src/rate-limit/`](src/rate-limit/AGENTS.md) — token-bucket seam; synchronous read-modify-write invariant
