// The Express/Prisma adapter over the pure `evaluateSession` decision: expire stale
// exams, load the exam/attempt/student, ask the decision, and on a Refusal send the
// response (logging one uniform event) and return null. On success it returns the
// Session for the handler to act on. The adapter never mutates the attempt — that
// stays in the handlers. See docs/adr/0004-exam-session-seam.md.
import type { Request, Response } from "express";
import prisma from "@repo/database";
import { logApiEvent } from "../lib/logging.ts";
import { deactivateExpiredExams } from "../lib/exam-status.ts";
import { evaluateSession, POLICY, type SessionIntent, type Session } from "./exam-session.ts";

async function openSession(
  req: Request,
  res: Response,
  examId: string,
  intent: SessionIntent,
): Promise<Session | null> {
  const policy = POLICY[intent];
  const now = new Date();
  if (policy.expire) await deactivateExpiredExams(now);

  // The attempt is needed by every intent; exam/student only when the policy
  // says so (violation loads neither). Independent of each other — load in parallel.
  const [exam, attempt, student] = await Promise.all([
    policy.loadExam
      ? prisma.exam.findUnique({
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
        })
      : Promise.resolve(null),
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
    policy.loadStudent
      ? prisma.user.findUnique({
          where: { id: req.userId! },
          select: { batchId: true, departmentId: true },
        })
      : Promise.resolve(null),
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
