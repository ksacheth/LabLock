// Env-driven Runner selection (ADR-0006). Resolved ONCE at module load and wired
// through judge()'s existing default parameter (`runner: Runner = defaultRunner`),
// so both route call sites and every test are unchanged: tests pass a fake
// Runner explicitly and never touch this default.
//
// RUNNER=host (default — dev is macOS without Docker) | sandbox (prod isolation).
//
// DELIBERATELY NO SILENT HOST FALLBACK. If RUNNER=sandbox but Docker/the image is
// unavailable, we do NOT quietly fall back to the host adapter — that would run
// untrusted code unsandboxed while the operator believes it is contained. Instead
// the sandbox fails loud at boot (preflightSandbox) and returns SYSTEM_ERROR at
// runtime if Docker dies mid-life. Silent-unsandboxed is worse than down.
import { hostRunner } from "./host-runner.ts";
import { sandboxRunner } from "./sandbox-runner.ts";
import type { Runner } from "./runner.ts";

type RunnerMode = "host" | "sandbox";

function getRunnerMode(): RunnerMode {
  const raw = process.env.RUNNER?.trim().toLowerCase();
  if (raw === "sandbox") {
    return "sandbox";
  }
  if (!raw || raw === "host") {
    return "host";
  }
  throw new Error(
    `Invalid RUNNER=${process.env.RUNNER}; expected "host" or "sandbox".`,
  );
}

const defaultRunner: Runner =
  getRunnerMode() === "sandbox" ? sandboxRunner : hostRunner;

export { defaultRunner, getRunnerMode };
export type { RunnerMode };
