# LabLock — Context & Glossary

LabLock is one product domain — lab exams with an online compiler and a browser
lockdown — shared across `apps/api` (Express on Bun) and `apps/web` (Next.js).
The monorepo split is by technical layer, not by separate business domains.

This file is the **ubiquitous language**. When code, issues, tests, or proposals
name a domain concept, use the term as defined here. Architectural decisions live
in `docs/adr/`.

## Glossary

### Exam lifecycle

- **Exam** — a faculty-authored assessment: a set of **Questions**, a time
  window, and eligibility rules. Authored by an approved **Faculty** member.
- **Attempt** (`ExamAttempt`) — one student's enrollment-and-progress record for
  an exam (`ENROLLED → IN_PROGRESS → …`). A student must enter the exam room
  (open an attempt) before running or submitting code.
- **Submission** — a stored record of one student executing code for one
  question: code, language, status, per-test-case results, and score. Produced by
  both the **run** and **submit** paths.

### Code execution

- **Judge** — the module that turns a code submission into a graded result:
  format input → run → normalize → compare → score. It owns the *pure* logic
  (input formatting, output equivalence, status aggregation, weighted scoring) and
  orchestration/logging. It is **blind to the execution environment** — it talks to
  a **Runner**. Lives in `apps/api/src/execution/judge.ts`. Public entry point:
  `judge(submission, cases, limits, runner?)`. See [ADR-0001](docs/adr/0001-execution-runner-seam.md).

- **Runner** — the seam (interface) that owns the *environment-specific* compile +
  run lifecycle: create a workspace, compile once, run the program against each
  case, tear down. A Runner is told **what** to run, never **what is correct** —
  output comparison stays in the Judge. Adapters:
  - **host adapter** (`host-runner.ts`) — runs the toolchain (`gcc`/`g++`/`javac`/
    `python3`) as child processes of the API host. **Current default. Not
    sandboxed** — untrusted code runs on the host with only a wall-clock timeout.
  - **sandbox adapter** — the isolating adapter: **one Docker container per `run()`**
    (compile + all cases inside it), network-off, read-only rootfs, non-root, with a
    **platform resource ceiling** (see below). Drops in behind the same seam with **no
    Judge changes**. **Host stays the default**; sandbox is selected by env and used in
    prod — and **never silently falls back to host** (fail loud at boot, `SYSTEM_ERROR`
    at runtime). See [ADR-0006](docs/adr/0006-sandbox-runner-adapter.md).
  - **fake** — an in-memory Runner returning canned `RunnerResult`s, used to test
    the Judge without spawning a toolchain.

- **Sandbox harness** — the small, *trusted*, language-agnostic executor baked into the
  sandbox image. The adapter (host-side, reusing the Judge's execution-plan knowledge)
  hands it a JSON job — source, compile/run commands, per-case timeouts, cases — and it
  compiles, runs each case with an in-namespace per-case timeout, and emits one
  `RunnerResult`-shaped JSON. **A valid harness JSON is the boundary between a student
  outcome and an infrastructure failure**: if the harness spoke, trust its
  `compile`/`cases`; anything that stops it (daemon down, image missing, crash, malformed
  output, outer deadman timeout) is infra → `RunnerResult.error` → `SYSTEM_ERROR`
  (ADR-0002).

- **Platform resource ceiling** — a fixed, generous per-execution cap (memory, CPU, PID
  count, wall-clock deadman) whose only job is *infrastructure safety*: untrusted code
  must not crash or exhaust the API host. A breach surfaces as an ordinary student
  outcome (e.g. OOM-kill → `RUNTIME_ERROR`), **not** as `SYSTEM_ERROR`. Distinct from a
  **per-question grading limit** below.

- **Per-question grading limit** (`memoryLimitKb`) — the faculty-authored, assessment-level
  memory bound stored per question. Currently **authored but unenforced** (never passed to
  the Runner; `memoryUsedKb` is always `null`; there is no `MEMORY_LIMIT_EXCEEDED` status).
  Enforcing it — threading the limit into the Runner, measuring peak usage, and adding a
  `MEMORY_LIMIT_EXCEEDED` verdict — is a **grading-semantics change to the Judge**, kept
  **out of scope** of the sandbox adapter (which only enforces the platform ceiling) and
  deferred to its own decision.

- **Verdict / execution status** — a submission's outcome. Values:
  `ACCEPTED`, `WRONG_ANSWER`, `TIME_LIMIT_EXCEEDED`, `RUNTIME_ERROR`,
  `COMPILE_ERROR`, and **`SYSTEM_ERROR`**.

- **`SYSTEM_ERROR`** — a **Runner-level (infrastructure) failure**, distinct from
  any student-caused outcome: the compiler binary is missing, the sandbox/container
  failed to start, etc. It means **"re-run me,"** not **"the student was wrong."**
  Never counts as a graded attempt. On the **submit** path, the failing question is
  quarantined as `SYSTEM_ERROR` (scores 0, flagged `needsRerun`) and the rest of the
  exam still scores; on the **run** path the request returns `503` and records no
  submission. See [ADR-0002](docs/adr/0002-system-error-status.md).
  - Do **not** confuse with **`COMPILE_ERROR`** (the student's code didn't compile)
    or **`PENDING`** (a question with no test cases configured — never gradable).

### Roles & approval

- **Faculty approval** — self-registered faculty are gated behind administrator
  approval before they can author exams. Unapproved faculty are rejected at
  protected routes.

### Authorization

- **authorize** — the pure decision that answers "may this actor perform this action
  on this resource?". `authorize(actor, action, resource?) → Decision`. It owns
  role, faculty-approval and **ownership** (own the gating exam), plus the
  exam-level `404` (missing/soft-deleted) and `403` (non-owner). It is **pure and
  blind to I/O** — the handler loads the actor and resource and passes them in — so
  its whole behaviour is a policy table, the test surface. Lives in
  `apps/api/src/authorization/authorize.ts`. See
  [ADR-0003](docs/adr/0003-authorization-decision-seam.md).

- **Actor** — the authenticated principal as `authorize` sees it:
  `{ id, role, facultyApproved } | null`. A **null** actor (valid JWT, user record
  gone) is an authentication failure → `401 ACCOUNT_NOT_FOUND`, not a role/ownership
  denial.

- **Action** — a fine-grained verb (`exam:create`, `question:create`, `user:admin`,
  …) keyed into one **policy table** giving `{ role, requireApproval, ownership,
  message }`. Ownership is uniform: nested actions (`question:*`, `testcase:*`) gate
  on the **parent exam's** ownership. Naming an action is mandatory, so a new route
  cannot forget a check.

- **Decision** — `authorize`'s typed result: `{ ok: true }` or
  `{ ok: false, status, error, code? }`. Not a thrown error and not `res`-coupled —
  it carries the `403`/`404`/`401` distinction so the core stays pure and testable.

- **`authorizeRequest`** — the thin Express/Prisma **adapter** over `authorize`: it
  loads the actor, calls the pure decision, and on deny sends the response and
  returns `null` (on allow it returns the actor). The **resource is still loaded by
  the handler**, so nested-resource existence (e.g. "Question not found") stays a
  handler precondition, not an authorization rule.

- **Exam-time preconditions** (eligibility, time-window, attempt-status) are **not**
  authorization — they belong to the **Exam-session** module below. For student
  routes `authorize` answers only the `STUDENT` role-gate; `openSession` answers
  "can this student act now?".

### Exam session

- **ExamSession** — the read-only gate that answers "may this student act on this
  exam right now?". It owns expire-stale, exam-existence, eligibility, time-window
  and attempt-status, returning a `Session` or a `Refusal`. It never mutates —
  attempt writes (create/resume/complete/disqualify) stay in the handlers. Lives in
  `apps/api/src/exam-session/`. See [ADR-0004](docs/adr/0004-exam-session-seam.md).

- **evaluateSession** — the **pure** core: `evaluateSession(intent, snapshot) →
  Session | Refusal`. Blind to I/O — the adapter loads `{ exam, attempt, student,
  now }` and passes them in — so the whole exam-time policy is a table, the test
  surface.

- **openSession** — the Express/Prisma **adapter**: runs `deactivateExpiredExams`,
  loads exam/attempt/student, calls `evaluateSession`, and on a `Refusal` sends the
  response (and logs one uniform `exam.session.refused` event) and returns `null`;
  on success returns the `Session`. Call site:
  `const session = await openSession(req, res, examId, "run"); if (!session) return;`.

- **SessionIntent** — `enter | draft | run | submit | violation`, keyed into the
  policy table. The intents map 1:1 to the student handlers so exact refusal
  messages survive. Three divergences are **intended** and encoded as rows, not
  normalized: `submit` skips the time-window, `violation` skips exam/window, and
  eligibility is checked only on `enter`.

- **Session / Refusal** — `evaluateSession`'s typed result, discriminated on `ok`
  (like `Decision`). `Session = { ok: true, now, exam, attempt }`;
  `Refusal = { ok: false, status, error, code?, details? }` — `details` carries the
  `score` when `submit` refuses an already-`COMPLETED` attempt. `openSession`
  consumes this: it writes the HTTP response on a `Refusal` and returns
  `Session | null` to the handler.

### Rate limiting

- **RateLimit** — the throttle that answers "has this client made too many requests
  to this surface in the current window?", protecting resources from volume abuse.
  Distinct from the **proctoring dedup** below. Scoped to two surfaces: **login**
  (brute-force) and **run/submit** (protecting the un-sandboxed Judge). Split the
  same way as the other seams (ADR-0001/0003/0004): a **pure decision core** plus a
  stateful **adapter**. Lives in `apps/api/src/rate-limit/`.

- **consume** — the **pure** core: `consume(state, now, policy) → { state, decision }`.
  Given the current bucket/window **state**, the injected **now**, and the **policy**,
  it returns the next state and an `Allowed | Limited` decision. Blind to I/O and to
  the clock — state is threaded *through* it rather than hidden inside, so the whole
  behaviour is a table, the test surface. Switches on the policy's **algorithm**
  (token-bucket for run/submit, fixed-window for login).

- **Policy** — one row per protected surface (`login`, `run`, `submit`) in a single
  table: `{ algorithm, limits, key }`, where **key** is the per-policy identity
  extractor — `user:${id}` for run/submit, `login:${ip}:${email}` for login. Naming a
  policy is how a call site opts a route in.

- **Allowed / Limited** — `consume`'s typed result, discriminated on `ok` (like
  `Decision` and `Session`). `Allowed = { ok: true, remaining, resetAt }`;
  `Limited = { ok: false, status: 429, error, code: "RATE_LIMITED", retryAfter,
  resetAt }`.

- **RateLimitStore** — the seam (interface) the adapter reads/writes bucket state
  through: **in-memory Map** (current default, single-process) and a documented,
  unbuilt **Redis** adapter for multi-server (parallel to Runner's `host` /
  unbuilt `sandbox`). Single-process in-memory is race-free without atomic scripts
  **because the adapter's read-modify-write runs synchronously with no `await`
  between read and write**; the atomicity Redis needs a Lua script for is provided
  free by the single-threaded runtime. See ADR-0005.

- **rateLimitRequest** — the Express adapter over `consume`: extracts the policy key,
  does the synchronous read-modify-write against the store, and on `Limited` writes
  `429` + `Retry-After` / `RateLimit-*` headers, logs one uniform
  `rate_limit.exceeded` event, and returns `null` (on `Allowed` returns the actor),
  in the same idiom as `authorizeRequest` / `openSession`. For **login** it is
  consulted **on failed credentials only**, so it sits after the password check, not
  upfront.

- **Proctoring dedup** — the pre-existing per-`(attempt, violationType)` idempotency
  guard in the violations handler (reject a duplicate of the *same* violation type
  within 2s). It is **not** rate limiting: it is content-aware, keyed on the event
  type, and durable in Postgres because it protects proctoring-log *integrity*, not
  request volume. It stays separate from **RateLimit**.
