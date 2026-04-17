const EXAM_ENTRY_CONSENT_PREFIX = "student_exam_entry_consent:";

export function buildStudentExamRoomPath(examId: string) {
  return `/student/exams/${examId}`;
}

export function buildStudentExamInstructionsPath(examId: string) {
  return `/student/exams/${examId}/instructions`;
}

function getExamEntryConsentKey(examId: string) {
  return `${EXAM_ENTRY_CONSENT_PREFIX}${examId}`;
}

export function markExamEntryConsent(examId: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    getExamEntryConsentKey(examId),
    new Date().toISOString(),
  );
}

export function hasExamEntryConsent(examId: string) {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(getExamEntryConsentKey(examId)) !== null;
}
