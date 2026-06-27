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
