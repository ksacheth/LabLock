// Faculty-approval guard shared across protected handlers.
import type { Response } from "express";

const FACULTY_PENDING_MSG =
  "Your faculty account is pending admin approval. You can use the teacher dashboard after an administrator activates your account.";

/** Returns true if the response was already sent (caller should return). */
function rejectUnapprovedFaculty(
  res: Response,
  user: { role: string; facultyApproved: boolean } | null,
  notFacultyMessage: string,
): boolean {
  if (!user || user.role !== "FACULTY") {
    res.status(403).json({ error: notFacultyMessage });
    return true;
  }
  if (!user.facultyApproved) {
    res.status(403).json({
      error: FACULTY_PENDING_MSG,
      code: "FACULTY_PENDING_APPROVAL",
    });
    return true;
  }
  return false;
}

export { FACULTY_PENDING_MSG, rejectUnapprovedFaculty };
