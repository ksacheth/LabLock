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
