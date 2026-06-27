// Shared domain types, role/language constants, and type guards.

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

export {
  portalLabelByRole,
  studentProgrammingLanguages,
  isPortalRole,
  isStudentProgrammingLanguage,
  toStudentProgrammingLanguage,
};
export type {
  PortalRole,
  StudentProgrammingLanguage,
  ExecutionSubmissionStatus,
  StoredTestCaseResult,
  StudentVisibleTestCase,
  StudentRunTestCaseResult,
  StudentRunExecutionResult,
};
