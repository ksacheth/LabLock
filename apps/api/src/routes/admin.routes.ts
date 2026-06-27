import type { Express, Request, Response, NextFunction } from "express";
import prisma from "@repo/database";
import { DepartmentSchema, BatchSchema, AdminUpdateUserSchema } from "@common/types";
import { authMiddleware } from "../middleware/auth.ts";

export function registerAdminRoutes(app: Express) {
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

}
