# ADR-0006 — Sandbox Runner adapter (container-isolated execution)

- **Status:** Accepted
- **Date:** 2026-07-04

## Context

ADR-0001 cut a wide **Runner seam** and shipped the **host adapter**, which runs the
toolchain (`gcc`/`g++`/`javac`/`python3`) as child processes of the API host with only a
wall-clock timeout — **untrusted student code executes on the host**. ADR-0001 explicitly
deferred the isolating adapter ("maybe someday"), cutting the seam wide (workspace →
compile-once → run-per-case → teardown, owned atomically by the adapter) precisely so a
sandbox could land later as one new file implementing `Runner`, with **zero `judge.ts`
edits**. This ADR builds that adapter.

Two facts from the code shaped the scope:

- `ExecutionSubmissionStatus` has **no `MEMORY_LIMIT_EXCEEDED`**, and `memoryUsedKb` is
  plumbed everywhere but hardcoded `null`.
- `memoryLimitKb` is **faculty-authored per question, validated and stored, but never
  enforced** (not even passed into `RunnerLimits`).

That tempts a "wire up memory while we're here" expansion — which this ADR deliberately
resists (see Decision).

## Decision

Add a **sandbox adapter** implementing the existing `Runner` interface. It isolates
execution; it changes **no** grading semantics and touches **no** Judge code.

### Isolation technology — Docker container-per-execution

Docker `run` with a locked-down flag set, chosen over lighter (nsjail) and heavier
(gVisor / Firecracker) options. The threat is a *graded exam student's* C/C++/Java/Python
program running for a few seconds — fully addressed by namespaces + cgroups + a no-network,
read-only, resource-capped container. gVisor/Firecracker defend against kernel-exploit
escapes, which is over-built for an enrolled-student population with names and consequences.
**gVisor is documented as the future hardening step** if the threat model escalates (public
signup), the same way ADR-0005 documents Redis-later.

### One container per `run()`

Compile **and all cases** run inside a single container (Q2), preserving the seam's
compile-once/run-many boundary and paying container startup once. Case-to-case isolation is
sacrificed (negligible for same-program-different-input runs inside a no-network, read-only,
ephemeral-tmpfs container); **per-case containers are documented as a future option** if a
concrete cross-case-leak threat appears. Compiling on the host is rejected outright —
compilation of untrusted code is itself untrusted.

### In-container harness + JSON-job contract

One `docker run` per submission drives a small, **trusted, language-agnostic harness** baked
into the image. The **host** computes the execution plan (reusing the Judge's existing
`getExecutionPlan` — language knowledge stays in one place, shared with the host adapter) and
passes a JSON job: `{ source, sourceFilename, compileCommand[], runCommand[],
compileTimeoutMs, runTimeoutMs, cases: [{ id, input }] }`. The harness compiles, runs each
case enforcing `runTimeoutMs` **inside the namespace** (`timeout(1)`), captures
stdout/stderr/exit/duration/timedOut, truncates output, and emits one `RunnerResult`-shaped
JSON. This is chosen over the naive `docker exec`-per-case port because killing a host-side
`docker exec` client does **not** reliably kill the in-container process — enforcing per-case
timeouts inside the namespace is the only correct option. The harness may be Python (`python3`
is always present in the image).

### Failure classification — the harness-JSON boundary

`RunnerResult.error` stays reserved for **infrastructure** failures → `SYSTEM_ERROR`
("re-run me", ADR-0002). The bright line:

> **A valid harness `RunnerResult` JSON is the boundary.** If the harness spoke, trust its
> `compile`/`cases` as student outcomes. If anything prevented a valid harness JSON — daemon
> down, image missing, container killed, malformed output, outer deadman timeout — it is
> infra → `error` → `SYSTEM_ERROR`.

| Failure | Side | Surfaces as |
|---|---|---|
| Docker daemon down / launch fails; image missing; harness crash before valid JSON; malformed output; outer deadman timeout | infra | `error` → `SYSTEM_ERROR` |
| Student compile non-zero | student | `compile.ok:false` → `COMPILE_ERROR` |
| Student process OOM-killed at the platform ceiling | student | killed case → `RUNTIME_ERROR` |
| Student process exceeds per-case wall-clock | student | `timedOut:true` → `TIME_LIMIT_EXCEEDED` |

The **outer `docker run` timeout is a generous deadman switch** (≈ `compileTimeout +
Σ runTimeouts + startup slack`), never the real per-case limit — tripping it means "give up,
call it infra", so it must not misclassify a slow-but-valid batch as `SYSTEM_ERROR`.

### Resource limits — platform ceiling only

The container enforces `--network none`, read-only rootfs + a size-capped **tmpfs** workspace,
non-root user, `--cap-drop ALL`, `--security-opt no-new-privileges`, `--pids-limit`,
`--cpus`, and a fixed **memory ceiling** (~512MB). This is a **platform resource ceiling** —
*infrastructure safety* ("don't crash the host") — and a breach surfaces as the existing
`RUNTIME_ERROR`, **no new status, no `judge.ts` change**.

Enforcing the faculty-authored **per-question `memoryLimitKb`** (threading it into
`RunnerLimits`, measuring peak usage, adding `MEMORY_LIMIT_EXCEEDED`, teaching the pure Judge
to interpret it) is a **grading-semantics change** and is **out of scope**, deferred to its
own PRD — explicitly, so this adapter keeps ADR-0001's "zero `judge.ts` edits" promise. The
follow-up gets easier *because* the sandbox exists (cgroups give the measurement hook).

### Selection & the no-silent-fallback rule

Selection is env-driven: a `defaultRunner` resolved once from `RUNNER=host|sandbox`
(**default host**, because dev is macOS without Docker), wired through `judge`'s existing
default parameter (`runner: Runner = defaultRunner`) so both route call sites and all tests
are unchanged. When `RUNNER=sandbox` is unsatisfiable (daemon down, image absent), the adapter
**must never fall back to the host** — that would run untrusted code unsandboxed while the
operator believes otherwise. Instead: **fail loud at boot** (preflight `docker info` / image
check refuses to start) **plus** per-execution `SYSTEM_ERROR` as the runtime net if Docker
dies mid-life. The absence of a host-fallback is deliberate and commented at the selection
point.

### Concurrency & teardown

Each container reserves up to the ceiling, so unbounded concurrency lets the sandbox OOM the
host it protects. A **bounded concurrency semaphore** fronts the sandbox (cap ≈ memory budget
÷ ceiling, small configurable default); saturation → a brief bounded queue → `SYSTEM_ERROR`
on overflow ("system busy → re-run me", reusing the status). This is **complementary to, not
redundant with, the rate limiter** (ADR-0005): rate limiting caps *per-user request rate*;
the semaphore caps *global in-flight concurrency*. Teardown is `docker run --rm` + a per-run
`finally` force-remove by unique name + a **labeled orphan sweep** at boot and on an interval
(covers API-crash orphans).

## Testing

- **Judge tests unchanged** (fake runner) — the adapter touches no Judge logic.
- **Isolation escape-attempt suite against a real container — the core:** programs that try
  to open a socket (denied), read host paths (denied), allocate past the ceiling
  (`RUNTIME_ERROR`), fork-bomb (contained by `--pids-limit`), loop forever
  (`TIME_LIMIT_EXCEEDED` + torn down), and compile maliciously (contained). These are the
  evidence the boundary holds.
- **Optional host-vs-sandbox differential parity** on benign fixtures — proves a faithful
  port with no grading drift.
- **Docker-gated:** skip locally with a **loud, explicit** note (a silent skip is false
  green); **mandatory in CI** — the isolation tests must actually run there, and CI fails if
  they don't. This is where ADR-0001's deferred candidate-#7 pinned-toolchain image gets
  built: the sandbox image *is* that image. The harness is verified through this suite.

## Consequences

- **Positive:** the "untrusted code on the host" hole closes; the adapter is additive (one
  new file behind the existing seam, no `judge.ts` edits); a documented gVisor upgrade path
  exists; the platform ceiling ends host-DoS via memory/PID/CPU; CI gains a real toolchain
  image and executed isolation tests.
- **Negative / accepted:** a Docker daemon dependency (Docker-out-of-Docker or sibling
  containers if the API is itself containerized — a socket-mount privilege trade-off to
  resolve at deploy); the harness is trusted code inside the image, verified by integration
  rather than unit tests; case-to-case isolation is intentionally weak; sandbox tests can't
  run on the macOS dev box.
- **Out of scope:** per-question `memoryLimitKb` enforcement + `MEMORY_LIMIT_EXCEEDED` +
  measured `memoryUsedKb` (a Judge grading change, its own PRD); gVisor/Firecracker; a typed
  config module (candidate #7).

## Related

- [ADR-0001](0001-execution-runner-seam.md) — the Runner seam and host adapter this
  implements the deferred sandbox for; the compile-once/run-many boundary and DI-via-default-
  parameter it reuses.
- [ADR-0002](0002-system-error-status.md) — the `SYSTEM_ERROR` "re-run me" semantics the
  harness-JSON boundary preserves.
- [ADR-0005](0005-rate-limit-store-seam.md) — the rate limiter the concurrency semaphore is
  complementary to (per-user rate vs global concurrency).
- Glossary: **Runner** (sandbox adapter), **Sandbox harness**, **Platform resource ceiling**,
  **Per-question grading limit** in `CONTEXT.md`.
