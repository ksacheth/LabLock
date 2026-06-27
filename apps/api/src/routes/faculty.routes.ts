import type { Express, Request, Response } from "express";
import prisma from "@repo/database";
import { authMiddleware } from "../middleware/auth.ts";
import { authorizeRequest } from "../authorization/authorize-request.ts";

export function registerFacultyRoutes(app: Express) {
app.get(
  "/api/faculty/exams/:examId/results",
  authMiddleware,
  async (_req: Request, res: Response) => {
    try {
      const { examId } = _req.params;
      if (!examId) {
        return res.status(400).json({ error: "examId is required" });
      }

      const exam = await prisma.exam.findUnique({
        where: { id: examId },
        select: {
          id: true,
          title: true,
          startTime: true,
          endTime: true,
          creatorId: true,
          deletedAt: true,
          questions: {
            where: { deletedAt: null },
            select: { marks: true },
          },
        },
      });

      // role + approval + ownership (incl. 404 for missing/soft-deleted) all
      // decided by the authorization seam.
      const actor = await authorizeRequest(_req, res, "exam:results", exam);
      if (!actor) return;
      // authorize already returned 404 for a missing/soft-deleted exam; this
      // narrows the type for the rest of the handler.
      if (!exam) return;

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

}
