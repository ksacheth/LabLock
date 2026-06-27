import { test, expect } from "bun:test";
import { judge } from "../judge.ts";
import { createFakeRunner } from "./fake-runner.ts";
import type {
  StudentVisibleTestCase,
  ExecutionSubmissionStatus,
} from "../../types.ts";
import type { RunnerCaseResult } from "../runner.ts";

const oneCase: StudentVisibleTestCase[] = [
  { id: "c1", input: "1 2\n", expectedOutput: "3", isHidden: false },
];

// Judge a single test case that compiled cleanly, given the runner's output.
function judgeSingleCase(caseResult: Partial<RunnerCaseResult>) {
  const runner = createFakeRunner({
    compile: { ok: true, timedOut: false, durationMs: 5, stderr: "" },
    cases: [
      {
        id: "c1",
        stdout: "",
        stderr: "",
        exitCode: 0,
        timedOut: false,
        durationMs: 2,
        ...caseResult,
      },
    ],
    error: null,
  });
  return judge(
    { code: "x", language: "PYTHON3" },
    oneCase,
    { timeLimitMs: 1000 },
    runner,
  );
}

const statusCases: Array<{
  label: string;
  result: Partial<RunnerCaseResult>;
  status: ExecutionSubmissionStatus;
  passedCount: number;
  errorContains?: string;
  stdErr?: string;
}> = [
  {
    label: "output matching the expected value yields ACCEPTED",
    result: { stdout: "3" },
    status: "ACCEPTED",
    passedCount: 1,
  },
  {
    label: "output differing from expected yields WRONG_ANSWER",
    result: { stdout: "4" },
    status: "WRONG_ANSWER",
    passedCount: 0,
  },
  {
    label: "a timed-out case yields TIME_LIMIT_EXCEEDED",
    result: { timedOut: true, exitCode: null, durationMs: 1000 },
    status: "TIME_LIMIT_EXCEEDED",
    passedCount: 0,
    errorContains: "exceeded",
  },
  {
    label: "a non-zero exit code yields RUNTIME_ERROR",
    result: { stderr: "Segmentation fault", exitCode: 139 },
    status: "RUNTIME_ERROR",
    passedCount: 0,
    stdErr: "Segmentation fault",
  },
];

test.each(statusCases)(
  "single case: $label",
  async ({ result: caseResult, status, passedCount, errorContains, stdErr }) => {
    const result = await judgeSingleCase(caseResult);

    expect(result.status).toBe(status);
    expect(result.passedCount).toBe(passedCount);
    expect(result.totalCount).toBe(1);
    if (errorContains !== undefined) {
      expect(result.testCaseResults[0]?.error).toContain(errorContains);
    }
    if (stdErr !== undefined) {
      expect(result.stdErr).toBe(stdErr);
    }
  },
);

test("a failed compile yields COMPILE_ERROR with no cases run", async () => {
  const runner = createFakeRunner({
    compile: { ok: false, timedOut: false, durationMs: 8, stderr: "main.c:1: error: expected ';'" },
    cases: [],
    error: null,
  });

  const result = await judge(
    { code: "int main(){return 0", language: "C" },
    oneCase,
    { timeLimitMs: 1000 },
    runner,
  );

  expect(result.status).toBe("COMPILE_ERROR");
  expect(result.passedCount).toBe(0);
  expect(result.totalCount).toBe(1);
  expect(result.testCaseResults).toHaveLength(0);
  expect(result.stdErr).toContain("expected ';'");
});

test("mixed cases aggregate to the highest-priority status and count passes", async () => {
  const cases: StudentVisibleTestCase[] = [
    { id: "a", input: "1\n", expectedOutput: "1", isHidden: false },
    { id: "b", input: "2\n", expectedOutput: "2", isHidden: false },
    { id: "c", input: "3\n", expectedOutput: "3", isHidden: false },
  ];
  const runner = createFakeRunner({
    compile: { ok: true, timedOut: false, durationMs: 5, stderr: "" },
    cases: [
      { id: "a", stdout: "1", stderr: "", exitCode: 0, timedOut: false, durationMs: 2 }, // ACCEPTED
      { id: "b", stdout: "99", stderr: "", exitCode: 0, timedOut: false, durationMs: 2 }, // WRONG_ANSWER
      { id: "c", stdout: "", stderr: "boom", exitCode: 1, timedOut: false, durationMs: 2 }, // RUNTIME_ERROR
    ],
    error: null,
  });

  const result = await judge(
    { code: "x", language: "PYTHON3" },
    cases,
    { timeLimitMs: 1000 },
    runner,
  );

  // RUNTIME_ERROR outranks WRONG_ANSWER outranks ACCEPTED
  expect(result.status).toBe("RUNTIME_ERROR");
  expect(result.passedCount).toBe(1);
  expect(result.totalCount).toBe(3);
});

test("a runner-level error yields SYSTEM_ERROR (not the student's fault)", async () => {
  const runner = createFakeRunner({
    compile: { ok: false, timedOut: false, durationMs: 0, stderr: "" },
    cases: [],
    error: { kind: "RUNNER_SPAWN_FAILED", message: "spawn gcc ENOENT" },
  });

  const result = await judge(
    { code: "x", language: "C" },
    oneCase,
    { timeLimitMs: 1000 },
    runner,
  );

  expect(result.status).toBe("SYSTEM_ERROR");
  expect(result.passedCount).toBe(0);
  expect(result.totalCount).toBe(1);
  expect(result.testCaseResults).toHaveLength(0);
  expect(result.storedTestCaseResults).toHaveLength(0);
  expect(result.stdErr).toContain("RUNNER_SPAWN_FAILED");
});
