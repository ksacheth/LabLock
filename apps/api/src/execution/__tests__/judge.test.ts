import { test, expect } from "bun:test";
import { judge } from "../judge.ts";
import { createFakeRunner } from "./fake-runner.ts";
import type { StudentVisibleTestCase } from "../../types.ts";

const oneCase: StudentVisibleTestCase[] = [
  { id: "c1", input: "1 2\n", expectedOutput: "3", isHidden: false },
];

test("a passing case yields ACCEPTED", async () => {
  const runner = createFakeRunner({
    compile: { ok: true, timedOut: false, durationMs: 5, stderr: "" },
    cases: [
      { id: "c1", stdout: "3", stderr: "", exitCode: 0, timedOut: false, durationMs: 2 },
    ],
    error: null,
  });

  const result = await judge(
    { code: "print(sum(map(int, input().split())))", language: "PYTHON3" },
    oneCase,
    { timeLimitMs: 1000 },
    runner,
  );

  expect(result.status).toBe("ACCEPTED");
  expect(result.passedCount).toBe(1);
  expect(result.totalCount).toBe(1);
});

test("output that differs from expected yields WRONG_ANSWER", async () => {
  const runner = createFakeRunner({
    compile: { ok: true, timedOut: false, durationMs: 5, stderr: "" },
    cases: [
      { id: "c1", stdout: "4", stderr: "", exitCode: 0, timedOut: false, durationMs: 2 },
    ],
    error: null,
  });

  const result = await judge(
    { code: "x", language: "PYTHON3" },
    oneCase,
    { timeLimitMs: 1000 },
    runner,
  );

  expect(result.status).toBe("WRONG_ANSWER");
  expect(result.passedCount).toBe(0);
});

test("a timed-out case yields TIME_LIMIT_EXCEEDED", async () => {
  const runner = createFakeRunner({
    compile: { ok: true, timedOut: false, durationMs: 5, stderr: "" },
    cases: [
      { id: "c1", stdout: "", stderr: "", exitCode: null, timedOut: true, durationMs: 1000 },
    ],
    error: null,
  });

  const result = await judge(
    { code: "x", language: "PYTHON3" },
    oneCase,
    { timeLimitMs: 1000 },
    runner,
  );

  expect(result.status).toBe("TIME_LIMIT_EXCEEDED");
  expect(result.passedCount).toBe(0);
  expect(result.testCaseResults[0]?.error).toContain("exceeded");
});

test("a non-zero exit code yields RUNTIME_ERROR", async () => {
  const runner = createFakeRunner({
    compile: { ok: true, timedOut: false, durationMs: 5, stderr: "" },
    cases: [
      { id: "c1", stdout: "", stderr: "Segmentation fault", exitCode: 139, timedOut: false, durationMs: 3 },
    ],
    error: null,
  });

  const result = await judge(
    { code: "x", language: "PYTHON3" },
    oneCase,
    { timeLimitMs: 1000 },
    runner,
  );

  expect(result.status).toBe("RUNTIME_ERROR");
  expect(result.passedCount).toBe(0);
  expect(result.stdErr).toBe("Segmentation fault");
});

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

test("a runner-level error throws (preserves today's 500 behavior)", async () => {
  const runner = createFakeRunner({
    compile: { ok: false, timedOut: false, durationMs: 0, stderr: "" },
    cases: [],
    error: { kind: "RUNNER_SPAWN_FAILED", message: "spawn gcc ENOENT" },
  });

  await expect(
    judge({ code: "x", language: "C" }, oneCase, { timeLimitMs: 1000 }, runner),
  ).rejects.toThrow("RUNNER_SPAWN_FAILED");
});
