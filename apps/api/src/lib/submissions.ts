// Upsert a student's submission record plus its test-case results.
import prisma from "@repo/database";
import type {
  StudentProgrammingLanguage,
  ExecutionSubmissionStatus,
  StoredTestCaseResult,
} from "../types.ts";

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

export { upsertStudentSubmissionRecord };
