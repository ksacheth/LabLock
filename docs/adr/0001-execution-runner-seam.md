# ADR-0001 — Code execution behind a Runner seam

- **Status:** Accepted
- **Date:** 2026-06-27

## Context

Compile → run → compare → score for student submissions was inlined in the API
monolith and later extracted into a single `execution/judge.ts`. That extraction
left two problems unsolved:

1. **No isolation seam.** `executeProcess` calls `node:child_process.spawn`
   directly. The toolchain (`gcc`/`g++`/`javac`/`python3`) runs as child processes
   of the API host with only a wall-clock timeout — untrusted student code executes
   on the host. There is no place to swap in an isolating execution environment.
2. **Untestable.** Because execution is welded to the host, none of the
   judging logic (output equivalence, status aggregation, scoring) can be tested
   without spawning a real compiler. The module had 0 tests.

Architecture review candidate #1 ("Extract the Judge behind a sandbox seam")
recommended putting the execution environment behind a Runner seam: host today,
sandboxed container in prod, in-memory fake in tests.

## Decision

Introduce a **wide Runner seam**. The `Runner` interface owns the entire
environment-specific lifecycle — workspace creation, compile-once, run-per-case,
teardown:

```ts
interface Runner {
  run(
    submission: { code: string; language: StudentProgrammingLanguage },
    cases: { id: string; input: string }[],          // input already formatted by the Judge
    limits: { compileTimeoutMs: number; runTimeoutMs: number },
  ): Promise<RunnerResult>;
}

type RunnerResult = {
  compile: { ok: boolean; timedOut: boolean; durationMs: number; stderr: string };  // ok:false ⇒ cases empty
  cases: { id: string; stdout: string; stderr: string; exitCode: number | null;
           timedOut: boolean; durationMs: number }[];
  error: { kind: string; message: string } | null;   // runner-level (infra) failure
};
```

- **The Judge keeps the pure logic** — input formatting, output equivalence,
  status aggregation, weighted scoring — plus orchestration and all logging. It is
  blind to the environment.
- **The Runner is blind to correctness** — it gets inputs, returns raw stdout. The
  Judge does the comparison. This is what makes the Judge testable through a fake.
- **Single, folded `run` call.** The adapter compiles once, runs N cases reusing
  the artifact, and short-circuits to `compile.ok:false` (empty `cases`) on compile
  failure. The compile-once-run-many-tear-down sequence is owned atomically by the
  adapter — the right boundary for a future sandbox.
- **Dependency injection via default parameter:** `judge(..., runner = hostRunner)`.
  Routes call `judge(...)` unchanged; tests pass a fake. No DI container, matching
  the codebase's plain-function style.
- **Files:** `execution/runner.ts` (interface + types), `execution/host-runner.ts`
  (host adapter: `getExecutionPlan`, `executeProcess`, workspace), `execution/judge.ts`
  (the Judge). The fake lives in a test helper, not in production `src`.

### Scope

This ADR delivers the **seam + host adapter + in-memory fake + tests** only. A real
isolating sandbox adapter is explicitly **deferred** ("maybe someday"). The seam is
cut wide precisely so that sandbox lands later as a new file implementing `Runner`,
with zero edits to `judge.ts`.

## Consequences

- **Positive:** judging logic becomes testable without a toolchain (see tests
  layers 1+2). The "untrusted code on the host" hole now has a single, named place
  to be closed. A sandbox adapter is additive, not a rewrite.
- **Negative:** the in-memory fake must emulate the whole compile+run lifecycle, not
  just one process spawn. Slightly more upfront structure than a narrow
  "spawn one process" seam.
- **Unchanged / out of scope:** `memoryUsedKb` stays `null` and
  `MEMORY_LIMIT_EXCEEDED` is still unemitted (the host adapter does not measure
  memory). Host-toolchain integration tests are deferred until CI provides a pinned
  toolchain image (architecture review candidate #7).

## Related

- [ADR-0002](0002-system-error-status.md) — how `RunnerResult.error` surfaces as a
  `SYSTEM_ERROR` submission status.
- Glossary: **Judge**, **Runner** in `CONTEXT.md`.
