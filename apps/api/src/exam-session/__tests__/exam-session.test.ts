import { test, expect } from "bun:test";
import { evaluateSession } from "../exam-session.ts";
import type { ExamSnapshot, AttemptSnapshot } from "../exam-session.ts";

const NOW = new Date("2026-01-01T12:00:00Z");

function exam(over: Partial<ExamSnapshot> = {}): ExamSnapshot {
  return {
    id: "e1",
    title: "Algorithms",
    description: null,
    startTime: new Date("2026-01-01T00:00:00Z"),
    endTime: new Date("2026-01-02T00:00:00Z"),
    durationMin: 60,
    isActive: true,
    deletedAt: null,
    eligibilities: [],
    ...over,
  };
}

function attempt(over: Partial<AttemptSnapshot> = {}): AttemptSnapshot {
  return {
    id: "a1",
    status: "IN_PROGRESS",
    startedAt: NOW,
    completedAt: null,
    retakeNumber: 0,
    score: null,
    ipAddress: null,
    ...over,
  };
}

const student = { batchId: "b1", departmentId: "d1" };

test("enter: an eligible student of a live, in-window exam with no prior attempt is admitted", () => {
  const result = evaluateSession("enter", {
    exam: exam(),
    attempt: null,
    student,
    now: NOW,
  });
  expect(result.ok).toBe(true);
});

test("enter: a missing exam is a not-found refusal", () => {
  const result = evaluateSession("enter", {
    exam: null,
    attempt: null,
    student,
    now: NOW,
  });
  expect(result).toEqual({
    ok: false,
    status: 404,
    error: "Exam not found",
    code: "EXAM_NOT_FOUND",
  });
});

test("enter: a soft-deleted exam is a not-found refusal", () => {
  const result = evaluateSession("enter", {
    exam: exam({ deletedAt: new Date("2026-01-01T01:00:00Z") }),
    attempt: null,
    student,
    now: NOW,
  });
  expect(result).toEqual({
    ok: false,
    status: 404,
    error: "Exam not found",
    code: "EXAM_NOT_FOUND",
  });
});

test("enter: a student outside the exam's eligibility is refused", () => {
  const result = evaluateSession("enter", {
    exam: exam({ eligibilities: [{ batchId: "other-batch", departmentId: null }] }),
    attempt: null,
    student,
    now: NOW,
  });
  expect(result).toEqual({
    ok: false,
    status: 403,
    error: "You are not eligible to enter this exam room",
    code: "INELIGIBLE",
  });
});

test("enter: a student matching an eligibility batch is admitted", () => {
  const result = evaluateSession("enter", {
    exam: exam({ eligibilities: [{ batchId: "b1", departmentId: null }] }),
    attempt: null,
    student,
    now: NOW,
  });
  expect(result.ok).toBe(true);
});

test("enter: a student matching an eligibility department is admitted", () => {
  const result = evaluateSession("enter", {
    exam: exam({ eligibilities: [{ batchId: null, departmentId: "d1" }] }),
    attempt: null,
    student,
    now: NOW,
  });
  expect(result.ok).toBe(true);
});

test("enter: an exam that is not live is refused", () => {
  const result = evaluateSession("enter", {
    exam: exam({ isActive: false }),
    attempt: null,
    student,
    now: NOW,
  });
  expect(result).toEqual({
    ok: false,
    status: 400,
    error: "This exam is not live right now",
    code: "NOT_ACTIVE",
  });
});

test("enter: an exam before its start time is refused", () => {
  const result = evaluateSession("enter", {
    exam: exam({ startTime: new Date("2026-01-01T18:00:00Z") }),
    attempt: null,
    student,
    now: NOW,
  });
  expect(result).toEqual({
    ok: false,
    status: 400,
    error: "This exam has not started yet",
    code: "NOT_STARTED",
  });
});

test("enter: an exam past its end time is refused", () => {
  const result = evaluateSession("enter", {
    exam: exam({ endTime: new Date("2026-01-01T06:00:00Z") }),
    attempt: null,
    student,
    now: NOW,
  });
  expect(result).toEqual({
    ok: false,
    status: 400,
    error: "This exam has already ended",
    code: "ENDED",
  });
});

test("enter: a student who already completed the exam is refused", () => {
  const result = evaluateSession("enter", {
    exam: exam(),
    attempt: attempt({ status: "COMPLETED" }),
    student,
    now: NOW,
  });
  expect(result).toEqual({
    ok: false,
    status: 400,
    error: "You have already submitted this exam",
    code: "ALREADY_SUBMITTED",
  });
});

test("enter: a disqualified student is refused", () => {
  const result = evaluateSession("enter", {
    exam: exam(),
    attempt: attempt({ status: "DISQUALIFIED" }),
    student,
    now: NOW,
  });
  expect(result).toEqual({
    ok: false,
    status: 403,
    error: "Your exam attempt has been disqualified",
    code: "DISQUALIFIED",
  });
});

test("enter: a student with an in-progress attempt is admitted to resume it", () => {
  const inProgress = attempt({ status: "IN_PROGRESS" });
  const result = evaluateSession("enter", {
    exam: exam(),
    attempt: inProgress,
    student,
    now: NOW,
  });
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.attempt).toEqual(inProgress);
});

// ─── draft + run: coarse window, require IN_PROGRESS, no eligibility (#24) ────

test("draft: an in-progress student in an open window is admitted", () => {
  const result = evaluateSession("draft", {
    exam: exam(),
    attempt: attempt({ status: "IN_PROGRESS" }),
    student,
    now: NOW,
  });
  expect(result.ok).toBe(true);
});

test("draft: a student without an in-progress attempt must enter the room first", () => {
  const result = evaluateSession("draft", {
    exam: exam(),
    attempt: null,
    student,
    now: NOW,
  });
  expect(result).toEqual({
    ok: false,
    status: 400,
    error: "Enter the exam room before saving code drafts",
    code: "NOT_IN_PROGRESS",
  });
});

test("draft: a closed window is refused with the drafts wording", () => {
  const result = evaluateSession("draft", {
    exam: exam({ isActive: false }),
    attempt: attempt({ status: "IN_PROGRESS" }),
    student,
    now: NOW,
  });
  expect(result).toEqual({
    ok: false,
    status: 400,
    error: "This exam room is not accepting code drafts now",
    code: "WINDOW_CLOSED",
  });
});

test("draft: a missing exam is a not-found refusal", () => {
  const result = evaluateSession("draft", {
    exam: null,
    attempt: attempt({ status: "IN_PROGRESS" }),
    student,
    now: NOW,
  });
  expect(result).toEqual({
    ok: false,
    status: 404,
    error: "Exam not found",
    code: "EXAM_NOT_FOUND",
  });
});

test("draft: eligibility is NOT checked (an in-progress attempt is enough)", () => {
  const result = evaluateSession("draft", {
    exam: exam({ eligibilities: [{ batchId: "other", departmentId: null }] }),
    attempt: attempt({ status: "IN_PROGRESS" }),
    student,
    now: NOW,
  });
  expect(result.ok).toBe(true);
});

test("run: a student without an in-progress attempt must enter the room first", () => {
  const result = evaluateSession("run", {
    exam: exam(),
    attempt: null,
    student,
    now: NOW,
  });
  expect(result).toEqual({
    ok: false,
    status: 400,
    error: "Enter the exam room before running code",
    code: "NOT_IN_PROGRESS",
  });
});

test("run: a closed window is refused with the runs wording", () => {
  const result = evaluateSession("run", {
    exam: exam({ endTime: new Date("2026-01-01T06:00:00Z") }),
    attempt: attempt({ status: "IN_PROGRESS" }),
    student,
    now: NOW,
  });
  expect(result).toEqual({
    ok: false,
    status: 400,
    error: "This exam room is not accepting code runs now",
    code: "WINDOW_CLOSED",
  });
});

test("run: an in-progress student in an open window is admitted", () => {
  const result = evaluateSession("run", {
    exam: exam(),
    attempt: attempt({ status: "IN_PROGRESS" }),
    student,
    now: NOW,
  });
  expect(result.ok).toBe(true);
});

// ─── submit: no window check, resubmit carries score, status matrix (#25) ─────

test("submit: an in-progress attempt may submit even after the window closed", () => {
  const result = evaluateSession("submit", {
    exam: exam({ endTime: new Date("2026-01-01T06:00:00Z") }), // already ended
    attempt: attempt({ status: "IN_PROGRESS" }),
    student,
    now: NOW,
  });
  expect(result.ok).toBe(true);
});

test("submit: a missing exam is a not-found refusal", () => {
  const result = evaluateSession("submit", {
    exam: null,
    attempt: attempt({ status: "IN_PROGRESS" }),
    student,
    now: NOW,
  });
  expect(result).toEqual({
    ok: false,
    status: 404,
    error: "Exam not found",
    code: "EXAM_NOT_FOUND",
  });
});

test("submit: no attempt is a 400", () => {
  const result = evaluateSession("submit", {
    exam: exam(),
    attempt: null,
    student,
    now: NOW,
  });
  expect(result).toEqual({
    ok: false,
    status: 400,
    error: "No attempt found for this exam",
    code: "NO_ATTEMPT",
  });
});

test("submit: a disqualified attempt is a 403", () => {
  const result = evaluateSession("submit", {
    exam: exam(),
    attempt: attempt({ status: "DISQUALIFIED" }),
    student,
    now: NOW,
  });
  expect(result).toEqual({
    ok: false,
    status: 403,
    error: "This attempt has been disqualified",
    code: "DISQUALIFIED",
  });
});

test("submit: resubmitting a completed exam returns the score in details", () => {
  const result = evaluateSession("submit", {
    exam: exam(),
    attempt: attempt({ status: "COMPLETED", score: 42 }),
    student,
    now: NOW,
  });
  expect(result).toEqual({
    ok: false,
    status: 400,
    error: "This exam has already been submitted",
    code: "ALREADY_SUBMITTED",
    details: { score: 42 },
  });
});

test("submit: an attempt that is neither in-progress nor terminal must be in progress", () => {
  const result = evaluateSession("submit", {
    exam: exam(),
    attempt: attempt({ status: "ENROLLED" }),
    student,
    now: NOW,
  });
  expect(result).toEqual({
    ok: false,
    status: 400,
    error: "Exam must be in progress to submit",
    code: "NOT_IN_PROGRESS",
  });
});

// ─── violation: no exam, no window, just an in-progress attempt (#25) ─────────

test("violation: an in-progress attempt is admitted with no exam loaded", () => {
  const result = evaluateSession("violation", {
    exam: null,
    attempt: attempt({ status: "IN_PROGRESS" }),
    student,
    now: NOW,
  });
  expect(result.ok).toBe(true);
});

test("violation: no in-progress attempt is a 404", () => {
  const result = evaluateSession("violation", {
    exam: null,
    attempt: null,
    student,
    now: NOW,
  });
  expect(result).toEqual({
    ok: false,
    status: 404,
    error: "No active IN_PROGRESS attempt found",
    code: "NO_ACTIVE_ATTEMPT",
  });
});

test("violation: a completed attempt is not active", () => {
  const result = evaluateSession("violation", {
    exam: null,
    attempt: attempt({ status: "COMPLETED" }),
    student,
    now: NOW,
  });
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.code).toBe("NO_ACTIVE_ATTEMPT");
});
