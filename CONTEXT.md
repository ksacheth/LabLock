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
  - **sandbox adapter** — *not built.* A future isolating adapter (container /
    resource-limited) drops in behind the same seam with no Judge changes.
  - **fake** — an in-memory Runner returning canned `RunnerResult`s, used to test
    the Judge without spawning a toolchain.

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
  authorization — they belong to the future **ExamSession** module. For student
  routes `authorize` replaces only the `STUDENT` role-gate; the exam-time logic stays
  inline.
