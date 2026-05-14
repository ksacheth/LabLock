# ADR-0003 — Authorization behind one decision seam

- **Status:** Accepted
- **Date:** 2026-06-27

## Context

Authorization was re-derived inline in every protected handler. Three checks
recur across ~20 routes:

1. **find actor** — `prisma.user.findUnique({ where: { id: req.userId! } })`.
2. **role + approval** — partly factored into `rejectUnapprovedFaculty(res, user, msg)`
   (`lib/faculty.ts`, faculty only); admin routes inline `role !== "ADMIN"`,
   student routes inline `role !== "STUDENT"`.
3. **ownership** — fully inline and varying: `exam.creatorId !== actor.id`, or the
   same check reached via `question → exam`, or `testcase → question → exam`.

The existing helper is `res`-coupled ("returns true if the response was already
sent"), which makes the decision impossible to test without Express and lets a new
route silently forget a check. Architecture review candidate #2 ("Collapse
authorization into one seam") recommended a deep authorization module with a small
interface hiding the rule set.

## Decision

Split authorization the same way [ADR-0001](0001-execution-runner-seam.md) split
execution: a **pure decision core** plus a thin **adapter** that touches the messy
outside world.

### The pure decision — `authorization/authorize.ts`

```ts
type Actor = { id: string; role: Role; facultyApproved: boolean } | null;

type Action =
  | "exam:create" | "exam:update" | "exam:delete"
  | "question:create" | "question:update" | "question:delete"
  | "testcase:create" | "testcase:update" | "testcase:delete"
  | "user:admin"
  | "exam:enter" | "exam:run" | "exam:submit";   // student role-gate only

type Decision =
  | { ok: true }
  | { ok: false; status: number; error: string; code?: string };

function authorize(actor: Actor, action: Action, resource?: Resource): Decision;
```

- **Pure and DB-free.** The handler loads the actor and the resource and passes
  them in. `authorize` performs no I/O, so its entire behaviour is a table:
  `actor × action × resource → Decision`. That table is the test surface.
- **One policy table.** Each `Action` maps to one row —
  `{ role, requireApproval, ownership: "exam" | "none", message }`. Adding a route
  is adding a row; the policy lives in exactly one readable place. Ownership is
  uniform: even `question:*`/`testcase:*` gate on the **parent exam's** ownership,
  so the table needs only `ownership: "exam" | "none"`, never a per-type owner.
- **The decision owns ownership 403 *and* exam-level 404.** The handler passes the
  owning `exam`-or-`null`; `authorize` returns `404` for a null/soft-deleted exam
  and `403` for a non-owner. Every allow/404/403 rule sits in one table, so a new
  route cannot forget the not-found-vs-forbidden distinction.
- **Typed `Decision`, not throw, not `res`-coupled.** Returning a decision keeps
  the core pure and carries the 403-vs-404 status without dragging in the (unbuilt)
  error-taxonomy seam (review candidate #4). When #4 lands, its mapping adapter can
  consume these decisions.
- **Null actor → `401` `ACCOUNT_NOT_FOUND`.** A valid JWT referencing a
  user that no longer exists is an authentication failure, not a role/ownership one.
  This deliberately unifies today's inconsistent `403`/`404` handling of that case.
- **Per-action messages live in the table**, preserving the existing user-facing
  text (`"Only faculty members can create exams"`, etc.).

### The adapter — `authorizeRequest`

```ts
authorizeRequest(req, res, action, resource?): Promise<Actor>  // null ⇒ denied
```

The only part touching Express/Prisma: it loads the actor, calls pure `authorize`,
and on deny sends the response and returns `null`; on allow returns the loaded
actor (handlers need `actor.id`). The call site collapses to:

```ts
const actor = await authorizeRequest(req, res, "exam:update", exam);
if (!actor) return;
```

The **resource is still loaded by the handler** before the call, so nested-resource
existence (`question`/`testcase` not found) stays a handler precondition — it is
existence of the thing being acted on, not authorization.

### Scope

- **`lib/faculty.ts` is deleted.** `rejectUnapprovedFaculty` is subsumed (role +
  approval are two columns of the table). Its `FACULTY_PENDING_MSG` string and
  `code: "FACULTY_PENDING_APPROVAL"` are a **client contract** — moved verbatim into
  the authorization module as the approval-failure deny payload.
- **All three role-gates migrate** — faculty-authoring, admin, and student. No
  protected route stays outside the seam.
- **Student exam-time preconditions stay inline.** For student routes `authorize`
  replaces **only** the `role !== "STUDENT"` gate; eligibility, time-window and
  attempt-status logic is untouched and remains owned by the future **ExamSession**
  module (review candidate #3). Student rows are pure role-gates
  (`ownership: "none"`).
- **Tests:** pure table-driven unit tests over `authorize`
  (every action × {right role, wrong role, unapproved faculty, null actor,
  null/soft-deleted exam, non-owner, owner}), written test-first. Route-level
  integration tests are **deferred** until a repository seam (candidate #5) makes
  them DB-free — same rationale ADR-0001 used to defer host-toolchain tests.

## Consequences

- **Positive:** the policy is one table, table-tested without a DB or Express; a new
  route can't call a handler without naming an `Action`, so it can't forget a check.
  The 403/404/401 statuses become consistent.
- **Negative:** one deliberate behaviour change — null actor is now `401` rather than
  today's mixed `403`/`404`. The pure core does not load actor/resource itself, so
  the (thin, untested-for-now) `authorizeRequest` adapter is the part deferred to
  later integration tests.
- **Out of scope:** student exam-time eligibility (→ #3), the error-taxonomy mapping
  seam (→ #4), and DB-free route tests (→ #5).

## Related

- [ADR-0001](0001-execution-runner-seam.md) — the pure-core + adapter split this ADR
  mirrors.
- Glossary: **authorize**, **Actor**, **Action**, **Decision** in `CONTEXT.md`.
