import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import { registerPublicRoutes } from "./routes/public.routes.ts";
import { registerAuthRoutes } from "./routes/auth.routes.ts";
import { registerAdminRoutes } from "./routes/admin.routes.ts";
import { registerExamRoutes } from "./routes/exam.routes.ts";
import { registerQuestionRoutes } from "./routes/question.routes.ts";
import { registerTestcaseRoutes } from "./routes/testcase.routes.ts";
import { registerFacultyRoutes } from "./routes/faculty.routes.ts";
import { registerStudentRoutes } from "./routes/student.routes.ts";

const app: Express = express();
const PORT = process.env.PORT ?? 4000;

// ─── Global Middleware ──────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:3000" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Health Check ───────────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Routes ─────────────────────────────────────────────────────────────────
registerPublicRoutes(app);
registerAuthRoutes(app);
registerAdminRoutes(app);
registerExamRoutes(app);
registerQuestionRoutes(app);
registerTestcaseRoutes(app);
registerFacultyRoutes(app);
registerStudentRoutes(app);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

// ─── Global Error Handler ────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

// ─── Start Server ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[api] Server running at http://localhost:${PORT}`);
});

export default app;
