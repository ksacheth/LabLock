import type { Express, Request, Response } from "express";
import prisma from "@repo/database";
import { QuestionSchema, UpdateQuestionSchema } from "@common/types";
import { authMiddleware } from "../middleware/auth.ts";
import { authorizeRequest } from "../authorization/authorize-request.ts";

export function registerQuestionRoutes(app: Express) {
app.post(
  "/api/exams/:id/questions",
  authMiddleware,
  async (_req: Request, res: Response) => {
    try {
      // Authorization (role / approval / parent-exam ownership) lives behind the
      // seam; the handler loads the owning exam and passes it in.
      const exam = await prisma.exam.findUnique({
        where: { id: _req.params.id },
      });

      const actor = await authorizeRequest(_req, res, "question:create", exam);
      if (!actor) return;
      if (!exam) return; // narrows the type; authorize already 404'd a missing exam

      // Validate body
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

      // Cannot add questions to an already-active (live) exam
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

app.get(
  "/api/exams/:id/questions",
  authMiddleware,
  async (_req: Request, res: Response) => {
    try {
      const exam = await prisma.exam.findUnique({
        where: { id: _req.params.id },
      });

      const actor = await authorizeRequest(_req, res, "question:read", exam);
      if (!actor) return;
      // authorize already returned 404 for a missing/soft-deleted exam; this
      // narrows the type for the rest of the handler.
      if (!exam) return;

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
    try {
      // Leaf existence ("Question not found") is a handler precondition, checked
      // before authorize. Ownership is then enforced via the parent exam.
      const question = await prisma.question.findUnique({
        where: { id: _req.params.id },
        include: { exam: true },
      });

      if (!question || question.deletedAt !== null) {
        return res.status(404).json({ error: "Question not found" });
      }

      const actor = await authorizeRequest(
        _req,
        res,
        "question:update",
        question.exam,
      );
      if (!actor) return;

      const result = UpdateQuestionSchema.safeParse(_req.body);
      if (!result.success) {
        return res
          .status(400)
          .json({ errors: result.error.flatten().fieldErrors });
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
    try {
      // Leaf existence ("Question not found") is a handler precondition, checked
      // before authorize. Ownership is then enforced via the parent exam.
      const question = await prisma.question.findUnique({
        where: { id: _req.params.id },
        include: { exam: true },
      });

      if (!question || question.deletedAt !== null) {
        return res.status(404).json({ error: "Question not found" });
      }

      const actor = await authorizeRequest(
        _req,
        res,
        "question:delete",
        question.exam,
      );
      if (!actor) return;

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

}
