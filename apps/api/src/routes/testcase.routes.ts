import type { Express, Request, Response } from "express";
import prisma from "@repo/database";
import { TestCaseSchema, UpdateTestCaseSchema } from "@common/types";
import { authMiddleware } from "../middleware/auth.ts";
import { authorizeRequest } from "../authorization/authorize-request.ts";

export function registerTestcaseRoutes(app: Express) {
app.post(
  "/api/questions/:id/testcases",
  authMiddleware,
  async (_req: Request, res: Response) => {
    const result = TestCaseSchema.safeParse(_req.body);
    if (!result.success) {
      return res
        .status(400)
        .json({ errors: result.error.flatten().fieldErrors });
    }

    const { input, expectedOutput, isHidden, weight } = result.data;

    try {
      // Leaf existence stays a handler precondition before the authorize call.
      const question = await prisma.question.findUnique({
        where: { id: _req.params.id },
        include: { exam: true },
      });

      if (!question || question.deletedAt !== null) {
        return res.status(404).json({ error: "Question not found" });
      }

      // Ownership reaches the exam through test-case → question → exam.
      const actor = await authorizeRequest(
        _req,
        res,
        "testcase:create",
        question.exam,
      );
      if (!actor) return;

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
    const result = UpdateTestCaseSchema.safeParse(_req.body);
    if (!result.success) {
      return res
        .status(400)
        .json({ errors: result.error.flatten().fieldErrors });
    }

    try {
      // Traverse testCase → question → exam to resolve the owning exam.
      // Leaf existence stays a handler precondition before the authorize call.
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

      const actor = await authorizeRequest(
        _req,
        res,
        "testcase:update",
        testCase.question.exam,
      );
      if (!actor) return;

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
    try {
      // Traverse testCase → question → exam to resolve the owning exam.
      // Leaf existence stays a handler precondition before the authorize call.
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

      const actor = await authorizeRequest(
        _req,
        res,
        "testcase:delete",
        testCase.question.exam,
      );
      if (!actor) return;

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
}
