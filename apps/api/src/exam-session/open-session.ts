// The Express/Prisma adapter over the pure `evaluateSession` decision: expire stale
// exams, load the exam/attempt/student, ask the decision, and on a Refusal send the
// response (logging one uniform event) and return null. On success it returns the
// Session for the handler to act on. The adapter never mutates the attempt — that
// stays in the handlers. See docs/adr/0004-exam-session-seam.md.
import type { Request, Response } from "express";
import prisma from "@repo/database";
import { logApiEvent } from "../lib/logging.ts";
import { deactivateExpiredExams } from "../lib/exam-status.ts";
import { evaluateSession, type SessionIntent, type Session } from "./exam-session.ts";

async function openSession(
  req: Request,
  res: Response,
  examId: string,
  intent: SessionIntent,
): Promise<Session | null> {
  const now = new Date();
  await deactivateExpiredExams(now);

  // Independent of each other (all post-expire) — load in parallel.
  const [exam, attempt, student] = await Promise.all([
    prisma.exam.findUnique({
      where: { id: examId },
      select: {
        id: true,
        title: true,
        description: true,
        startTime: true,
        endTime: true,
        durationMin: true,
        isActive: true,
        deletedAt: true,
        eligibilities: { select: { batchId: true, departmentId: true } },
      },
    }),
    prisma.examAttempt.findFirst({
      where: { userId: req.userId!, examId },
      orderBy: { retakeNumber: "desc" },
      select: {
        id: true,
        status: true,
        startedAt: true,
        completedAt: true,
        retakeNumber: true,
        score: true,
        ipAddress: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: req.userId! },
      select: { batchId: true, departmentId: true },
    }),
  ]);

  const result = evaluateSession(intent, {
    exam,
    attempt,
    student: { batchId: student?.batchId ?? null, departmentId: student?.departmentId ?? null },
    now,
  });

  if (!result.ok) {
    logApiEvent("exam.session.refused", {
      intent,
      examId,
      userId: req.userId ?? null,
      reason: result.code ?? null,
    });
    res.status(result.status).json({
      error: result.error,
      ...(result.code ? { code: result.code } : {}),
      ...(result.details ?? {}),
    });
    return null;
  }

  return result;
}

export { openSession };
