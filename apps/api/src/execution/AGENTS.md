# execution — code-judging engine

## Purpose

Compiles and runs student code and produces a verdict. Two collaborators (ADR-0001,
ADR-0002, ADR-0006):

- `runner.ts` — `Runner` interface + types: an environment-agnostic compile+run lifecycle.
- `host-runner.ts` — current default adapter; spawns `gcc`/`g++`/`javac`/`python3` as
  host child processes (unsandboxed, wall-clock timeout only).
- `judge.ts` — the Judge: formats competitive-style input, compares outputs
  (exact / structured / token-loose), aggregates per-case statuses into one verdict.

## Ownership

Owns the compile→run→compare→verdict pipeline. A future sandbox adapter (ADR-0006,
not yet present) belongs here as a new `Runner` implementation.

## Local Contracts

- **Runner is blind to correctness**; **Judge is blind to environment.** Keep the split.
- A new Runner adapter (e.g. Docker sandbox) **must not touch `judge.ts`** — it only
  implements the `Runner` interface. That is the entire point of the seam.
- `RunnerResult.error` (Runner/infra failure) → verdict `SYSTEM_ERROR`. A failed
  compile (`compile.ok: false`) → `COMPILE_ERROR`. Never conflate these two, and never
  conflate `SYSTEM_ERROR` with student fault — it means "re-run me," scores 0, and does
  not count as a graded attempt (see ADR-0002 for run=503-no-submission vs submit-quarantine).
- No memory enforcement: `memoryUsedKb` is always `null`.
- Default runner is injected as a parameter (`judge(..., runner = hostRunner)`); tests
  pass a fake Runner rather than spawning processes.

## Verification

`bun test` in the seam's `__tests__`; the pure Judge comparison/aggregation logic is the
primary test surface.
