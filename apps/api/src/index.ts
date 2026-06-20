import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import cors from "cors";
import prisma from "@repo/database";
import bcrypt from "bcryptjs";
import {
  UserSchema,
  FacultySignupSchema,
  ExamSchema,
  UpdateExamSchema,
  DepartmentSchema,
  BatchSchema,
  AdminUpdateUserSchema,
  QuestionSchema,
  UpdateQuestionSchema,
  TestCaseSchema,
  UpdateTestCaseSchema,
} from "@common/types";
import jwt from "jsonwebtoken";
import { authMiddleware } from "./middleware/auth.ts";

const portalLabelByRole = {
  STUDENT: "student",
  FACULTY: "teacher",
  ADMIN: "admin",
} as const;

type PortalRole = keyof typeof portalLabelByRole;
const studentProgrammingLanguages = ["C", "CPP", "PYTHON3", "JAVA"] as const;
type StudentProgrammingLanguage = (typeof studentProgrammingLanguages)[number];
type ExecutionSubmissionStatus =
  | "ACCEPTED"
  | "WRONG_ANSWER"
  | "COMPILE_ERROR"
  | "RUNTIME_ERROR"
  | "TIME_LIMIT_EXCEEDED";

type StoredTestCaseResult = {
  testCaseId: string;
  passed: boolean;
  actualOutput: string | null;
  executionTimeMs: number | null;
  memoryUsedKb: number | null;
};

type StudentVisibleTestCase = {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
};

type StudentRunTestCaseResult = {
  testCaseId: string;
  passed: boolean;
  input: string | null;
  expectedOutput: string | null;
  actualOutput: string | null;
  executionTimeMs: number | null;
  memoryUsedKb: number | null;
  error: string | null;
};

type StudentRunExecutionResult = {
  status: ExecutionSubmissionStatus;
  executionTimeMs: number | null;
  memoryUsedKb: number | null;
  passedCount: number;
  totalCount: number;
  stdErr: string | null;
  testCaseResults: StudentRunTestCaseResult[];
  storedTestCaseResults: StoredTestCaseResult[];
};

function calculateWeightedQuestionScore(
  questionMarks: number,
  weightedCases: Array<{ id: string; weight: number }>,
  storedResults: StoredTestCaseResult[],
  executionStatus: ExecutionSubmissionStatus,
): number {
  if (weightedCases.length === 0) return 0;
  if (executionStatus === "COMPILE_ERROR") return 0;
  const totalWeight = weightedCases.reduce((s, t) => s + t.weight, 0);
  if (totalWeight <= 0) return 0;
  let earnedWeight = 0;
  for (const tc of weightedCases) {
    const r = storedResults.find((x) => x.testCaseId === tc.id);
    if (r?.passed) earnedWeight += tc.weight;
  }
  return (earnedWeight / totalWeight) * questionMarks;
}

const COMPILATION_TIMEOUT_MS = 15_000;
const PROCESS_OUTPUT_LIMIT = 16_000;

function logApiEvent(
  event: string,
  details?: Record<string, string | number | boolean | null>,
) {
  console.info(`[api] ${event}`, {
    timestamp: new Date().toISOString(),
    ...details,
  });
}

const FACULTY_PENDING_MSG =
  "Your faculty account is pending admin approval. You can use the teacher dashboard after an administrator activates your account.";

/** Returns true if the response was already sent (caller should return). */
function rejectUnapprovedFaculty(
  res: Response,
  user: { role: string; facultyApproved: boolean } | null,
  notFacultyMessage: string,
): boolean {
  if (!user || user.role !== "FACULTY") {
    res.status(403).json({ error: notFacultyMessage });
    return true;
  }
  if (!user.facultyApproved) {
    res.status(403).json({
      error: FACULTY_PENDING_MSG,
      code: "FACULTY_PENDING_APPROVAL",
    });
    return true;
  }
  return false;
}

function isPortalRole(value: unknown): value is PortalRole {
  return typeof value === "string" && value in portalLabelByRole;
}

function isStudentProgrammingLanguage(
  value: unknown,
): value is StudentProgrammingLanguage {
  return (
    typeof value === "string" &&
    studentProgrammingLanguages.includes(value as StudentProgrammingLanguage)
  );
}

function toStudentProgrammingLanguage(
  value: string | undefined | null,
): StudentProgrammingLanguage {
  if (value && isStudentProgrammingLanguage(value)) {
    return value;
  }
  return "PYTHON3";
}

function calculateExamEndTime(startTime: Date, durationMin: number) {
  return new Date(startTime.getTime() + durationMin * 60_000);
}

function isExamCurrentlyActive(
  exam: { isActive: boolean; endTime: Date },
  now = new Date(),
) {
  return exam.isActive && exam.endTime > now;
}

async function deactivateExpiredExams(now = new Date()) {
  await prisma.exam.updateMany({
    where: {
      deletedAt: null,
      isActive: true,
      endTime: { lte: now },
    },
    data: { isActive: false },
  });
}

function truncateProcessOutput(
  value: string,
  maxLength = PROCESS_OUTPUT_LIMIT,
) {
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

function normalizeExecutionOutput(value: string) {
  return value.replace(/\r\n/g, "\n").trimEnd();
}

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
  return /[\[\],]/.test(value);
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
    .replace(/[\[\],]/g, " ")
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

async function executeStudentCodeAgainstVisibleCases(options: {
  code: string;
  language: StudentProgrammingLanguage;
  timeLimitMs: number;
  testCases: StudentVisibleTestCase[];
  metadata?: {
    userId: string;
    examId: string;
    questionId: string;
    attemptId: string;
  };
}) {
  const tempDir = await mkdtemp(join(tmpdir(), "labproctor-run-"));

  try {
    const executionPlan = getExecutionPlan(options.language, tempDir);
    await writeFile(executionPlan.sourcePath, options.code, "utf8");
    logApiEvent("exam.code.compile.started", {
      userId: options.metadata?.userId ?? null,
      examId: options.metadata?.examId ?? null,
      questionId: options.metadata?.questionId ?? null,
      attemptId: options.metadata?.attemptId ?? null,
      language: options.language,
      testCaseCount: options.testCases.length,
    });

    const compileResult = await executeProcess(executionPlan.compileCommand, {
      cwd: tempDir,
      timeoutMs: COMPILATION_TIMEOUT_MS,
    });

    logApiEvent("exam.code.compile.completed", {
      userId: options.metadata?.userId ?? null,
      examId: options.metadata?.examId ?? null,
      questionId: options.metadata?.questionId ?? null,
      attemptId: options.metadata?.attemptId ?? null,
      language: options.language,
      timedOut: compileResult.timedOut,
      exitCode: compileResult.exitCode ?? null,
      durationMs: compileResult.durationMs,
      success: !compileResult.timedOut && compileResult.exitCode === 0,
    });

    if (compileResult.timedOut || compileResult.exitCode !== 0) {
      return {
        status: "COMPILE_ERROR",
        executionTimeMs: null,
        memoryUsedKb: null,
        passedCount: 0,
        totalCount: options.testCases.length,
        stdErr: compileResult.timedOut
          ? `Compilation exceeded ${COMPILATION_TIMEOUT_MS}ms.`
          : truncateProcessOutput(compileResult.stderr || compileResult.stdout),
        testCaseResults: [] satisfies StudentRunTestCaseResult[],
        storedTestCaseResults: [] satisfies StoredTestCaseResult[],
      } satisfies StudentRunExecutionResult;
    }

    const testCaseResults: StudentRunTestCaseResult[] = [];
    const storedTestCaseResults: StoredTestCaseResult[] = [];
    let aggregateStatus: ExecutionSubmissionStatus = "ACCEPTED";
    let highestExecutionTimeMs: number | null = null;
    let stdErr: string | null = null;

    for (const testCase of options.testCases) {
      const executionInput = formatExecutionInputForCompetitiveProgramming(
        testCase.input,
      );
      const runResult = await executeProcess(executionPlan.runCommand, {
        cwd: tempDir,
        input: executionInput,
        timeoutMs: Math.max(options.timeLimitMs, 250),
      });

      highestExecutionTimeMs = Math.max(
        highestExecutionTimeMs ?? 0,
        runResult.durationMs,
      );

      const actualOutput = normalizeExecutionOutput(runResult.stdout);
      const expectedOutput = normalizeExecutionOutput(testCase.expectedOutput);
      const timedOut = runResult.timedOut;
      const runtimeFailed = !timedOut && runResult.exitCode !== 0;
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

      if (!stdErr && runResult.stderr.trim()) {
        stdErr = truncateProcessOutput(runResult.stderr.trim());
      }

      const caseError = timedOut
        ? `Execution exceeded ${options.timeLimitMs}ms.`
        : runtimeFailed
          ? truncateProcessOutput(
              runResult.stderr.trim() ||
                `Process exited with code ${runResult.exitCode}.`,
            )
          : null;

      testCaseResults.push({
        testCaseId: testCase.id,
        passed,
        input: executionInput,
        expectedOutput: testCase.expectedOutput,
        actualOutput,
        executionTimeMs: runResult.durationMs,
        memoryUsedKb: null,
        error: caseError,
      });
      storedTestCaseResults.push({
        testCaseId: testCase.id,
        passed,
        actualOutput,
        executionTimeMs: runResult.durationMs,
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
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function upsertStudentSubmissionRecord(options: {
  attemptId: string;
  userId: string;
  examId: string;
  questionId: string;
  code: string;
  language: StudentProgrammingLanguage;
  submittedAt: Date;
  status: "PENDING" | ExecutionSubmissionStatus;
  executionTimeMs: number | null;
  memoryUsedKb: number | null;
  passedCount: number;
  totalCount: number;
  stdErr: string | null;
  testCaseResults: StoredTestCaseResult[];
}) {
  return prisma.$transaction(async (tx) => {
    const existingDraft = await tx.submission.findFirst({
      where: {
        attemptId: options.attemptId,
        questionId: options.questionId,
        userId: options.userId,
      },
      orderBy: { submittedAt: "desc" },
      select: { id: true },
    });

    const submission = existingDraft
      ? await tx.submission.update({
          where: { id: existingDraft.id },
          data: {
            code: options.code,
            language: options.language,
            submittedAt: options.submittedAt,
            status: options.status,
            executionTimeMs: options.executionTimeMs,
            memoryUsedKb: options.memoryUsedKb,
            passedCount: options.passedCount,
            totalCount: options.totalCount,
            stdErr: options.stdErr,
          },
        })
      : await tx.submission.create({
          data: {
            attemptId: options.attemptId,
            userId: options.userId,
            examId: options.examId,
            questionId: options.questionId,
            code: options.code,
            language: options.language,
            submittedAt: options.submittedAt,
            status: options.status,
            executionTimeMs: options.executionTimeMs,
            memoryUsedKb: options.memoryUsedKb,
            passedCount: options.passedCount,
            totalCount: options.totalCount,
            stdErr: options.stdErr,
          },
        });

    await tx.submissionTestCaseResult.deleteMany({
      where: { submissionId: submission.id },
    });

    if (options.testCaseResults.length > 0) {
      await tx.submissionTestCaseResult.createMany({
        data: options.testCaseResults.map((result) => ({
          submissionId: submission.id,
          testCaseId: result.testCaseId,
          passed: result.passed,
          actualOutput: result.actualOutput,
          executionTimeMs: result.executionTimeMs,
          memoryUsedKb: result.memoryUsedKb,
        })),
      });
    }

    return submission;
  });
}

const app: Express = express();
const PORT = process.env.PORT ?? 4000;

// ─── Global Middleware ──────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:3000" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Health Check ───────────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Public department/batch endpoints (for signup dropdowns) ──────────────
app.get("/api/departments", async (_req: Request, res: Response) => {
  try {
    const departments = await prisma.department.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    });
    return res.json(departments);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch departments" });
  }
});

app.get("/api/batches", async (_req: Request, res: Response) => {
  const { departmentId } = _req.query;
  try {
    const batches = await prisma.batch.findMany({
      where: {
        isActive: true,
        ...(departmentId ? { departmentId: String(departmentId) } : {}),
      },
      select: {
        id: true,
        label: true,
        yearOfStudy: true,
        intakeYear: true,
        departmentId: true,
      },
      orderBy: [{ intakeYear: "desc" }, { yearOfStudy: "asc" }],
    });
    return res.json(batches);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch batches" });
  }
});

// ─── API Routes ──────────────────────────────────────────────────────────────
app.get(
  "/api/users",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await prisma.user.findMany({
        omit: { password: true },
      });
      res.json(users);
    } catch (error) {
      next(error);
    }
  },
);

app.post("/api/signup", async (_req: Request, res: Response) => {
  const result = UserSchema.safeParse(_req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.flatten().fieldErrors });
  }

  const { email, password, name, departmentId, batchId, rollNumber } =
    result.data;

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Validate departmentId if provided
    if (departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: departmentId },
      });
      if (!dept) {
        return res.status(400).json({ error: "Department not found" });
      }
    }

    // Validate batchId if provided and ensure it belongs to the department
    if (batchId) {
      const batch = await prisma.batch.findUnique({
        where: { id: batchId },
      });
      if (!batch) {
        return res.status(400).json({ error: "Batch not found" });
      }
      if (departmentId && batch.departmentId !== departmentId) {
        return res.status(400).json({
          error: "Batch does not belong to the selected department",
        });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: "STUDENT",
        facultyApproved: true,
        departmentId: departmentId ?? null,
        batchId: batchId ?? null,
        rollNumber: rollNumber ?? null,
      },
      omit: { password: true },
    });

    res.status(201).json(user);
  } catch (error: any) {
    if (error.code === "P2002") {
      const field = error.meta?.target?.includes("rollNumber")
        ? "roll number"
        : "email";
      return res
        .status(409)
        .json({ error: `A user with that ${field} already exists` });
    }
    res.status(500).json({ error: "Signup failed" });
  }
});

app.post("/api/signup/faculty", async (_req: Request, res: Response) => {
  const result = FacultySignupSchema.safeParse(_req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.flatten().fieldErrors });
  }

  const { email, password, name } = result.data;

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: "FACULTY",
        facultyApproved: false,
        departmentId: null,
        batchId: null,
        rollNumber: null,
      },
      omit: { password: true },
    });

    logApiEvent("auth.faculty_signup.created", {
      userId: user.id,
      email: user.email,
    });

    res.status(201).json(user);
  } catch (error: any) {
    if (error.code === "P2002") {
      return res
        .status(409)
        .json({ error: "A user with that email already exists" });
    }
    res.status(500).json({ error: "Faculty signup failed" });
  }
});

app.post("/api/signin", async (_req: Request, res: Response) => {
  const { email, password, expectedRole } = _req.body as {
    email?: string;
    password?: string;
    expectedRole?: unknown;
  };

  if (!email || !password) {
    logApiEvent("auth.signin.validation_failed", {
      reason: "missing_credentials",
    });
    return res.status(400).json({ error: "email and password are required" });
  }

  if (expectedRole !== undefined && !isPortalRole(expectedRole)) {
    logApiEvent("auth.signin.validation_failed", {
      reason: "invalid_expected_role",
    });
    return res.status(400).json({ error: "Invalid login role requested" });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      logApiEvent("auth.signin.denied", {
        reason: "user_not_found",
        email,
      });
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      logApiEvent("auth.signin.denied", {
        reason: "invalid_password",
        userId: user.id,
      });
      return res.status(400).json({ error: "Invalid credentials" });
    }

    if (user.role === "FACULTY" && !user.facultyApproved) {
      logApiEvent("auth.signin.denied", {
        reason: "faculty_pending_approval",
        userId: user.id,
      });
      return res.status(403).json({
        error: FACULTY_PENDING_MSG,
        code: "FACULTY_PENDING_APPROVAL",
      });
    }

    if (expectedRole && user.role !== expectedRole) {
      const actualPortal = portalLabelByRole[user.role as PortalRole];
      const guidance =
        user.role === "ADMIN"
          ? "Please use the admin login flow."
          : `Please use the ${actualPortal} login page.`;

      logApiEvent("auth.signin.role_mismatch", {
        userId: user.id,
        expectedRole,
        actualRole: user.role,
      });
      return res.status(403).json({
        error: `This account does not have ${portalLabelByRole[expectedRole]} access. ${guidance}`,
      });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });

    const { password: _, ...safeUser } = user;
    logApiEvent("auth.signin.success", {
      userId: user.id,
      role: user.role,
      expectedRole: isPortalRole(expectedRole) ? expectedRole : null,
    });
    res.json({ token, user: safeUser });
  } catch (error) {
    console.error("[api] auth.signin.failed", error);
    res.status(500).json({ error: "Signin failed" });
  }
});

app.get("/api/me", authMiddleware, async (_req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: _req.userId! } });
    if (!user) {
      logApiEvent("auth.me.not_found", {
        userId: _req.userId ?? null,
      });
      return res.status(404).json({ error: "User not found" });
    }
    if (user.role === "FACULTY" && !user.facultyApproved) {
      return res.status(403).json({
        error: FACULTY_PENDING_MSG,
        code: "FACULTY_PENDING_APPROVAL",
      });
    }
    const { password: _, ...safeUser } = user;
    logApiEvent("auth.me.success", {
      userId: user.id,
      role: user.role,
    });
    res.json(safeUser);
  } catch (error) {
    console.error("[api] auth.me.failed", error);
    res.status(500).json({ error: "Failed to get user" });
  }
});

app.post(
  "/api/admin/departments",
  authMiddleware,
  async (_req: Request, res: Response) => {
    const admin = await prisma.user.findUnique({ where: { id: _req.userId! } });
    if (!admin || admin.role !== "ADMIN") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const result = DepartmentSchema.safeParse(_req.body);
    if (!result.success) {
      return res
        .status(400)
        .json({ errors: result.error.flatten().fieldErrors });
    }

    const { name, code, isActive } = result.data;

    try {
      const department = await prisma.department.create({
        data: { name, code, isActive },
      });
      return res.status(201).json(department);
    } catch (error: any) {
      if (error.code === "P2002") {
        const field = error.meta?.target?.includes("code") ? "code" : "name";
        return res
          .status(409)
          .json({ error: `A department with that ${field} already exists` });
      }
      return res.status(500).json({ error: "Failed to create department" });
    }
  },
);

app.get(
  "/api/admin/departments",
  authMiddleware,
  async (_req: Request, res: Response) => {
    const admin = await prisma.user.findUnique({ where: { id: _req.userId! } });
    if (!admin || admin.role !== "ADMIN") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    try {
      const departments = await prisma.department.findMany({
        include: {
          _count: { select: { batches: true, users: true } },
        },
        orderBy: { name: "asc" },
      });
      return res.json(departments);
    } catch (error) {
      return res.status(500).json({ error: "Failed to get departments" });
    }
  },
);

app.post(
  "/api/admin/batches",
  authMiddleware,
  async (_req: Request, res: Response) => {
    const admin = await prisma.user.findUnique({ where: { id: _req.userId! } });
    if (!admin || admin.role !== "ADMIN") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const result = BatchSchema.safeParse(_req.body);
    if (!result.success) {
      return res
        .status(400)
        .json({ errors: result.error.flatten().fieldErrors });
    }

    const { departmentId, yearOfStudy, intakeYear, label, isActive } =
      result.data;

    try {
      // Verify the department exists before creating the batch
      const department = await prisma.department.findUnique({
        where: { id: departmentId },
      });
      if (!department) {
        return res.status(404).json({ error: "Department not found" });
      }

      const batch = await prisma.batch.create({
        data: { departmentId, yearOfStudy, intakeYear, label, isActive },
        include: {
          department: { select: { id: true, name: true, code: true } },
        },
      });
      return res.status(201).json(batch);
    } catch (error: any) {
      if (error.code === "P2002") {
        return res.status(409).json({
          error:
            "A batch for this department, year of study, and intake year already exists",
        });
      }
      return res.status(500).json({ error: "Failed to create batch" });
    }
  },
);

app.get(
  "/api/admin/batches",
  authMiddleware,
  async (_req: Request, res: Response) => {
    const admin = await prisma.user.findUnique({ where: { id: _req.userId! } });
    if (!admin || admin.role !== "ADMIN") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Optional ?departmentId= filter
    const { departmentId } = _req.query;

    try {
      const batches = await prisma.batch.findMany({
        where: departmentId
          ? { departmentId: String(departmentId) }
          : undefined,
        include: {
          department: { select: { id: true, name: true, code: true } },
          _count: { select: { users: true } },
        },
        orderBy: [{ intakeYear: "desc" }, { yearOfStudy: "asc" }],
      });
      return res.json(batches);
    } catch (error) {
      return res.status(500).json({ error: "Failed to get batches" });
    }
  },
);

app.patch(
  "/api/admin/users/:id",
  authMiddleware,
  async (_req: Request, res: Response) => {
    // 1. ADMIN only
    const admin = await prisma.user.findUnique({ where: { id: _req.userId! } });
    if (!admin || admin.role !== "ADMIN") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // 2. Validate body
    const result = AdminUpdateUserSchema.safeParse(_req.body);
    if (!result.success) {
      return res
        .status(400)
        .json({ errors: result.error.flatten().fieldErrors });
    }

    const { role, departmentId, batchId, rollNumber, facultyApproved } =
      result.data;

    // 3. Target user must exist
    const targetUser = await prisma.user.findUnique({
      where: { id: _req.params.id },
    });
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    try {
      // 4. If a departmentId is being set, verify it exists
      if (departmentId) {
        const dept = await prisma.department.findUnique({
          where: { id: departmentId },
        });
        if (!dept) {
          return res.status(404).json({ error: "Department not found" });
        }
      }

      // 5. If a batchId is being set, verify it exists AND belongs to the
      //    departmentId that will be in effect after this update
      if (batchId) {
        const batch = await prisma.batch.findUnique({
          where: { id: batchId },
        });
        if (!batch) {
          return res.status(404).json({ error: "Batch not found" });
        }

        const effectiveDeptId = departmentId ?? targetUser.departmentId;
        if (batch.departmentId !== effectiveDeptId) {
          return res.status(400).json({
            error: "Batch does not belong to the specified department",
          });
        }
      }

      // 6. Build the update payload — only include fields that were sent
      //    (undefined = omit from update, null = explicitly clear the field)
      const data: Record<string, unknown> = {};
      if (role !== undefined) data.role = role;
      if (departmentId !== undefined) data.departmentId = departmentId ?? null;
      if (batchId !== undefined) data.batchId = batchId ?? null;
      if (rollNumber !== undefined) data.rollNumber = rollNumber ?? null;
      if (facultyApproved !== undefined) data.facultyApproved = facultyApproved;

      // 7. If role is changing to FACULTY/ADMIN, clear student-only fields
      if (role === "FACULTY" || role === "ADMIN") {
        data.departmentId = null;
        data.batchId = null;
        data.rollNumber = null;
      }

      // Promoting a user to FACULTY via admin UI approves them by default unless
      // facultyApproved is explicitly set in the same request.
      if (role === "FACULTY" && facultyApproved === undefined) {
        data.facultyApproved = true;
      }

      const updatedUser = await prisma.user.update({
        where: { id: _req.params.id },
        data,
        omit: { password: true },
        include: {
          department: { select: { id: true, name: true, code: true } },
          batch: {
            select: {
              id: true,
              label: true,
              yearOfStudy: true,
              intakeYear: true,
            },
          },
        },
      });

      return res.json(updatedUser);
    } catch (error: any) {
      if (error.code === "P2002") {
        return res
          .status(409)
          .json({ error: "A user with that roll number already exists" });
      }
      return res.status(500).json({ error: "Failed to update user" });
    }
  },
);

app.post(
  "/api/exams/:id/questions",
  authMiddleware,
  async (_req: Request, res: Response) => {
    const faculty = await prisma.user.findUnique({
      where: { id: _req.userId! },
    });
    if (
      rejectUnapprovedFaculty(
        res,
        faculty,
        "Only faculty members can add questions",
      )
    ) {
      return;
    }

    // 2. Validate body
    const result = QuestionSchema.safeParse(_req.body);
    if (!result.success) {
      return res
        .status(400)
        .json({ errors: result.error.flatten().fieldErrors });
    }

    const {
      title,
      description,
      marks,
      timeLimitMs,
      memoryLimitKb,
      orderIndex,
    } = result.data;

    try {
      // 3. Exam must exist, not be soft-deleted, and belong to this faculty
      const exam = await prisma.exam.findUnique({
        where: { id: _req.params.id },
      });

      if (!exam || exam.deletedAt !== null) {
        return res.status(404).json({ error: "Exam not found" });
      }

      if (exam.creatorId !== faculty!.id) {
        return res
          .status(403)
          .json({ error: "You are not the creator of this exam" });
      }

      // 4. Cannot add questions to an already-active (live) exam
      if (exam.isActive) {
        return res
          .status(400)
          .json({ error: "Cannot add questions to an active exam" });
      }

      // 5. Auto-calculate orderIndex if not provided —
      //    count non-deleted questions already on this exam and place at the end
      const resolvedOrderIndex =
        orderIndex ??
        (await prisma.question.count({
          where: { examId: exam.id, deletedAt: null },
        })) + 1;

      const question = await prisma.question.create({
        data: {
          examId: exam.id,
          title,
          description,
          marks,
          timeLimitMs,
          memoryLimitKb,
          orderIndex: resolvedOrderIndex,
        },
      });

      return res.status(201).json(question);
    } catch (error) {
      return res.status(500).json({ error: "Failed to add question" });
    }
  },
);

app.post(
  "/api/createExam",
  authMiddleware,
  async (_req: Request, res: Response) => {
    // 1. Validate input
    const result = ExamSchema.safeParse(_req.body);
    if (!result.success) {
      return res
        .status(400)
        .json({ errors: result.error.flatten().fieldErrors });
    }

    const {
      title,
      description,
      startTime,
      endTime,
      durationMin,
      batchId,
      isActive,
      accessCode,
    } = result.data;

    try {
      // 2. Verify the authenticated user is FACULTY
      const creator = await prisma.user.findUnique({
        where: { id: _req.userId! },
      });

      if (
        rejectUnapprovedFaculty(
          res,
          creator,
          "Only faculty members can create exams",
        )
      ) {
        return;
      }

      const batch = await prisma.batch.findUnique({
        where: { id: batchId },
      });
      if (!batch || !batch.isActive) {
        return res
          .status(400)
          .json({ error: "Selected batch is not available" });
      }

      const resolvedEndTime =
        endTime ?? calculateExamEndTime(startTime, durationMin);

      // 3. Create the exam with all fields
      const exam = await prisma.exam.create({
        data: {
          title,
          description,
          startTime,
          endTime: resolvedEndTime,
          durationMin,
          isActive,
          accessCode,
          creatorId: _req.userId!,
          eligibilities: {
            create: {
              batchId,
            },
          },
        },
      });

      res.status(201).json(exam);
    } catch (error) {
      res.status(500).json({ error: "Failed to create exam" });
    }
  },
);

app.get(
  "/api/getExams",
  authMiddleware,
  async (_req: Request, res: Response) => {
    try {
      const now = new Date();
      await deactivateExpiredExams(now);

      const user = await prisma.user.findUnique({
        where: { id: _req.userId! },
      });

      if (!user) {
        logApiEvent("exam.list.user_not_found", {
          userId: _req.userId ?? null,
        });
        return res.status(404).json({ error: "User not found" });
      }

      // ── FACULTY: exams they created ──────────────────────────────────────
      if (user.role === "FACULTY") {
        if (!user.facultyApproved) {
          return res.status(403).json({
            error: FACULTY_PENDING_MSG,
            code: "FACULTY_PENDING_APPROVAL",
          });
        }
        const exams = await prisma.exam.findMany({
          where: {
            creatorId: user.id,
            deletedAt: null,
          },
          include: {
            eligibilities: {
              select: {
                id: true,
                batchId: true,
                batch: {
                  select: {
                    id: true,
                    label: true,
                    yearOfStudy: true,
                    intakeYear: true,
                    departmentId: true,
                    department: {
                      select: {
                        id: true,
                        name: true,
                        code: true,
                      },
                    },
                  },
                },
              },
            },
            _count: { select: { questions: true, attempts: true } },
          },
          orderBy: { startTime: "desc" },
        });
        logApiEvent("exam.list.success", {
          userId: user.id,
          role: user.role,
          examCount: exams.length,
        });
        return res.json(exams);
      }

      // ── ADMIN: every exam ────────────────────────────────────────────────
      if (user.role === "ADMIN") {
        const exams = await prisma.exam.findMany({
          where: { deletedAt: null },
          include: {
            creator: { select: { id: true, name: true, email: true } },
            _count: { select: { questions: true, attempts: true } },
          },
          orderBy: { startTime: "desc" },
        });
        logApiEvent("exam.list.success", {
          userId: user.id,
          role: user.role,
          examCount: exams.length,
        });
        return res.json(exams);
      }

      // ── STUDENT: active exams open to everyone OR matching eligibility ───
      //
      // Exams with no eligibility rows are treated as open to all students.
      // If eligibility rows exist, they are OR-ed across the student's batch
      // and department.
      const eligibilityFilter = [];
      if (user.batchId) eligibilityFilter.push({ batchId: user.batchId });
      if (user.departmentId) {
        eligibilityFilter.push({ departmentId: user.departmentId });
      }

      const exams = await prisma.exam.findMany({
        where: {
          deletedAt: null,
          isActive: true,
          endTime: { gt: now },
          OR: [
            { eligibilities: { none: {} } },
            ...(eligibilityFilter.length > 0
              ? [
                  {
                    eligibilities: {
                      some: { OR: eligibilityFilter },
                    },
                  },
                ]
              : []),
          ],
        },
        include: {
          _count: { select: { questions: true } },
          // Attach this student's most-recent attempt so the UI can show status
          attempts: {
            where: { userId: user.id },
            orderBy: { retakeNumber: "desc" },
            take: 1,
            select: {
              id: true,
              status: true,
              score: true,
              startedAt: true,
              completedAt: true,
              retakeNumber: true,
            },
          },
        },
        orderBy: { startTime: "asc" },
      });

      logApiEvent("exam.list.success", {
        userId: user.id,
        role: user.role,
        examCount: exams.length,
        eligibilityFilters: eligibilityFilter.length,
      });
      return res.json(exams);
    } catch (error) {
      console.error("[api] exam.list.failed", error);
      res.status(500).json({ error: "Failed to fetch exams" });
    }
  },
);

app.post(
  "/api/student/exams/:id/enter",
  authMiddleware,
  async (_req: Request, res: Response) => {
    try {
      const now = new Date();
      await deactivateExpiredExams(now);

      const student = await prisma.user.findUnique({
        where: { id: _req.userId! },
      });

      if (!student || student.role !== "STUDENT") {
        logApiEvent("exam.enter.denied", {
          userId: _req.userId ?? null,
          examId: _req.params.id ?? null,
          reason: "non_student",
        });
        return res
          .status(403)
          .json({ error: "Only students can enter an exam room" });
      }

      const exam = await prisma.exam.findUnique({
        where: { id: _req.params.id },
        select: {
          id: true,
          title: true,
          description: true,
          startTime: true,
          endTime: true,
          durationMin: true,
          isActive: true,
          deletedAt: true,
          eligibilities: {
            select: {
              batchId: true,
              departmentId: true,
            },
          },
        },
      });

      if (!exam || exam.deletedAt !== null) {
        logApiEvent("exam.enter.denied", {
          userId: student.id,
          examId: _req.params.id ?? null,
          reason: "exam_not_found",
        });
        return res.status(404).json({ error: "Exam not found" });
      }

      const isEligible =
        exam.eligibilities.length === 0 ||
        exam.eligibilities.some(
          (eligibility) =>
            (eligibility.batchId !== null &&
              eligibility.batchId === student.batchId) ||
            (eligibility.departmentId !== null &&
              eligibility.departmentId === student.departmentId),
        );

      if (!isEligible) {
        logApiEvent("exam.enter.denied", {
          userId: student.id,
          examId: exam.id,
          reason: "ineligible",
        });
        return res
          .status(403)
          .json({ error: "You are not eligible to enter this exam room" });
      }

      if (!exam.isActive) {
        logApiEvent("exam.enter.denied", {
          userId: student.id,
          examId: exam.id,
          reason: "not_active",
        });
        return res
          .status(400)
          .json({ error: "This exam is not live right now" });
      }

      if (exam.startTime > now) {
        logApiEvent("exam.enter.denied", {
          userId: student.id,
          examId: exam.id,
          reason: "not_started",
        });
        return res.status(400).json({ error: "This exam has not started yet" });
      }

      if (exam.endTime <= now) {
        logApiEvent("exam.enter.denied", {
          userId: student.id,
          examId: exam.id,
          reason: "ended",
        });
        return res.status(400).json({ error: "This exam has already ended" });
      }

      const latestAttempt = await prisma.examAttempt.findFirst({
        where: {
          userId: student.id,
          examId: exam.id,
        },
        orderBy: { retakeNumber: "desc" },
      });

      if (latestAttempt?.status === "COMPLETED") {
        logApiEvent("exam.enter.denied", {
          userId: student.id,
          examId: exam.id,
          reason: "already_submitted",
          attemptId: latestAttempt.id,
        });
        return res
          .status(400)
          .json({ error: "You have already submitted this exam" });
      }

      if (latestAttempt?.status === "DISQUALIFIED") {
        logApiEvent("exam.enter.denied", {
          userId: student.id,
          examId: exam.id,
          reason: "disqualified",
          attemptId: latestAttempt.id,
        });
        return res
          .status(403)
          .json({ error: "Your exam attempt has been disqualified" });
      }

      const ipAddress = typeof _req.ip === "string" ? _req.ip : undefined;

      const attempt = latestAttempt
        ? latestAttempt.status === "IN_PROGRESS"
          ? latestAttempt
          : await prisma.examAttempt.update({
              where: { id: latestAttempt.id },
              data: {
                status: "IN_PROGRESS",
                startedAt: latestAttempt.startedAt ?? now,
                ipAddress: latestAttempt.ipAddress ?? ipAddress,
              },
            })
        : await prisma.examAttempt.create({
            data: {
              userId: student.id,
              examId: exam.id,
              status: "IN_PROGRESS",
              startedAt: now,
              ipAddress,
            },
          });

      const questions = await prisma.question.findMany({
        where: {
          examId: exam.id,
          deletedAt: null,
        },
        orderBy: { orderIndex: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          marks: true,
          orderIndex: true,
          timeLimitMs: true,
          memoryLimitKb: true,
          submissions: {
            where: {
              attemptId: attempt.id,
              userId: student.id,
            },
            orderBy: { submittedAt: "desc" },
            take: 1,
            select: {
              id: true,
              code: true,
              language: true,
              submittedAt: true,
            },
          },
        },
      });

      logApiEvent("exam.enter.success", {
        userId: student.id,
        examId: exam.id,
        attemptId: attempt.id,
        questionCount: questions.length,
      });
      return res.json({
        serverTime: now.toISOString(),
        exam: {
          id: exam.id,
          title: exam.title,
          description: exam.description,
          startTime: exam.startTime,
          endTime: exam.endTime,
          durationMin: exam.durationMin,
          questions: questions.map((question) => ({
            id: question.id,
            title: question.title,
            description: question.description,
            marks: question.marks,
            orderIndex: question.orderIndex,
            timeLimitMs: question.timeLimitMs,
            memoryLimitKb: question.memoryLimitKb,
            draft: question.submissions[0] ?? null,
          })),
        },
        attempt: {
          id: attempt.id,
          status: attempt.status,
          startedAt: attempt.startedAt,
          completedAt: attempt.completedAt,
          retakeNumber: attempt.retakeNumber,
        },
      });
    } catch (error) {
      console.error("[api] exam.enter.failed", error);
      return res.status(500).json({ error: "Failed to enter exam room" });
    }
  },
);

app.put(
  "/api/student/exams/:examId/questions/:questionId/draft",
  authMiddleware,
  async (_req: Request, res: Response) => {
    try {
      const { examId, questionId } = _req.params;
      const { code, language } = _req.body as {
        code?: unknown;
        language?: unknown;
      };

      if (!examId || !questionId) {
        return res
          .status(400)
          .json({ error: "examId and questionId are required" });
      }

      if (typeof code !== "string") {
        return res.status(400).json({ error: "code must be a string" });
      }

      if (!isStudentProgrammingLanguage(language)) {
        return res.status(400).json({
          error: "language must be one of C, C++, Python, or Java",
        });
      }

      const now = new Date();
      await deactivateExpiredExams(now);

      const student = await prisma.user.findUnique({
        where: { id: _req.userId! },
      });
      if (!student || student.role !== "STUDENT") {
        return res
          .status(403)
          .json({ error: "Only students can save exam drafts" });
      }

      const exam = await prisma.exam.findUnique({
        where: { id: examId },
        select: {
          id: true,
          startTime: true,
          endTime: true,
          isActive: true,
          deletedAt: true,
        },
      });

      if (!exam || exam.deletedAt !== null) {
        return res.status(404).json({ error: "Exam not found" });
      }

      if (!exam.isActive || exam.startTime > now || exam.endTime <= now) {
        return res
          .status(400)
          .json({ error: "This exam room is not accepting code drafts now" });
      }

      const question = await prisma.question.findFirst({
        where: {
          id: questionId,
          examId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!question) {
        return res.status(404).json({ error: "Question not found" });
      }

      const attempt = await prisma.examAttempt.findFirst({
        where: {
          userId: student.id,
          examId,
        },
        orderBy: { retakeNumber: "desc" },
      });

      if (!attempt || attempt.status !== "IN_PROGRESS") {
        return res
          .status(400)
          .json({ error: "Enter the exam room before saving code drafts" });
      }

      const draft = await upsertStudentSubmissionRecord({
        attemptId: attempt.id,
        userId: student.id,
        examId,
        questionId,
        code,
        language,
        submittedAt: now,
        status: "PENDING",
        executionTimeMs: null,
        memoryUsedKb: null,
        passedCount: 0,
        totalCount: 0,
        stdErr: null,
        testCaseResults: [],
      });

      return res.json({
        id: draft.id,
        code: draft.code,
        language: draft.language,
        submittedAt: draft.submittedAt,
      });
    } catch (error) {
      return res.status(500).json({ error: "Failed to save code draft" });
    }
  },
);

app.post(
  "/api/student/exams/:examId/violations",
  authMiddleware,
  async (_req: Request, res: Response) => {
    try {
      const { examId } = _req.params;
      const { type, details } = _req.body;

      if (!examId) {
        return res.status(400).json({ error: "examId is required" });
      }

      const VALID_VIOLATION_TYPES = [
        "TAB_SWITCH",
        "FULLSCREEN_EXIT",
        "COPY_PASTE",
        "MULTIPLE_FACES",
        "NO_FACE",
        "OTHER",
      ];

      if (!type || !VALID_VIOLATION_TYPES.includes(type)) {
        return res.status(400).json({ error: "Invalid violation type" });
      }

      const student = await prisma.user.findUnique({
        where: { id: _req.userId! },
      });
      if (!student || student.role !== "STUDENT") {
        return res
          .status(403)
          .json({ error: "Only students can report violations" });
      }

      const attempt = await prisma.examAttempt.findFirst({
        where: {
          userId: student.id,
          examId,
          status: "IN_PROGRESS",
        },
        orderBy: { retakeNumber: "desc" },
      });

      if (!attempt) {
        return res
          .status(404)
          .json({ error: "No active IN_PROGRESS attempt found" });
      }

      const twoSecondsAgo = new Date(Date.now() - 2000);
      const recentLog = await prisma.proctoringLog.findFirst({
        where: {
          attemptId: attempt.id,
          violationType: type as any,
          timestamp: { gte: twoSecondsAgo },
        },
      });

      if (recentLog) {
        return res.status(429).json({
          error: "Rate limit: Duplicate violation type within 2 seconds",
        });
      }

      const log = await prisma.proctoringLog.create({
        data: {
          attemptId: attempt.id,
          violationType: type as any,
          details: details ? String(details).slice(0, 500) : null,
        },
      });

      let totalStrikes = 0;
      let isDisqualified = false;

      if (type === "TAB_SWITCH" || type === "FULLSCREEN_EXIT") {
        totalStrikes = await prisma.proctoringLog.count({
          where: {
            attemptId: attempt.id,
            violationType: {
              in: ["TAB_SWITCH", "FULLSCREEN_EXIT"],
            },
          },
        });

        if (totalStrikes >= 3) {
          await prisma.examAttempt.update({
            where: { id: attempt.id },
            data: {
              status: "DISQUALIFIED",
              completedAt: new Date(),
            },
          });
          isDisqualified = true;
        }
      }

      logApiEvent("exam.violation.recorded", {
        userId: student.id,
        examId,
        attemptId: attempt.id,
        type,
        totalStrikes,
      });

      return res.json({
        id: log.id,
        timestamp: log.timestamp,
        totalStrikes,
        isDisqualified,
      });
    } catch (error) {
      console.error("[api] exam.violation.failed", error);
      return res.status(500).json({ error: "Failed to record violation" });
    }
  },
);

app.post(
  "/api/student/exams/:examId/questions/:questionId/run",
  authMiddleware,
  async (_req: Request, res: Response) => {
    try {
      const { examId, questionId } = _req.params;
      const { code, language } = _req.body as {
        code?: unknown;
        language?: unknown;
      };

      if (!examId || !questionId) {
        return res
          .status(400)
          .json({ error: "examId and questionId are required" });
      }

      if (typeof code !== "string") {
        return res.status(400).json({ error: "code must be a string" });
      }

      if (!isStudentProgrammingLanguage(language)) {
        return res.status(400).json({
          error: "language must be one of C, C++, Python, or Java",
        });
      }

      const now = new Date();
      await deactivateExpiredExams(now);

      const student = await prisma.user.findUnique({
        where: { id: _req.userId! },
      });
      if (!student || student.role !== "STUDENT") {
        return res
          .status(403)
          .json({ error: "Only students can run code from the exam room" });
      }

      const exam = await prisma.exam.findUnique({
        where: { id: examId },
        select: {
          id: true,
          startTime: true,
          endTime: true,
          isActive: true,
          deletedAt: true,
        },
      });

      if (!exam || exam.deletedAt !== null) {
        return res.status(404).json({ error: "Exam not found" });
      }

      if (!exam.isActive || exam.startTime > now || exam.endTime <= now) {
        return res
          .status(400)
          .json({ error: "This exam room is not accepting code runs now" });
      }

      const question = await prisma.question.findFirst({
        where: {
          id: questionId,
          examId,
          deletedAt: null,
        },
        select: {
          id: true,
          timeLimitMs: true,
          memoryLimitKb: true,
          testCases: {
            where: { isHidden: false },
            orderBy: { id: "asc" },
            select: {
              id: true,
              input: true,
              expectedOutput: true,
              isHidden: true,
            },
          },
        },
      });

      if (!question) {
        return res.status(404).json({ error: "Question not found" });
      }

      if (question.testCases.length === 0) {
        return res.status(400).json({
          error:
            "This question has no visible test cases configured for running code",
        });
      }

      const attempt = await prisma.examAttempt.findFirst({
        where: {
          userId: student.id,
          examId,
        },
        orderBy: { retakeNumber: "desc" },
      });

      if (!attempt || attempt.status !== "IN_PROGRESS") {
        return res
          .status(400)
          .json({ error: "Enter the exam room before running code" });
      }

      const executionResult = await executeStudentCodeAgainstVisibleCases({
        code,
        language,
        timeLimitMs: question.timeLimitMs,
        testCases: question.testCases,
        metadata: {
          userId: student.id,
          examId,
          questionId,
          attemptId: attempt.id,
        },
      });

      const submission = await upsertStudentSubmissionRecord({
        attemptId: attempt.id,
        userId: student.id,
        examId,
        questionId,
        code,
        language,
        submittedAt: now,
        status: executionResult.status,
        executionTimeMs: executionResult.executionTimeMs,
        memoryUsedKb: executionResult.memoryUsedKb,
        passedCount: executionResult.passedCount,
        totalCount: executionResult.totalCount,
        stdErr: executionResult.stdErr,
        testCaseResults: executionResult.storedTestCaseResults,
      });

      logApiEvent("exam.code.run.completed", {
        userId: student.id,
        examId,
        questionId,
        attemptId: attempt.id,
        submissionId: submission.id,
        language,
        status: executionResult.status,
        passedCount: executionResult.passedCount,
        totalCount: executionResult.totalCount,
      });

      return res.json({
        submissionId: submission.id,
        status: executionResult.status,
        passedCount: executionResult.passedCount,
        totalCount: executionResult.totalCount,
        executionTimeMs: executionResult.executionTimeMs,
        memoryUsedKb: executionResult.memoryUsedKb,
        stdErr: executionResult.stdErr,
        submittedAt: submission.submittedAt,
        testCaseResults: executionResult.testCaseResults,
      });
    } catch (error) {
      return res.status(500).json({ error: "Failed to run code" });
    }
  },
);

app.post(
  "/api/student/exams/:examId/submit",
  authMiddleware,
  async (_req: Request, res: Response) => {
    try {
      const { examId } = _req.params;
      if (!examId) {
        return res.status(400).json({ error: "examId is required" });
      }

      const now = new Date();
      await deactivateExpiredExams(now);

      const student = await prisma.user.findUnique({
        where: { id: _req.userId! },
      });
      if (!student || student.role !== "STUDENT") {
        return res
          .status(403)
          .json({ error: "Only students can submit an exam" });
      }

      const exam = await prisma.exam.findFirst({
        where: { id: examId, deletedAt: null },
        select: {
          id: true,
          startTime: true,
          endTime: true,
          isActive: true,
        },
      });

      if (!exam) {
        return res.status(404).json({ error: "Exam not found" });
      }

      const attempt = await prisma.examAttempt.findFirst({
        where: { userId: student.id, examId },
        orderBy: { retakeNumber: "desc" },
      });

      if (!attempt) {
        return res.status(400).json({ error: "No attempt found for this exam" });
      }

      if (attempt.status === "DISQUALIFIED") {
        return res
          .status(403)
          .json({ error: "This attempt has been disqualified" });
      }

      if (attempt.status === "COMPLETED") {
        return res.status(400).json({
          error: "This exam has already been submitted",
          score: attempt.score,
        });
      }

      if (attempt.status !== "IN_PROGRESS") {
        return res
          .status(400)
          .json({ error: "Exam must be in progress to submit" });
      }

      const questions = await prisma.question.findMany({
        where: { examId, deletedAt: null },
        orderBy: { orderIndex: "asc" },
        select: {
          id: true,
          marks: true,
          timeLimitMs: true,
        },
      });

      const maxTotalMarks = questions.reduce((s, q) => s + q.marks, 0);
      let totalScore = 0;
      const breakdown: Array<{
        questionId: string;
        marksEarned: number;
        maxMarks: number;
        status: ExecutionSubmissionStatus | "PENDING";
        passedCount: number;
        totalCount: number;
      }> = [];

      for (const question of questions) {
        const latestSubmission = await prisma.submission.findFirst({
          where: {
            attemptId: attempt.id,
            questionId: question.id,
            userId: student.id,
          },
          orderBy: { submittedAt: "desc" },
        });

        const code = latestSubmission?.code ?? "";
        const language = toStudentProgrammingLanguage(
          latestSubmission?.language,
        );

        const testCases = await prisma.testCase.findMany({
          where: { questionId: question.id },
          orderBy: { id: "asc" },
          select: {
            id: true,
            input: true,
            expectedOutput: true,
            isHidden: true,
            weight: true,
          },
        });

        const weightedForScore = testCases.map((tc) => ({
          id: tc.id,
          weight: tc.weight,
        }));

        if (testCases.length === 0) {
          await upsertStudentSubmissionRecord({
            attemptId: attempt.id,
            userId: student.id,
            examId,
            questionId: question.id,
            code,
            language,
            submittedAt: now,
            status: "PENDING",
            executionTimeMs: null,
            memoryUsedKb: null,
            passedCount: 0,
            totalCount: 0,
            stdErr: null,
            testCaseResults: [],
          });
          breakdown.push({
            questionId: question.id,
            marksEarned: 0,
            maxMarks: question.marks,
            status: "PENDING",
            passedCount: 0,
            totalCount: 0,
          });
          continue;
        }

        const visibleCases: StudentVisibleTestCase[] = testCases.map((tc) => ({
          id: tc.id,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isHidden: tc.isHidden,
        }));

        const executionResult = await executeStudentCodeAgainstVisibleCases({
          code,
          language,
          timeLimitMs: question.timeLimitMs,
          testCases: visibleCases,
          metadata: {
            userId: student.id,
            examId,
            questionId: question.id,
            attemptId: attempt.id,
          },
        });

        const marksEarned = calculateWeightedQuestionScore(
          question.marks,
          weightedForScore,
          executionResult.storedTestCaseResults,
          executionResult.status,
        );
        totalScore += marksEarned;

        await upsertStudentSubmissionRecord({
          attemptId: attempt.id,
          userId: student.id,
          examId,
          questionId: question.id,
          code,
          language,
          submittedAt: now,
          status: executionResult.status,
          executionTimeMs: executionResult.executionTimeMs,
          memoryUsedKb: executionResult.memoryUsedKb,
          passedCount: executionResult.passedCount,
          totalCount: executionResult.totalCount,
          stdErr: executionResult.stdErr,
          testCaseResults: executionResult.storedTestCaseResults,
        });

        breakdown.push({
          questionId: question.id,
          marksEarned: Math.round(marksEarned * 100) / 100,
          maxMarks: question.marks,
          status: executionResult.status,
          passedCount: executionResult.passedCount,
          totalCount: executionResult.totalCount,
        });
      }

      const roundedTotal = Math.round(totalScore * 100) / 100;

      await prisma.examAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "COMPLETED",
          score: roundedTotal,
          completedAt: now,
          gradedAt: now,
        },
      });

      logApiEvent("exam.submit.success", {
        userId: student.id,
        examId,
        attemptId: attempt.id,
        totalScore: roundedTotal,
        questionCount: questions.length,
      });

      return res.json({
        totalScore: roundedTotal,
        maxTotalMarks,
        breakdown,
      });
    } catch (error) {
      console.error("[api] exam.submit.failed", error);
      return res.status(500).json({ error: "Failed to submit exam" });
    }
  },
);

app.get(
  "/api/faculty/exams/:examId/results",
  authMiddleware,
  async (_req: Request, res: Response) => {
    try {
      const { examId } = _req.params;
      if (!examId) {
        return res.status(400).json({ error: "examId is required" });
      }

      const faculty = await prisma.user.findUnique({
        where: { id: _req.userId! },
      });
      if (
        rejectUnapprovedFaculty(
          res,
          faculty,
          "Only faculty members can view exam results",
        )
      ) {
        return;
      }

      const exam = await prisma.exam.findFirst({
        where: {
          id: examId,
          deletedAt: null,
          creatorId: faculty!.id,
        },
        select: {
          id: true,
          title: true,
          startTime: true,
          endTime: true,
          questions: {
            where: { deletedAt: null },
            select: { marks: true },
          },
        },
      });

      if (!exam) {
        return res.status(404).json({ error: "Exam not found" });
      }

      const totalMarks = exam.questions.reduce((s, q) => s + q.marks, 0);

      const attempts = await prisma.examAttempt.findMany({
        where: {
          examId,
          status: "COMPLETED",
        },
        orderBy: [{ score: "desc" }, { completedAt: "asc" }],
        include: {
          user: {
            select: {
              id: true,
              name: true,
              rollNumber: true,
              email: true,
            },
          },
        },
      });

      const rows = attempts.map((a, index) => {
        const started = a.startedAt?.getTime() ?? null;
        const completed = a.completedAt?.getTime() ?? null;
        const durationMs =
          started !== null && completed !== null
            ? Math.max(0, completed - started)
            : null;

        return {
          rank: index + 1,
          attemptId: a.id,
          userId: a.user.id,
          name: a.user.name,
          rollNumber: a.user.rollNumber,
          email: a.user.email,
          score: a.score,
          startedAt: a.startedAt,
          completedAt: a.completedAt,
          durationMs,
        };
      });

      const scores = attempts
        .map((a) => a.score)
        .filter((s): s is number => s !== null && s !== undefined);
      const averageScore =
        scores.length > 0
          ? Math.round(
              (scores.reduce((acc, s) => acc + s, 0) / scores.length) * 100,
            ) / 100
          : null;
      const highestScore =
        scores.length > 0 ? Math.max(...scores) : null;

      return res.json({
        exam: {
          id: exam.id,
          title: exam.title,
          startTime: exam.startTime,
          endTime: exam.endTime,
          totalMarks,
        },
        summary: {
          participantCount: attempts.length,
          averageScore,
          highestScore,
        },
        attempts: rows,
      });
    } catch (error) {
      console.error("[api] faculty.exam.results.failed", error);
      return res.status(500).json({ error: "Failed to fetch exam results" });
    }
  },
);

// Exam Eligibility

app.get("/api/exams/:id", async (_req: Request, res: Response) => {
  const { id } = _req.params;
  try {
    const exam = await prisma.exam.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        startTime: true,
        endTime: true,
        questions: true,
      },
    });
    if (!exam) {
      return res.status(404).json({ error: "Exam not found" });
    }
    return res.json(exam);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch exam" });
  }
});

app.patch(
  "/api/exams/:id",
  authMiddleware,
  async (_req: Request, res: Response) => {
    const { id } = _req.params;

    const faculty = await prisma.user.findUnique({
      where: { id: _req.userId! },
    });
    if (
      rejectUnapprovedFaculty(
        res,
        faculty,
        "Only faculty members can update exams",
      )
    ) {
      return;
    }

    const result = UpdateExamSchema.safeParse(_req.body);
    if (!result.success) {
      return res
        .status(400)
        .json({ errors: result.error.flatten().fieldErrors });
    }

    try {
      const exam = await prisma.exam.findUnique({
        where: { id },
      });
      if (!exam || exam.deletedAt !== null) {
        return res.status(404).json({ error: "Exam not found" });
      }

      if (exam.creatorId !== faculty!.id) {
        return res
          .status(403)
          .json({ error: "You are not the creator of this exam" });
      }

      const {
        title,
        description,
        startTime,
        endTime,
        durationMin,
        isActive,
        accessCode,
      } = result.data;

      const effectiveStartTime = startTime ?? exam.startTime;
      const effectiveDurationMin = durationMin ?? exam.durationMin;
      const effectiveEndTime =
        endTime ??
        calculateExamEndTime(effectiveStartTime, effectiveDurationMin);
      const now = new Date();

      if (isActive === true && effectiveStartTime > now) {
        return res.status(400).json({
          error:
            "You can only start an exam at or after its scheduled start time",
        });
      }

      if (isActive === true && effectiveEndTime <= now) {
        return res.status(400).json({
          error: "This exam has already reached its end time",
        });
      }

      if (effectiveEndTime <= effectiveStartTime) {
        return res
          .status(400)
          .json({ error: "endTime must be after startTime" });
      }

      const data: Record<string, unknown> = {};
      if (title !== undefined) data.title = title;
      if (description !== undefined) data.description = description;
      if (startTime !== undefined) data.startTime = startTime;
      if (durationMin !== undefined) data.durationMin = durationMin;
      if (isActive !== undefined) data.isActive = isActive;
      if (accessCode !== undefined) data.accessCode = accessCode;
      if (endTime !== undefined) {
        data.endTime = endTime;
      } else if (startTime !== undefined || durationMin !== undefined) {
        data.endTime = effectiveEndTime;
      }

      if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: "No valid exam fields provided" });
      }

      const updatedExam = await prisma.exam.update({
        where: { id },
        data,
        select: {
          id: true,
          title: true,
          description: true,
          startTime: true,
          endTime: true,
          durationMin: true,
          isActive: true,
          accessCode: true,
        },
      });

      return res.json(updatedExam);
    } catch (error) {
      res.status(500).json({ error: "Failed to update exam" });
    }
  },
);

app.delete(
  "/api/exams/:id",
  authMiddleware,
  async (_req: Request, res: Response) => {
    const { id } = _req.params;

    const faculty = await prisma.user.findUnique({
      where: { id: _req.userId! },
    });
    if (
      rejectUnapprovedFaculty(
        res,
        faculty,
        "Only faculty members can delete exams",
      )
    ) {
      return;
    }

    try {
      const exam = await prisma.exam.findUnique({
        where: { id },
      });

      if (!exam || exam.deletedAt !== null) {
        return res.status(404).json({ error: "Exam not found" });
      }

      if (exam.creatorId !== faculty!.id) {
        return res
          .status(403)
          .json({ error: "You are not the creator of this exam" });
      }

      if (isExamCurrentlyActive(exam)) {
        return res
          .status(400)
          .json({ error: "Only draft exams can be deleted" });
      }

      await prisma.exam.update({
        where: { id },
        data: {
          isActive: false,
          deletedAt: new Date(),
        },
      });

      return res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete exam" });
    }
  },
);

app.post(
  "/api/exams/:id/eligibility",
  authMiddleware,
  async (_req: Request, res: Response) => {
    const { id } = _req.params;
    const {} = _req.body;
  },
);

// ─── Questions & Test Cases ──────────────────────────────────────────────────

app.get(
  "/api/exams/:id/questions",
  authMiddleware,
  async (_req: Request, res: Response) => {
    const faculty = await prisma.user.findUnique({
      where: { id: _req.userId! },
    });
    if (
      rejectUnapprovedFaculty(
        res,
        faculty,
        "Only faculty members can view questions",
      )
    ) {
      return;
    }

    try {
      const exam = await prisma.exam.findUnique({
        where: { id: _req.params.id },
      });

      if (!exam || exam.deletedAt !== null) {
        return res.status(404).json({ error: "Exam not found" });
      }

      if (exam.creatorId !== faculty!.id) {
        return res
          .status(403)
          .json({ error: "You are not the creator of this exam" });
      }

      const questions = await prisma.question.findMany({
        where: { examId: exam.id, deletedAt: null },
        include: {
          testCases: {
            orderBy: { id: "asc" },
          },
          _count: { select: { submissions: true } },
        },
        orderBy: { orderIndex: "asc" },
      });

      return res.json(questions);
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch questions" });
    }
  },
);

app.patch(
  "/api/questions/:id",
  authMiddleware,
  async (_req: Request, res: Response) => {
    const faculty = await prisma.user.findUnique({
      where: { id: _req.userId! },
    });
    if (
      rejectUnapprovedFaculty(
        res,
        faculty,
        "Only faculty members can update questions",
      )
    ) {
      return;
    }

    const result = UpdateQuestionSchema.safeParse(_req.body);
    if (!result.success) {
      return res
        .status(400)
        .json({ errors: result.error.flatten().fieldErrors });
    }

    try {
      const question = await prisma.question.findUnique({
        where: { id: _req.params.id },
        include: { exam: true },
      });

      if (!question || question.deletedAt !== null) {
        return res.status(404).json({ error: "Question not found" });
      }

      if (question.exam.creatorId !== faculty!.id) {
        return res
          .status(403)
          .json({ error: "You are not the creator of this exam" });
      }

      if (question.exam.isActive) {
        return res
          .status(400)
          .json({ error: "Cannot update questions on an active exam" });
      }

      const {
        title,
        description,
        marks,
        timeLimitMs,
        memoryLimitKb,
        orderIndex,
      } = result.data;

      // Only include fields that were actually sent
      const data: Record<string, unknown> = {};
      if (title !== undefined) data.title = title;
      if (description !== undefined) data.description = description;
      if (marks !== undefined) data.marks = marks;
      if (timeLimitMs !== undefined) data.timeLimitMs = timeLimitMs;
      if (memoryLimitKb !== undefined) data.memoryLimitKb = memoryLimitKb;
      if (orderIndex !== undefined) data.orderIndex = orderIndex;

      const updated = await prisma.question.update({
        where: { id: _req.params.id },
        data,
      });

      return res.json(updated);
    } catch (error) {
      return res.status(500).json({ error: "Failed to update question" });
    }
  },
);

app.delete(
  "/api/questions/:id",
  authMiddleware,
  async (_req: Request, res: Response) => {
    const faculty = await prisma.user.findUnique({
      where: { id: _req.userId! },
    });
    if (
      rejectUnapprovedFaculty(
        res,
        faculty,
        "Only faculty members can delete questions",
      )
    ) {
      return;
    }

    try {
      const question = await prisma.question.findUnique({
        where: { id: _req.params.id },
        include: { exam: true },
      });

      if (!question || question.deletedAt !== null) {
        return res.status(404).json({ error: "Question not found" });
      }

      if (question.exam.creatorId !== faculty!.id) {
        return res
          .status(403)
          .json({ error: "You are not the creator of this exam" });
      }

      if (question.exam.isActive) {
        return res
          .status(400)
          .json({ error: "Cannot delete questions from an active exam" });
      }

      await prisma.question.update({
        where: { id: _req.params.id },
        data: { deletedAt: new Date() },
      });

      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ error: "Failed to delete question" });
    }
  },
);

app.post(
  "/api/questions/:id/testcases",
  authMiddleware,
  async (_req: Request, res: Response) => {
    const faculty = await prisma.user.findUnique({
      where: { id: _req.userId! },
    });
    if (
      rejectUnapprovedFaculty(
        res,
        faculty,
        "Only faculty members can add test cases",
      )
    ) {
      return;
    }

    const result = TestCaseSchema.safeParse(_req.body);
    if (!result.success) {
      return res
        .status(400)
        .json({ errors: result.error.flatten().fieldErrors });
    }

    const { input, expectedOutput, isHidden, weight } = result.data;

    try {
      const question = await prisma.question.findUnique({
        where: { id: _req.params.id },
        include: { exam: true },
      });

      if (!question || question.deletedAt !== null) {
        return res.status(404).json({ error: "Question not found" });
      }

      if (question.exam.creatorId !== faculty!.id) {
        return res
          .status(403)
          .json({ error: "You are not the creator of this exam" });
      }

      if (question.exam.isActive) {
        return res
          .status(400)
          .json({ error: "Cannot add test cases to an active exam" });
      }

      const testCase = await prisma.testCase.create({
        data: {
          questionId: question.id,
          input,
          expectedOutput,
          isHidden,
          weight,
        },
      });

      return res.status(201).json(testCase);
    } catch (error) {
      return res.status(500).json({ error: "Failed to add test case" });
    }
  },
);

app.patch(
  "/api/testcases/:id",
  authMiddleware,
  async (_req: Request, res: Response) => {
    const faculty = await prisma.user.findUnique({
      where: { id: _req.userId! },
    });
    if (
      rejectUnapprovedFaculty(
        res,
        faculty,
        "Only faculty members can update test cases",
      )
    ) {
      return;
    }

    const result = UpdateTestCaseSchema.safeParse(_req.body);
    if (!result.success) {
      return res
        .status(400)
        .json({ errors: result.error.flatten().fieldErrors });
    }

    try {
      // Traverse testCase → question → exam to verify ownership
      const testCase = await prisma.testCase.findUnique({
        where: { id: _req.params.id },
        include: { question: { include: { exam: true } } },
      });

      if (!testCase) {
        return res.status(404).json({ error: "Test case not found" });
      }

      if (testCase.question.deletedAt !== null) {
        return res.status(404).json({ error: "Question has been deleted" });
      }

      if (testCase.question.exam.creatorId !== faculty!.id) {
        return res
          .status(403)
          .json({ error: "You are not the creator of this exam" });
      }

      if (testCase.question.exam.isActive) {
        return res
          .status(400)
          .json({ error: "Cannot update test cases on an active exam" });
      }

      const { input, expectedOutput, isHidden, weight } = result.data;

      const data: Record<string, unknown> = {};
      if (input !== undefined) data.input = input;
      if (expectedOutput !== undefined) data.expectedOutput = expectedOutput;
      if (isHidden !== undefined) data.isHidden = isHidden;
      if (weight !== undefined) data.weight = weight;

      const updated = await prisma.testCase.update({
        where: { id: _req.params.id },
        data,
      });

      return res.json(updated);
    } catch (error) {
      return res.status(500).json({ error: "Failed to update test case" });
    }
  },
);

app.delete(
  "/api/testcases/:id",
  authMiddleware,
  async (_req: Request, res: Response) => {
    const faculty = await prisma.user.findUnique({
      where: { id: _req.userId! },
    });
    if (
      rejectUnapprovedFaculty(
        res,
        faculty,
        "Only faculty members can delete test cases",
      )
    ) {
      return;
    }

    try {
      // Traverse testCase → question → exam to verify ownership
      const testCase = await prisma.testCase.findUnique({
        where: { id: _req.params.id },
        include: { question: { include: { exam: true } } },
      });

      if (!testCase) {
        return res.status(404).json({ error: "Test case not found" });
      }

      if (testCase.question.deletedAt !== null) {
        return res.status(404).json({ error: "Question has been deleted" });
      }

      if (testCase.question.exam.creatorId !== faculty!.id) {
        return res
          .status(403)
          .json({ error: "You are not the creator of this exam" });
      }

      if (testCase.question.exam.isActive) {
        return res
          .status(400)
          .json({ error: "Cannot delete test cases from an active exam" });
      }

      // TestCase has no deletedAt — hard delete
      await prisma.testCase.delete({ where: { id: _req.params.id } });

      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ error: "Failed to delete test case" });
    }
  },
);

// ─── 404 Handler ────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

// ─── Global Error Handler ────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

// ─── Start Server ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[api] Server running at http://localhost:${PORT}`);
});

export default app;
