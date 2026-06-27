import type { Express, Request, Response } from "express";
import prisma from "@repo/database";

export function registerPublicRoutes(app: Express) {
app.get("/api/departments", async (_req: Request, res: Response) => {
  try {
    const departments = await prisma.department.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    });
    return res.json(departments);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch departments" });
  }
});

app.get("/api/batches", async (_req: Request, res: Response) => {
  const { departmentId } = _req.query;
  try {
    const batches = await prisma.batch.findMany({
      where: {
        isActive: true,
        ...(departmentId ? { departmentId: String(departmentId) } : {}),
      },
      select: {
        id: true,
        label: true,
        yearOfStudy: true,
        intakeYear: true,
        departmentId: true,
      },
      orderBy: [{ intakeYear: "desc" }, { yearOfStudy: "asc" }],
    });
    return res.json(batches);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch batches" });
  }
});

// ─── API Routes ──────────────────────────────────────────────────────────────
}
