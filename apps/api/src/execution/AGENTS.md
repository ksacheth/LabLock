# execution — code-judging engine

## Purpose

Compiles and runs student code and produces a verdict. Collaborators (ADR-0001,
ADR-0002, ADR-0006):

- `runner.ts` — `Runner` interface + types: an environment-agnostic compile+run lifecycle.
- `host-runner.ts` — default adapter; spawns `gcc`/`g++`/`javac`/`python3` as host child
  processes (unsandboxed, wall-clock timeout only). Owns `getExecutionPlan` (the shared
  language → compile/run-command knowledge), exported for the sandbox adapter to reuse.
- `sandbox-runner.ts` — isolating adapter (ADR-0006): one locked-down Docker container per
  `run()` (network-off, read-only rootfs, non-root, memory/CPU/PID ceiling) driving the
  trusted harness in `../../sandbox/harness.py` (image: `../../sandbox/Dockerfile`). Includes
  the boot preflight, the bounded-concurrency front, and the labeled orphan sweep.
- `bounded-semaphore.ts` — pure, Docker-free concurrency cap + overflow→`SYSTEM_ERROR` queue.
- `runner-selection.ts` — resolves `defaultRunner` once from `RUNNER=host|sandbox`.
- `judge.ts` — the Judge: formats competitive-style input, compares outputs
  (exact / structured / token-loose), aggregates per-case statuses into one verdict.

## Ownership

Owns the compile→run→compare→verdict pipeline. The sandbox adapter (ADR-0006) lives here
as a `Runner` implementation, isolation only — it changes no Judge logic or grading semantics.

## Local Contracts

- **Runner is blind to correctness**; **Judge is blind to environment.** Keep the split.
- A new Runner adapter (e.g. Docker sandbox) **must not touch `judge.ts`** — it only
  implements the `Runner` interface. That is the entire point of the seam.
- `RunnerResult.error` (Runner/infra failure) → verdict `SYSTEM_ERROR`. A failed
  compile (`compile.ok: false`) → `COMPILE_ERROR`. Never conflate these two, and never
  conflate `SYSTEM_ERROR` with student fault — it means "re-run me," scores 0, and does
  not count as a graded attempt (see ADR-0002 for run=503-no-submission vs submit-quarantine).
- No memory enforcement: `memoryUsedKb` is always `null`. The sandbox enforces only a
  **platform resource ceiling** (host safety); an OOM-kill breach surfaces as the ordinary
  `RUNTIME_ERROR`. Per-question `memoryLimitKb` + `MEMORY_LIMIT_EXCEEDED` is a separate,
  out-of-scope grading change (ADR-0006).
- Default runner is injected as a parameter (`judge(..., runner = defaultRunner)`, resolved
  from `RUNNER`); tests pass a fake Runner rather than spawning processes.
- `RUNNER=sandbox` **never** silently falls back to host — fail loud at boot (preflight),
  `SYSTEM_ERROR` at runtime if Docker dies mid-life.

## Verification

`bun test` in the seam's `__tests__`; the pure Judge comparison/aggregation logic and the
semaphore are the Docker-free test surface. The sandbox isolation escape-attempt suite is
Docker-gated (loud skip locally, **mandatory in CI** via `SANDBOX_TESTS=required`).
