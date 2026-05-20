// The Exam-session seam: one pure decision answering "may this student act on this
// exam right now?". Blind to I/O — the adapter loads the exam, attempt and student
// and passes them in, so the whole exam-time policy is a table (the test surface).
// Read-only: attempt writes (create/resume/complete/disqualify) stay in handlers.
// See docs/adr/0004-exam-session-seam.md.

type SessionIntent = "enter" | "draft" | "run" | "submit" | "violation";

type ExamSnapshot = {
  id: string;
  title: string;
  description: string | null;
  startTime: Date;
  endTime: Date;
  durationMin: number;
  isActive: boolean;
  deletedAt: Date | null;
  eligibilities: { batchId: string | null; departmentId: string | null }[];
};

type AttemptSnapshot = {
  id: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  retakeNumber: number;
  score: number | null;
  ipAddress: string | null;
};

type Snapshot = {
  exam: ExamSnapshot | null;
  attempt: AttemptSnapshot | null;
  student: { batchId: string | null; departmentId: string | null };
  now: Date;
};

type Refusal = {
  ok: false;
  status: number;
  error: string;
  code?: string;
  details?: Record<string, unknown>;
};

type Session = {
  ok: true;
  now: Date;
  exam: ExamSnapshot | null;
  attempt: AttemptSnapshot | null;
};

function evaluateSession(intent: SessionIntent, snapshot: Snapshot): Session | Refusal {
  const { exam, attempt, now } = snapshot;

  if (!exam || exam.deletedAt !== null) {
    return { ok: false, status: 404, error: "Exam not found", code: "EXAM_NOT_FOUND" };
  }

  const { student } = snapshot;
  const isEligible =
    exam.eligibilities.length === 0 ||
    exam.eligibilities.some(
      (e) =>
        (e.batchId !== null && e.batchId === student.batchId) ||
        (e.departmentId !== null && e.departmentId === student.departmentId),
    );
  if (!isEligible) {
    return {
      ok: false,
      status: 403,
      error: "You are not eligible to enter this exam room",
      code: "INELIGIBLE",
    };
  }

  if (!exam.isActive) {
    return { ok: false, status: 400, error: "This exam is not live right now", code: "NOT_ACTIVE" };
  }
  if (exam.startTime > now) {
    return { ok: false, status: 400, error: "This exam has not started yet", code: "NOT_STARTED" };
  }
  if (exam.endTime <= now) {
    return { ok: false, status: 400, error: "This exam has already ended", code: "ENDED" };
  }

  if (attempt?.status === "COMPLETED") {
    return {
      ok: false,
      status: 400,
      error: "You have already submitted this exam",
      code: "ALREADY_SUBMITTED",
    };
  }
  if (attempt?.status === "DISQUALIFIED") {
    return {
      ok: false,
      status: 403,
      error: "Your exam attempt has been disqualified",
      code: "DISQUALIFIED",
    };
  }

  return { ok: true, now, exam, attempt };
}

export { evaluateSession };
export type { SessionIntent, ExamSnapshot, AttemptSnapshot, Snapshot, Session, Refusal };
