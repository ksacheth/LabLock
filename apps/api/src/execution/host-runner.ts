// Host adapter for the Runner seam: compiles and runs student code as child
// processes of the API host. CURRENT DEFAULT — not sandboxed; untrusted code
// runs on the host with only a wall-clock timeout. A sandbox adapter can drop
// in behind the same seam later. See docs/adr/0001-execution-runner-seam.md.
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { StudentProgrammingLanguage } from "../types.ts";
import type { Runner, RunnerResult } from "./runner.ts";

const PROCESS_OUTPUT_LIMIT = 16_000;

function truncateProcessOutput(value: string, maxLength = PROCESS_OUTPUT_LIMIT) {
  return value.length > maxLength
    ? `${value.slice(0, maxLength)}\n...truncated`
    : value;
}

function appendProcessOutput(current: string, chunk: string) {
  if (current.length >= PROCESS_OUTPUT_LIMIT) {
    return current;
  }

  return truncateProcessOutput(current + chunk);
}

async function executeProcess(
  command: string[],
  options: {
    cwd: string;
    input?: string;
    timeoutMs: number;
  },
) {
  const startedAt = performance.now();

  return await new Promise<{
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    stdout: string;
    stderr: string;
    timedOut: boolean;
    durationMs: number;
  }>((resolve, reject) => {
    const child = spawn(command[0]!, command.slice(1), {
      cwd: options.cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, options.timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout = appendProcessOutput(stdout, chunk.toString("utf8"));
    });
    child.stderr.on("data", (chunk) => {
      stderr = appendProcessOutput(stderr, chunk.toString("utf8"));
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (exitCode, signal) => {
      clearTimeout(timer);
      resolve({
        exitCode,
        signal,
        stdout,
        stderr,
        timedOut,
        durationMs: Math.max(1, Math.round(performance.now() - startedAt)),
      });
    });

    if (options.input !== undefined) {
      child.stdin.write(options.input);
    }
    child.stdin.end();
  });
}

function getExecutionPlan(
  language: StudentProgrammingLanguage,
  tempDir: string,
) {
  switch (language) {
    case "C": {
      const sourcePath = join(tempDir, "main.c");
      const executablePath = join(tempDir, "main-c");
      return {
        sourcePath,
        compileCommand: [
          "gcc",
          "-O2",
          "-std=c11",
          sourcePath,
          "-o",
          executablePath,
        ],
        runCommand: [executablePath],
      };
    }
    case "CPP": {
      const sourcePath = join(tempDir, "main.cpp");
      const executablePath = join(tempDir, "main-cpp");
      return {
        sourcePath,
        compileCommand: [
          "g++",
          "-O2",
          "-std=c++17",
          sourcePath,
          "-o",
          executablePath,
        ],
        runCommand: [executablePath],
      };
    }
    case "PYTHON3": {
      const sourcePath = join(tempDir, "main.py");
      return {
        sourcePath,
        compileCommand: ["python3", "-m", "py_compile", sourcePath],
        runCommand: ["python3", sourcePath],
      };
    }
    case "JAVA": {
      const sourcePath = join(tempDir, "Main.java");
      return {
        sourcePath,
        compileCommand: ["javac", "-encoding", "UTF-8", sourcePath],
        runCommand: ["java", "-cp", tempDir, "Main"],
      };
    }
  }
}

const hostRunner: Runner = {
  async run(submission, cases, limits) {
    const tempDir = await mkdtemp(join(tmpdir(), "labproctor-run-"));

    try {
      const executionPlan = getExecutionPlan(submission.language, tempDir);
      await writeFile(executionPlan.sourcePath, submission.code, "utf8");

      const compileResult = await executeProcess(executionPlan.compileCommand, {
        cwd: tempDir,
        timeoutMs: limits.compileTimeoutMs,
      });

      if (compileResult.timedOut || compileResult.exitCode !== 0) {
        return {
          compile: {
            ok: false,
            timedOut: compileResult.timedOut,
            durationMs: compileResult.durationMs,
            stderr: compileResult.stderr || compileResult.stdout,
          },
          cases: [],
          error: null,
        } satisfies RunnerResult;
      }

      const caseResults: RunnerResult["cases"] = [];

      for (const testCase of cases) {
        const runResult = await executeProcess(executionPlan.runCommand, {
          cwd: tempDir,
          input: testCase.input,
          timeoutMs: limits.runTimeoutMs,
        });

        caseResults.push({
          id: testCase.id,
          stdout: runResult.stdout,
          stderr: runResult.stderr,
          exitCode: runResult.exitCode,
          timedOut: runResult.timedOut,
          durationMs: runResult.durationMs,
        });
      }

      return {
        compile: {
          ok: true,
          timedOut: false,
          durationMs: compileResult.durationMs,
          stderr: "",
        },
        cases: caseResults,
        error: null,
      } satisfies RunnerResult;
    } catch (error) {
      // Runner-level (infrastructure) failure — e.g. the compiler binary is
      // missing and spawn rejects with ENOENT. Distinct from a compile failure.
      return {
        compile: { ok: false, timedOut: false, durationMs: 0, stderr: "" },
        cases: [],
        error: {
          kind: "RUNNER_SPAWN_FAILED",
          message: error instanceof Error ? error.message : String(error),
        },
      } satisfies RunnerResult;
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  },
};

export { hostRunner };
