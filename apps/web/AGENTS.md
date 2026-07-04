# apps/web — LabLock frontend

## Purpose

Next.js 16 (App Router, React 19, TypeScript, Tailwind CSS v4) frontend for LabLock:
a proctored online-exam platform. Students take timed coding exams in a locked-down
browser room; faculty author exams/questions and view results; admins provision
departments/batches/users. Entry: `app/layout.tsx` (root layout, Lexend + Material
Symbols fonts), `app/page.tsx` (public landing).

Talks to `apps/api` over REST + Bearer JWT.

## Ownership

Owns all UI and client-side flows. Does not own domain rules — those are enforced by
`apps/api`; this app mirrors them (role gating, exam-room integrity) client-side.

## Local Contracts

- **Route / role map** (each page is a `"use client"` component):
  - `app/auth/` — public login/signup + role selection (`/auth`, `/auth/<role>/login`,
    `.../signup`). Stores JWT + user in `localStorage`.
  - `app/admin/dashboard/` — ADMIN console (departments / batches / users / faculty approval).
  - `app/teacher/` — FACULTY: `dashboard` (create/host/monitor), `exams` (question +
    test-case editor via `?examId=`), `results` (leaderboard + CSV export).
  - `app/student/` — STUDENT: `dashboard`, `exams/[examId]/instructions` (consent gate),
    `exams/[examId]/page.tsx` (the locked-down exam room), `exams/entry-access.ts`.
  - `app/components/` — shared `PublicHeader`, `TeacherNavbar`.
- **Auth guard is client-side and per-page** (no `middleware.ts`): on mount, read
  `localStorage.token` → redirect to `/auth/<role>/login` if missing; then `GET /api/me`
  and redirect via `getDashboardPathForRole(role)` if role ≠ the page's required role.
  Teacher pages special-case `403 { code: "FACULTY_PENDING_APPROVAL" }`.
- **Exam-room integrity** (`app/student/exams/[examId]/page.tsx`, ~1900 lines — read its
  constraints before editing): requires the `sessionStorage` entry-consent set by the
  instructions page (`entry-access.ts`); enforces fullscreen; blocks copy/paste/tab-switch
  via `visibilitychange`/`blur`/`fullscreenchange`; reports to `/api/student/exams/:id/violations`;
  auto-disqualifies after strikes. This is the most contract-heavy file in the app.
- **Data fetching:** `axios` directly in components (no React Query/SWR/server actions).
  Base URL `process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"`, repeated per file.
- **Error `code` strings** returned by the API are branched on here — keep them in sync
  with `apps/api`.
- **Env:** `NEXT_PUBLIC_API_URL` is the only web env var (not in root `.env.example`).
  Next reads its own `.env*` files; the root `.env` is loaded by `apps/api`, not this app.

## Work Guidance

- Styling is Tailwind v4 configured in `app/globals.css` via `@theme` tokens; no CSS
  Modules, no component library (`@repo/ui` is a dependency but currently unused here).
  Icons via the `material-symbols-outlined` webfont.
- No global state store; keep per-page `useState`/`useEffect` unless introducing a
  deliberate shared client/helper (the repeated `API_URL` + auth-guard blocks are the
  obvious extraction candidates).

## Verification

- `bun run check-types` (`next typegen && tsc --noEmit`) and `bun run lint`
  (`eslint --max-warnings 0`). No test framework is wired up in this app.
