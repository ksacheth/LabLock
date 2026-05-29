// Sandbox isolation suite (ADR-0006, PRD #38 · slices #39/#40). Each case is a
// program that TRIES to escape; the assertion is that the boundary holds — this
// is what turns "runs in a container" into "is a sandbox".
//
// Docker-gated: it drives a REAL container via the sandbox adapter and the
// pinned image. Locally it SKIPS with a loud, explicit note (a silent skip is a
// false green). In CI it is MANDATORY: set SANDBOX_TESTS=required and the file
// hard-fails if Docker or the image is missing, so the suite can never quietly
// vanish. Build the image first: docker build -t "$SANDBOX_IMAGE" apps/api/sandbox
import { test, expect } from "bun:test";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  sandboxRunner,
  SANDBOX_LABEL_KEY,
  BOOT_LABEL_KEY,
} from "../sandbox-runner.ts";
import { hostRunner } from "../host-runner.ts";
import type { RunnerCaseInput } from "../runner.ts";
import type { StudentProgrammingLanguage } from "../../types.ts";

const IMAGE = process.env.SANDBOX_IMAGE ?? "labproctor-sandbox:latest";
const REQUIRED = process.env.SANDBOX_TESTS === "required";
const TEST_TIMEOUT_MS = 90_000;
const ONE_CASE: RunnerCaseInput[] = [{ id: "c1", input: "" }];

function runDocker(args: string[]): Promise<{ code: number; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    child.stdout.on("data", (chunk) => (stdout += chunk.toString("utf8")));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stdout }));
  });
}

async function dockerAndImageReady(): Promise<boolean> {
  try {
    const info = await runDocker(["info"]);
    if (info.code !== 0) return false;
    const image = await runDocker(["image", "inspect", IMAGE]);
    return image.code === 0;
  } catch {
    return false;
  }
}

const ready = await dockerAndImageReady();

if (REQUIRED && !ready) {
  throw new Error(
    `SANDBOX_TESTS=required but Docker or the sandbox image "${IMAGE}" is unavailable. ` +
      `The isolation suite is a NON-TEST when skipped and MUST run in CI. ` +
      `Build it: docker build -t "${IMAGE}" apps/api/sandbox`,
  );
}

if (!ready) {
  console.warn(
    `\n[sandbox tests] SKIPPED — Docker or the image "${IMAGE}" is unavailable.\n` +
      `  These isolation tests prove the sandbox actually contains untrusted code;\n` +
      `  a skip is a NON-TEST. They are MANDATORY in CI (SANDBOX_TESTS=required).\n`,
  );
}

// Docker-gated: real test when ready, loud-skip otherwise.
const itDocker = ready ? test : test.skip;

function submission(code: string, language: StudentProgrammingLanguage = "PYTHON3") {
  return { code, language };
}

// This guard test ALWAYS runs: in CI (SANDBOX_TESTS=required) it enforces that
// the suite really executed against a live image.
test("isolation suite is enforced in CI", () => {
  if (REQUIRED) {
    expect(ready).toBe(true);
  } else {
    expect(true).toBe(true);
  }
});

// ─── #39: benign end-to-end tracer bullet ────────────────────────────────────

itDocker(
  "benign submission runs end-to-end in a container and returns the host verdict",
  async () => {
    const result = await sandboxRunner.run(
      submission("print('hello world')"),
      ONE_CASE,
      { compileTimeoutMs: 15_000, runTimeoutMs: 3_000 },
    );

    expect(result.error).toBeNull();
    expect(result.compile.ok).toBe(true);
    expect(result.cases[0]?.stdout.trim()).toBe("hello world");
    expect(result.cases[0]?.exitCode).toBe(0);
    expect(result.cases[0]?.timedOut).toBe(false);
  },
  TEST_TIMEOUT_MS,
);

// ─── #40: escape-attempt isolation suite ─────────────────────────────────────

itDocker(
  "opening a network socket is denied (--network none)",
  async () => {
    const code = [
      "import socket",
      "s = socket.socket()",
      "s.settimeout(3)",
      "s.connect(('8.8.8.8', 53))",
      "print('CONNECTED')",
    ].join("\n");

    const result = await sandboxRunner.run(submission(code), ONE_CASE, {
      compileTimeoutMs: 15_000,
      runTimeoutMs: 8_000,
    });

    expect(result.error).toBeNull();
    const first = result.cases[0];
    expect(first?.stdout).not.toContain("CONNECTED");
    // connect() raised (network unreachable) → non-zero exit → RUNTIME_ERROR.
    expect(first?.exitCode).not.toBe(0);
    expect(first?.timedOut).toBe(false);
  },
  TEST_TIMEOUT_MS,
);

itDocker(
  "the root filesystem is read-only and no host paths are mounted",
  async () => {
    const code = [
      "try:",
      "    open('/etc/passwd_probe', 'w').write('x')",
      "    print('WROTE_ROOTFS')",
      "except OSError:",
      "    print('DENIED')",
    ].join("\n");

    const result = await sandboxRunner.run(submission(code), ONE_CASE, {
      compileTimeoutMs: 15_000,
      runTimeoutMs: 3_000,
    });

    expect(result.error).toBeNull();
    expect(result.cases[0]?.stdout).toContain("DENIED");
    expect(result.cases[0]?.stdout).not.toContain("WROTE_ROOTFS");
  },
  TEST_TIMEOUT_MS,
);

itDocker(
  "allocating past the memory ceiling is OOM-killed → RUNTIME_ERROR",
  async () => {
    const code = [
      "chunks = []",
      "while True:",
      "    chunks.append(bytearray(50 * 1024 * 1024))",
    ].join("\n");

    const result = await sandboxRunner.run(submission(code), ONE_CASE, {
      compileTimeoutMs: 15_000,
      runTimeoutMs: 12_000,
    });

    expect(result.error).toBeNull();
    const first = result.cases[0];
    // OOM-kill at the ceiling: not a timeout, a non-zero (signal) exit.
    expect(first?.timedOut).toBe(false);
    expect(first?.exitCode).not.toBe(0);
  },
  TEST_TIMEOUT_MS,
);

itDocker(
  "a fork bomb is contained by --pids-limit and the host survives",
  async () => {
    const code = [
      "import os",
      "while True:",
      "    try:",
      "        os.fork()",
      "    except OSError:",
      "        pass",
    ].join("\n");

    const result = await sandboxRunner.run(submission(code), ONE_CASE, {
      compileTimeoutMs: 15_000,
      runTimeoutMs: 3_000,
    });

    // Contained: we still get a verdict (not an infra/deadman failure), the whole
    // process group is torn down, and this test process is still running to assert.
    expect(result.error).toBeNull();
    expect(result.cases[0]?.timedOut).toBe(true);
  },
  TEST_TIMEOUT_MS,
);

itDocker(
  "an infinite loop hits the per-case wall clock → TIME_LIMIT_EXCEEDED and is torn down",
  async () => {
    const startedAt = Date.now();
    const result = await sandboxRunner.run(
      submission("while True:\n    pass"),
      ONE_CASE,
      { compileTimeoutMs: 15_000, runTimeoutMs: 1_500 },
    );

    expect(result.error).toBeNull();
    expect(result.cases[0]?.timedOut).toBe(true);
    // Killed at the per-case limit, far inside the generous outer deadman.
    expect(Date.now() - startedAt).toBeLessThan(15_000 + 1_500 + 15_000);
  },
  TEST_TIMEOUT_MS,
);

itDocker(
  "a malicious compile bomb is contained in-sandbox (COMPILE_ERROR, host untouched)",
  async () => {
    // Recursive-template instantiation: T<N> embeds two T<N-1>, so sizeof(T<30>)
    // is ~2^30 ints. Compiling it explodes memory/time — and because compilation
    // of untrusted code is itself untrusted, it runs INSIDE the sandbox, where the
    // ceiling contains it instead of hammering the host.
    const code = [
      "template <int N> struct T { T<N-1> a, b; };",
      "template <> struct T<0> { int x; };",
      "int main() { T<30> t; return (int)sizeof(t); }",
    ].join("\n");

    const result = await sandboxRunner.run(submission(code, "CPP"), ONE_CASE, {
      compileTimeoutMs: 20_000,
      runTimeoutMs: 2_000,
    });

    // A contained compile is a STUDENT outcome (COMPILE_ERROR), never infra.
    expect(result.error).toBeNull();
    expect(result.compile.ok).toBe(false);
    expect(result.cases).toHaveLength(0);
  },
  TEST_TIMEOUT_MS,
);

// ─── #40 (optional): host-vs-sandbox differential parity ─────────────────────

itDocker(
  "differential parity: a benign program grades the same on host and sandbox",
  async () => {
    const code = "n = int(input())\nprint(n * n)";
    const cases: RunnerCaseInput[] = [{ id: "c1", input: "7\n" }];
    const limits = { compileTimeoutMs: 15_000, runTimeoutMs: 3_000 };

    const host = await hostRunner.run(submission(code), cases, limits);
    // Skip the comparison (not the whole suite) if the host lacks python3.
    if (host.error) {
      console.warn("[sandbox tests] parity: host toolchain unavailable, skipping compare");
      return;
    }
    const sandbox = await sandboxRunner.run(submission(code), cases, limits);

    expect(sandbox.error).toBeNull();
    expect(sandbox.compile.ok).toBe(host.compile.ok);
    expect(sandbox.cases[0]?.stdout.trim()).toBe(host.cases[0]?.stdout.trim());
    expect(sandbox.cases[0]?.exitCode).toBe(host.cases[0]?.exitCode);
  },
  TEST_TIMEOUT_MS,
);

// ─── #41: labeled orphan sweep (Docker-gated) ────────────────────────────────

itDocker(
  "the orphan sweep reclaims a foreign labeled container but spares this boot's own",
  async () => {
    const { sweepOrphans, BOOT_ID } = await import("../sandbox-runner.ts");
    const foreignName = `labproctor-sandbox-test-${randomUUID()}`;
    const ownName = `labproctor-sandbox-test-${randomUUID()}`;

    try {
      // A crash-orphan from a *different* boot, and a live container from THIS boot.
      await runDocker([
        "run", "-d", "--name", foreignName,
        "--label", `${SANDBOX_LABEL_KEY}=1`,
        "--label", `${BOOT_LABEL_KEY}=some-other-boot`,
        IMAGE, "sleep", "120",
      ]);
      await runDocker([
        "run", "-d", "--name", ownName,
        "--label", `${SANDBOX_LABEL_KEY}=1`,
        "--label", `${BOOT_LABEL_KEY}=${BOOT_ID}`,
        IMAGE, "sleep", "120",
      ]);

      await sweepOrphans();
      // Give the fire-and-forget `docker rm -f` a moment to land.
      await new Promise((resolve) => setTimeout(resolve, 1_500));

      const foreign = await runDocker(["ps", "-aq", "--filter", `name=${foreignName}`]);
      const own = await runDocker(["ps", "-aq", "--filter", `name=${ownName}`]);
      expect(foreign.stdout.trim()).toBe(""); // foreign orphan reaped
      expect(own.stdout.trim()).not.toBe(""); // this boot's container spared
    } finally {
      await runDocker(["rm", "-f", foreignName]);
      await runDocker(["rm", "-f", ownName]);
    }
  },
  TEST_TIMEOUT_MS,
);
