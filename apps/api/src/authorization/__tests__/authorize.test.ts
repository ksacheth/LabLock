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

test("role is checked before resource existence (wrong role on a missing exam is 403)", () => {
  const student = { id: "s1", role: "STUDENT" as const, facultyApproved: false };
  expect(authorize(student, "exam:update", null)).toEqual({
    ok: false,
    status: 403,
    error: "Only faculty members can update exams",
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
