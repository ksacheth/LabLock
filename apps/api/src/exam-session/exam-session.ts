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

// The exam-time policy, one row per intent. Drives both the pure decision below
// (eligibility / window / attempt rules) and the adapter's loading (expire,
// loadExam, loadStudent). The three preserved divergences live here as data:
// submit has window "none", violation skips exam entirely, eligibility is enter-only.
type Policy = {
  expire: boolean;
  loadExam: boolean;
  loadStudent: boolean;
  checkEligibility: boolean;
  window: "none" | "granular" | "coarse";
  windowMessage?: string;
  attempt: "enter" | "require" | "submit" | "violation";
  notInProgressMessage?: string;
};

const POLICY: Record<SessionIntent, Policy> = {
  enter: {
    expire: true, loadExam: true, loadStudent: true, checkEligibility: true,
    window: "granular", attempt: "enter",
  },
  draft: {
    expire: true, loadExam: true, loadStudent: false, checkEligibility: false,
    window: "coarse", windowMessage: "This exam room is not accepting code drafts now",
    attempt: "require", notInProgressMessage: "Enter the exam room before saving code drafts",
  },
  run: {
    expire: true, loadExam: true, loadStudent: false, checkEligibility: false,
    window: "coarse", windowMessage: "This exam room is not accepting code runs now",
    attempt: "require", notInProgressMessage: "Enter the exam room before running code",
  },
  submit: {
    expire: true, loadExam: true, loadStudent: false, checkEligibility: false,
    window: "none", attempt: "submit",
  },
  violation: {
    expire: false, loadExam: false, loadStudent: false, checkEligibility: false,
    window: "none", attempt: "violation",
  },
};

function checkAttempt(policy: Policy, attempt: AttemptSnapshot | null): Refusal | null {
  switch (policy.attempt) {
    case "enter":
      if (attempt?.status === "COMPLETED") {
        return { ok: false, status: 400, error: "You have already submitted this exam", code: "ALREADY_SUBMITTED" };
      }
      if (attempt?.status === "DISQUALIFIED") {
        return { ok: false, status: 403, error: "Your exam attempt has been disqualified", code: "DISQUALIFIED" };
      }
      return null;
    case "require":
      if (!attempt || attempt.status !== "IN_PROGRESS") {
        return { ok: false, status: 400, error: policy.notInProgressMessage!, code: "NOT_IN_PROGRESS" };
      }
      return null;
    case "submit":
      if (!attempt) {
        return { ok: false, status: 400, error: "No attempt found for this exam", code: "NO_ATTEMPT" };
      }
      if (attempt.status === "DISQUALIFIED") {
        return { ok: false, status: 403, error: "This attempt has been disqualified", code: "DISQUALIFIED" };
      }
      if (attempt.status === "COMPLETED") {
        return {
          ok: false, status: 400, error: "This exam has already been submitted",
          code: "ALREADY_SUBMITTED", details: { score: attempt.score },
        };
      }
      if (attempt.status !== "IN_PROGRESS") {
        return { ok: false, status: 400, error: "Exam must be in progress to submit", code: "NOT_IN_PROGRESS" };
      }
      return null;
    case "violation":
      if (!attempt || attempt.status !== "IN_PROGRESS") {
        return { ok: false, status: 404, error: "No active IN_PROGRESS attempt found", code: "NO_ACTIVE_ATTEMPT" };
      }
      return null;
  }
}

function checkEligibility(
  policy: Policy,
  exam: ExamSnapshot | null,
  student: Snapshot["student"],
): Refusal | null {
  if (!policy.checkEligibility || !exam) return null;
  const isEligible =
    exam.eligibilities.length === 0 ||
    exam.eligibilities.some(
      (e) =>
        (e.batchId !== null && e.batchId === student.batchId) ||
        (e.departmentId !== null && e.departmentId === student.departmentId),
    );
  if (isEligible) return null;
  return { ok: false, status: 403, error: "You are not eligible to enter this exam room", code: "INELIGIBLE" };
}

// Granular (enter) keeps the original handler's check order — !isActive first —
// so an expired exam still reports NOT_ACTIVE, not ENDED. See ADR-0004.
function checkWindow(policy: Policy, exam: ExamSnapshot | null, now: Date): Refusal | null {
  if (!exam || policy.window === "none") return null;
  if (policy.window === "granular") {
    if (!exam.isActive) {
      return { ok: false, status: 400, error: "This exam is not live right now", code: "NOT_ACTIVE" };
    }
    if (exam.startTime > now) {
      return { ok: false, status: 400, error: "This exam has not started yet", code: "NOT_STARTED" };
    }
    if (exam.endTime <= now) {
      return { ok: false, status: 400, error: "This exam has already ended", code: "ENDED" };
    }
    return null;
  }
  // coarse (draft / run)
  if (!exam.isActive || exam.startTime > now || exam.endTime <= now) {
    return { ok: false, status: 400, error: policy.windowMessage!, code: "WINDOW_CLOSED" };
  }
  return null;
}

function evaluateSession(intent: SessionIntent, snapshot: Snapshot): Session | Refusal {
  const policy = POLICY[intent];
  const { exam, attempt, student, now } = snapshot;

  if (policy.loadExam && (!exam || exam.deletedAt !== null)) {
    return { ok: false, status: 404, error: "Exam not found", code: "EXAM_NOT_FOUND" };
  }

  return (
    checkEligibility(policy, exam, student) ??
    checkWindow(policy, exam, now) ??
    checkAttempt(policy, attempt) ??
    { ok: true, now, exam, attempt }
  );
}

export { evaluateSession, POLICY };
export type { SessionIntent, ExamSnapshot, AttemptSnapshot, Snapshot, Session, Refusal };
