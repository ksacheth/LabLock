import type { Express, Request, Response } from "express";
import prisma from "@repo/database";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UserSchema, FacultySignupSchema } from "@common/types";
import { authMiddleware } from "../middleware/auth.ts";
import { portalLabelByRole, isPortalRole } from "../types.ts";
import type { PortalRole } from "../types.ts";
import { logApiEvent } from "../lib/logging.ts";
import {
  FACULTY_PENDING_MSG,
  FACULTY_PENDING_APPROVAL,
} from "../authorization/authorize.ts";

export function registerAuthRoutes(app: Express) {
app.post("/api/signup", async (_req: Request, res: Response) => {
  const result = UserSchema.safeParse(_req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.flatten().fieldErrors });
  }

  const { email, password, name, departmentId, batchId, rollNumber } =
    result.data;

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Validate departmentId if provided
    if (departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: departmentId },
      });
      if (!dept) {
        return res.status(400).json({ error: "Department not found" });
      }
    }

    // Validate batchId if provided and ensure it belongs to the department
    if (batchId) {
      const batch = await prisma.batch.findUnique({
        where: { id: batchId },
      });
      if (!batch) {
        return res.status(400).json({ error: "Batch not found" });
      }
      if (departmentId && batch.departmentId !== departmentId) {
        return res.status(400).json({
          error: "Batch does not belong to the selected department",
        });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: "STUDENT",
        facultyApproved: true,
        departmentId: departmentId ?? null,
        batchId: batchId ?? null,
        rollNumber: rollNumber ?? null,
      },
      omit: { password: true },
    });

    res.status(201).json(user);
  } catch (error: any) {
    if (error.code === "P2002") {
      const field = error.meta?.target?.includes("rollNumber")
        ? "roll number"
        : "email";
      return res
        .status(409)
        .json({ error: `A user with that ${field} already exists` });
    }
    res.status(500).json({ error: "Signup failed" });
  }
});

app.post("/api/signup/faculty", async (_req: Request, res: Response) => {
  const result = FacultySignupSchema.safeParse(_req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.flatten().fieldErrors });
  }

  const { email, password, name } = result.data;

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: "FACULTY",
        facultyApproved: false,
        departmentId: null,
        batchId: null,
        rollNumber: null,
      },
      omit: { password: true },
    });

    logApiEvent("auth.faculty_signup.created", {
      userId: user.id,
      email: user.email,
    });

    res.status(201).json(user);
  } catch (error: any) {
    if (error.code === "P2002") {
      return res
        .status(409)
        .json({ error: "A user with that email already exists" });
    }
    res.status(500).json({ error: "Faculty signup failed" });
  }
});

app.post("/api/signin", async (_req: Request, res: Response) => {
  const { email, password, expectedRole } = _req.body as {
    email?: string;
    password?: string;
    expectedRole?: unknown;
  };

  if (!email || !password) {
    logApiEvent("auth.signin.validation_failed", {
      reason: "missing_credentials",
    });
    return res.status(400).json({ error: "email and password are required" });
  }

  if (expectedRole !== undefined && !isPortalRole(expectedRole)) {
    logApiEvent("auth.signin.validation_failed", {
      reason: "invalid_expected_role",
    });
    return res.status(400).json({ error: "Invalid login role requested" });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      logApiEvent("auth.signin.denied", {
        reason: "user_not_found",
        email,
      });
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      logApiEvent("auth.signin.denied", {
        reason: "invalid_password",
        userId: user.id,
      });
      return res.status(400).json({ error: "Invalid credentials" });
    }

    if (user.role === "FACULTY" && !user.facultyApproved) {
      logApiEvent("auth.signin.denied", {
        reason: "faculty_pending_approval",
        userId: user.id,
      });
      return res.status(403).json({
        error: FACULTY_PENDING_MSG,
        code: FACULTY_PENDING_APPROVAL,
      });
    }

    if (expectedRole && user.role !== expectedRole) {
      const actualPortal = portalLabelByRole[user.role as PortalRole];
      const guidance =
        user.role === "ADMIN"
          ? "Please use the admin login flow."
          : `Please use the ${actualPortal} login page.`;

      logApiEvent("auth.signin.role_mismatch", {
        userId: user.id,
        expectedRole,
        actualRole: user.role,
      });
      return res.status(403).json({
        error: `This account does not have ${portalLabelByRole[expectedRole]} access. ${guidance}`,
      });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });

    const { password: _, ...safeUser } = user;
    logApiEvent("auth.signin.success", {
      userId: user.id,
      role: user.role,
      expectedRole: isPortalRole(expectedRole) ? expectedRole : null,
    });
    res.json({ token, user: safeUser });
  } catch (error) {
    console.error("[api] auth.signin.failed", error);
    res.status(500).json({ error: "Signin failed" });
  }
});

app.get("/api/me", authMiddleware, async (_req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: _req.userId! } });
    if (!user) {
      logApiEvent("auth.me.not_found", {
        userId: _req.userId ?? null,
      });
      return res.status(404).json({ error: "User not found" });
    }
    if (user.role === "FACULTY" && !user.facultyApproved) {
      return res.status(403).json({
        error: FACULTY_PENDING_MSG,
        code: FACULTY_PENDING_APPROVAL,
      });
    }
    const { password: _, ...safeUser } = user;
    logApiEvent("auth.me.success", {
      userId: user.id,
      role: user.role,
    });
    res.json(safeUser);
  } catch (error) {
    console.error("[api] auth.me.failed", error);
    res.status(500).json({ error: "Failed to get user" });
  }
});

}
