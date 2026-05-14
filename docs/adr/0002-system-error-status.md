# ADR-0002 — `SYSTEM_ERROR` status for Runner-level failures

- **Status:** Accepted
- **Date:** 2026-06-27

## Context

The [Runner seam](0001-execution-runner-seam.md) introduces a `RunnerResult.error`
field for **infrastructure** failures — the compiler binary is missing, a
sandbox/container fails to start before compile, etc. These are **not the
student's fault**.

Before the seam, such failures bubbled up as a thrown exception → generic `500`.
The submission status enum (`ACCEPTED | WRONG_ANSWER | TIME_LIMIT_EXCEEDED |
RUNTIME_ERROR | COMPILE_ERROR`) had nowhere honest to record them. Mapping an ops
failure onto `COMPILE_ERROR` or `RUNTIME_ERROR` would penalize the student and
persist a wrong verdict.

The **submit** path is especially exposed: it loops over every question. If one
question's Runner errors and the Judge throws, the *entire* completed exam
submission aborts — strictly worse than the status quo.

## Decision

Add a distinct **`SYSTEM_ERROR`** submission status, and handle Runner-level
failures per path:

- **Run path** (`POST` run-code) — low stakes. On `RunnerResult.error`, return
  **`503`** ("system error, try again") and record **no** submission. The student
  retries.
- **Submit path** (final exam) — **per-question quarantine.** The failing question
  records `SYSTEM_ERROR`, scores **0** for this pass, is flagged **`needsRerun`** in
  the response, and the loop **continues** scoring the rest of the exam. A transient
  glitch never destroys a finished exam, and the failure is not silently buried as
  `WRONG_ANSWER`.

Supporting choices:

- `SYSTEM_ERROR` is added to **both** the persisted Prisma `SubmissionStatus` enum
  (additive migration, no backfill) and the TS `ExecutionSubmissionStatus`.
- `SYSTEM_ERROR` is a **whole-question verdict**, set directly when
  `RunnerResult.error` is present. It is **excluded** from
  `getHigherPriorityExecutionStatus` — it does not compete in per-case aggregation.
- Scoring stays pure: `calculateWeightedQuestionScore` contributes **0**; the
  "re-run" signal rides alongside as `needsRerun`, not inside the score.

### Why a new enum value rather than reusing `PENDING`

`PENDING` already means "question has no test cases configured — never gradable."
Overloading it for "execution failed, re-run me" would make the two
indistinguishable to faculty, defeating the entire reason for the quarantine. The
honest, queryable distinction is the point.

## Consequences

- **Positive:** ops failures are recorded honestly and are queryable ("which
  questions need a re-run?"). A finished exam survives a transient toolchain glitch.
  `SYSTEM_ERROR ≠ WRONG_ANSWER` tells faculty "re-run," not "student failed."
- **Negative:** one additive Prisma migration; every consumer of submission status
  (web result views, faculty dashboards) must learn to treat `SYSTEM_ERROR` as
  re-runnable rather than final. A re-run/re-grade workflow for quarantined
  questions is implied but **not** specified here — follow-up work.

## Related

- [ADR-0001](0001-execution-runner-seam.md) — the Runner seam and `RunnerResult.error`.
- Glossary: **`SYSTEM_ERROR`** in `CONTEXT.md`.
