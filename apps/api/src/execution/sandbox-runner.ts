// Sandbox adapter for the Runner seam (ADR-0006): each run() executes inside one
// locked-down Docker container — no network, read-only rootfs, non-root, with a
// platform memory/CPU/PID ceiling. This closes ADR-0001's "untrusted code on the
// host" hole. It is an ISOLATION change only: it implements the same `Runner`
// interface, reuses the host adapter's `getExecutionPlan`, and touches no Judge
// logic and no grading semantics.
//
// Failure classification follows the harness-JSON boundary (ADR-0002/0006): a
// valid harness `RunnerResult` JSON is a student outcome (trust its
// compile/cases); anything that prevents a valid JSON — daemon down, image
// missing, container killed, malformed output, outer deadman timeout, queue
// saturation — is infrastructure → `error` → SYSTEM_ERROR ("re-run me").
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import { getExecutionPlan } from "./host-runner.ts";
import {
  createBoundedSemaphore,
  QueueOverflowError,
} from "./bounded-semaphore.ts";
import type { Runner, RunnerCaseResult, RunnerResult } from "./runner.ts";

// In-container paths. The workspace is an ephemeral, size-capped tmpfs mounted at
// run time (the rootfs is read-only), and /tmp is likewise tmpfs so the toolchain
// has somewhere to write intermediates.
const WORKSPACE = "/workspace";
const HARNESS_PATH = "/opt/harness/harness.py";
const PROCESS_OUTPUT_LIMIT = 16_000;

// Labels let a boot/interval sweep reclaim containers orphaned by an API crash.
// A per-process boot id distinguishes THIS process's live containers from
// foreign orphans, so the interval sweep never force-removes an in-flight run.
const SANDBOX_LABEL_KEY = "labproctor.sandbox";
const BOOT_LABEL_KEY = "labproctor.boot";
const BOOT_ID = randomUUID();

// The outer `docker run` timeout is a GENEROUS deadman ("give up, call it
// infra"), never the real per-case limit — the harness enforces per-case
// timeouts in-namespace. Sized as compile + Σ run + startup slack so a
// slow-but-valid batch is not misclassified as SYSTEM_ERROR.
const STARTUP_SLACK_MS = Number(process.env.SANDBOX_STARTUP_SLACK_MS ?? 15_000);

// Interval sweep cadence for foreign orphans (ms).
const SWEEP_INTERVAL_MS = Number(process.env.SANDBOX_SWEEP_INTERVAL_MS ?? 60_000);

function sandboxConfig() {
  return {
    image: process.env.SANDBOX_IMAGE ?? "labproctor-sandbox:latest",
    memory: process.env.SANDBOX_MEMORY ?? "512m",
    cpus: process.env.SANDBOX_CPUS ?? "1",
    pidsLimit: process.env.SANDBOX_PIDS_LIMIT ?? "128",
    workspaceSize: process.env.SANDBOX_WORKSPACE_SIZE ?? "64m",
  };
}

// Bounded concurrency fronts every run — see bounded-semaphore.ts for why this is
// complementary to, not redundant with, the rate limiter (ADR-0005).
const semaphore = createBoundedSemaphore({
  concurrency: Number(process.env.SANDBOX_CONCURRENCY ?? 4),
  maxQueue: Number(process.env.SANDBOX_MAX_QUEUE ?? 8),
  queueTimeoutMs: Number(process.env.SANDBOX_QUEUE_TIMEOUT_MS ?? 10_000),
});

type SandboxJob = {
  source: string;
  sourceFilename: string;
  compileCommand: string[];
  runCommand: string[];
  compileTimeoutMs: number;
  runTimeoutMs: number;
  cases: { id: string; input: string }[];
};

function infraError(kind: string, message: string): RunnerResult {
  return {
    compile: { ok: false, timedOut: false, durationMs: 0, stderr: "" },
    cases: [],
    error: { kind, message },
  };
}

function truncate(value: string): string {
  return value.length > PROCESS_OUTPUT_LIMIT
    ? `${value.slice(0, PROCESS_OUTPUT_LIMIT)}\n...truncated`
    : value;
}

// ─── docker helpers ──────────────────────────────────────────────────────────

// Run a docker CLI command, resolving stdout on exit 0 and rejecting otherwise.
// Used by preflight and the orphan sweep (never on the hot student path).
function captureDocker(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk.toString("utf8")));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString("utf8")));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr.trim() || `docker ${args[0]} exited ${code}`));
      }
    });
  });
}

// Fire-and-forget teardown net. `docker run --rm` handles the happy path; this
// covers a container that outlived a killed client. Never throws into a result.
function forceRemove(idOrName: string): void {
  try {
    const child = spawn("docker", ["rm", "-f", idOrName], { stdio: "ignore" });
    child.on("error", () => {});
  } catch {
    // best effort
  }
}

function dockerRunArgs(name: string): string[] {
  const cfg = sandboxConfig();
  return [
    "run",
    "--rm",
    "-i",
    "--name",
    name,
    "--label",
    `${SANDBOX_LABEL_KEY}=1`,
    "--label",
    `${BOOT_LABEL_KEY}=${BOOT_ID}`,
    "--network",
    "none",
    "--read-only",
    "--tmpfs",
    `${WORKSPACE}:rw,exec,size=${cfg.workspaceSize},mode=1777`,
    // The toolchain (gcc/g++/javac) writes intermediates to /tmp; the rootfs is
    // read-only, so give it an ephemeral tmpfs too.
    "--tmpfs",
    `/tmp:rw,exec,size=${cfg.workspaceSize},mode=1777`,
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--pids-limit",
    cfg.pidsLimit,
    "--cpus",
    cfg.cpus,
    "--memory",
    cfg.memory,
    // Match swap to memory so the ceiling is real (no swap escape hatch).
    "--memory-swap",
    cfg.memory,
    "--workdir",
    WORKSPACE,
    cfg.image,
    "python3",
    HARNESS_PATH,
  ];
}

// A valid harness JSON is the boundary: parse it into a RunnerResult and force
// `error: null` (it is a student outcome by definition). Return null for
// anything malformed — the caller turns that into a SYSTEM_ERROR.
function parseHarnessResult(raw: string): RunnerResult | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const candidate = parsed as {
    compile?: { ok?: unknown; timedOut?: unknown; durationMs?: unknown; stderr?: unknown };
    cases?: unknown;
  };
  if (!candidate.compile || typeof candidate.compile.ok !== "boolean") {
    return null;
  }
  if (!Array.isArray(candidate.cases)) {
    return null;
  }
  return {
    compile: {
      ok: candidate.compile.ok,
      timedOut: Boolean(candidate.compile.timedOut),
      durationMs: Number(candidate.compile.durationMs) || 0,
      stderr: truncate(String(candidate.compile.stderr ?? "")),
    },
    cases: candidate.cases.map(normalizeCase),
    error: null,
  };
}

function normalizeCase(value: unknown): RunnerCaseResult {
  const record = (value ?? {}) as Record<string, unknown>;
  const exitCode = record.exitCode;
  return {
    id: String(record.id ?? ""),
    stdout: truncate(String(record.stdout ?? "")),
    stderr: truncate(String(record.stderr ?? "")),
    exitCode: exitCode === null || exitCode === undefined ? null : Number(exitCode),
    timedOut: Boolean(record.timedOut),
    durationMs: Number(record.durationMs) || 0,
  };
}

function deadmanMs(compileTimeoutMs: number, runTimeoutMs: number, caseCount: number): number {
  return compileTimeoutMs + caseCount * runTimeoutMs + STARTUP_SLACK_MS;
}

// One `docker run` per submission: feed the job on stdin, collect the harness's
// stdout, classify against the harness-JSON boundary, and always tear down.
function runInContainer(job: SandboxJob, deadline: number): Promise<RunnerResult> {
  const name = `labproctor-sandbox-${randomUUID()}`;
  const settle = { done: false };

  const execution = new Promise<RunnerResult>((resolve) => {
    const finish = (result: RunnerResult) => {
      if (!settle.done) {
        settle.done = true;
        resolve(result);
      }
    };

    const child = spawn("docker", dockerRunArgs(name), {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    const deadman = setTimeout(() => {
      child.kill("SIGKILL");
      finish(
        infraError(
          "SANDBOX_DEADMAN",
          `Sandbox run exceeded the ${deadline}ms deadman timeout.`,
        ),
      );
    }, deadline);

    child.stdout.on("data", (chunk) => {
      if (stdout.length < PROCESS_OUTPUT_LIMIT * 2) {
        stdout += chunk.toString("utf8");
      }
    });
    child.stderr.on("data", (chunk) => {
      if (stderr.length < PROCESS_OUTPUT_LIMIT) {
        stderr += chunk.toString("utf8");
      }
    });
    child.on("error", (error) => {
      clearTimeout(deadman);
      // e.g. the `docker` binary is missing — infra, not the student's fault.
      finish(infraError("SANDBOX_SPAWN_FAILED", error.message));
    });
    child.on("close", (code) => {
      clearTimeout(deadman);
      if (settle.done) {
        return;
      }
      const result = parseHarnessResult(stdout);
      if (!result) {
        finish(
          infraError(
            "SANDBOX_BAD_OUTPUT",
            `Harness produced no valid RunnerResult JSON (docker exit ${code}). stderr: ${truncate(stderr).trim()}`,
          ),
        );
        return;
      }
      finish(result);
    });

    child.stdin.write(JSON.stringify(job));
    child.stdin.end();
  });

  return execution.finally(() => forceRemove(name));
}

const sandboxRunner: Runner = {
  async run(submission, cases, limits) {
    const plan = getExecutionPlan(submission.language, WORKSPACE);
    const job: SandboxJob = {
      source: submission.code,
      sourceFilename: basename(plan.sourcePath),
      compileCommand: plan.compileCommand,
      runCommand: plan.runCommand,
      compileTimeoutMs: limits.compileTimeoutMs,
      runTimeoutMs: limits.runTimeoutMs,
      cases: cases.map((testCase) => ({ id: testCase.id, input: testCase.input })),
    };
    const deadline = deadmanMs(
      limits.compileTimeoutMs,
      limits.runTimeoutMs,
      cases.length,
    );

    try {
      return await semaphore.run(() => runInContainer(job, deadline));
    } catch (error) {
      if (error instanceof QueueOverflowError) {
        // Saturation → "system busy, re-run me" (reusing SYSTEM_ERROR, no new
        // taxonomy). Never a hang, never a crash.
        return infraError("SANDBOX_BUSY", error.message);
      }
      return infraError(
        "SANDBOX_UNEXPECTED",
        error instanceof Error ? error.message : String(error),
      );
    }
  },
};

// ─── Boot preflight & orphan sweep ───────────────────────────────────────────

// Fail loud when RUNNER=sandbox but the sandbox is unsatisfiable — deliberately
// NO host fallback: running untrusted code unsandboxed while the operator
// believes it is contained is worse than refusing to start (ADR-0006).
async function preflightSandbox(): Promise<void> {
  const cfg = sandboxConfig();
  try {
    await captureDocker(["info"]);
  } catch (error) {
    throw new Error(
      `RUNNER=sandbox but the Docker daemon is unreachable: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  try {
    await captureDocker(["image", "inspect", cfg.image]);
  } catch {
    throw new Error(
      `RUNNER=sandbox but the sandbox image "${cfg.image}" is not present. Build it: docker build -t ${cfg.image} apps/api/sandbox`,
    );
  }
}

// Containers whose boot label is NOT this process's id — i.e. orphaned by a prior
// (crashed) API process. Filtering by boot id is what makes the interval sweep
// safe: it never reaps a container this process is actively running.
async function listForeignOrphans(): Promise<string[]> {
  const output = await captureDocker([
    "ps",
    "-a",
    "--filter",
    `label=${SANDBOX_LABEL_KEY}=1`,
    "--format",
    `{{.ID}} {{.Label "${BOOT_LABEL_KEY}"}}`,
  ]);
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, boot] = line.split(/\s+/);
      return { id: id ?? "", boot: boot ?? "" };
    })
    .filter((entry) => entry.id && entry.boot !== BOOT_ID)
    .map((entry) => entry.id);
}

async function sweepOrphans(): Promise<void> {
  try {
    const ids = await listForeignOrphans();
    for (const id of ids) {
      forceRemove(id);
    }
  } catch {
    // Best effort — a sweep failure must not take down the API.
  }
}

// Sweep once at boot, then on an interval. Returns a stop() for tests/shutdown.
function startOrphanSweeper(intervalMs = SWEEP_INTERVAL_MS): () => void {
  void sweepOrphans();
  const timer = setInterval(() => void sweepOrphans(), intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}

export {
  sandboxRunner,
  preflightSandbox,
  startOrphanSweeper,
  sweepOrphans,
  // Exported for the Docker-gated test suite.
  SANDBOX_LABEL_KEY,
  BOOT_LABEL_KEY,
  BOOT_ID,
};
