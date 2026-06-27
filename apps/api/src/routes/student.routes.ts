import type { Express, Request, Response } from "express";
import prisma from "@repo/database";
import { authMiddleware } from "../middleware/auth.ts";
import { isStudentProgrammingLanguage, toStudentProgrammingLanguage } from "../types.ts";
import type { ExecutionSubmissionStatus, StudentVisibleTestCase } from "../types.ts";
import { calculateWeightedQuestionScore } from "../lib/scoring.ts";
import { logApiEvent } from "../lib/logging.ts";
import { deactivateExpiredExams } from "../lib/exam-status.ts";
import { judge } from "../execution/judge.ts";
import { upsertStudentSubmissionRecord } from "../lib/submissions.ts";
import { authorizeRequest } from "../authorization/authorize-request.ts";

export function registerStudentRoutes(app: Express) {
app.post(
  "/api/student/exams/:id/enter",
  authMiddleware,
  async (_req: Request, res: Response) => {
    try {
      const now = new Date();
      await deactivateExpiredExams(now);

      const actor = await authorizeRequest(_req, res, "student:enter");
      if (!actor) return;

      // The eligibility check below needs the student's batch/department, so the
      // handler still loads the full record (authorize already confirmed it exists).
      const student = await prisma.user.findUnique({
        where: { id: _req.userId! },
      });
      if (!student) return;

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

      const student = await authorizeRequest(_req, res, "student:draft");
      if (!student) return;

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

      const student = await authorizeRequest(_req, res, "student:violation");
      if (!student) return;

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

      const student = await authorizeRequest(_req, res, "student:run");
      if (!student) return;

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

      const executionResult = await judge(
        {
          code,
          language,
          metadata: {
            userId: student.id,
            examId,
            questionId,
            attemptId: attempt.id,
          },
        },
        question.testCases,
        { timeLimitMs: question.timeLimitMs },
      );

      // Runner-level failure: not the student's fault. Record nothing and ask
      // them to retry rather than persisting a bogus run. See ADR-0002.
      if (executionResult.status === "SYSTEM_ERROR") {
        logApiEvent("exam.code.run.system_error", {
          userId: student.id,
          examId,
          questionId,
          attemptId: attempt.id,
          stdErr: executionResult.stdErr,
        });
        return res.status(503).json({
          error: "Code execution is temporarily unavailable. Please try again.",
        });
      }

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

      const student = await authorizeRequest(_req, res, "student:submit");
      if (!student) return;

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
        needsRerun?: boolean;
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

        const executionResult = await judge(
          {
            code,
            language,
            metadata: {
              userId: student.id,
              examId,
              questionId: question.id,
              attemptId: attempt.id,
            },
          },
          visibleCases,
          { timeLimitMs: question.timeLimitMs },
        );

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
          // Quarantined: an infrastructure failure, scored 0 and flagged for a
          // re-run rather than counted as a wrong answer. See ADR-0002.
          needsRerun: executionResult.status === "SYSTEM_ERROR",
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

}
