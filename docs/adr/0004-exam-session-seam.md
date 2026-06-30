# ADR-0004 — Exam-time gating behind an Exam-session seam

- **Status:** Accepted
- **Date:** 2026-06-30

## Context

Five student handlers — **enter**, **draft**, **run**, **submit**, **violations** —
each re-derive "can this student act on this exam right now?" inline: expire stale
exams, load the exam, check eligibility, check the time window, and check
attempt-status. The question has no home, and the five implementations have
**drifted**:

| check | enter | draft | run | submit | violations |
|---|---|---|---|---|---|
| `deactivateExpiredExams` | ✓ | ✓ | ✓ | ✓ | — |
| load exam / 404 | ✓ | ✓ | ✓ | ✓ | — |
| eligibility (batch/dept) | ✓ | — | — | — | — |
| time window | ✓ granular | ✓ coarse | ✓ coarse | — | — |
| attempt status | create/resume `IN_PROGRESS`; `COMPLETED`→400, `DISQUALIFIED`→403 | require `IN_PROGRESS` | require `IN_PROGRESS` | require `IN_PROGRESS`; `COMPLETED`→400+score, `DISQUALIFIED`→403 | require `IN_PROGRESS` |

Architecture review candidate #3 ("One deep Exam-session module") recommended a
`openSession(student, examId) → Session | Refusal` that the handlers delegate to.
The student **role-gate** was already moved to the authorization seam (ADR-0003);
this ADR addresses the **exam-time** decision that ADR-0003 explicitly deferred.

## Decision

Introduce an **Exam-session seam**, split the same way as the execution
(ADR-0001) and authorization (ADR-0003) seams: a **pure decision core** plus a thin
**adapter** that does the I/O.

### The pure decision — `exam-session/exam-session.ts`

```ts
type SessionIntent = "enter" | "draft" | "run" | "submit" | "violation";

type Refusal = { ok: false; status: number; error: string; code?: string;
                 details?: Record<string, unknown> };
type Session = { ok: true; now: Date; exam: ExamSnapshot | null;
                 attempt: AttemptSnapshot | null };

function evaluateSession(intent: SessionIntent, snapshot: {
  exam: ExamSnapshot | null;
  attempt: AttemptSnapshot | null;
  student: { batchId: string | null; departmentId: string | null };
  now: Date;
}): Session | Refusal;
```

- **Read-only gate.** It answers "may this student act now?" and returns a
  validated `Session` (the loaded exam + the latest attempt + server time) or a
  typed `Refusal`. **All attempt writes stay in the handlers** — enter
  creates/resumes from `session.attempt`, submit marks `COMPLETED`, violations
  disqualifies. The module never mutates.
- **Pure / DB-free.** The adapter loads exam/attempt/student and passes them in, so
  the whole policy is a table — `intent × snapshot → Session | Refusal` — which is
  the test surface.
- **One policy table.** Each `SessionIntent` maps to one row: which checks run
  (expire, load-exam, eligibility, window) + the attempt rule + the exact refusal
  messages and `code`s. The five intents map 1:1 to handlers, so the existing
  user-facing messages survive verbatim (draft vs run), and even `violation` fits
  as a row that skips exam/window and only requires `IN_PROGRESS`.
- **Discriminated union on `ok`**, matching ADR-0003's `Decision`. `Session` carries
  `now`/`exam`/`attempt` so handlers don't re-query; `Refusal` carries
  `status`/`error`/`code?` plus `details?` for the one payload case (submit on an
  already-`COMPLETED` attempt returns the `score`).
- **Per-intent invariants** (e.g. `attempt` non-null for draft/run/submit/violation;
  `exam` null for violation) are guaranteed by the evaluator but not expressible from
  the `intent` string, so acting handlers do a redundant `if (!session.attempt) return`
  narrow — the same harmless pattern ADR-0003 used for `if (!exam) return`.

### Preserved divergences (intended semantics, not bugs)

The extraction **preserves current behavior exactly**. Three divergences are
intended and encoded as policy rows, not normalized:

1. **`submit` never checks the time window** — a student may submit an in-progress
   attempt after `endTime` (don't lose their work to the clock).
2. **`violation` loads no exam and checks no window** — proctoring strikes are
   logged off an `IN_PROGRESS` attempt regardless of timing.
3. **Eligibility is checked only on `enter`** — sound because an attempt can only be
   created through enter's eligibility gate, so later intents rely on the attempt
   existing.

"Fixing" any of these is a separate, opt-in decision — never a side effect of this
extraction.

### The adapter — `exam-session/open-session.ts`

```ts
openSession(req, res, examId, intent): Promise<Session | null>  // null ⇒ refused
```

- Runs `deactivateExpiredExams` (for intents whose row enables it — a pre-load side
  effect, so the pure core only sees a post-expire exam), loads exam/attempt/student,
  calls `evaluateSession`, and on a `Refusal` **sends the response and returns
  `null`**; on success returns the `Session`. Call site:
  `const session = await openSession(req, res, examId, "run"); if (!session) return;`.
- **Owns refusal logging.** On refusal it emits one uniform event
  `exam.session.refused` keyed by `{ intent, examId, userId, reason: refusal.code }`,
  replacing today's six differently-named `*.denied` events. Success-path logging
  (`exam.code.run.completed`, `exam.violation.recorded`, …) stays in the handlers.

### Boundary & composition

- **Handlers keep:** body validation (400s), leaf existence (`Question not found`
  404), the actual work (`judge`, `upsertStudentSubmissionRecord`, scoring), and all
  attempt writes.
- **Two seams in sequence, not merged:** `authorize(student:run)` answers "is this a
  student?" (role-gate, ADR-0003); `openSession(run)` answers "can they act now?"
  (exam-state). Composition: `authorize → (body validation) → openSession → work`.

### Testing

Pure table-driven tests on `evaluateSession` (`intent` × {eligibility, window,
attempt-status, null exam}), written TDD with `bun test`. Route-level integration is
**deferred** until a repository seam (review candidate #5) makes it DB-free — same
call as ADR-0001/0003.

## Consequences

- **Positive:** "can this student act now?" lives in one table, table-tested without
  a DB; the five handlers collapse to one `openSession` call; refusals become one
  typed shape with stable `code`s; denial logging is uniform and queryable.
- **Negative:** denial log events are renamed/normalized (internal observability, not
  a client contract). The DB-touching adapter is deferred to later integration tests.
- **Out of scope:** the attempt-lifecycle writes (create/resume/complete/disqualify)
  stay in handlers; the repository seam (#5) and DB-free route tests it unlocks.

## Related

- [ADR-0003](0003-authorization-decision-seam.md) — the student role-gate; this ADR
  delivers the exam-time decision it deferred.
- [ADR-0001](0001-execution-runner-seam.md) — the pure-core + adapter split this
  mirrors.
- Glossary: **ExamSession**, **openSession**, **evaluateSession**, **Session**,
  **Refusal**, **SessionIntent** in `CONTEXT.md`.
