# Lab Exam Lockdown System with Online Compiler

## 1. Introduction
Lab examinations are essential for evaluating students' practical programming skills. However, traditional lab exams face issues such as missing compilers, system inconsistencies, and increased cheating due to easy access to online resources and LLMs.

This project proposes a centralized solution that integrates an online compiler with an exam-oriented lockdown and integrity-monitoring system.

## 2. Objective
The objectives of this project are:

- Remove dependency on locally installed compilers during lab exams.
- Provide a uniform coding environment for all students.
- Minimize exam-time delays caused by system setup issues.
- Reduce cheating and misuse of LLMs during lab examinations.
- Simplify monitoring and management of lab exams for faculty.

## 3. Existing Problems
Current lab exam systems suffer from the following drawbacks:

- Compiler unavailability: Required compilers or correct versions may not be installed on all systems.
- Time loss: Installing or configuring software during exams wastes valuable time.
- Lack of uniformity: Different operating systems and environments lead to inconsistent program behavior.
- High cheating risk: Students can easily access the internet, LLMs, or external help.
- Manual proctoring limitations: Invigilators cannot continuously and effectively monitor all students.

## 4. Proposed Solution / Our Thought
We propose a web-based platform that combines:

- Online compiler: A centralized, browser-based compiler preconfigured with required programming languages, ensuring identical execution environments for all students.
- Exam lockdown: Browser-level enforcement that requires fullscreen, detects tab switching and focus loss, blocks copy and paste, and logs integrity violations with a strike-based auto-ban.

By integrating both components, the system creates a controlled and fair examination environment while eliminating local setup dependencies.

## 5. Key Features

- Web-based coding interface with real-time code execution.
- Role-based portals for students, faculty, and administrators.
- Self-service faculty registration gated by administrator approval.
- Faculty exam authoring with weighted, hidden or visible test cases and flexible output matching.
- Automated grading with per-question weighted scoring and faculty result dashboards.
- Controlled exam access with restricted actions.
- Continuous activity monitoring with violation logging.
- Reduced dependency on local machine configuration.

## 6. Tech Stack
The system is built using the following technologies to ensure scalability, performance, and security:

- Frontend: Next.js with React (dynamic and responsive user interface).
- Backend: Express running on the Bun runtime (API requests and business logic).
- Database: PostgreSQL with Prisma ORM (robust structured storage for student records and exam logs).

## 7. Advantages

- Saves exam time by removing installation and configuration steps.
- Ensures fairness through a uniform coding environment.
- Reduces cheating and misuse of AI-based tools.
- Eases workload on faculty and invigilators.
- Scales for large numbers of students.

## 8. Limitations and Assumptions

- Requires stable internet connectivity.
- Students must use a compatible web browser.
- Effectiveness of integrity monitoring depends on lockdown rules and system accuracy; it cannot observe the physical exam environment.

## 9. Future Scope

- Support for additional programming languages.
- More advanced AI-based proctoring techniques.
- Integration with institutional systems such as LMS.

## 10. Conclusion
The Lab Exam Lockdown System with an Online Compiler addresses key challenges in conducting lab exams. By ensuring a uniform coding environment and strengthening exam monitoring, the proposed system improves exam efficiency, fairness, and academic integrity.

## 11. Architecture

The runtime architecture diagram shows how the components connect end to end:

**[Open the runtime architecture diagram →](./docs/diagrams/runtime-architecture.html)**

It is generated from an editable spec
([`docs/diagrams/runtime-architecture.json`](./docs/diagrams/runtime-architecture.json)),
and the architectural decisions behind it are recorded as ADRs in
[`docs/adr/`](./docs/adr/).

The core design is three seams, each a pure decision core plus a thin adapter. The
vocabulary is defined in [`CONTEXT.md`](./CONTEXT.md):

- **Runner** — owns the environment-specific compile + run lifecycle. Adapters are
  `host` (default: runs `gcc`/`g++`/`javac`/`python3` as child processes of the API
  host) and `sandbox` (one locked-down Docker container per execution, selected with
  `RUNNER=sandbox`). A Runner is told *what* to run, never *what is correct*.
- **Judge** — owns correctness: input formatting, output comparison, status
  aggregation, weighted scoring. It is blind to the execution environment.
- **`authorize` / `evaluateSession` / `consume`** — pure, I/O-free decision cores
  driven by policy tables, which are also the test surface.

`apps/api` composes them in this order for every student request:
`authorizeRequest → rateLimitRequest → openSession → judge`.

## 12. Database Schema

[![Database Schema](./assets/schema.svg)](https://dbdiagram.io/d/69a44b76a3f0aa31e1704d84)

Click the diagram to view the interactive version. The Excalidraw source and a
rendered export also live in [`docs/diagrams/`](./docs/diagrams/).

## 13. Repository Structure

```
apps/
  api/                 Express 4 on the Bun runtime — REST API (port 4000)
    src/
      authorization/   pure authorization decision + adapter (ADR-0003)
      exam-session/    exam-time gating seam (ADR-0004)
      execution/       Runner + Judge engine (ADR-0001, 0002, 0006)
      rate-limit/      throttling seam (ADR-0005)
      routes/          one registerXRoutes module per resource area
    sandbox/           Dockerfile + harness.py for the sandbox Runner
  web/                 Next.js 16 App Router frontend (port 3000)
    app/
      admin/           departments, batches, users, faculty approval
      teacher/         exam authoring, question/test-case editor, results
      student/         dashboard + the locked-down exam room
      auth/            login and signup
packages/
  database/            Prisma schema, migrations, seed (the data contract)
  common/              shared zod/TypeScript types
  ui/                  shared React components (not yet used by the web app)
  eslint-config/       shared lint presets
  typescript-config/   shared TypeScript presets
docs/
  adr/                 architecture decision records
  diagrams/            runtime architecture + database schema diagrams
  reviews/             dated architecture reviews
  agents/              agent/workflow docs
```

## 14. Getting Started

**Prerequisites:** [Bun](https://bun.sh) 1.3.9 (the pinned `packageManager`), a
PostgreSQL instance, and Docker *only* if you want to run the sandboxed code runner.

```sh
bun install
cp .env.example .env    # then fill in DATABASE_URL and JWT_SECRET
bun run db:migrate      # apply migrations (or `bun run db:push`)
cd packages/database && bun run db:seed    # creates the admin account
bun run dev             # starts api on :4000 and web on :3000
```

Environment lives in a single root `.env` ([`.env.example`](./.env.example) documents
every variable) and is loaded by `apps/api`. The frontend does **not** read the root
file — it reads `NEXT_PUBLIC_API_URL` from its own `apps/web/.env.local`.

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `JWT_SECRET` | yes | the API throws at startup if unset |
| `ADMIN_EMAIL` / `ADMIN_NAME` / `ADMIN_PASSWORD` | for seeding | admin account created by `db:seed` |
| `PORT` / `CORS_ORIGIN` | no | default `4000` / `http://localhost:3000` |
| `RUNNER` | no | `host` (default) or `sandbox` |
| `SANDBOX_*` | no | image, memory, CPU, PID and queue tuning for the sandbox Runner |
| `TRUST_PROXY` | no | set behind a proxy so `req.ip` reflects the client; read by the API but not yet listed in `.env.example` |
| `NEXT_PUBLIC_API_URL` | no | read by `apps/web` from its own env file |

**Optional — isolated code execution.** By default student code runs as a child
process of the API host. To run each submission in a locked-down container instead:

```sh
docker build -t labproctor-sandbox:latest apps/api/sandbox
# then set RUNNER=sandbox in .env
```

There is deliberately **no silent fallback** to the host runner: if `RUNNER=sandbox`
and Docker or the image is unavailable, the API refuses to start rather than run
untrusted code unsandboxed (see [ADR-0006](./docs/adr/0006-sandbox-runner-adapter.md)).

## 15. Testing

```sh
cd apps/api && bun test
```

| Suite | Result |
|---|---|
| `apps/api` unit tests | 113 pass, 9 skip, 0 fail (122 tests, 10 files) — as of 2026-09-16 |

The 9 skips are the Docker-gated sandbox isolation suite (network denial, read-only
rootfs, OOM kill, fork bomb, timeout, compile bomb). They skip locally when Docker is
unavailable and are **mandatory in CI**, which runs them with `SANDBOX_TESTS=required`
so a skipped isolation test cannot pass silently.

There is no test framework wired up in `apps/web`. Static checks run from the repo
root:

```sh
bun run lint          # eslint across all workspaces
bun run check-types   # tsc / next typegen across all workspaces
```

## 16. Documentation

| Doc | Contents |
|---|---|
| [`CONTEXT.md`](./CONTEXT.md) | the ubiquitous language — read before changing a seam |
| [`docs/adr/`](./docs/adr/) | six architecture decision records (Runner, `SYSTEM_ERROR`, authorization, exam-session, rate limiting, sandbox) |
| [`docs/diagrams/`](./docs/diagrams/) | runtime architecture and database schema diagrams |
| [`docs/reviews/`](./docs/reviews/) | dated architecture reviews |
