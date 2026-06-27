import type { Express, Request, Response } from "express";
import prisma from "@repo/database";
import { ExamSchema, UpdateExamSchema } from "@common/types";
import { authMiddleware } from "../middleware/auth.ts";
import { logApiEvent } from "../lib/logging.ts";
import { authorizeRequest } from "../authorization/authorize-request.ts";
import {
  FACULTY_PENDING_MSG,
  FACULTY_PENDING_APPROVAL,
} from "../authorization/authorize.ts";
import { calculateExamEndTime, isExamCurrentlyActive, deactivateExpiredExams } from "../lib/exam-status.ts";

export function registerExamRoutes(app: Express) {
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
      // 2. Verify the authenticated user is approved FACULTY
      const actor = await authorizeRequest(_req, res, "exam:create");
      if (!actor) return;

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
            code: FACULTY_PENDING_APPROVAL,
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

    try {
      const exam = await prisma.exam.findUnique({
        where: { id },
      });

      const actor = await authorizeRequest(_req, res, "exam:update", exam);
      if (!actor) return;
      // authorize already returned 404 for a missing/soft-deleted exam; this
      // narrows the type for the rest of the handler.
      if (!exam) return;

      const result = UpdateExamSchema.safeParse(_req.body);
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

    try {
      const exam = await prisma.exam.findUnique({
        where: { id },
      });

      const actor = await authorizeRequest(_req, res, "exam:delete", exam);
      if (!actor) return;
      // authorize already returned 404 for a missing/soft-deleted exam; this
      // narrows the type for the rest of the handler.
      if (!exam) return;

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

}
