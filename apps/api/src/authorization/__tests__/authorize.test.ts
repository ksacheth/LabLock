import { test, expect } from "bun:test";
import { authorize } from "../authorize.ts";

const approvedFaculty = {
  id: "f1",
  role: "FACULTY" as const,
  facultyApproved: true,
};

const ownedExam = { creatorId: "f1", deletedAt: null };

test("approved faculty may create an exam", () => {
  expect(authorize(approvedFaculty, "exam:create")).toEqual({ ok: true });
});

test("a non-faculty actor cannot create an exam", () => {
  const student = { id: "s1", role: "STUDENT" as const, facultyApproved: false };
  expect(authorize(student, "exam:create")).toEqual({
    ok: false,
    status: 403,
    error: "Only faculty members can create exams",
  });
});

test("approved faculty may update an exam they own", () => {
  expect(authorize(approvedFaculty, "exam:update", ownedExam)).toEqual({
    ok: true,
  });
});

test("approved faculty cannot update an exam they do not own", () => {
  const someoneElsesExam = { creatorId: "other", deletedAt: null };
  expect(authorize(approvedFaculty, "exam:update", someoneElsesExam)).toEqual({
    ok: false,
    status: 403,
    error: "You are not the creator of this exam",
  });
});

test("updating a missing exam is a not-found, owned by authorize", () => {
  expect(authorize(approvedFaculty, "exam:update", null)).toEqual({
    ok: false,
    status: 404,
    error: "Exam not found",
  });
});

test("updating a soft-deleted exam is a not-found", () => {
  const deleted = { creatorId: "f1", deletedAt: new Date("2026-01-01") };
  expect(authorize(approvedFaculty, "exam:update", deleted)).toEqual({
    ok: false,
    status: 404,
    error: "Exam not found",
  });
});

test("approved faculty may delete an exam they own", () => {
  expect(authorize(approvedFaculty, "exam:delete", ownedExam)).toEqual({
    ok: true,
  });
});

test("deleting an exam owned by someone else is forbidden", () => {
  const someoneElsesExam = { creatorId: "other", deletedAt: null };
  expect(authorize(approvedFaculty, "exam:delete", someoneElsesExam)).toEqual({
    ok: false,
    status: 403,
    error: "You are not the creator of this exam",
  });
});

test("approved faculty may view results for an exam they own", () => {
  expect(authorize(approvedFaculty, "exam:results", ownedExam)).toEqual({
    ok: true,
  });
});

test("a non-faculty actor cannot view exam results", () => {
  const student = { id: "s1", role: "STUDENT" as const, facultyApproved: false };
  expect(authorize(student, "exam:results", ownedExam)).toEqual({
    ok: false,
    status: 403,
    error: "Only faculty members can view exam results",
  });
});

test("faculty cannot view results for an exam they do not own", () => {
  const someoneElsesExam = { creatorId: "other", deletedAt: null };
  expect(authorize(approvedFaculty, "exam:results", someoneElsesExam)).toEqual({
    ok: false,
    status: 403,
    error: "You are not the creator of this exam",
  });
});

test("viewing results for a missing exam is a not-found", () => {
  expect(authorize(approvedFaculty, "exam:results", null)).toEqual({
    ok: false,
    status: 404,
    error: "Exam not found",
  });
});

test("unapproved faculty viewing results are told approval is pending", () => {
  const pending = { id: "f2", role: "FACULTY" as const, facultyApproved: false };
  expect(authorize(pending, "exam:results", ownedExam)).toEqual({
    ok: false,
    status: 403,
    error:
      "Your faculty account is pending admin approval. You can use the teacher dashboard after an administrator activates your account.",
    code: "FACULTY_PENDING_APPROVAL",
  });
});

test("role is checked before resource existence (wrong role on a missing exam is 403)", () => {
  const student = { id: "s1", role: "STUDENT" as const, facultyApproved: false };
  expect(authorize(student, "exam:update", null)).toEqual({
    ok: false,
    status: 403,
    error: "Only faculty members can update exams",
  });
});

test("approved faculty may create a question on an exam they own", () => {
  expect(authorize(approvedFaculty, "question:create", ownedExam)).toEqual({
    ok: true,
  });
});

test("a non-faculty actor cannot create a question", () => {
  const student = { id: "s1", role: "STUDENT" as const, facultyApproved: false };
  expect(authorize(student, "question:create", ownedExam)).toEqual({
    ok: false,
    status: 403,
    error: "Only faculty members can add questions",
  });
});

test("approved faculty may update a question whose exam they own", () => {
  expect(authorize(approvedFaculty, "question:update", ownedExam)).toEqual({
    ok: true,
  });
});

test("a non-faculty actor cannot update a question", () => {
  const student = { id: "s1", role: "STUDENT" as const, facultyApproved: false };
  expect(authorize(student, "question:update", ownedExam)).toEqual({
    ok: false,
    status: 403,
    error: "Only faculty members can update questions",
  });
});

test("approved faculty may delete a question whose exam they own", () => {
  expect(authorize(approvedFaculty, "question:delete", ownedExam)).toEqual({
    ok: true,
  });
});

test("a non-faculty actor cannot delete a question", () => {
  const student = { id: "s1", role: "STUDENT" as const, facultyApproved: false };
  expect(authorize(student, "question:delete", ownedExam)).toEqual({
    ok: false,
    status: 403,
    error: "Only faculty members can delete questions",
  });
});

test("approved faculty may read questions of an exam they own", () => {
  expect(authorize(approvedFaculty, "question:read", ownedExam)).toEqual({
    ok: true,
  });
});

test("a non-faculty actor cannot read an exam's questions", () => {
  const student = { id: "s1", role: "STUDENT" as const, facultyApproved: false };
  expect(authorize(student, "question:read", ownedExam)).toEqual({
    ok: false,
    status: 403,
    error: "Only faculty members can view questions",
  });
});

test("a question on an exam owned by someone else is forbidden", () => {
  const someoneElsesExam = { creatorId: "other", deletedAt: null };
  expect(authorize(approvedFaculty, "question:update", someoneElsesExam)).toEqual({
    ok: false,
    status: 403,
    error: "You are not the creator of this exam",
  });
});

test("a missing actor is an authentication failure, not a forbidden one", () => {
  expect(authorize(null, "exam:create")).toEqual({
    ok: false,
    status: 401,
    error: "Account not found",
    code: "ACCOUNT_NOT_FOUND",
  });
});

test("an admin may perform an admin-only action", () => {
  const admin = { id: "a1", role: "ADMIN" as const, facultyApproved: false };
  expect(authorize(admin, "user:admin")).toEqual({ ok: true });
});

test("a non-admin actor cannot perform an admin-only action", () => {
  expect(authorize(approvedFaculty, "user:admin")).toEqual({
    ok: false,
    status: 403,
    error: "Unauthorized",
  });
});

test("a null actor on an admin-only action is an authentication failure", () => {
  expect(authorize(null, "user:admin")).toEqual({
    ok: false,
    status: 401,
    error: "Account not found",
    code: "ACCOUNT_NOT_FOUND",
  });
});

test("an unapproved faculty member is told approval is pending", () => {
  const pending = { id: "f2", role: "FACULTY" as const, facultyApproved: false };
  expect(authorize(pending, "exam:create")).toEqual({
    ok: false,
    status: 403,
    error:
      "Your faculty account is pending admin approval. You can use the teacher dashboard after an administrator activates your account.",
    code: "FACULTY_PENDING_APPROVAL",
  });
});

// ─── Test-case actions (ownership reaches the exam via test-case → question) ──

test("approved faculty may create a test case on an exam they own", () => {
  expect(authorize(approvedFaculty, "testcase:create", ownedExam)).toEqual({
    ok: true,
  });
});

test("a non-faculty actor cannot create a test case", () => {
  const student = { id: "s1", role: "STUDENT" as const, facultyApproved: false };
  expect(authorize(student, "testcase:create", ownedExam)).toEqual({
    ok: false,
    status: 403,
    error: "Only faculty members can add test cases",
  });
});

test("approved faculty may update a test case on an exam they own", () => {
  expect(authorize(approvedFaculty, "testcase:update", ownedExam)).toEqual({
    ok: true,
  });
});

test("a non-faculty actor cannot update a test case", () => {
  const student = { id: "s1", role: "STUDENT" as const, facultyApproved: false };
  expect(authorize(student, "testcase:update", ownedExam)).toEqual({
    ok: false,
    status: 403,
    error: "Only faculty members can update test cases",
  });
});

test("approved faculty may delete a test case on an exam they own", () => {
  expect(authorize(approvedFaculty, "testcase:delete", ownedExam)).toEqual({
    ok: true,
  });
});

test("a non-faculty actor cannot delete a test case", () => {
  const student = { id: "s1", role: "STUDENT" as const, facultyApproved: false };
  expect(authorize(student, "testcase:delete", ownedExam)).toEqual({
    ok: false,
    status: 403,
    error: "Only faculty members can delete test cases",
  });
});

test("faculty cannot manage a test case whose owning exam is someone else's", () => {
  const someoneElsesExam = { creatorId: "other", deletedAt: null };
  expect(
    authorize(approvedFaculty, "testcase:create", someoneElsesExam),
  ).toEqual({
    ok: false,
    status: 403,
    error: "You are not the creator of this exam",
  });
});

test("managing a test case whose owning exam is missing/soft-deleted is a 404", () => {
  expect(authorize(approvedFaculty, "testcase:update", null)).toEqual({
    ok: false,
    status: 404,
    error: "Exam not found",
  });
});

// ─── Student role-gate (issue #13) ───────────────────────────────────────────
// Student actions are pure role-gates: { role: STUDENT, requireApproval: false,
// ownership: "none" }. The exam-time preconditions stay inline in the handlers.

const student = { id: "s1", role: "STUDENT" as const, facultyApproved: true };

// Every student route is the same pure role-gate; only the denial message
// differs. Table-driven across the action × {student, non-student, null actor}.
const studentActions = [
  { action: "student:enter" as const, message: "Only students can enter an exam room" },
  { action: "student:draft" as const, message: "Only students can save exam drafts" },
  { action: "student:violation" as const, message: "Only students can report violations" },
  { action: "student:run" as const, message: "Only students can run code from the exam room" },
  { action: "student:submit" as const, message: "Only students can submit an exam" },
];

for (const { action, message } of studentActions) {
  test(`a student is allowed ${action}`, () => {
    expect(authorize(student, action)).toEqual({ ok: true });
  });

  test(`a non-student is forbidden ${action}`, () => {
    expect(authorize(approvedFaculty, action)).toEqual({
      ok: false,
      status: 403,
      error: message,
    });
  });

  test(`a null actor on ${action} is an authentication failure`, () => {
    expect(authorize(null, action)).toEqual({
      ok: false,
      status: 401,
      error: "Account not found",
      code: "ACCOUNT_NOT_FOUND",
    });
  });
}
