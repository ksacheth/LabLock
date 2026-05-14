// The Judge: turns a code submission into a graded result. Owns the pure logic
// (input formatting, output equivalence, status aggregation) plus orchestration
// and logging; it is blind to the execution environment, talking only to a
// Runner. See docs/adr/0001-execution-runner-seam.md and CONTEXT.md.
import { logApiEvent } from "../lib/logging.ts";
import { hostRunner } from "./host-runner.ts";
import type { Runner } from "./runner.ts";
import type {
  StudentProgrammingLanguage,
  ExecutionSubmissionStatus,
  StoredTestCaseResult,
  StudentVisibleTestCase,
  StudentRunTestCaseResult,
  StudentRunExecutionResult,
} from "../types.ts";

const COMPILATION_TIMEOUT_MS = 15_000;
const MIN_RUN_TIMEOUT_MS = 250;

// ─── Input formatting (competitive-programming semantics) ────────────────────

function normalizeExecutionInput(value: string) {
  return value.replace(/\r\n/g, "\n");
}

function isPrimitiveCompetitiveInputValue(
  value: unknown,
): value is string | number | boolean | bigint | null {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  );
}

function expandArrayStyleInputLine(line: string) {
  const trimmedLine = line.trim();

  if (!trimmedLine.startsWith("[") || !trimmedLine.endsWith("]")) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(trimmedLine);

    if (
      !Array.isArray(parsedValue) ||
      !parsedValue.every((item) => isPrimitiveCompetitiveInputValue(item))
    ) {
      return null;
    }

    const serializedValues = parsedValue.map((item) =>
      item === null ? "null" : String(item),
    );

    return [String(parsedValue.length), serializedValues.join(" ")].join("\n");
  } catch {
    return null;
  }
}

function formatExecutionInputForCompetitiveProgramming(value: string) {
  return normalizeExecutionInput(value)
    .split("\n")
    .map((line) => expandArrayStyleInputLine(line) ?? line)
    .join("\n");
}

// ─── Output equivalence ──────────────────────────────────────────────────────

function normalizeExecutionOutput(value: string) {
  return value.replace(/\r\n/g, "\n").trimEnd();
}

function normalizeStructuredExecutionValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeStructuredExecutionValue(item));
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = normalizeStructuredExecutionValue(
          (value as Record<string, unknown>)[key],
        );
        return accumulator;
      }, {});
  }

  return value;
}

function stableStringifyExecutionValue(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringifyExecutionValue(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(
        ([key, nestedValue]) =>
          `${JSON.stringify(key)}:${stableStringifyExecutionValue(nestedValue)}`,
      )
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function parseStructuredExecutionValue(value: string): unknown | null {
  const normalized = normalizeExecutionOutput(value).trim();

  if (normalized === "") {
    return null;
  }

  try {
    return JSON.parse(normalized);
  } catch {
    return null;
  }
}

function looksLikeArrayStyleOutput(value: string) {
  return /[[\],]/.test(value);
}

function flattenStructuredExecutionTokens(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenStructuredExecutionTokens(item));
  }

  if (value && typeof value === "object") {
    return [
      stableStringifyExecutionValue(normalizeStructuredExecutionValue(value)),
    ];
  }

  return [String(value)];
}

function tokenizeLooseExecutionOutput(value: string): string[] {
  return normalizeExecutionOutput(value)
    .replace(/[[\],]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function outputsAreEquivalent(actualOutput: string, expectedOutput: string) {
  const normalizedActualOutput = normalizeExecutionOutput(actualOutput);
  const normalizedExpectedOutput = normalizeExecutionOutput(expectedOutput);

  if (normalizedActualOutput === normalizedExpectedOutput) {
    return true;
  }

  const structuredActualOutput = parseStructuredExecutionValue(
    normalizedActualOutput,
  );
  const structuredExpectedOutput = parseStructuredExecutionValue(
    normalizedExpectedOutput,
  );

  if (
    structuredActualOutput !== null &&
    structuredExpectedOutput !== null &&
    stableStringifyExecutionValue(
      normalizeStructuredExecutionValue(structuredActualOutput),
    ) ===
      stableStringifyExecutionValue(
        normalizeStructuredExecutionValue(structuredExpectedOutput),
      )
  ) {
    return true;
  }

  if (
    !looksLikeArrayStyleOutput(normalizedActualOutput) &&
    !looksLikeArrayStyleOutput(normalizedExpectedOutput)
  ) {
    return false;
  }

  const comparableActualTokens =
    structuredActualOutput !== null
      ? flattenStructuredExecutionTokens(structuredActualOutput)
      : tokenizeLooseExecutionOutput(normalizedActualOutput);
  const comparableExpectedTokens =
    structuredExpectedOutput !== null
      ? flattenStructuredExecutionTokens(structuredExpectedOutput)
      : tokenizeLooseExecutionOutput(normalizedExpectedOutput);

  return (
    comparableActualTokens.length === comparableExpectedTokens.length &&
    comparableActualTokens.every(
      (token, index) => token === comparableExpectedTokens[index],
    )
  );
}

// ─── Status aggregation ──────────────────────────────────────────────────────

function getHigherPriorityExecutionStatus(
  current: ExecutionSubmissionStatus,
  next: ExecutionSubmissionStatus,
) {
  const priority: Record<ExecutionSubmissionStatus, number> = {
    ACCEPTED: 0,
    WRONG_ANSWER: 1,
    TIME_LIMIT_EXCEEDED: 2,
    RUNTIME_ERROR: 3,
    COMPILE_ERROR: 4,
  };

  return priority[next] > priority[current] ? next : current;
}

// ─── Judge ───────────────────────────────────────────────────────────────────

type JudgeSubmission = {
  code: string;
  language: StudentProgrammingLanguage;
  metadata?: {
    userId: string;
    examId: string;
    questionId: string;
    attemptId: string;
  };
};

type JudgeLimits = {
  timeLimitMs: number;
};

async function judge(
  submission: JudgeSubmission,
  cases: StudentVisibleTestCase[],
  limits: JudgeLimits,
  runner: Runner = hostRunner,
): Promise<StudentRunExecutionResult> {
  const metadata = submission.metadata;
  const logContext = {
    userId: metadata?.userId ?? null,
    examId: metadata?.examId ?? null,
    questionId: metadata?.questionId ?? null,
    attemptId: metadata?.attemptId ?? null,
    language: submission.language,
  };

  const formattedInputById = new Map<string, string>();
  const runnerCases = cases.map((testCase) => {
    const input = formatExecutionInputForCompetitiveProgramming(testCase.input);
    formattedInputById.set(testCase.id, input);
    return { id: testCase.id, input };
  });

  logApiEvent("exam.code.compile.started", {
    ...logContext,
    testCaseCount: cases.length,
  });

  const runnerResult = await runner.run(
    { code: submission.code, language: submission.language },
    runnerCases,
    {
      compileTimeoutMs: COMPILATION_TIMEOUT_MS,
      runTimeoutMs: Math.max(limits.timeLimitMs, MIN_RUN_TIMEOUT_MS),
    },
  );

  logApiEvent("exam.code.compile.completed", {
    ...logContext,
    timedOut: runnerResult.compile.timedOut,
    durationMs: runnerResult.compile.durationMs,
    success: runnerResult.compile.ok && runnerResult.error === null,
  });

  // Slice 1: a runner-level (infrastructure) failure preserves today's
  // behavior — it throws and surfaces as a 500. Turning it into a
  // SYSTEM_ERROR outcome is a separate slice (see ADR-0002).
  if (runnerResult.error) {
    throw new Error(
      `Runner failure (${runnerResult.error.kind}): ${runnerResult.error.message}`,
    );
  }

  if (!runnerResult.compile.ok) {
    return {
      status: "COMPILE_ERROR",
      executionTimeMs: null,
      memoryUsedKb: null,
      passedCount: 0,
      totalCount: cases.length,
      stdErr: runnerResult.compile.timedOut
        ? `Compilation exceeded ${COMPILATION_TIMEOUT_MS}ms.`
        : runnerResult.compile.stderr,
      testCaseResults: [] satisfies StudentRunTestCaseResult[],
      storedTestCaseResults: [] satisfies StoredTestCaseResult[],
    } satisfies StudentRunExecutionResult;
  }

  const testCaseResults: StudentRunTestCaseResult[] = [];
  const storedTestCaseResults: StoredTestCaseResult[] = [];
  let aggregateStatus: ExecutionSubmissionStatus = "ACCEPTED";
  let highestExecutionTimeMs: number | null = null;
  let stdErr: string | null = null;

  for (const testCase of cases) {
    const runnerCase = runnerResult.cases.find(
      (candidate) => candidate.id === testCase.id,
    );
    const executionInput = formattedInputById.get(testCase.id) ?? testCase.input;

    const durationMs = runnerCase?.durationMs ?? 0;
    highestExecutionTimeMs = Math.max(highestExecutionTimeMs ?? 0, durationMs);

    const actualOutput = normalizeExecutionOutput(runnerCase?.stdout ?? "");
    const expectedOutput = normalizeExecutionOutput(testCase.expectedOutput);
    const timedOut = runnerCase?.timedOut ?? false;
    const runtimeFailed = !timedOut && (runnerCase?.exitCode ?? 1) !== 0;
    const passed =
      !timedOut &&
      !runtimeFailed &&
      outputsAreEquivalent(actualOutput, expectedOutput);
    const caseStatus: ExecutionSubmissionStatus = timedOut
      ? "TIME_LIMIT_EXCEEDED"
      : runtimeFailed
        ? "RUNTIME_ERROR"
        : passed
          ? "ACCEPTED"
          : "WRONG_ANSWER";

    aggregateStatus = getHigherPriorityExecutionStatus(
      aggregateStatus,
      caseStatus,
    );

    const caseStdErr = runnerCase?.stderr.trim() ?? "";
    if (!stdErr && caseStdErr) {
      stdErr = caseStdErr;
    }

    const caseError = timedOut
      ? `Execution exceeded ${limits.timeLimitMs}ms.`
      : runtimeFailed
        ? caseStdErr ||
          `Process exited with code ${runnerCase?.exitCode ?? "unknown"}.`
        : null;

    testCaseResults.push({
      testCaseId: testCase.id,
      passed,
      input: executionInput,
      expectedOutput: testCase.expectedOutput,
      actualOutput,
      executionTimeMs: durationMs,
      memoryUsedKb: null,
      error: caseError,
    });
    storedTestCaseResults.push({
      testCaseId: testCase.id,
      passed,
      actualOutput,
      executionTimeMs: durationMs,
      memoryUsedKb: null,
    });
  }

  return {
    status: aggregateStatus,
    executionTimeMs: highestExecutionTimeMs,
    memoryUsedKb: null,
    passedCount: testCaseResults.filter((result) => result.passed).length,
    totalCount: testCaseResults.length,
    stdErr,
    testCaseResults,
    storedTestCaseResults,
  } satisfies StudentRunExecutionResult;
}

export {
  judge,
  // Exported for direct unit testing — the buggiest pure logic.
  outputsAreEquivalent,
  formatExecutionInputForCompetitiveProgramming,
};
