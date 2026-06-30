// The authorization seam: one pure decision answering "may this actor perform
// this action on this resource?". Blind to I/O — the handler loads the actor and
// resource and passes them in, so the whole policy is a table (the test surface).
// See docs/adr/0003-authorization-decision-seam.md.
import type { UserRole } from "@repo/database";

type Actor = { id: string; role: UserRole; facultyApproved: boolean } | null;

type Action =
  | "exam:create"
  | "exam:update"
  | "exam:delete"
  | "exam:results"
  | "user:admin"
  | "question:create"
  | "question:update"
  | "question:delete"
  | "question:read"
  | "testcase:create"
  | "testcase:update"
  | "testcase:delete"
  | "student:enter"
  | "student:draft"
  | "student:violation"
  | "student:run"
  | "student:submit";

// The owning exam, as authorize needs to see it. `null` ⇒ not found / soft-deleted.
type Resource = { creatorId: string; deletedAt: Date | null } | null;

type Decision =
  | { ok: true }
  | { ok: false; status: number; error: string; code?: string };

// Client contract (was in lib/faculty.ts): the web app branches on this code.
const FACULTY_PENDING_MSG =
  "Your faculty account is pending admin approval. You can use the teacher dashboard after an administrator activates your account.";
const FACULTY_PENDING_APPROVAL = "FACULTY_PENDING_APPROVAL";

const POLICY: Record<
  Action,
  {
    role: UserRole;
    requireApproval: boolean;
    ownership: "exam" | "none";
    message: string;
  }
> = {
  "exam:create": {
    role: "FACULTY",
    requireApproval: true,
    ownership: "none",
    message: "Only faculty members can create exams",
  },
  "exam:update": {
    role: "FACULTY",
    requireApproval: true,
    ownership: "exam",
    message: "Only faculty members can update exams",
  },
  "exam:delete": {
    role: "FACULTY",
    requireApproval: true,
    ownership: "exam",
    message: "Only faculty members can delete exams",
  },
  "exam:results": {
    role: "FACULTY",
    requireApproval: true,
    ownership: "exam",
    message: "Only faculty members can view exam results",
  },
  "user:admin": {
    role: "ADMIN",
    requireApproval: false,
    ownership: "none",
    message: "Unauthorized",
  },
  "question:create": {
    role: "FACULTY",
    requireApproval: true,
    ownership: "exam",
    message: "Only faculty members can add questions",
  },
  "question:update": {
    role: "FACULTY",
    requireApproval: true,
    ownership: "exam",
    message: "Only faculty members can update questions",
  },
  "question:delete": {
    role: "FACULTY",
    requireApproval: true,
    ownership: "exam",
    message: "Only faculty members can delete questions",
  },
  "question:read": {
    role: "FACULTY",
    requireApproval: true,
    ownership: "exam",
    message: "Only faculty members can view questions",
  },
  "testcase:create": {
    role: "FACULTY",
    requireApproval: true,
    ownership: "exam",
    message: "Only faculty members can add test cases",
  },
  "testcase:update": {
    role: "FACULTY",
    requireApproval: true,
    ownership: "exam",
    message: "Only faculty members can update test cases",
  },
  "testcase:delete": {
    role: "FACULTY",
    requireApproval: true,
    ownership: "exam",
    message: "Only faculty members can delete test cases",
  },
  // Student role-gates (issue #13): pure role checks. Exam-time preconditions
  // (eligibility, time-window, attempt-status) are owned by the ExamSession seam
  // (openSession) — see ADR-0004 — not by this role-gate.
  "student:enter": {
    role: "STUDENT",
    requireApproval: false,
    ownership: "none",
    message: "Only students can enter an exam room",
  },
  "student:draft": {
    role: "STUDENT",
    requireApproval: false,
    ownership: "none",
    message: "Only students can save exam drafts",
  },
  "student:violation": {
    role: "STUDENT",
    requireApproval: false,
    ownership: "none",
    message: "Only students can report violations",
  },
  "student:run": {
    role: "STUDENT",
    requireApproval: false,
    ownership: "none",
    message: "Only students can run code from the exam room",
  },
  "student:submit": {
    role: "STUDENT",
    requireApproval: false,
    ownership: "none",
    message: "Only students can submit an exam",
  },
};

function authorize(actor: Actor, action: Action, resource?: Resource): Decision {
  if (!actor) {
    return {
      ok: false,
      status: 401,
      error: "Account not found",
      code: "ACCOUNT_NOT_FOUND",
    };
  }

  const rule = POLICY[action];

  if (actor.role !== rule.role) {
    return { ok: false, status: 403, error: rule.message };
  }

  if (rule.requireApproval && !actor.facultyApproved) {
    return {
      ok: false,
      status: 403,
      error: FACULTY_PENDING_MSG,
      code: FACULTY_PENDING_APPROVAL,
    };
  }

  if (rule.ownership === "exam") {
    if (!resource || resource.deletedAt !== null) {
      return { ok: false, status: 404, error: "Exam not found" };
    }
    if (resource.creatorId !== actor.id) {
      return {
        ok: false,
        status: 403,
        error: "You are not the creator of this exam",
      };
    }
  }

  return { ok: true };
}

export { authorize, FACULTY_PENDING_MSG, FACULTY_PENDING_APPROVAL };
export type { Actor, Action, Resource, Decision };
